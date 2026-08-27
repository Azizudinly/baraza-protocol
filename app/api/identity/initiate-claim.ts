/**
 * POST /api/identity/initiate-claim
 *
 * Wallet-initiated leg of identity continuity. A wallet-connected member
 * submits the phone number they want to link; the server generates a
 * 6-digit code, stores HASH(code) + phone_hash + wallet_address as a
 * pending claim (10-minute TTL), and dispatches the code via SMS.
 *
 * Returns { expiresAt } on success. The code is never returned to the
 * client — it's only delivered out-of-band via SMS so the member proves
 * possession of the phone.
 *
 * USSD-initiated leg is symmetric and lives at the USSD menu layer (the
 * member dials, the menu generates the code on-screen, then the member
 * enters it on the web /claim page).
 */

import {
  IDENTITY_CLAIM_CONSTANTS,
  generateClaimCode,
  hashClaimCode,
  hashPhoneNumber,
} from '../../src/lib/identity/claim.js';
import { getWalletProof, verifyWalletProof } from '../_lib/wallet-proof.js';

export const config = { runtime: 'nodejs' };

const PHONE_PATTERN = /^\+\d{8,15}$/;
const WALLET_PATTERN = /^[A-Za-z0-9_:+-]{8,128}$/;

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

async function sendClaimSms(phone: string, code: string): Promise<void> {
  const username = process.env.AT_USERNAME;
  const apiKey = process.env.AT_API_KEY;
  if (!username || !apiKey) return; // dev / unconfigured — no-op
  const body = new URLSearchParams({
    username,
    to: phone,
    message: `Baraza: Your identity link code is ${code}. Expires in 10 minutes. Do not share.`,
    from: process.env.AT_SENDER_ID ?? 'Baraza',
  });
  await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: { apiKey, Accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  }).catch(() => undefined);
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type,x-wallet-address,x-wallet-message,x-wallet-signature',
      },
    });
  }
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });

  let body: { phoneNumber?: unknown; walletAddress?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'invalid_request', message: 'JSON body required' }, { status: 400 });
  }

  const phoneNumber =
    typeof body.phoneNumber === 'string' && PHONE_PATTERN.test(body.phoneNumber)
      ? body.phoneNumber
      : null;
  const walletAddress =
    typeof body.walletAddress === 'string' && WALLET_PATTERN.test(body.walletAddress)
      ? body.walletAddress
      : null;

  if (!phoneNumber || !walletAddress) {
    return json({ error: 'invalid_request', message: 'phoneNumber and walletAddress required' }, { status: 400 });
  }
  if (!verifyWalletProof(getWalletProof(req, walletAddress), walletAddress, 'identity-claim')) {
    return json({ error: 'wallet_proof_required', message: 'Valid wallet signature required' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'supabase_not_configured' }, { status: 503 });
  }

  let phoneHash: string;
  try {
    phoneHash = await hashPhoneNumber(phoneNumber);
  } catch {
    return json({ error: 'identity_pepper_missing' }, { status: 503 });
  }

  const code = generateClaimCode();
  const codeHash = await hashClaimCode(code);
  const expiresAt = new Date(Date.now() + IDENTITY_CLAIM_CONSTANTS.CLAIM_TTL_MS).toISOString();

  const insertRes = await fetch(`${supabaseUrl}/rest/v1/identity_claim_pending`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      phone_hash: phoneHash,
      code_hash: codeHash,
      initiated_by: 'wallet',
      pending_wallet_address: walletAddress,
      expires_at: expiresAt,
    }),
  });
  if (!insertRes.ok) {
    return json({ error: 'upstream_error' }, { status: 502 });
  }

  await sendClaimSms(phoneNumber, code);

  return json({ ok: true, expiresAt });
}

export { handler as default, handler as POST, handler as OPTIONS };

