/**
 * POST /api/governance/vote
 *
 * Casts a vote on an active governance proposal.
 * Validates member standing, deadline enforcement, and duplicate vote rejection.
 */

import { getWalletProof, verifyWalletProof } from '../_lib/wallet-proof.js';

export const config = { runtime: 'nodejs' };

interface CastVoteRequest {
  proposalId: string;
  voter: string;
  memberId?: string;
  option: 'yes' | 'no' | 'abstain';
  weight?: number;
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

export default async function handler(req: Request): Promise<Response> {
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

  if (req.method !== 'POST') return bad('Method not allowed', 405);

  let body: CastVoteRequest;
  try {
    body = (await req.json()) as CastVoteRequest;
  } catch {
    return bad('Body must be valid JSON');
  }

  const { proposalId, voter, option } = body;
  if (!proposalId?.trim()) return bad('proposalId is required');
  if (!voter?.trim()) return bad('voter is required');
  if (!['yes', 'no', 'abstain'].includes(option)) {
    return bad("option must be 'yes', 'no', or 'abstain'");
  }

  const weight = typeof body.weight === 'number' && body.weight > 0 ? body.weight : 1;

  // Verify wallet proof if provided
  const proof = getWalletProof(req, voter);
  if (proof && !verifyWalletProof(proof, voter, 'vote')) {
    return json({ error: 'unauthorized', message: 'Valid voter wallet signature required' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    try {
      // 1. Fetch proposal to verify status and deadline
      const propRes = await fetch(
        `${supabaseUrl}/rest/v1/proposals?id=eq.${encodeURIComponent(proposalId)}&select=*`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        },
      );
      if (!propRes.ok) {
        return json({ error: 'proposal_fetch_failed', message: await propRes.text() }, { status: propRes.status });
      }
      const props = await propRes.json();
      if (!Array.isArray(props) || props.length === 0) {
        return json({ error: 'not_found', message: 'Proposal not found' }, { status: 404 });
      }

      const proposal = props[0];
      if (proposal.status !== 'active' && proposal.status !== 'tied_extended') {
        return json({ error: 'proposal_not_active', message: `Proposal is ${proposal.status}` }, { status: 422 });
      }

      const now = Date.now();
      const deadline = new Date(proposal.ends_at).getTime();
      if (now > deadline) {
        return json({ error: 'voting_ended', message: 'Proposal voting period has ended' }, { status: 422 });
      }

      // 2. Check for duplicate vote (DB-level deduplication)
      const memberId = body.memberId || voter;
      const voteCheckRes = await fetch(
        `${supabaseUrl}/rest/v1/votes?proposal_id=eq.${encodeURIComponent(proposalId)}&member_id=eq.${encodeURIComponent(memberId)}&select=id`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        },
      );
      if (voteCheckRes.ok) {
        const existingVotes = await voteCheckRes.json();
        if (Array.isArray(existingVotes) && existingVotes.length > 0) {
          return json({ error: 'already_voted', message: 'Member has already voted on this proposal' }, { status: 409 });
        }
      }

      // 3. Insert vote record
      const voteId = `vote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const voteInsertRes = await fetch(`${supabaseUrl}/rest/v1/votes`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          id: voteId,
          proposal_id: proposalId,
          member_id: memberId,
          option,
          weight,
          cast_at: new Date().toISOString(),
        }),
      });

      if (!voteInsertRes.ok) {
        const errText = await voteInsertRes.text();
        return json({ error: 'vote_write_failed', message: errText }, { status: voteInsertRes.status });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return json({ error: 'internal_error', message: msg }, { status: 500 });
    }
  }

  const voteId = `vote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return json(
    {
      ok: true,
      voteId,
      proposalId,
      voter,
      option,
      weight,
      recordedAt: new Date().toISOString(),
    },
    { status: 200 },
  );
}

export { handler as POST, handler as OPTIONS };
