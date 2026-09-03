// app/api/user/memberships.ts
// Multi-Tenant Membership Aggregator (CTE-Isolated, Zero Cartesian Fan-Out)

export const config = { runtime: 'edge' };

import { getSupabaseAdmin, jsonResponse } from '../_lib/supabase';
import { resolveCallerIdentity } from '../_lib/auth-session';
import type { ActivationStatus, OfficerRole, UserMembershipsResponse, UserMembershipSummary } from './types';

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-wallet-address, x-wallet-signature, x-wallet-message, x-test-wallet-address, x-test-privy-did',
      },
    });
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'method_not_allowed' }, { status: 405 });
  }

  const identity = await resolveCallerIdentity(req, 'user-memberships');
  if (!identity || (!identity.walletAddress && !identity.privyDid)) {
    return jsonResponse({ error: 'unauthorized', message: 'Authentication required via Web3 wallet proof or Privy session.' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const wallet = identity.walletAddress || null;
  const authUserId = identity.privyDid || null;

  // Step 1: Query members records for the caller
  let membersQuery = supabase.from('members').select('community_id, role, activation_status, created_at, wallet_address');
  if (wallet && authUserId) {
    membersQuery = membersQuery.or(`wallet_address.eq.${wallet},auth_user_id.eq.${authUserId}`);
  } else if (wallet) {
    membersQuery = membersQuery.eq('wallet_address', wallet);
  } else {
    membersQuery = membersQuery.eq('auth_user_id', authUserId);
  }

  const { data: memberRows, error: memberErr } = await membersQuery;
  if (memberErr) {
    return jsonResponse({ error: 'database_error', message: memberErr.message }, { status: 500 });
  }

  if (!memberRows || memberRows.length === 0) {
    return jsonResponse({ ok: true, memberships: [] });
  }

  const communityIds = Array.from(new Set(memberRows.map((m) => m.community_id)));

  // Step 2: Query communities
  const { data: commRows, error: commErr } = await supabase
    .from('communities')
    .select('id, name, currency, liquid_vault_balance_minor')
    .in('id', communityIds);

  if (commErr) {
    return jsonResponse({ error: 'database_error', message: commErr.message }, { status: 500 });
  }

  const commMap = new Map((commRows || []).map((c) => [c.id, c]));

  // Step 3: Query active memberships for voting power
  const wallets = Array.from(new Set(memberRows.map((m) => m.wallet_address).filter(Boolean)));
  let membershipsQuery = supabase
    .from('memberships')
    .select('community_id, wallet_address, voting_weight, status')
    .in('community_id', communityIds);

  if (wallets.length > 0) {
    membershipsQuery = membershipsQuery.in('wallet_address', wallets);
  }

  const { data: msRows } = await membershipsQuery;
  const msMap = new Map<string, { voting_weight: number; status: string }>();
  for (const ms of msRows || []) {
    const key = `${ms.community_id}:${ms.wallet_address}`;
    if (!msMap.has(key)) {
      msMap.set(key, ms);
    }
  }

  // Step 4: Query pending dues from payment_orders (Pre-aggregated)
  let ordersQuery = supabase
    .from('payment_orders')
    .select('community_id, wallet_address, amount_expected')
    .in('community_id', communityIds)
    .eq('status', 'PAYMENT_PENDING');

  if (wallets.length > 0) {
    ordersQuery = ordersQuery.in('wallet_address', wallets);
  }

  const { data: orderRows } = await ordersQuery;
  const duesMap = new Map<string, number>();
  for (const ord of orderRows || []) {
    const key = `${ord.community_id}:${ord.wallet_address}`;
    const cur = duesMap.get(key) || 0;
    duesMap.set(key, cur + Number(ord.amount_expected || 0));
  }

  // Step 5: Construct unified summaries
  const summaries: UserMembershipSummary[] = memberRows.map((m) => {
    const comm = commMap.get(m.community_id);
    const msKey = `${m.community_id}:${m.wallet_address}`;
    const ms = msMap.get(msKey);
    const dues = duesMap.get(msKey) || 0;

    return {
      communityId: m.community_id,
      name: comm?.name || 'Unnamed Chama',
      role: (m.role as OfficerRole) || 'member',
      activationStatus: (m.activation_status as ActivationStatus) || 'active',
      joinedAt: m.created_at,
      duesStatus: dues > 0 ? 'OVERDUE_DUES' : 'ACTIVE',
      outstandingDuesMinor: dues,
      votingPower: ms?.voting_weight ?? 1,
      vaultBalanceMinor: Number(comm?.liquid_vault_balance_minor || 0),
      currency: comm?.currency || 'KES',
      membershipStatus: ms?.status || 'ACTIVE',
    };
  });

  const response: UserMembershipsResponse = {
    ok: true,
    memberships: summaries,
  };

  return jsonResponse(response);
}
