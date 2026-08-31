/**
 * POST /api/identity/verify-claim
 *
 * Closes the bidirectional claim. The client (web with wallet connected)
 * submits { code, phoneNumber, walletAddress }; the server fetches the
 * pending claim by phone_hash, runs `verifyClaim()`, and on success:
 *
 *   1. Inserts a row into `identity_links` (phone_hash, wallet_address)
 *   2. Marks the pending row consumed_at = now()
 *
 * On failure (invalid code, attempts left), increments the attempts
 * counter so the runtime guard in `verifyClaim` enforces the 5-attempt
 * cap on the next call.
 */

import {
  buildVerificationProof,
  hashPhoneNumber,
  verifyClaim,
  type PendingClaimSnapshot,
} from '../../src/lib/identity/claim.js';
import { getWalletProof, verifyWalletProof } from '../_lib/wallet-proof.js';

export const config = { runtime: 'nodejs' };

const PHONE_PATTERN = /^\+\d{8,15}$/;
const WALLET_PATTERN = /^[A-Za-z0-9_:+-]{8,128}$/;
const CODE_PATTERN = /^\d{6}$/;

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

interface PendingRow {
  id: string;
  phone_hash: string;
  code_hash: string;
  initiated_by: 'ussd' | 'wallet';
  pending_wallet_address: string | null;
  attempts: number;
  expires_at: string;
  consumed_at: string | null;
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

  let body: { code?: unknown; phoneNumber?: unknown; walletAddress?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'invalid_request' }, { status: 400 });
  }

  const code = typeof body.code === 'string' && CODE_PATTERN.test(body.code) ? body.code : null;
  const phoneNumber =
    typeof body.phoneNumber === 'string' && PHONE_PATTERN.test(body.phoneNumber)
      ? body.phoneNumber
      : null;
  const walletAddress =
    typeof body.walletAddress === 'string' && WALLET_PATTERN.test(body.walletAddress)
      ? body.walletAddress
      : null;

  if (!code || !phoneNumber || !walletAddress) {
    return json(
      { error: 'invalid_request', message: 'code, phoneNumber, walletAddress required' },
      { status: 400 },
    );
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

  // Fetch the most recent active pending claim for this phone_hash.
  const params = new URLSearchParams({
    phone_hash: `eq.${phoneHash}`,
    'consumed_at': 'is.null',
    select: 'id,phone_hash,code_hash,initiated_by,pending_wallet_address,attempts,expires_at,consumed_at',
    order: 'created_at.desc',
    limit: '1',
  }).toString();
  const pendingRes = await fetch(`${supabaseUrl}/rest/v1/identity_claim_pending?${params}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!pendingRes.ok) return json({ error: 'upstream_error' }, { status: 502 });
  const rows = (await pendingRes.json().catch(() => [])) as PendingRow[];
  const row = rows[0];
  if (!row) return json({ error: 'no_pending_claim' }, { status: 404 });

  const snapshot: PendingClaimSnapshot = {
    phoneHash: row.phone_hash,
    codeHash: row.code_hash,
    initiatedBy: row.initiated_by,
    pendingWalletAddress: row.pending_wallet_address,
    attempts: row.attempts,
    expiresAt: new Date(row.expires_at).getTime(),
    consumedAt: row.consumed_at ? new Date(row.consumed_at).getTime() : null,
  };

  const verdict = await verifyClaim({ pending: snapshot, submittedCode: code, walletAddress });

  if (!verdict.ok) {
    // Increment attempts. Best-effort; ignore failures.
    await fetch(
      `${supabaseUrl}/rest/v1/identity_claim_pending?id=eq.${encodeURIComponent(row.id)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ attempts: row.attempts + 1 }),
      },
    ).catch(() => undefined);
    return json({ ok: false, reason: verdict.reason }, { status: 403 });
  }

  // Verification ok — write the link, mark pending consumed.
  const nonce = crypto.randomUUID();
  let proof: string;
  try {
    proof = await buildVerificationProof(code, nonce);
  } catch {
    return json({ error: 'identity_pepper_missing' }, { status: 503 });
  }

  const linkRes = await fetch(`${supabaseUrl}/rest/v1/identity_links`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      phone_hash: verdict.phoneHash,
      wallet_address: verdict.walletAddress,
      claim_method: snapshot.initiatedBy === 'ussd' ? 'ussd_initiated' : 'wallet_initiated',
      verification_proof: proof,
    }),
  });
  if (!linkRes.ok && linkRes.status !== 409) {
    return json({ error: 'link_write_failed' }, { status: 502 });
  }

  // Migrate memberships associated with this phone_hash to the new wallet_address (Stakeholder Decision 4)
  try {
    const memRes = await fetch(
      `${supabaseUrl}/rest/v1/memberships?user_id_hash=eq.${encodeURIComponent(verdict.phoneHash)}&status=in.(PENDING,ACTIVE)`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (memRes.ok) {
      const memRows = (await memRes.json().catch(() => [])) as Array<{ member_id: string; community_id: string; wallet_address: string }>;
      for (const m of memRows) {
        if (m.wallet_address === verdict.walletAddress) continue;
        const targetRes = await fetch(
          `${supabaseUrl}/rest/v1/memberships?community_id=eq.${encodeURIComponent(m.community_id)}&wallet_address=eq.${encodeURIComponent(verdict.walletAddress)}&status=in.(PENDING,ACTIVE)&limit=1`,
          { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
        );
        if (targetRes.ok) {
          const targets = (await targetRes.json().catch(() => [])) as Array<{ member_id: string }>;
          if (targets.length > 0) {
            await fetch(
              `${supabaseUrl}/rest/v1/memberships?member_id=eq.${encodeURIComponent(m.member_id)}`,
              {
                method: 'PATCH',
                headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
                body: JSON.stringify({ status: 'MIGRATED', migrated_to: targets[0].member_id }),
              },
            ).catch(() => undefined);
          } else {
            await fetch(
              `${supabaseUrl}/rest/v1/memberships?member_id=eq.${encodeURIComponent(m.member_id)}`,
              {
                method: 'PATCH',
                headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
                body: JSON.stringify({ wallet_address: verdict.walletAddress }),
              },
            ).catch(() => undefined);
          }
        }
      }
    }
  } catch {
    // Non-fatal
  }

  await fetch(
    `${supabaseUrl}/rest/v1/identity_claim_pending?id=eq.${encodeURIComponent(row.id)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ consumed_at: new Date().toISOString() }),
    },
  ).catch(() => undefined);

  return json({ ok: true, phoneHash: verdict.phoneHash, walletAddress: verdict.walletAddress });
}

export { handler as default, handler as POST, handler as OPTIONS };

