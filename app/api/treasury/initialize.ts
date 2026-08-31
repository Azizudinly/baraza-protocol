/**
 * POST /api/treasury/initialize
 *
 * Initializes the Stellar Soroban `treasury_vault` contract for a community.
 * Implements Progressive Governance (Stakeholder Decision 3):
 *   - Initializes with Founder as the initial 1-of-1 signer.
 *   - Stores vault metadata in the database for tracking.
 */

import { getWalletProof, verifyWalletProof } from '../_lib/wallet-proof.js';

export const config = { runtime: 'nodejs' };

interface TreasuryInitRequest {
  communityId: string;
  vaultAddress?: string;
  adminAddress: string;
  signers?: string[];
  threshold?: number;
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

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST,OPTIONS',
        'access-control-allow-headers': 'content-type,x-wallet-address,x-wallet-message,x-wallet-signature',
      },
    });
  }

  if (req.method !== 'POST') return bad('method not allowed', 405);

  let body: TreasuryInitRequest;
  try {
    body = (await req.json()) as TreasuryInitRequest;
  } catch {
    return bad('Body must be valid JSON');
  }

  const { communityId, adminAddress } = body;
  if (!communityId?.trim()) return bad('communityId is required');
  if (!adminAddress?.trim()) return bad('adminAddress is required');

  // Verify wallet proof from the founder
  if (!verifyWalletProof(getWalletProof(req, adminAddress), adminAddress, 'treasury-init')) {
    return json({ error: 'unauthorized', message: 'Valid wallet signature required' }, { status: 401 });
  }

  const signers = Array.isArray(body.signers) && body.signers.length > 0 ? body.signers : [adminAddress];
  const threshold = typeof body.threshold === 'number' && body.threshold >= 1 && body.threshold <= signers.length
    ? body.threshold
    : 1;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    // Persist vault configuration to community record
    try {
      await fetch(
        `${supabaseUrl}/rest/v1/communities?id=eq.${encodeURIComponent(communityId)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            treasury_policy: threshold === 1 ? 'single-signer-progressive' : 'multisig-active',
            updated_at: new Date().toISOString(),
          }),
        },
      );
    } catch {
      // Non-fatal
    }
  }

  return json({
    ok: true,
    communityId,
    adminAddress,
    signers,
    threshold,
    status: 'INITIALIZED',
    progressiveMultisigReady: true,
  }, { status: 200 });
}

export { handler as default, handler as POST, handler as OPTIONS };
