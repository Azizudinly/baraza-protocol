import { createClient } from '@supabase/supabase-js';
import {
  allocateRetroRound,
  type RetroVote,
} from '../../src/lib/brza/retroRounds.js';
import { buildVoterProfiles } from '../../src/lib/brza/voterProfile.js';
import { getWalletProof, verifyWalletProof } from '../_lib/wallet-proof.js';

export const config = { runtime: 'nodejs' };

/**
 * Settle a retro round.
 *
 * POST /api/communities/retro-settle
 * Body: { roundId }
 *
 * Behaviour:
 *   1. Round must exist and have `status='voting'` and `voting_closes_at` ≤ now.
 *   2. Load every ballot.
 *   3. Build voter profiles (today: stubbed at weight 1.0 — see TODO).
 *   4. Run `allocateRetroRound` to produce per-recipient allocations.
 *   5. Upsert allocations into `retro_allocations` with settlement_status='pending'.
 *   6. Advance round to `status='allocated'`.
 *
 * Mint queueing is intentionally out of scope here. The cron promoter
 * (`api/cron/promote-orders.ts`) is the existing pattern for moving BRZA on
 * Stellar; a follow-up will extend it to scan `retro_allocations` rows with
 * `settlement_status='pending'` and queue mints.
 *
 * Auth: this endpoint accepts a cron trigger (checked via `Authorization: Bearer ${CRON_SECRET}`)
 * OR an admin wallet in `X-Admin-Wallet`. Either path works for manual
 * triggers during dev.
 */

function parseAdminWallets(): string[] {
  return (process.env.ADMIN_WALLETS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAuthorized(req: Request): boolean {
  // Path 1: cron secret
  const auth = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;

  // Path 2: admin wallet
  const wallet = req.headers.get('x-admin-wallet');
  if (!wallet) return false;
  const allowed = parseAdminWallets();
  if (allowed.length === 0 || !allowed.includes(wallet)) return false;
  return verifyWalletProof(getWalletProof(req, wallet), wallet, 'retro-settle');
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function corsHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };
}

export function OPTIONS(): Response {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Wallet, Authorization, X-Wallet-Address, X-Wallet-Message, X-Wallet-Signature',
    },
  });
}

interface SettleBody {
  roundId?: string;
}

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: corsHeaders(),
    });
  }

  let body: SettleBody;
  try {
    body = (await req.json()) as SettleBody;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }
  if (!body.roundId) {
    return new Response(JSON.stringify({ error: 'roundId required' }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return new Response(
      JSON.stringify({ error: 'supabase_unavailable' }),
      { status: 503, headers: corsHeaders() },
    );
  }

  // 1. Round eligible to settle?
  const { data: round, error: roundErr } = await supabase
    .from('retro_rounds')
    .select('id, community_id, status, voting_closes_at, pool_brza')
    .eq('id', body.roundId)
    .maybeSingle();
  if (roundErr) {
    return new Response(JSON.stringify({ error: roundErr.message }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
  if (!round) {
    return new Response(JSON.stringify({ error: 'round_not_found' }), {
      status: 404,
      headers: corsHeaders(),
    });
  }
  const r = round as {
    id: string;
    community_id: string;
    status: string;
    voting_closes_at: string;
    pool_brza: number;
  };
  if (r.status === 'allocated' || r.status === 'settled') {
    return new Response(
      JSON.stringify({
        error: 'already_settled',
        message: `Round is already ${r.status}.`,
      }),
      { status: 409, headers: corsHeaders() },
    );
  }
  if (new Date(r.voting_closes_at).getTime() > Date.now()) {
    return new Response(
      JSON.stringify({
        error: 'voting_still_open',
        message: 'Voting has not closed yet.',
      }),
      { status: 409, headers: corsHeaders() },
    );
  }

  // 2. Pull votes
  const { data: votesRows, error: votesErr } = await supabase
    .from('retro_votes')
    .select('round_id, voter_wallet, allocations')
    .eq('round_id', r.id);
  if (votesErr) {
    return new Response(JSON.stringify({ error: votesErr.message }), {
      status: 500,
      headers: corsHeaders(),
    });
  }

  const votes: RetroVote[] = (votesRows ?? []).map((row) => {
    const typed = row as {
      round_id: string;
      voter_wallet: string;
      allocations: Record<string, number>;
    };
    return {
      roundId: typed.round_id,
      voterWallet: typed.voter_wallet,
      allocations: typed.allocations,
    };
  });

  // 3. Voter profiles (today: stubbed)
  const voterWallets = votes.map((v) => v.voterWallet);
  const profiles = await buildVoterProfiles(supabase, r.community_id, voterWallets);

  // 4. Allocate
  const allocations = allocateRetroRound({ poolBrza: r.pool_brza }, votes, profiles);

  // 5. Persist
  if (allocations.length > 0) {
    const rows = allocations.map((a) => ({
      round_id: r.id,
      recipient_wallet: a.recipientWallet,
      brza_allocated: a.brzaAllocated,
      baseline_brza: a.baselineBrza,
      multiplier_brza: a.multiplierBrza,
      vote_share: Number(a.voteShare.toFixed(4)),
      settlement_status: 'pending',
    }));
    const { error: insertErr } = await supabase
      .from('retro_allocations')
      .upsert(rows, { onConflict: 'round_id,recipient_wallet' });
    if (insertErr) {
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        { status: 500, headers: corsHeaders() },
      );
    }
  }

  // 6. Advance round
  const { error: updateErr } = await supabase
    .from('retro_rounds')
    .update({ status: 'allocated' })
    .eq('id', r.id);
  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), {
      status: 500,
      headers: corsHeaders(),
    });
  }

  return new Response(
    JSON.stringify({
      roundId: r.id,
      voteCount: votes.length,
      recipientCount: allocations.length,
      totalBrzaAllocated: allocations.reduce((s, a) => s + a.brzaAllocated, 0),
    }),
    { headers: corsHeaders() },
  );
}


export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return OPTIONS();
  if (req.method === 'POST') return POST(req);
  return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: corsHeaders() });
}
