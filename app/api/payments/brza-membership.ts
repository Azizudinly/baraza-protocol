export const config = { runtime: 'edge' };

interface BrzaMembershipRequest {
  phone: string;
  communityId: string;
  communityCode: string;
  communityTreasuryAddress: string;
  amountKes: number;
  membershipTierId?: string;
  idempotencyKey: string;
}

interface PaymentOrderRow {
  order_id: string;
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
  return Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`);
}

function providerEnvironment(): 'sandbox' | 'production' {
  return process.env.NODE_ENV === 'production' || process.env.CF_PAGES === '1' || process.env.VERCEL_ENV === 'production'
    ? 'production'
    : 'sandbox';
}

function generateOrderId(): string {
  return `ord_brza_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateActivationSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function phoneHash(phone: string, pepper: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(phone));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function supabaseHeaders(serviceKey: string, representation = false): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json',
    ...(representation ? { Prefer: 'return=representation' } : {}),
  };
}

async function findExistingOrder(url: string, serviceKey: string, idempotencyKey: string): Promise<string | null> {
  const res = await fetch(
    `${url}/rest/v1/payment_orders?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&select=order_id`,
    { headers: supabaseHeaders(serviceKey) },
  );
  if (!res.ok) throw new Error('Could not check payment idempotency.');
  const rows = (await res.json().catch(() => [])) as PaymentOrderRow[];
  return rows[0]?.order_id ?? null;
}

async function patchOrder(
  url: string,
  serviceKey: string,
  orderId: string,
  update: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${url}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: supabaseHeaders(serviceKey),
    body: JSON.stringify(update),
  });
  if (!res.ok) throw new Error('Could not update payment order.');
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });
  if (!isAuthorized(req)) return bad('BRZA membership initiation is restricted to trusted server calls.', 401);

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const kotaniKey = process.env.KOTANI_PAY_API_KEY;
  const hashPepper = process.env.PAYMENT_PHONE_HASH_PEPPER;
  if (!supabaseUrl || !serviceKey || !kotaniKey || !hashPepper) {
    return bad('BRZA membership payment orchestration is not configured.', 503);
  }

  let body: BrzaMembershipRequest;
  try {
    body = (await req.json()) as BrzaMembershipRequest;
  } catch {
    return bad('Body must be valid JSON.');
  }

  if (!/^\+?[0-9]{10,15}$/.test(body.phone?.trim() ?? '')) return bad('phone must contain 10 to 15 digits.');
  if (!body.communityId?.trim()) return bad('communityId is required.');
  if (!/^[A-Za-z0-9_-]{1,20}$/.test(body.communityCode?.trim() ?? '')) {
    return bad('communityCode must contain only letters, numbers, underscores, or hyphens.');
  }
  if (!/^G[A-Z2-7]{55}$/.test(body.communityTreasuryAddress ?? '')) {
    return bad('communityTreasuryAddress must be a valid Stellar G-account.');
  }
  if (!Number.isFinite(body.amountKes) || body.amountKes <= 0) return bad('amountKes must be greater than zero.');
  if (!body.idempotencyKey?.trim() || body.idempotencyKey.length > 128) {
    return bad('idempotencyKey is required and must be at most 128 characters.');
  }

  const existingOrderId = await findExistingOrder(supabaseUrl, serviceKey, body.idempotencyKey);
  if (existingOrderId) {
    return json({
      error: 'duplicate_payment_request',
      message: 'This payment request was already submitted.',
      orderId: existingOrderId,
    }, { status: 409 });
  }

  const orderId = generateOrderId();
  const activationSecret = generateActivationSecret();
  const now = new Date();
  const createRes = await fetch(`${supabaseUrl}/rest/v1/payment_orders`, {
    method: 'POST',
    headers: supabaseHeaders(serviceKey, true),
    body: JSON.stringify({
      order_id: orderId,
      community_id: body.communityId,
      membership_tier_id: body.membershipTierId ?? null,
      provider: 'kotani',
      provider_environment: providerEnvironment(),
      activation_secret_hash: await sha256(activationSecret),
      amount_expected: body.amountKes,
      currency: 'KES',
      phone_hash: await phoneHash(body.phone.trim(), hashPepper),
      status: 'CREATED',
      idempotency_key: body.idempotencyKey,
      expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    }),
  });
  if (!createRes.ok) {
    const detail = await createRes.text().catch(() => '');
    if (createRes.status === 409 || /duplicate key|23505|idempotency/i.test(detail)) {
      return json({ error: 'duplicate_payment_request', message: 'This payment request was already submitted.' }, { status: 409 });
    }
    return bad('Could not create BRZA payment order.', 502);
  }

  const kotaniBase = process.env.KOTANI_API_BASE?.replace(/\/$/, '') || 'https://api.kotanipay.com';
  let providerRes: Response;
  try {
    providerRes = await fetch(`${kotaniBase}/v1/onramp/stellar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${kotaniKey}` },
      body: JSON.stringify({
        phone: body.phone.trim(),
        amount: body.amountKes,
        currency: 'KES',
        destination: body.communityTreasuryAddress,
        memo: `BRZA ${body.communityCode}`,
        network: 'stellar',
      }),
    });
  } catch {
    await patchOrder(supabaseUrl, serviceKey, orderId, { status: 'PAYMENT_FAILED' });
    return bad('Kotani payment request failed.', 502);
  }
  const providerData = await providerRes.json().catch(() => ({}));
  if (!providerRes.ok || !providerData.reference) {
    await patchOrder(supabaseUrl, serviceKey, orderId, { status: 'PAYMENT_FAILED' });
    return bad(providerData.message ?? 'Kotani payment request failed.', 502);
  }

  const status = 'PAYMENT_PENDING';
  await patchOrder(supabaseUrl, serviceKey, orderId, {
    provider_reference: providerData.reference,
    status,
  });

  return json({
    orderId,
    activationSecret,
    providerReference: providerData.reference,
    status,
    persisted: true,
  }, { status: 201 });
}
