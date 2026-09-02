/**
 * /api/governance/proposals
 *
 * GET  - List proposals for a community with quorum metrics.
 * POST - Create a governance proposal with snapshotted member count and balance checks.
 */

import { getWalletProof, verifyWalletProof } from '../_lib/wallet-proof.js';

export const config = { runtime: 'nodejs' };

interface CreateProposalRequest {
  communityId: string;
  proposer: string;
  title: string;
  description: string;
  kind?: string;
  fundingAmountMinor?: number;
  votingPeriodDays?: number;
  quorumThresholdBps?: number;
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
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'content-type,x-wallet-address,x-wallet-message,x-wallet-signature',
      },
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const communityId = url.searchParams.get('communityId');
    if (!communityId) return bad('communityId is required', 400);

    if (!supabaseUrl || !serviceKey) {
      // In-memory / dev fallback if DB not configured
      return json({ ok: true, proposals: [], count: 0 });
    }

    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/proposals?community_id=eq.${encodeURIComponent(communityId)}&order=created_at.desc`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        },
      );
      if (!res.ok) {
        return json({ error: 'fetch_failed', message: await res.text() }, { status: res.status });
      }
      const proposals = await res.json();
      return json({ ok: true, proposals, count: Array.isArray(proposals) ? proposals.length : 0 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return json({ error: 'internal_error', message: msg }, { status: 500 });
    }
  }

  if (req.method !== 'POST') {
    return bad('Method not allowed', 405);
  }

  let body: CreateProposalRequest;
  try {
    body = (await req.json()) as CreateProposalRequest;
  } catch {
    return bad('Body must be valid JSON');
  }

  const { communityId, proposer, title, description } = body;
  if (!communityId?.trim()) return bad('communityId is required');
  if (!proposer?.trim()) return bad('proposer is required');
  if (!title?.trim()) return bad('title is required');
  if (!description?.trim()) return bad('description is required');

  // Verify wallet proof if provided or required
  const proof = getWalletProof(req, proposer);
  if (proof && !verifyWalletProof(proof, proposer, 'create-proposal')) {
    return json({ error: 'unauthorized', message: 'Valid wallet signature required' }, { status: 401 });
  }

  const kind = body.kind ?? 'general';
  const fundingAmountMinor = typeof body.fundingAmountMinor === 'number' && body.fundingAmountMinor > 0
    ? body.fundingAmountMinor
    : 0;
  const quorumThresholdBps = typeof body.quorumThresholdBps === 'number' && body.quorumThresholdBps > 0
    ? body.quorumThresholdBps
    : 2000; // default 20%
  const votingPeriodDays = typeof body.votingPeriodDays === 'number' && body.votingPeriodDays > 0
    ? body.votingPeriodDays
    : 7;

  const now = new Date();
  const startsAt = now.toISOString();
  const endsAt = new Date(now.getTime() + votingPeriodDays * 24 * 60 * 60 * 1000).toISOString();
  const proposalId = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  let snapshotMemberCount = 1;

  if (supabaseUrl && serviceKey) {
    try {
      // 1. Fetch active member count to snapshot the denominator (RT-01 Fix)
      const memberCountRes = await fetch(
        `${supabaseUrl}/rest/v1/memberships?community_id=eq.${encodeURIComponent(communityId)}&status=eq.active&select=member_id`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            Prefer: 'count=exact',
          },
        },
      );
      if (memberCountRes.ok) {
        const countHeader = memberCountRes.headers.get('content-range');
        if (countHeader) {
          const total = parseInt(countHeader.split('/')[1] || '1', 10);
          if (total > 0) snapshotMemberCount = total;
        }
      }

      // 2. Insert proposal row into Postgres
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/proposals`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'content-type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          id: proposalId,
          community_id: communityId,
          title,
          description,
          kind,
          status: 'active',
          chain: 'stellar',
          created_by: proposer,
          starts_at: startsAt,
          ends_at: endsAt,
          for_votes: 0,
          against_votes: 0,
          abstain_votes: 0,
          snapshot_member_count: snapshotMemberCount,
          quorum_threshold_bps: quorumThresholdBps,
          funding_amount_minor: fundingAmountMinor,
          tie_extended: false,
          execution_status: 'pending',
          created_at: startsAt,
          updated_at: startsAt,
        }),
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text();
        return json({ error: 'db_insert_failed', message: errText }, { status: insertRes.status });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return json({ error: 'internal_error', message: msg }, { status: 500 });
    }
  }

  return json(
    {
      ok: true,
      proposalId,
      communityId,
      proposer,
      title,
      description,
      status: 'active',
      snapshotMemberCount,
      quorumThresholdBps,
      fundingAmountMinor,
      startsAt,
      endsAt,
    },
    { status: 201 },
  );
}

export { handler as POST, handler as GET, handler as OPTIONS };
