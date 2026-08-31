export interface PaymentOrderStatusRow {
  order_id: string;
  status: string;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0;
}

function inCidrV4(ip: string, cidr: string): boolean {
  const [base, prefixRaw] = cidr.split('/');
  const prefix = Number(prefixRaw);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt === null || baseInt === null) return false;
  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  return (ipInt & mask) === (baseInt & mask);
}

export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;
  const realIp = req.headers.get('x-real-ip')?.trim();
  return realIp || null;
}

export function isIpAllowed(req: Request, allowlistRaw: string | undefined): boolean {
  const allowlist = (allowlistRaw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowlist.length === 0) return false;
  const ip = clientIp(req);
  if (!ip) return false;

  for (const item of allowlist) {
    if (item.includes('/')) {
      if (inCidrV4(ip, item)) return true;
      continue;
    }
    if (item === ip) return true;
  }
  return false;
}

export function hasPathSecret(req: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const pathname = new URL(req.url).pathname;
  const segments = pathname.split('/').filter(Boolean);
  const pathToken = segments[segments.length - 1] || '';
  if (pathToken.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= pathToken.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

export function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

export function supabaseHeaders(serviceKey: string): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json',
  };
}

export async function findOrderByProviderReference(
  url: string,
  serviceKey: string,
  providerReference: string,
): Promise<PaymentOrderStatusRow | null> {
  const res = await fetch(
    `${url}/rest/v1/payment_orders?provider_reference=eq.${encodeURIComponent(providerReference)}&select=order_id,status&limit=1`,
    { headers: supabaseHeaders(serviceKey) },
  );
  if (!res.ok) throw new Error('status_callback_lookup_failed');
  const rows = (await res.json().catch(() => [])) as PaymentOrderStatusRow[];
  return rows[0] ?? null;
}

export async function patchOrderStatus(
  url: string,
  serviceKey: string,
  orderId: string,
  status: string,
): Promise<void> {
  const res = await fetch(
    `${url}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}`,
    {
      method: 'PATCH',
      headers: supabaseHeaders(serviceKey),
      body: JSON.stringify({ status }),
    },
  );
  if (!res.ok) throw new Error('status_callback_update_failed');
}

export function extractTransactionIdFromResult(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;
  const maybe = result as {
    TransactionID?: unknown;
    ResultParameters?: { ResultParameter?: Array<{ Key?: unknown; Value?: unknown }> };
  };
  if (typeof maybe.TransactionID === 'string' && maybe.TransactionID.trim()) {
    return maybe.TransactionID.trim();
  }
  const list = maybe.ResultParameters?.ResultParameter;
  if (!Array.isArray(list)) return null;
  for (const item of list) {
    if (item?.Key === 'TransactionID' && typeof item.Value === 'string' && item.Value.trim()) {
      return item.Value.trim();
    }
  }
  return null;
}
