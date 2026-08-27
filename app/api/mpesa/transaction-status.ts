export const config = { runtime: 'nodejs' };

import { requestTransactionStatusQuery } from '../../../packages/integrations/src/daraja';

interface PaymentOrderRow {
  order_id: string;
  status: string;
}

function supabaseHeaders(serviceKey: string): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json',
  };
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
}

async function findOrderByReference(
  url: string,
  serviceKey: string,
  transactionId: string,
): Promise<PaymentOrderRow | null> {
  const res = await fetch(
    `${url}/rest/v1/payment_orders?provider_reference=eq.${encodeURIComponent(transactionId)}&select=order_id,status&limit=1`,
    { headers: supabaseHeaders(serviceKey) },
  );
  if (!res.ok) throw new Error('status_query_lookup_failed');
  const rows = (await res.json().catch(() => [])) as PaymentOrderRow[];
  return rows[0] ?? null;
}

async function setOrderStatusQuerySent(
  url: string,
  serviceKey: string,
  orderId: string,
): Promise<void> {
  const res = await fetch(
    `${url}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(serviceKey),
      body: JSON.stringify({ status: 'STATUS_QUERY_SENT' }),
    },
  );
  if (!res.ok) throw new Error('status_query_persist_failed');
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.PAYMENT_ADAPTER_PROXY_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!secret) return false; // Fail-closed: MUST be configured
  const auth = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (auth.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= auth.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, { status: 405 });
  }

  if (!isAuthorized(req)) {
    return json({ error: 'unauthorized', message: 'Unauthorized status query proxy call.' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { transactionId?: string; sandbox?: boolean; remarks?: string };
    const transactionId = body.transactionId?.trim();
    if (!transactionId) {
      return json({ error: 'invalid_request', message: 'transactionId is required' }, { status: 400 });
    }

    const result = await requestTransactionStatusQuery({
      transactionId,
      remarks: body.remarks ?? 'Verification of contribution payment',
      resultUrl: process.env.MPESA_STATUS_RESULT_URL?.trim(),
      queueTimeoutUrl: process.env.MPESA_STATUS_TIMEOUT_URL?.trim(),
      sandbox: body.sandbox ?? false,
    });

    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
    }

    const order = await findOrderByReference(supabaseUrl, serviceKey, transactionId);
    if (!order) {
      return json({ ok: false, error: 'payment_order_not_found' }, { status: 404 });
    }

    const alreadyInFlight = order.status === 'STATUS_QUERY_SENT';
    const alreadySubmitted = order.status === 'ATTESTATION_SUBMITTED';
    if (!alreadyInFlight && !alreadySubmitted) {
      await setOrderStatusQuerySent(supabaseUrl, serviceKey, order.order_id);
    }

    return json({
      ok: true,
      queryAccepted: true,
      awaitingResult: true,
      mode: result.mode,
      transactionId: result.transactionId,
      conversationId: result.conversationId,
      originatorConversationId: result.originatorConversationId,
      acceptedAt: result.acceptedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'transaction_status_query_failed';
    return json({ ok: false, queryAccepted: false, error: message }, { status: 502 });
  }
}
