export const config = { runtime: 'edge' };

interface PaystackInitRequest {
  action: 'initialize';
  orderId: string;
  email: string;
  amountKes: number;
  currency?: string;
  callbackUrl?: string;
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

function isAuthorized(req: Request): boolean {
  const secret = process.env.PAYMENT_ADAPTER_PROXY_SECRET?.trim();
  if (!secret) return false; // Fail-closed: proxy secret MUST be set
  const auth = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (auth.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= auth.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type, authorization',
      },
    });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });
  if (!isAuthorized(req)) return bad('Unauthorized payment adapter proxy call.', 401);

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return json({
      error: 'paystack_not_configured',
      message: 'Set PAYSTACK_SECRET_KEY to enable Paystack pan-African checkouts.',
    }, { status: 503 });
  }

  let body: PaystackInitRequest;
  try {
    body = (await req.json()) as PaystackInitRequest;
  } catch {
    return bad('Body must be valid JSON.');
  }

  if (body.action !== 'initialize') return bad('Supported action is initialize.');
  const orderId = body.orderId?.trim();
  if (!orderId) return bad('orderId is required.');
  if (!body.email?.trim() || !body.email.includes('@')) return bad('Valid email is required.');

  // Validate order amount against database when Supabase is configured
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let amountMinor = Math.round(Number(body.amountKes || 0) * 100);

  if (supabaseUrl && serviceKey) {
    try {
      const orderRes = await fetch(
        `${supabaseUrl}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}&select=order_id,amount_expected,amount_minor,currency&limit=1`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'content-type': 'application/json',
          },
        },
      );
      if (orderRes.ok) {
        const rows = (await orderRes.json().catch(() => [])) as Array<{
          order_id: string;
          amount_expected?: number;
          amount_minor?: number;
        }>;
        if (rows.length > 0) {
          const dbExpectedMinor = rows[0].amount_minor ?? Math.round(Number(rows[0].amount_expected || 0) * 100);
          if (dbExpectedMinor > 0) {
            // Override with the true database expected amount to prevent client price tampering
            amountMinor = dbExpectedMinor;
          }
        }
      }
    } catch {
      // Non-fatal if DB lookup fails, continue with validated positive amountMinor
    }
  }

  if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
    return bad('Valid amount is required.');
  }

  const currency = (body.currency || 'KES').toUpperCase();

  const siteUrl = process.env.VITE_SITE_URL || 'https://barazaprotocol.com';
  const callbackUrl = body.callbackUrl || `${siteUrl}/payment-orders/${encodeURIComponent(orderId)}`;

  try {
    const upstreamRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        reference: body.orderId.trim(),
        email: body.email.trim(),
        amount: amountMinor,
        currency,
        callback_url: callbackUrl,
        metadata: {
          order_id: body.orderId.trim(),
          source: 'baraza_protocol',
        },
      }),
    });

    const data = (await upstreamRes.json().catch(() => ({}))) as {
      status?: boolean;
      message?: string;
      data?: {
        authorization_url?: string;
        access_code?: string;
        reference?: string;
      };
    };

    if (!upstreamRes.ok || !data.status || !data.data?.authorization_url) {
      return json({
        error: 'paystack_init_failed',
        message: data.message || 'Failed to initialize Paystack checkout.',
      }, { status: 502 });
    }

    return json({
      ok: true,
      provider: 'paystack',
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      reference: data.data.reference || body.orderId,
    }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: 'paystack_network_error', message: msg }, { status: 502 });
  }
}
