export const config = { runtime: 'nodejs' };

interface VerifyStellarRequest {
  // Preferred: server-signed token that binds communityId+amountXlm at intent creation time.
  // Required on mainnet. On testnet, falls back to legacy fields when absent.
  intentToken?: string;
  txHash: string;
  environment?: 'test' | 'live';
  // Legacy fields — testnet/sandbox only when intentToken is not provided
  communityId?: string;
  amountXlm?: number;
}

interface HorizonTransaction {
  hash: string;
  ledger: number;
  successful: boolean;
}

interface HorizonOperation {
  type: string;
  asset_type?: string;
  amount?: string;
  from?: string;
  to?: string;
}

type DuplicateConstraint = 'intent_token' | 'provider_reference' | 'other';

type PersistOrderResult =
  | { status: 'persisted' }
  | { status: 'not_configured' }
  | { status: 'duplicate'; constraint: DuplicateConstraint; detail: string }
  | { status: 'failed'; detail: string };

// Map a Supabase 409 response body to which unique constraint fired. Falls
// back to 'other' when the body is empty (text() failed) or doesn't name
// either index — the caller treats 'other' as a generic 409.
function classifyDuplicate(detail: string): DuplicateConstraint {
  if (/payment_orders_intent_token_unique/i.test(detail)) return 'intent_token';
  if (/payment_orders_provider_reference_unique/i.test(detail)) return 'provider_reference';
  return 'other';
}

const DEFAULT_TESTNET_HORIZON = 'https://horizon-testnet.stellar.org';
const DEFAULT_MAINNET_HORIZON = 'https://horizon.stellar.org';

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

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function stellarNetwork(requestedEnvironment?: 'test' | 'live'): 'testnet' | 'mainnet' | 'custom' {
  const raw = process.env.STELLAR_NETWORK ?? process.env.VITE_STELLAR_NETWORK;
  if (requestedEnvironment === 'live') return 'mainnet';
  if (raw === 'mainnet' || raw === 'custom') return raw;
  return 'testnet';
}

function horizonUrl(requestedEnvironment?: 'test' | 'live'): string {
  const configured = process.env.STELLAR_HORIZON_URL ?? process.env.VITE_STELLAR_HORIZON_URL;
  if (configured?.trim()) return configured.replace(/\/$/, '');
  return stellarNetwork(requestedEnvironment) === 'mainnet' ? DEFAULT_MAINNET_HORIZON : DEFAULT_TESTNET_HORIZON;
}

function providerEnvironment(requestedEnvironment?: 'test' | 'live'): 'sandbox' | 'production' {
  return stellarNetwork(requestedEnvironment) === 'mainnet' ? 'production' : 'sandbox';
}

function configuredTreasuryAccount(requestedEnvironment?: 'test' | 'live'): string | null {
  const account = process.env.STELLAR_TREASURY_ACCOUNT?.trim() ?? '';
  if (!account) {
    if (stellarNetwork(requestedEnvironment) === 'mainnet') {
      throw new Error('STELLAR_TREASURY_ACCOUNT is required for Stellar mainnet verification.');
    }
    return null;
  }
  if (!/^G[A-Z2-7]{55}$/.test(account)) {
    throw new Error('STELLAR_TREASURY_ACCOUNT must be a valid Stellar G-account.');
  }
  return account;
}

function generateOrderId(): string {
  return `ord_stellar_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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

// sha256(intentToken). Stored in payment_orders.intent_token_hash so the
// migration-010 unique index (`payment_orders_intent_token_unique`) actually
// blocks replay of the same signed intent — we must never store the raw
// bearer token, since the column is part of column-level GRANTs (010).
async function hashIntentToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// HMAC(payer-address, PAYMENT_PHONE_HASH_PEPPER) — pepper-derived identity
// hash matching membership/activate.ts so payment_orders.user_id_hash joins
// to memberships.user_id_hash later in reconciliation.
async function hashUserId(identity: string): Promise<string> {
  const pepper = process.env.PAYMENT_PHONE_HASH_PEPPER?.trim();
  if (!pepper) throw new Error('PAYMENT_PHONE_HASH_PEPPER is required — set it in your environment variables');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(identity));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Compute BRZA allocation from the actual settled XLM amount and rates pinned
// at intent creation. Mirror of brza/constants.ts:convertXlmToBrza, duplicated
// here so this edge handler stays free of Vite-only import.meta.env modules.
function computeBrzaAllocated(
  amountXlm: number,
  xlmUsdRate: number,
  brzaPriceUsd: number,
): number {
  const usdValue = amountXlm * xlmUsdRate;
  return Math.round((usdValue / brzaPriceUsd) * 1e7) / 1e7;
}

async function verifyIntentToken(
  token: string,
): Promise<{ communityId: string; amountXlm: number; xlmUsdRate?: number; brzaPriceUsd?: number } | null> {
  const secret = process.env.STELLAR_INTENT_SECRET;
  if (!secret) return null;

  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const encodedPayload = token.slice(0, dot);
  const sig = token.slice(dot + 1);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const sigPad = sig.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - sig.length % 4) % 4);
  let sigBytes: Uint8Array;
  try {
    const bin = atob(sigPad);
    sigBytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  if (base64url(sigBytes) !== sig) return null;

  const signature = sigBytes.buffer.slice(sigBytes.byteOffset, sigBytes.byteOffset + sigBytes.byteLength) as ArrayBuffer;
  const valid = await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(encodedPayload));
  if (!valid) return null;

  const payPad =
    encodedPayload.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - encodedPayload.length % 4) % 4);
  try {
    // atob returns a Latin-1 byte string; pass through TextDecoder to recover
    // the original UTF-8 text (handles non-ASCII communityId values correctly).
    const payBytes = Uint8Array.from(atob(payPad), (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(payBytes)) as {
      communityId: string;
      amountXlm: number;
      xlmUsdRate?: number;
      brzaPriceUsd?: number;
      expiresAt: string;
    };
    if (new Date(parsed.expiresAt) < new Date()) return null;
    if (!parsed.communityId || !Number.isFinite(parsed.amountXlm) || parsed.amountXlm <= 0) return null;
    // Backwards-compat: intents minted before xlmUsdRate/brzaPriceUsd were
    // added carry neither field. Verification still succeeds; brza_allocated
    // stays NULL for those orders (cron handles them as legacy).
    const xlmUsdRate =
      typeof parsed.xlmUsdRate === 'number' && parsed.xlmUsdRate > 0 ? parsed.xlmUsdRate : undefined;
    const brzaPriceUsd =
      typeof parsed.brzaPriceUsd === 'number' && parsed.brzaPriceUsd > 0 ? parsed.brzaPriceUsd : undefined;
    return { communityId: parsed.communityId, amountXlm: parsed.amountXlm, xlmUsdRate, brzaPriceUsd };
  } catch {
    return null;
  }
}

async function fetchHorizonJson<T>(path: string, requestedEnvironment?: 'test' | 'live'): Promise<T> {
  const res = await fetch(`${horizonUrl(requestedEnvironment)}${path}`, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Stellar Horizon returned ${res.status}`);
  return (await res.json()) as T;
}

async function verifyNativePayment(
  txHash: string,
  expectedAmount: number,
  treasuryAccount: string | null,
  requestedEnvironment?: 'test' | 'live',
): Promise<{ ledger: number; amount: number; payer: string | null }> {
  const transaction = await fetchHorizonJson<HorizonTransaction>(`/transactions/${txHash}`, requestedEnvironment);
  if (!transaction.successful) throw new Error('Stellar transaction was not successful.');

  const operations = await fetchHorizonJson<{ _embedded?: { records?: HorizonOperation[] } }>(
    `/transactions/${txHash}/operations`,
    requestedEnvironment,
  );
  const payment = operations._embedded?.records?.find((operation) => {
    const amount = Number(operation.amount);
    const isNativePayment = operation.type === 'payment' && operation.asset_type === 'native';
    const reachesTreasury = !treasuryAccount || operation.to === treasuryAccount;
    return isNativePayment && reachesTreasury && Number.isFinite(amount) && amount >= expectedAmount;
  });

  if (!payment?.amount) {
    throw new Error(treasuryAccount
      ? 'Transaction does not contain enough XLM paid to the configured treasury account.'
      : 'Transaction does not contain enough native XLM payment value.');
  }

  return { ledger: transaction.ledger, amount: Number(payment.amount), payer: payment.from ?? null };
}


async function persistOrder(input: {
  orderId: string;
  activationSecret: string;
  communityId: string;
  txHash: string;
  amountXlm: number;
  environment?: 'test' | 'live';
  intentToken?: string;
  payerAddress: string | null;
  xlmUsdRate?: number;
  brzaPriceUsd?: number;
}): Promise<PersistOrderResult> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { status: 'not_configured' };

  const intentTokenHash = input.intentToken ? await hashIntentToken(input.intentToken) : null;
  const userIdHash = input.payerAddress ? await hashUserId(input.payerAddress) : null;
  // brza_allocated is derived from the ACTUAL settled XLM amount (may exceed
  // body.amountXlm if user overpaid) × pinned intent-time rates. Stays NULL
  // for legacy intents that lack the pinned rates — cron treats those as a
  // separate cohort needing manual reconciliation.
  const brzaAllocated =
    input.xlmUsdRate && input.brzaPriceUsd
      ? computeBrzaAllocated(input.amountXlm, input.xlmUsdRate, input.brzaPriceUsd)
      : null;

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
      community_id: input.communityId,
      provider: 'stellar',
      provider_environment: providerEnvironment(input.environment),
      provider_reference: input.txHash,
      activation_secret_hash: await hashActivationSecret(input.activationSecret),
      amount_expected: input.amountXlm,
      amount_received: input.amountXlm,
      // Migration 010 columns — populate so the intent-token unique index and
      // identity correlation actually guard something on this rail.
      amount_xlm: input.amountXlm,
      intent_token_hash: intentTokenHash,
      user_id_hash: userIdHash,
      brza_allocated: brzaAllocated,
      currency: 'XLM',
      status: 'PAYMENT_CONFIRMED',
      confirmed_at: new Date().toISOString(),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.warn('[stellar-verify-payment] Supabase insert failed:', res.status, detail);
    if (
      res.status === 409 ||
      /duplicate key|23505|payment_orders_provider_reference_unique|payment_orders_intent_token_unique/i.test(detail)
    ) {
      return { status: 'duplicate', constraint: classifyDuplicate(detail), detail };
    }
    return { status: 'failed', detail };
  }
  return { status: 'persisted' };
}

// Web Standards Fetch Request/Response handler
async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  }
if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405, headers: { Allow: 'POST, OPTIONS' } });

  let body: VerifyStellarRequest;
  try {
    body = (await req.json()) as VerifyStellarRequest;
  } catch {
    return bad('Body must be valid JSON');
  }

  const txHash = body.txHash?.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(txHash)) return bad('Enter a valid 64-character Stellar transaction hash.');
  const requestedEnvironment = body.environment === 'live' ? 'live' : 'test';

  // Resolve communityId and amountXlm from the signed intent (preferred) or legacy fields (testnet only).
  let communityId: string;
  let amountXlm: number;
  // Pinned-at-intent rates used to derive brza_allocated. Undefined for the
  // dev-only legacy fields path and for old intents minted before the rates
  // were added — persistOrder stores NULL in those cases.
  let xlmUsdRate: number | undefined;
  let brzaPriceUsd: number | undefined;

  if (body.intentToken) {
    const claim = await verifyIntentToken(body.intentToken);
    if (!claim) return bad('Payment intent token is invalid or expired.');
    communityId = claim.communityId;
    amountXlm = claim.amountXlm;
    xlmUsdRate = claim.xlmUsdRate;
    brzaPriceUsd = claim.brzaPriceUsd;
  } else if (stellarNetwork(requestedEnvironment) !== 'mainnet' && process.env.NODE_ENV === 'development') {
    if (!body.communityId) return bad('communityId is required');
    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    let minDuesXlm = 0.1;
    if (supabaseUrl && serviceRoleKey) {
      try {
        const commRes = await fetch(
          `${supabaseUrl}/rest/v1/communities?id=eq.${encodeURIComponent(body.communityId)}&select=id,activation_fee_minor&limit=1`,
          { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
        );
        if (commRes.ok) {
          const rows = (await commRes.json().catch(() => [])) as Array<{ activation_fee_minor?: number }>;
          const minor = rows[0]?.activation_fee_minor ?? 50000;
          const xlmUsd = 0.10;
          minDuesXlm = Number(((minor / 100) * (1 / 130) / xlmUsd).toFixed(4));
        }
      } catch {
        // Fall back to minDuesXlm
      }
    }
    communityId = body.communityId;
    amountXlm = Math.max(minDuesXlm, Number(body.amountXlm || minDuesXlm));
  } else {
    return bad('intentToken is required for production Stellar payments.');
  }

  let treasuryAccount: string | null;
  try {
    treasuryAccount = configuredTreasuryAccount(requestedEnvironment);
  } catch (err) {
    return json({
      error: 'stellar_verifier_not_configured',
      message: err instanceof Error ? err.message : 'Stellar treasury verification is not configured.',
    }, { status: 503 });
  }

  try {
    const proof = await verifyNativePayment(txHash, amountXlm, treasuryAccount, requestedEnvironment);
    const orderId = generateOrderId();
    const activationSecret = generateActivationSecret();
    const persistResult = await persistOrder({
      orderId,
      activationSecret,
      communityId,
      txHash,
      amountXlm: proof.amount,
      environment: requestedEnvironment,
      intentToken: body.intentToken,
      payerAddress: proof.payer,
      xlmUsdRate,
      brzaPriceUsd,
    });

    if (persistResult.status === 'duplicate') {
      // Two distinct unique constraints can fire here:
      //   - payment_orders_provider_reference_unique → same txHash reused
      //   - payment_orders_intent_token_unique → same signed intent reused
      // persistOrder classifies via the structured `constraint` field so we
      // do not re-regex the body here (it can be empty when text() throws).
      const isIntentReplay = persistResult.constraint === 'intent_token';
      return json({
        error: isIntentReplay ? 'stellar_intent_reused' : 'stellar_payment_reused',
        message: isIntentReplay
          ? 'This payment intent token has already been used to record a Baraza payment order.'
          : 'This Stellar transaction hash is already attached to a Baraza payment order.',
      }, { status: 409 });
    }

    if (persistResult.status === 'failed') {
      return json({
        error: 'stellar_order_persist_failed',
        message: 'Stellar payment was verified, but the payment order could not be recorded.',
      }, { status: 502 });
    }

    const persisted = persistResult.status === 'persisted';

    return json({
      orderId: persisted ? orderId : `ord_local_stellar_${Date.now().toString(36)}`,
      activationSecret: persisted ? activationSecret : null,
      status: 'PAYMENT_CONFIRMED',
      rail: 'stellar',
      txHash,
      ledger: proof.ledger,
      amountXlm: proof.amount,
      persisted,
      horizonUrl: horizonUrl(requestedEnvironment),
    });
  } catch (err) {
    return json({
      error: 'stellar_verification_failed',
      message: err instanceof Error ? err.message : 'Could not verify Stellar payment.',
    }, { status: 422 });
  }
}

export { handler as POST, handler as OPTIONS };
