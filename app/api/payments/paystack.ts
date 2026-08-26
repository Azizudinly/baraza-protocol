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
  const secret = process.env.PAYMENT_ADAPTER_PROXY_SECRET;
  if (!secret) return true; // Open to internal client calls if proxy secret unset in dev
  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${secret}`;
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
  if (!body.orderId?.trim()) return bad('orderId is required.');
  if (!body.email?.trim() || !body.email.includes('@')) return bad('Valid email is required.');
  if (!Number.isFinite(body.amountKes) || body.amountKes <= 0) return bad('amountKes must be greater than zero.');

  // Paystack expects amount in minor currency units (cents/kobo)
  const amountMinor = Math.round(body.amountKes * 100);
  const currency = (body.currency || 'KES').toUpperCase();

  const siteUrl = process.env.VITE_SITE_URL || 'https://barazaprotocol.com';
  const callbackUrl = body.callbackUrl || `${siteUrl}/payment-orders/${encodeURIComponent(body.orderId)}`;

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
