export const config = { runtime: 'nodejs' };

import { timingSafeEqual } from 'node:crypto';

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = process.env.COMPLIANCE_REVIEW_SECRET;
  const authHeader = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;

  if (
    !secret ||
    authHeader.length !== expected.length ||
    !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  ) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  let body: { communityId?: string; justification?: string; resolutionJournalEntryId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), { status: 400 });
  }

  const { communityId, justification } = body;
  if (!communityId || !justification) {
    return new Response(JSON.stringify({ error: 'communityId and justification are required' }), { status: 422 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), { status: 503 });
  }

  // 1. Unfreeze community in database (restore status to active, unfreeze payouts)
  await fetch(`${supabaseUrl}/rest/v1/communities?id=eq.${encodeURIComponent(communityId)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      is_payout_frozen: false,
      treasury_policy: 'multisig-ready',
      status: 'active',
    }),
  });

  // 2. Acknowledge reconciliation variance alerts for this community
  await fetch(
    `${supabaseUrl}/rest/v1/compliance_alerts?community_id=eq.${encodeURIComponent(communityId)}&alert_type=eq.TREASURY_RECONCILIATION_VARIANCE`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: 'compliance_officer',
      }),
    }
  );

  // 3. Record RESOLVED entry in the append-only reconciliation audit log
  await fetch(`${supabaseUrl}/rest/v1/reconciliation_audit_logs`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      community_id: communityId,
      onchain_balance_minor: 0,
      ledger_balance_minor: 0,
      cached_vault_balance_minor: 0,
      variance_minor: 0,
      status: 'RESOLVED',
      metadata: {
        justification,
        resolutionJournalEntryId: body.resolutionJournalEntryId ?? null,
        resolved_at: new Date().toISOString(),
      },
    }),
  });

  return new Response(
    JSON.stringify({ ok: true, communityId, status: 'active', isPayoutFrozen: false }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}
