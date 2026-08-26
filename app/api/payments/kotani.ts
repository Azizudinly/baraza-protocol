export const config = { runtime: 'edge' };

type KotaniRequest =
  | {
      action: 'mpesaToBrza';
      phone: string;
      kesAmount: number;
      destinationAddress: string;
      communityCode: string;
      orderId?: string;
    }
  | {
      action: 'brzaToMpesa';
      phone: string;
      brzaAmount: string;
      sourceAddress: string;
      orderId?: string;
    }
  | { action: 'checkStatus'; reference: string };

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
  if (!secret) return true; // Open to internal server calls if proxy secret unset in dev
  return req.headers.get('authorization') === `Bearer ${secret}`;
}

async function upstream(path: string, init: RequestInit, key: string): Promise<Response> {
  const base = process.env.KOTANI_API_BASE?.replace(/\/$/, '') || 'https://api.kotanipay.com';
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${key}`,
      ...(init.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return bad((data as { message?: string }).message ?? 'Kotani request failed.', 502);
  return json(data);
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
  if (!isAuthorized(req)) return bad('Payment adapter proxy is restricted to trusted server calls.', 401);
  const key = process.env.KOTANI_PAY_API_KEY;
  if (!key) return bad('Kotani is not configured.', 503);

  let body: KotaniRequest;
  try {
    body = (await req.json()) as KotaniRequest;
  } catch {
    return bad('Body must be valid JSON.');
  }

  if (body.action === 'mpesaToBrza') {
    if (!body.phone || !body.destinationAddress || !body.communityCode || !(body.kesAmount > 0)) {
      return bad('phone, kesAmount, destinationAddress, and communityCode are required.');
    }
    return upstream('/v1/onramp/stellar', {
      method: 'POST',
      body: JSON.stringify({
        phone: body.phone,
        amount: body.kesAmount,
        currency: 'KES',
        destination: body.destinationAddress,
        memo: `BRZA ${body.communityCode}`,
        client_reference: body.orderId || undefined,
        network: 'stellar',
      }),
    }, key);
  }

  if (body.action === 'brzaToMpesa') {
    if (!body.phone || !body.brzaAmount || !body.sourceAddress) {
      return bad('phone, brzaAmount, and sourceAddress are required.');
    }
    return upstream('/v1/offramp/stellar', {
      method: 'POST',
      body: JSON.stringify({
        phone: body.phone,
        xlm_amount: body.brzaAmount,
        source: body.sourceAddress,
        client_reference: body.orderId || undefined,
        currency: 'KES',
      }),
    }, key);
  }

  if (body.action === 'checkStatus') {
    if (!body.reference) return bad('reference is required.');
    return upstream(`/v1/status/${encodeURIComponent(body.reference)}`, { method: 'GET' }, key);
  }

  return bad('Unknown Kotani action.');
}
