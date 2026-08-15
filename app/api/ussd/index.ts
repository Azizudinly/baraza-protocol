import { getOrCreateSession, destroySession, resolveCountryFromPhone } from '../../src/lib/ussd/session.js';
import { handleUssdInput, type PendingPayOrder } from '../../src/lib/ussd/menu.js';
import {
  hydratePendingWelcomeFromDb,
  peekPendingWelcome,
  takePendingSmsFallbacks,
} from '../../src/lib/ussd/welcome.js';
import { formatWelcomeSmsFallback } from '../../src/lib/notifications/sms.js';
import { classifyExit, logSessionExit } from '../../src/lib/ussd/monitoring.js';

export const config = { runtime: 'edge' };

function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

function isAuthorized(req: Request): boolean {
  if (!isProduction()) return true;
  const apiKey = process.env.AT_API_KEY;
  if (!apiKey) return false;
  return req.headers.get('AT-API-Key') === apiKey;
}

async function generateSecret(length = 48): Promise<string> {
  const bytes = new Uint8Array(Math.ceil(length * 0.75));
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, length);
}

async function createPaymentOrder(pending: PendingPayOrder, baseUrl: string): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  const orderId = `ord_ussd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const activationSecret = await generateSecret();
  const secretHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(activationSecret),
  );
  const activationSecretHash = Array.from(new Uint8Array(secretHash), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');

  const res = await fetch(`${supabaseUrl}/rest/v1/payment_orders`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      order_id: orderId,
      community_id: pending.communityCode,
      provider: 'africastalking',
      provider_environment: isProduction() ? 'production' : 'sandbox',
      activation_secret_hash: activationSecretHash,
      amount_expected: pending.amount,
      currency: pending.currency,
      // M6-C4: USSD can create the order, but it must not mark it confirmed.
      // Phase 1 requires the verified payment route to own that transition.
      status: 'PAYMENT_PENDING',
      metadata: { source: 'ussd', phone: pending.phoneNumber },
    }),
  });

  if (!res.ok) return null;

  // Send activation link via SMS (fire-and-forget).
  const smsUrl = `${baseUrl}/join/${pending.communityCode}/status?orderId=${orderId}&activationSecret=${activationSecret}&rail=mpesa`;
  sendActivationSms(pending.phoneNumber, smsUrl).catch(() => undefined);

  return orderId;
}

async function fetchBrzaBalanceForPhone(phoneNumber: string): Promise<number> {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return 0;

  const identity = encodeURIComponent(`phone:${phoneNumber}`);
  const res = await fetch(
    `${supabaseUrl}/rest/v1/memberships?wallet_address=eq.${identity}&status=in.(ACTIVE,PENDING)&select=voting_weight`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  );
  if (!res.ok) return 0;
  const rows = (await res.json().catch(() => [])) as Array<{ voting_weight?: number | null }>;
  return rows.reduce((sum, r) => sum + (r.voting_weight ?? 1), 0);
}

async function sendRawSms(phoneNumber: string, message: string): Promise<void> {
  const username = process.env.AT_USERNAME;
  const apiKey = process.env.AT_API_KEY;
  if (!username || !apiKey) return;

  const body = new URLSearchParams({
    username,
    to: phoneNumber,
    message,
    from: process.env.AT_SENDER_ID ?? 'Baraza',
  });

  await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      apiKey,
      Accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
}

async function sendActivationSms(phoneNumber: string, activationUrl: string): Promise<void> {
  await sendRawSms(
    phoneNumber,
    `Baraza: Your dues payment was received. Activate your membership here: ${activationUrl}`,
  );
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type, AT-API-Key',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (!isAuthorized(req)) {
    return new Response('Forbidden', { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new Response('Bad Request: body must be form-encoded', { status: 400 });
  }

  const sessionId = formData.get('sessionId');
  const phoneNumber = formData.get('phoneNumber');
  const serviceCode = formData.get('serviceCode');
  const text = formData.get('text');

  if (
    typeof sessionId !== 'string' ||
    typeof phoneNumber !== 'string' ||
    typeof serviceCode !== 'string' ||
    typeof text !== 'string'
  ) {
    return new Response('Bad Request: missing required fields', { status: 400 });
  }

  const countryCode = resolveCountryFromPhone(phoneNumber);
  const session = getOrCreateSession({ sessionId, phoneNumber, serviceCode, countryCode });

  // Cross-process welcome hydration: cron-side `markMintConfirmed` writes a
  // pending_welcome flag onto the payment_order; pick it up before routing
  // so the welcome fires on the very next dial.
  await hydratePendingWelcomeFromDb(phoneNumber).catch(() => undefined);

  // Prefetch BRZA balance when the user navigates to the balance menu (root '1').
  const isBalanceMenu = text === '1' || text.startsWith('1*');
  const brzaBalance = isBalanceMenu ? await fetchBrzaBalanceForPhone(phoneNumber) : undefined;

  // Snapshot the welcome (if any) before handling, so we can format the
  // SMS fallback even after the flow consumes the registry entry.
  const welcomeSnapshot = peekPendingWelcome(phoneNumber);
  const handlerStartedAt = Date.now();

  const result = handleUssdInput({ session, text, phoneNumber, brzaBalance });

  if (result.action === 'END') {
    destroySession(sessionId);
  }

  // After computing the menu response, create a payment order in the background
  // if the user confirmed a dues payment. The USSD response is sent immediately;
  // the Supabase write and SMS happen async.
  if (result.pendingPayOrder) {
    const origin = new URL(req.url).origin;
    createPaymentOrder(result.pendingPayOrder, origin).catch(() => undefined);
  }

  // Dispatch any queued welcome SMS fallbacks (Nia's W0 "Main menu" skip path).
  // Fire-and-forget so the USSD response stays fast.
  const fallbackTargets = takePendingSmsFallbacks();
  const smsFallbackQueued = fallbackTargets.length > 0;
  if (smsFallbackQueued && welcomeSnapshot) {
    const message = formatWelcomeSmsFallback(welcomeSnapshot.communityName);
    for (const target of fallbackTargets) {
      sendRawSms(target, message).catch(() => undefined);
    }
  }

  // Seku monitoring: log every END as a session exit. CON events stay
  // out of the table to avoid filling it with every keypress.
  if (result.action === 'END') {
    const welcomeIsPendingAfter = peekPendingWelcome(phoneNumber) !== null;
    const { exitReason, welcomeState } = classifyExit({
      resultAction: result.action,
      resultText: result.text,
      welcomeWasPending: welcomeSnapshot !== null,
      welcomeIsPendingAfter,
      smsFallbackQueued,
    });
    logSessionExit({
      sessionId,
      phoneNumber,
      countryCode,
      serviceCode,
      lastMenuPath: text,
      resultAction: result.action,
      exitReason,
      welcomeState,
      durationMs: Date.now() - handlerStartedAt,
    }).catch(() => undefined);
  }

  return new Response(`${result.action} ${result.text}`, {
    status: 200,
    headers: { 'content-type': 'text/plain' },
  });
}
