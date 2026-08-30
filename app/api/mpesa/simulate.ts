/**
 * M-Pesa simulator — local/dev-only helper for Phase 1 M6 work.
 *
 * Phase 1 plan reference: 02-phase1-backend-execution-plan.md M6-C3.
 * The production requirement is explicit: the fake settlement path must not
 * be reachable in production, because it can be mistaken for the verified
 * payment pipeline.
 */

export const config = { runtime: 'edge' };

interface SimulateRequest {
  phone: string;
  communityId: string;
  tierId?: string;
  amount: number;
  currency?: string;
}

interface SimulateResponse {
  orderId: string;
  activationSecret: string;
  status: 'PAYMENT_PENDING' | 'PAYMENT_CONFIRMED';
  amount: number;
  currency: string;
  simulatedAt: string;
  persisted: boolean;
  note: string;
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

function badRequest(message: string): Response {
  return json({ error: 'invalid_request', message }, { status: 400 });
}

function forbidden(message: string): Response {
  return json({ error: 'forbidden', message }, { status: 403 });
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.CF_PAGES === '1' || process.env.VERCEL_ENV === 'production';
}

function isSimulatorAuthorized(req: Request): boolean {
  if (isProduction()) return false;
  if (process.env.MPESA_SIMULATOR_ENABLED !== 'true') return false;

  const secret = process.env.MPESA_SIMULATOR_SECRET;
  if (!secret) return false;

  const auth = req.headers.get('authorization') ?? '';
  const headerSecret = req.headers.get('x-simulator-secret') ?? '';
  return auth === `Bearer ${secret}` || headerSecret === secret;
}

function generateOrderId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `ord_sim_${ts}_${rand}`;
}

function generateActivationSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashActivationSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function persistOrder(input: {
  orderId: string;
  activationSecret: string;
  request: SimulateRequest;
}): Promise<boolean> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return false;

  // Direct fetch against Supabase REST so we don't need the JS SDK in Edge.
  const res = await fetch(`${url}/rest/v1/payment_orders`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      order_id: input.orderId,
      community_id: input.request.communityId,
      membership_tier_id: input.request.tierId ?? null,
      provider: 'africastalking',
      provider_environment: 'sandbox',
      activation_secret_hash: await hashActivationSecret(input.activationSecret),
      amount_expected: input.request.amount,
      currency: input.request.currency ?? 'KES',
      status: 'PAYMENT_PENDING',
    }),
  });

  if (!res.ok) {
    // Surface the underlying message to logs; degrade gracefully on the wire.
    const detail = await res.text().catch(() => '');
    console.warn('[mpesa-simulate] Supabase insert failed:', res.status, detail);
    return false;
  }
  return true;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, { status: 405 });
  }
  if (!isSimulatorAuthorized(req)) {
    return forbidden('M-Pesa simulator is disabled in production.');
  }

  let body: SimulateRequest;
  try {
    body = (await req.json()) as SimulateRequest;
  } catch {
    return badRequest('Body must be valid JSON');
  }

  if (!body.phone || typeof body.phone !== 'string') {
    return badRequest('phone is required');
  }
  if (!body.communityId || typeof body.communityId !== 'string') {
    return badRequest('communityId is required');
  }
  if (typeof body.amount !== 'number' || body.amount <= 0) {
    return badRequest('amount must be a positive number');
  }

  const orderId = generateOrderId();
  const activationSecret = generateActivationSecret();
  const persisted = await persistOrder({ orderId, activationSecret, request: body });

  const response: SimulateResponse = {
    orderId,
    activationSecret,
    status: 'PAYMENT_PENDING',
    amount: body.amount,
    currency: body.currency ?? 'KES',
    simulatedAt: new Date().toISOString(),
    persisted,
    note: persisted
      ? 'Simulator persisted to Supabase payment_orders as a non-confirmed dev record. Real M-Pesa webhook hook-up replaces this in production.'
      : 'Simulator in stateless mode (SUPABASE_SERVICE_ROLE_KEY not set). The order_id is ephemeral and remains non-confirmed.',
  };

  return json(response, {
    status: 200,
    headers: { 'access-control-allow-origin': '*' },
  });
}
