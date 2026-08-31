export const config = { runtime: 'edge' };

import { calculateDynamicFee } from '../../src/lib/payments/feeEngine.js';

interface CreateIntentRequest {
  communityId: string;
  amountXlm?: number;
  amountKes?: number;
  currency?: string;
}

interface CommunityRow {
  id: string;
  name: string;
  activation_fee_minor?: number | null;
  fee_type?: string | null;
  carrier_pass_through?: boolean | null;
  currency?: string | null;
}

const XLM_USD_RATE_DEFAULT = 0.10;

function resolveBrzaPriceUsd(): number | null {
  const fromEnv = process.env.BRZA_PRICE_USD;
  if (fromEnv) {
    const parsed = Number(fromEnv);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function resolveXlmUsdRate(): number {
  const fromEnv = process.env.XLM_USD_RATE_MVP;
  if (fromEnv) {
    const parsed = Number(fromEnv);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return XLM_USD_RATE_DEFAULT;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlFromString(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      ...(init?.headers ?? {}),
    },
  });
}

function bad(message: string, status = 400): Response {
  return json({ error: 'invalid_request', message }, { status });
}

async function signPayload(encodedPayload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
  return base64url(new Uint8Array(sig));
}

async function fetchCommunity(
  supabaseUrl: string,
  serviceRoleKey: string,
  communityId: string,
): Promise<CommunityRow | null> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/communities?id=eq.${encodeURIComponent(communityId)}&select=id,name,activation_fee_minor,fee_type,carrier_pass_through,currency&limit=1`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'content-type': 'application/json',
        },
      },
    );
    if (!res.ok) return null;
    const rows = (await res.json().catch(() => [])) as CommunityRow[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
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

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });

  const secret = process.env.STELLAR_INTENT_SECRET;
  if (!secret) {
    return json({
      error: 'intent_signing_not_configured',
      message: 'Set STELLAR_INTENT_SECRET to enable payment intent generation.',
    }, { status: 503 });
  }

  let body: CreateIntentRequest;
  try {
    body = (await req.json()) as CreateIntentRequest;
  } catch {
    return bad('Body must be valid JSON');
  }

  if (!body.communityId?.trim()) return bad('communityId is required');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let community: CommunityRow | null = null;
  if (supabaseUrl && serviceRoleKey) {
    community = await fetchCommunity(supabaseUrl, serviceRoleKey, body.communityId.trim());
  }

  // Resolve base dues configuration from database (never trust client fallback if DB is configured)
  const feeType = community?.fee_type || 'one_time';
  let baseAmountMinor: number;

  if (feeType === 'free') {
    baseAmountMinor = 0;
  } else if (community?.activation_fee_minor !== undefined && community?.activation_fee_minor !== null) {
    baseAmountMinor = Number(community.activation_fee_minor);
  } else if (body.amountKes !== undefined && Number.isFinite(body.amountKes) && (!supabaseUrl || !serviceRoleKey)) {
    // Only allow client fallback in local unconfigured development
    baseAmountMinor = Math.round(body.amountKes * 100);
  } else {
    // Default fallback: KES 500 = 50,000 cents
    baseAmountMinor = 50000;
  }

  const currency = community?.currency || body.currency || 'KES';
  const carrierPassThrough = community?.carrier_pass_through !== false;

  // Zero-fee community instant bypass
  if (feeType === 'free' || baseAmountMinor <= 0) {
    return json({
      zeroFee: true,
      bypassPayment: true,
      communityId: body.communityId.trim(),
      message: 'Community requires zero activation dues. Proceed directly to membership activation.',
    }, { status: 200 });
  }

  const feeBreakdown = calculateDynamicFee(baseAmountMinor, currency, carrierPassThrough);

  const xlmUsdRate = resolveXlmUsdRate();
  const brzaPriceUsd = resolveBrzaPriceUsd();

  if (brzaPriceUsd === null) {
    return json({
      error: 'pricing_not_configured',
      message: 'Set BRZA_PRICE_USD to enable payment intent creation.',
    }, { status: 503 });
  }

  // Derive dynamic XLM amount: (totalKES / 130) / xlmUsdRate
  const kesUsdRate = 1 / 130;
  const derivedXlm = Number(((feeBreakdown.totalExpectedMinor / 100) * kesUsdRate / xlmUsdRate).toFixed(4));
  const minRequiredXlm = Math.max(0.1, derivedXlm);

  // Zero-trust client input: ignore arbitrary sub-rate discounts.
  // Only accept client override if it is a genuine overpayment (>= 99.5% of derived amount).
  const amountXlm = (typeof body.amountXlm === 'number' && Number.isFinite(body.amountXlm) && body.amountXlm >= minRequiredXlm * 0.995)
    ? Number(body.amountXlm.toFixed(4))
    : minRequiredXlm;

  const nonce = base64url(crypto.getRandomValues(new Uint8Array(12)));
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const payload = JSON.stringify({
    communityId: body.communityId.trim(),
    amountXlm,
    xlmUsdRate,
    brzaPriceUsd,
    baseAmountMinor: feeBreakdown.baseAmountMinor,
    platformFeeMinor: feeBreakdown.platformFeeMinor,
    carrierCostMinor: feeBreakdown.carrierCostMinor,
    totalExpectedMinor: feeBreakdown.totalExpectedMinor,
    currency: feeBreakdown.currency,
    expiresAt,
    nonce,
  });

  const encodedPayload = base64urlFromString(payload);
  const sig = await signPayload(encodedPayload, secret);

  return json({
    intentToken: `${encodedPayload}.${sig}`,
    communityId: body.communityId.trim(),
    amountXlm,
    xlmUsdRate,
    brzaPriceUsd,
    feeBreakdown,
    expiresAt,
    nonce,
  }, { status: 201 });
}
