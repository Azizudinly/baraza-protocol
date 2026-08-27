export const config = { runtime: 'edge' };

interface KotaniWebhookPayload {
  reference: string;
  status: string;
  amount?: number;
  kes_amount?: number;
  currency?: string;
  phone?: string;
  timestamp?: string;
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
}

async function verifyKotaniSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

function supabaseHeaders(serviceKey: string): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json',
  };
}

async function findOrder(
  url: string,
  serviceKey: string,
  providerReference: string,
): Promise<{ order_id: string; community_id?: string; status: string; amount_expected: number; currency: string } | null> {
  const res = await fetch(
    `${url}/rest/v1/payment_orders?provider=eq.kotani&provider_reference=eq.${encodeURIComponent(providerReference)}&select=order_id,community_id,status,amount_expected,currency&limit=1`,
    { headers: supabaseHeaders(serviceKey) },
  );
  if (!res.ok) return null;
  const rows = (await res.json().catch(() => [])) as Array<{
    order_id: string; community_id?: string; status: string; amount_expected: number; currency: string;
  }>;
  return rows[0] ?? null;
}

async function patchOrder(
  url: string,
  serviceKey: string,
  orderId: string,
  update: Record<string, unknown>,
): Promise<boolean> {
  const res = await fetch(
    `${url}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(serviceKey),
      body: JSON.stringify(update),
    },
  );
  return res.ok;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });

  const webhookSecret = process.env.KOTANI_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) return json({ error: 'webhook_not_configured' }, { status: 503 });

  const rawBody = await req.text();
  const signature = req.headers.get('x-kotani-signature') ?? '';

  if (!signature || !await verifyKotaniSignature(rawBody, signature, webhookSecret)) {
    console.warn('[kotani-webhook] Signature verification failed');
    return json({ error: 'forbidden' }, { status: 403 });
  }

  let payload: KotaniWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as KotaniWebhookPayload;
  } catch {
    return json({ error: 'invalid_request', message: 'Body must be valid JSON' }, { status: 400 });
  }

  if (!payload?.reference || !payload.status) {
    return json({ error: 'invalid_request', message: 'reference and status are required' }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.info('[kotani-webhook] Supabase not configured — ignoring', payload.reference, payload.status);
    return json({ received: true });
  }

  const order = await findOrder(supabaseUrl, serviceKey, payload.reference);
  if (!order) {
    console.warn('[kotani-webhook] No order for reference', payload.reference);
    return json({ received: true, matched: false });
  }

  const kotaniStatus = payload.status.toLowerCase();

  if (kotaniStatus === 'completed') {
    if (order.status === 'PAYMENT_CONFIRMED' || order.status === 'PROVIDER_CONFIRMED' || order.status === 'INDEXER_CONFIRMED' || order.status === 'RECONCILED') {
      return json({ received: true, changed: false });
    }

    const expectedCurrency = (order.currency || 'KES').toUpperCase();
    const paidCurrency = (payload.currency || 'KES').toUpperCase();
    const amountReceived = payload.kes_amount ?? payload.amount ?? null;

    if (expectedCurrency !== paidCurrency) {
      await patchOrder(supabaseUrl, serviceKey, order.order_id, {
        status: 'AMOUNT_MISMATCH',
        amount_received: amountReceived !== null ? Number(amountReceived) : null,
      });
      return json({ error: 'currency_mismatch', status: 'AMOUNT_MISMATCH' }, { status: 422 });
    }

    if (amountReceived === null || !Number.isFinite(Number(amountReceived))) {
      return json({ error: 'invalid_amount', message: 'Valid payment amount is required' }, { status: 422 });
    }

    const numAmount = Number(amountReceived);
    const numExpected = Number(order.amount_expected || 0);

    if (numAmount < numExpected) {
      await patchOrder(supabaseUrl, serviceKey, order.order_id, {
        status: 'AMOUNT_MISMATCH',
        amount_received: numAmount,
      });
      return json({ received: true, changed: true, status: 'AMOUNT_MISMATCH' }, { status: 422 });
    }

    await patchOrder(supabaseUrl, serviceKey, order.order_id, {
      status: 'PAYMENT_CONFIRMED',
      amount_received: numAmount,
      confirmed_at: new Date().toISOString(),
    });

    if (order.community_id && numAmount > 0) {
      try {
        const commRes = await fetch(
          `${supabaseUrl}/rest/v1/communities?id=eq.${encodeURIComponent(order.community_id)}&select=fund_balance&limit=1`,
          { headers: supabaseHeaders(serviceKey) },
        );
        if (commRes.ok) {
          const comms = (await commRes.json().catch(() => [])) as Array<{ fund_balance?: number }>;
          const currentBal = Number(comms[0]?.fund_balance || 0);
          await fetch(
            `${supabaseUrl}/rest/v1/communities?id=eq.${encodeURIComponent(order.community_id)}`,
            {
              method: 'PATCH',
              headers: supabaseHeaders(serviceKey),
              body: JSON.stringify({ fund_balance: currentBal + numAmount }),
            },
          );
        }
      } catch {
        // Non-fatal
      }
    }

    return json({ received: true, changed: true, status: 'PAYMENT_CONFIRMED' });
  }

  if (kotaniStatus === 'failed' || kotaniStatus === 'cancelled' || kotaniStatus === 'rejected') {
    if (order.status === 'PAYMENT_FAILED') return json({ received: true, changed: false });
    await patchOrder(supabaseUrl, serviceKey, order.order_id, { status: 'PAYMENT_FAILED' });
    return json({ received: true, changed: true, status: 'PAYMENT_FAILED' });
  }

  if (kotaniStatus === 'expired') {
    if (order.status === 'PAYMENT_EXPIRED') return json({ received: true, changed: false });
    await patchOrder(supabaseUrl, serviceKey, order.order_id, { status: 'PAYMENT_EXPIRED' });
    return json({ received: true, changed: true, status: 'PAYMENT_EXPIRED' });
  }

  return json({ received: true, changed: false, kotaniStatus });
}
