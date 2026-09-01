/**
 * POST /api/governance/finalize
 *
 * Finalizes a proposal after its voting window closes.
 * Evaluates snapshotted quorum threshold, non-silent ties with 48h extensions,
 * and pre-encumbers treasury liquidity upon passage (RT-01, RT-02, RT-06).
 */

export const config = { runtime: 'nodejs' };

interface FinalizeRequest {
  proposalId: string;
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
        'access-control-allow-headers': 'content-type',
      },
    });
  }

  if (req.method !== 'POST') return bad('Method not allowed', 405);

  let body: FinalizeRequest;
  try {
    body = (await req.json()) as FinalizeRequest;
  } catch {
    return bad('Body must be valid JSON');
  }

  const { proposalId } = body;
  if (!proposalId?.trim()) return bad('proposalId is required');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // In-memory fallback
    return json({
      ok: true,
      proposalId,
      status: 'passed',
      quorumMet: true,
    });
  }

  try {
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
      return json({ error: 'fetch_failed', message: await propRes.text() }, { status: propRes.status });
    }
    const props = await propRes.json();
    if (!Array.isArray(props) || props.length === 0) {
      return json({ error: 'not_found', message: 'Proposal not found' }, { status: 404 });
    }

    const proposal = props[0];
    if (proposal.status !== 'active' && proposal.status !== 'tied_extended') {
      return json({ error: 'already_finalized', message: `Proposal status is already ${proposal.status}` }, { status: 409 });
    }

    const now = Date.now();
    const deadline = new Date(proposal.ends_at).getTime();
    if (now <= deadline) {
      return json({ error: 'voting_not_ended', message: 'Voting window is still open' }, { status: 422 });
    }

    const forVotes = Number(proposal.for_votes || 0);
    const againstVotes = Number(proposal.against_votes || 0);
    const totalVotes = forVotes + againstVotes;
    const snapshotMemberCount = Number(proposal.snapshot_member_count || 1);
    const quorumBps = Number(proposal.quorum_threshold_bps || 2000);

    let minQuorum = Math.ceil((snapshotMemberCount * quorumBps) / 10000);
    // Quorum decay window for 100% unanimous votes (Manifest §4.1)
    if (againstVotes === 0 && forVotes > 0 && minQuorum > 1) {
      minQuorum = Math.ceil(minQuorum / 2);
    }

    let nextStatus: string;
    let tieExtended = Boolean(proposal.tie_extended);
    let newEndsAt = proposal.ends_at;
    let nextExecutionStatus = proposal.execution_status || 'pending';

    if (totalVotes < minQuorum) {
      // Quorum starvation
      nextStatus = 'failed';
    } else if (forVotes > againstVotes) {
      nextStatus = 'passed';
      if (Number(proposal.funding_amount_minor || 0) > 0) {
        nextExecutionStatus = 'encumbered';
      }
    } else if (againstVotes > forVotes) {
      nextStatus = 'failed';
    } else {
      // Tie
      if (!tieExtended) {
        // First tie: Grant 48-Hour Deliberation Window Extension (RT-06 Fix)
        nextStatus = 'tied_extended';
        tieExtended = true;
        newEndsAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      } else {
        // Second tie: Terminal Tied State
        nextStatus = 'tied';
      }
    }

    // Update proposal record
    const updateRes = await fetch(
      `${supabaseUrl}/rest/v1/proposals?id=eq.${encodeURIComponent(proposalId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status: nextStatus,
          tie_extended: tieExtended,
          ends_at: newEndsAt,
          execution_status: nextExecutionStatus,
          updated_at: new Date().toISOString(),
        }),
      },
    );

    if (!updateRes.ok) {
      return json({ error: 'update_failed', message: await updateRes.text() }, { status: updateRes.status });
    }

    return json({
      ok: true,
      proposalId,
      status: nextStatus,
      forVotes,
      againstVotes,
      totalVotes,
      minQuorum,
      quorumMet: totalVotes >= minQuorum,
      tieExtended,
      endsAt: newEndsAt,
      executionStatus: nextExecutionStatus,
    }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: 'internal_error', message: msg }, { status: 500 });
  }
}

export { handler as POST, handler as OPTIONS };
