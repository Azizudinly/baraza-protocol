export const config = { runtime: 'edge' };

import {
  extractTransactionIdFromResult,
  findOrderByProviderReference,
  hasPathSecret,
  isIpAllowed,
  json,
  patchOrderStatus,
} from './status-callback-shared';

interface DarajaStatusResultBody {
  Result?: {
    ResultCode?: number | string;
    ResultDesc?: string;
    TransactionID?: string;
    ResultParameters?: {
      ResultParameter?: Array<{ Key?: string; Value?: string | number }>;
    };
  };
}

function parseResultCode(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });

  const pathSecret = process.env.MPESA_STATUS_RESULT_PATH_SECRET?.trim();
  const allowlist = process.env.MPESA_STATUS_CALLBACK_IP_ALLOWLIST;
  if (!hasPathSecret(req, pathSecret) || !isIpAllowed(req, allowlist)) {
    return json({ error: 'forbidden' }, { status: 403 });
  }

  let body: DarajaStatusResultBody;
  try {
    body = (await req.json()) as DarajaStatusResultBody;
  } catch {
    return json({ error: 'invalid_request', message: 'Body must be valid JSON' }, { status: 400 });
  }

  const result = body.Result;
  const resultCode = parseResultCode(result?.ResultCode);
  if (!result || resultCode === null) {
    return json({ error: 'invalid_request', message: 'Missing Result.ResultCode' }, { status: 400 });
  }

  const transactionId = extractTransactionIdFromResult(result);
  if (!transactionId) {
    return json({ error: 'invalid_request', message: 'Missing transaction identifier' }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json({ error: 'supabase_not_configured' }, { status: 503 });

  const order = await findOrderByProviderReference(supabaseUrl, serviceKey, transactionId);
  if (!order) return json({ received: true, matched: false });

  if (resultCode === 0) {
    if (order.status === 'ATTESTATION_SUBMITTED') {
      return json({ received: true, changed: false, idempotent: true, status: order.status });
    }
    if (order.status !== 'STATUS_QUERY_SENT') {
      return json({ error: 'invalid_transition', from: order.status, to: 'ATTESTATION_SUBMITTED' }, { status: 409 });
    }
    await patchOrderStatus(supabaseUrl, serviceKey, order.order_id, 'ATTESTATION_SUBMITTED');
    return json({ received: true, changed: true, status: 'ATTESTATION_SUBMITTED' });
  }

  if (order.status !== 'PROVIDER_CONFIRMED') {
    await patchOrderStatus(supabaseUrl, serviceKey, order.order_id, 'PROVIDER_CONFIRMED');
    return json({
      received: true,
      changed: true,
      retriable: true,
      resultCode,
      resultDesc: result.ResultDesc ?? null,
      status: 'PROVIDER_CONFIRMED',
    });
  }

  return json({
    received: true,
    changed: false,
    retriable: true,
    resultCode,
    resultDesc: result.ResultDesc ?? null,
    status: 'PROVIDER_CONFIRMED',
  });
}
