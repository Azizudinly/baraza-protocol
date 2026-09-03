// app/api/communities/officers.ts
// Production Role-Based Access Control & Governance Mutation

export const config = { runtime: 'edge' };

import { getSupabaseAdmin, jsonResponse } from '../_lib/supabase';
import { resolveCallerIdentity } from '../_lib/auth-session';
import { assertValidSlug } from '../_lib/validation';
import type { OfficerMutationRequest, OfficerRole } from '../user/types';

const VALID_ROLES: OfficerRole[] = ['founder', 'admin', 'treasurer', 'member'];

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-wallet-address, x-wallet-signature, x-wallet-message, x-test-wallet-address, x-test-privy-did',
      },
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, { status: 405 });
  }

  const identity = await resolveCallerIdentity(req, 'officer-mutation');
  if (!identity || (!identity.walletAddress && !identity.privyDid)) {
    return jsonResponse({ error: 'unauthorized', message: 'Authentication required via Web3 wallet proof or Privy session.' }, { status: 401 });
  }

  let body: OfficerMutationRequest;
  try {
    body = (await req.json()) as OfficerMutationRequest;
  } catch {
    return jsonResponse({ error: 'invalid_json', message: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const { communityId, targetWallet, newRole, action } = body;
  try {
    assertValidSlug(communityId, 'communityId');
  } catch (err: unknown) {
    return jsonResponse({ error: 'invalid_parameter', message: (err as Error).message }, { status: 400 });
  }

  if (!targetWallet || typeof targetWallet !== 'string') {
    return jsonResponse({ error: 'invalid_input', message: 'targetWallet is required.' }, { status: 400 });
  }
  if (!VALID_ROLES.includes(newRole)) {
    return jsonResponse({ error: 'invalid_role', message: `Role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
  }
  if (action !== 'ASSIGN' && action !== 'REVOKE') {
    return jsonResponse({ error: 'invalid_action', message: 'Action must be ASSIGN or REVOKE.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Check community exists and fetch governance policies
  const { data: community, error: commErr } = await supabase
    .from('communities')
    .select('id, name, tier, treasury_policy')
    .eq('id', communityId)
    .maybeSingle();

  if (commErr || !community) {
    return jsonResponse({ error: 'not_found', message: 'Community not found.' }, { status: 404 });
  }

  // Invariant I-ROLE-3: SACCO Governance Policy Gate
  if (community.tier === 'sacco' && community.treasury_policy === 'proposal-only') {
    return jsonResponse({
      error: 'governance_policy_violation',
      message: 'Officer appointments in SACCO tier require formal democratic proposal governance.',
    }, { status: 422 });
  }

  // Check caller authorization
  let callerQuery = supabase.from('members').select('*').eq('community_id', communityId);
  if (identity.walletAddress) {
    callerQuery = callerQuery.eq('wallet_address', identity.walletAddress);
  } else {
    callerQuery = callerQuery.eq('auth_user_id', identity.privyDid);
  }

  const { data: callerMember } = await callerQuery.maybeSingle();
  if (!callerMember) {
    return jsonResponse({ error: 'forbidden', message: 'Caller is not a member of this community.' }, { status: 403 });
  }

  // Invariant I-ROLE-5: Active Officer Invariant
  if (callerMember.activation_status !== 'active') {
    return jsonResponse({
      error: 'forbidden',
      message: 'Caller officer account is suspended or pending activation.',
    }, { status: 403 });
  }

  // Invariant I-ROLE-1: Privilege Containment (Must be Founder or Admin)
  if (!['founder', 'admin'].includes(callerMember.role)) {
    return jsonResponse({
      error: 'forbidden',
      message: 'Caller lacks administrative privileges to mutate officer roles.',
    }, { status: 403 });
  }

  // Fetch target member (by wallet_address or auth_user_id)
  const { data: targetMember } = await supabase
    .from('members')
    .select('*')
    .eq('community_id', communityId)
    .or(`wallet_address.eq.${targetWallet},auth_user_id.eq.${targetWallet}`)
    .maybeSingle();

  if (!targetMember) {
    return jsonResponse({ error: 'not_found', message: 'Target member not found in this community.' }, { status: 404 });
  }

  // Invariant I-ROLE-4: Founder Sovereign Invariant
  if (targetMember.role === 'founder' && callerMember.role !== 'founder') {
    return jsonResponse({
      error: 'forbidden',
      message: 'Only a Community Founder can demote, revoke, or reassign a Founder.',
    }, { status: 403 });
  }

  // Invariant I-ROLE-2: Non-Zero Admin Invariant
  const isDemotingAdmin = ['founder', 'admin'].includes(targetMember.role) && (action === 'REVOKE' || !['founder', 'admin'].includes(newRole));
  if (isDemotingAdmin) {
    const { count, error: countErr } = await supabase
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('community_id', communityId)
      .in('role', ['founder', 'admin'])
      .eq('activation_status', 'active');

    if (countErr || count === null || count <= 1) {
      return jsonResponse({
        error: 'conflict',
        message: 'Cannot revoke or demote the sole remaining Community Administrator.',
      }, { status: 409 });
    }
  }

  // Determine final role
  const finalRole: OfficerRole = action === 'REVOKE' ? 'member' : newRole;

  // Execute mutation
  const { error: updErr } = await supabase
    .from('members')
    .update({ role: finalRole, updated_at: new Date().toISOString() })
    .eq('member_id', targetMember.member_id);

  if (updErr) {
    return jsonResponse({ error: 'database_error', message: updErr.message }, { status: 500 });
  }

  // Record immutable action in community_audit_logs
  await supabase.from('community_audit_logs').insert({
    community_id: communityId,
    actor_wallet: callerMember.wallet_address || identity.walletAddress || identity.privyDid,
    action_type: action === 'REVOKE' ? 'OFFICER_REVOKED' : 'OFFICER_ASSIGNED',
    target_subject: targetWallet,
    details: {
      previous_role: targetMember.role,
      new_role: finalRole,
      action,
    },
  });

  return jsonResponse({
    ok: true,
    communityId,
    targetWallet,
    previousRole: targetMember.role,
    newRole: finalRole,
    action,
  });
}
