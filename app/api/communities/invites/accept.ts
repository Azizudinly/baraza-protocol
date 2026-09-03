// app/api/communities/invites/accept.ts
// Secure Community Invite Acceptance & Membership Activation

export const config = { runtime: 'edge' };

import { getSupabaseAdmin, jsonResponse } from '../../_lib/supabase';
import { resolveCallerIdentity } from '../../_lib/auth-session';

// In-Memory Rate Limiting Sliding Window (Max 10 attempts per minute per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(ipOrKey: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ipOrKey);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ipOrKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count += 1;
  return true;
}

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

  // Rate Limiting Guard
  const clientIp = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '127.0.0.1';
  if (!checkRateLimit(clientIp)) {
    return jsonResponse({
      error: 'rate_limited',
      message: 'Too many invite acceptance attempts. Please retry after 60 seconds.',
    }, {
      status: 429,
      headers: { 'Retry-After': '60' },
    });
  }

  const identity = await resolveCallerIdentity(req, 'accept-invite');
  if (!identity || (!identity.walletAddress && !identity.privyDid)) {
    return jsonResponse({ error: 'unauthorized', message: 'Authentication required to accept an invite.' }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = (await req.json()) as { code?: string };
  } catch {
    return jsonResponse({ error: 'invalid_json', message: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const code = body.code?.trim();
  if (!code || !/^[a-zA-Z0-9_-]{6,32}$/.test(code)) {
    return jsonResponse({ error: 'invalid_code', message: 'Invalid invite code format.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Fetch invite
  const { data: invite, error: invErr } = await supabase
    .from('community_invites')
    .select('*')
    .eq('code', code)
    .maybeSingle();

  if (invErr || !invite) {
    return jsonResponse({ error: 'not_found', message: 'Invite link not found or invalid.' }, { status: 404 });
  }

  // Check expiration
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return jsonResponse({ error: 'expired', message: 'Invite link has expired.' }, { status: 410 });
  }

  const communityId = invite.community_id;

  // Capacity Conservation Guard: Pre-check if caller is already a member
  let existingCheck = supabase.from('members').select('member_id, role').eq('community_id', communityId);
  if (identity.walletAddress) {
    existingCheck = existingCheck.eq('wallet_address', identity.walletAddress);
  } else {
    existingCheck = existingCheck.eq('auth_user_id', identity.privyDid);
  }

  const { data: existingMember } = await existingCheck.maybeSingle();
  if (existingMember) {
    return jsonResponse({
      ok: true,
      alreadyMember: true,
      communityId,
      role: existingMember.role,
      message: 'Caller is already an active member of this community. Invite capacity preserved.',
    });
  }

  // Check capacity
  if (invite.uses_count >= invite.max_uses) {
    return jsonResponse({ error: 'capacity_exhausted', message: 'Invite link usage capacity has been exhausted.' }, { status: 410 });
  }

  // Atomic Increment of uses_count bounded by max_uses
  const { data: updatedInvite, error: incErr } = await supabase
    .from('community_invites')
    .update({ uses_count: invite.uses_count + 1 })
    .eq('code', code)
    .lt('uses_count', invite.max_uses)
    .select()
    .single();

  if (incErr || !updatedInvite) {
    return jsonResponse({ error: 'capacity_exhausted', message: 'Invite capacity exhausted concurrently.' }, { status: 410 });
  }

  // Insert new member
  const memberId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const walletAddr = identity.walletAddress || `privy_wallet_${(identity.privyDid || '').replace(/[^a-zA-Z0-9]/g, '_')}`;
  const authUid = identity.privyDid || identity.walletAddress || memberId;

  const newMember = {
    member_id: memberId,
    community_id: communityId,
    wallet_address: walletAddr,
    auth_user_id: authUid,
    role: 'member',
    activation_status: 'active',
  };

  const { error: insErr } = await supabase.from('members').insert(newMember);
  if (insErr) {
    return jsonResponse({ error: 'database_error', message: insErr.message }, { status: 500 });
  }

  // Record audit log
  await supabase.from('community_audit_logs').insert({
    community_id: communityId,
    actor_wallet: identity.walletAddress || identity.privyDid || 'anonymous',
    action_type: 'MEMBER_JOINED_VIA_INVITE',
    target_subject: code,
    details: {
      invite_code: code,
      uses_count_now: updatedInvite.uses_count,
      max_uses: updatedInvite.max_uses,
    },
  });

  return jsonResponse({
    ok: true,
    joined: true,
    communityId,
    role: 'member',
    message: 'Successfully joined community via invite link.',
  });
}
