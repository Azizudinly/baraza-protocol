export const config = { runtime: 'edge' };

import {
  extractTransactionIdFromResult,
  findOrderByProviderReference,
  hasPathSecret,
  isIpAllowed,
  json,
  patchOrderStatus,
} from './status-callback-shared.js';

interface DarajaTimeoutBody {
  Result?: {
    TransactionID?: string;
    ResultParameters?: {
      ResultParameter?: Array<{ Key?: string; Value?: string | number }>;
    };
  };
  TransactionID?: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });

  const pathSecret = process.env.MPESA_STATUS_TIMEOUT_PATH_SECRET?.trim();
  const allowlist = process.env.MPESA_STATUS_CALLBACK_IP_ALLOWLIST;
  if (!hasPathSecret(req, pathSecret) || !isIpAllowed(req, allowlist)) {
    return json({ error: 'forbidden' }, { status: 403 });
  }

  let body: DarajaTimeoutBody;
  try {
    body = (await req.json()) as DarajaTimeoutBody;
  } catch {
    return json({ error: 'invalid_request', message: 'Body must be valid JSON' }, { status: 400 });
  }

  const result = body.Result ?? null;
  const transactionId =
    (result ? extractTransactionIdFromResult(result) : null) ||
    (typeof body.TransactionID === 'string' && body.TransactionID.trim() ? body.TransactionID.trim() : null);

  if (!transactionId) {
    return json({ error: 'invalid_request', message: 'Missing transaction identifier' }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json({ error: 'supabase_not_configured' }, { status: 503 });

  const order = await findOrderByProviderReference(supabaseUrl, serviceKey, transactionId);
  if (!order) return json({ received: true, matched: false });

  if (order.status === 'PROVIDER_CONFIRMED') {
    return json({ received: true, changed: false, retriable: true, status: order.status });
  }
  if (order.status !== 'STATUS_QUERY_SENT') {
    return json({ error: 'invalid_transition', from: order.status, to: 'PROVIDER_CONFIRMED' }, { status: 409 });
  }

  await patchOrderStatus(supabaseUrl, serviceKey, order.order_id, 'PROVIDER_CONFIRMED');
  return json({ received: true, changed: true, retriable: true, status: 'PROVIDER_CONFIRMED' });
}
