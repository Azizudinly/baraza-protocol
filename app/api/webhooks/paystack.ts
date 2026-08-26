export const config = { runtime: 'edge' };

interface PaystackWebhookEvent {
  event: string;
  data: {
    id: number;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    gateway_response?: string;
    paid_at?: string;
    customer?: {
      email?: string;
      phone?: string;
    };
    metadata?: {
      order_id?: string;
    };
  };
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
}

function bad(message: string, status = 400): Response {
  return json({ error: 'invalid_request', message }, { status });
}

async function verifyPaystackSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign'],
    );
    const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
    const expected = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');

    if (expected.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

function supabaseHeaders(serviceKey: string): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json',
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type, x-paystack-signature',
      },
    });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });

  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return json({ error: 'paystack_webhook_not_configured' }, { status: 503 });

  const signature = req.headers.get('x-paystack-signature');
  if (!signature) return bad('Missing x-paystack-signature header.', 401);

  const rawBody = await req.text();
  const isValid = await verifyPaystackSignature(rawBody, signature, secret);
  if (!isValid) return bad('Invalid Paystack HMAC-SHA512 webhook signature.', 401);

  let eventPayload: PaystackWebhookEvent;
  try {
    eventPayload = JSON.parse(rawBody) as PaystackWebhookEvent;
  } catch {
    return bad('Invalid webhook payload JSON.');
  }

  // We handle charge.success events
  if (eventPayload.event !== 'charge.success') {
    return json({ ok: true, ignored: true, reason: `Ignored event ${eventPayload.event}` }, { status: 200 });
  }

  const orderId = eventPayload.data.metadata?.order_id || eventPayload.data.reference;
  if (!orderId) {
    return bad('Webhook payload lacks reference / order_id.');
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return json({ ok: false, message: 'Supabase not configured' }, { status: 500 });
  }

  // Query order
  const getRes = await fetch(
    `${supabaseUrl}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}&select=order_id,status,amount_expected,currency&limit=1`,
    { headers: supabaseHeaders(serviceKey) },
  );
  if (!getRes.ok) return json({ ok: false, message: 'Order lookup failed' }, { status: 502 });

  const rows = (await getRes.json().catch(() => [])) as Array<{
    order_id: string; status: string; amount_expected: number; currency: string;
  }>;
  const order = rows[0];

  if (!order) {
    return json({ ok: true, warning: `Order ${orderId} not found in database.` }, { status: 200 });
  }

  // Idempotent: already confirmed
  if (order.status === 'PROVIDER_CONFIRMED' || order.status === 'INDEXER_CONFIRMED' || order.status === 'RECONCILED') {
    return json({ ok: true, message: `Order ${orderId} already in status ${order.status}.` }, { status: 200 });
  }

  // Patch status to PROVIDER_CONFIRMED
  const patchRes = await fetch(
    `${supabaseUrl}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}`,
    {
      method: 'PATCH',
      headers: {
        ...supabaseHeaders(serviceKey),
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        status: 'PROVIDER_CONFIRMED',
        provider: 'paystack',
        provider_reference: String(eventPayload.data.id),
        paid_at: eventPayload.data.paid_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    },
  );

  if (!patchRes.ok) {
    return json({ ok: false, message: 'Failed to update order status.' }, { status: 500 });
  }

  return json({
    ok: true,
    orderId,
    status: 'PROVIDER_CONFIRMED',
    provider: 'paystack',
  }, { status: 200 });
}
