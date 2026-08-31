export const config = { runtime: 'edge' };

interface ATTransactionData {
  requestId: string;
  sourceType: string;
  source: string;
  value: string;
  providerRefId?: string;
  status: string;
  description: string;
  transactionDate: string;
  requestMetadata?: { username?: string; productName?: string };
}

interface ATPaymentNotification {
  transactionData: ATTransactionData;
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
}

async function verifyATSignature(rawBody: string, signature: string, apiKey: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

function parseKesAmount(value: string): number | null {
  const match = value.replace(/,/g, '').match(/[\d.]+/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
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
    `${url}/rest/v1/payment_orders?provider=eq.africastalking&provider_reference=eq.${encodeURIComponent(providerReference)}&select=order_id,community_id,status,amount_expected,currency&limit=1`,
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

  const apiKey = process.env.AT_API_KEY?.trim();
  if (!apiKey) return json({ error: 'webhook_not_configured' }, { status: 503 });

  const rawBody = await req.text();
  const signature = req.headers.get('x-at-signature') ?? '';

  if (!signature || !await verifyATSignature(rawBody, signature, apiKey)) {
    console.warn('[at-webhook] Signature verification failed');
    return json({ error: 'forbidden' }, { status: 403 });
  }

  let notification: ATPaymentNotification;
  try {
    notification = JSON.parse(rawBody) as ATPaymentNotification;
  } catch {
    return json({ error: 'invalid_request', message: 'Body must be valid JSON' }, { status: 400 });
  }

  const tx = notification?.transactionData;
  if (!tx?.requestId || !tx.status) {
    return json({ error: 'invalid_request', message: 'Missing transactionData fields' }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Acknowledge without persisting when Supabase is not configured (dev/preview).
  if (!supabaseUrl || !serviceKey) {
    console.info('[at-webhook] Supabase not configured — ignoring', tx.requestId, tx.status);
    return json({ received: true });
  }

  const order = await findOrder(supabaseUrl, serviceKey, tx.requestId);
  if (!order) {
    console.warn('[at-webhook] No order for reference', tx.requestId);
    // Return 200 so AT doesn't keep retrying for an unknown reference.
    return json({ received: true, matched: false });
  }

  const atStatus = tx.status.toLowerCase();
  if (atStatus === 'success') {
    if (order.status === 'PAYMENT_CONFIRMED' || order.status === 'PROVIDER_CONFIRMED' || order.status === 'INDEXER_CONFIRMED' || order.status === 'RECONCILED') {
      return json({ received: true, changed: false });
    }
    const amount = parseKesAmount(tx.value);
    if (amount === null || !Number.isFinite(amount)) {
      return json({ error: 'invalid_amount', message: 'Unparseable payment amount' }, { status: 422 });
    }

    const expected = Number(order.amount_expected || 0);
    if (amount < expected) {
      await patchOrder(supabaseUrl, serviceKey, order.order_id, {
        status: 'AMOUNT_MISMATCH',
        amount_received: amount,
      });
      return json({ received: true, changed: true, status: 'AMOUNT_MISMATCH' }, { status: 422 });
    }

    await patchOrder(supabaseUrl, serviceKey, order.order_id, {
      status: 'PAYMENT_CONFIRMED',
      amount_received: amount,
      confirmed_at: new Date().toISOString(),
    });

    if (order.community_id && amount > 0) {
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
              body: JSON.stringify({ fund_balance: currentBal + amount }),
            },
          );
        }
      } catch {
        // Non-fatal
      }
    }

    return json({ received: true, changed: true, status: 'PAYMENT_CONFIRMED' });
  }

  if (atStatus === 'failed' || atStatus === 'cancelled') {
    if (order.status === 'PAYMENT_FAILED') return json({ received: true, changed: false });
    await patchOrder(supabaseUrl, serviceKey, order.order_id, { status: 'PAYMENT_FAILED' });
    return json({ received: true, changed: true, status: 'PAYMENT_FAILED' });
  }

  return json({ received: true, changed: false, atStatus });
}
