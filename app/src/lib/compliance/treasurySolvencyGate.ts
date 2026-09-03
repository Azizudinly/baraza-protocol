/**
 * Treasury Solvency Gate (Invariant I-REC-1 & I-REC-6)
 *
 * Verifies that a community is active, solvent, and not under an active
 * reconciliation circuit breaker freeze before authorizing payouts.
 */

export interface TreasurySolvencyResult {
  allowed: boolean;
  isPayoutFrozen: boolean;
  status: string;
  treasuryPolicy?: string;
  error?: string;
}

export async function assertTreasurySolvent(
  supabaseUrl: string,
  serviceKey: string,
  communityId: string
): Promise<TreasurySolvencyResult> {
  if (!communityId) {
    return { allowed: false, isPayoutFrozen: false, status: 'invalid_id', error: 'COMMUNITY_ID_REQUIRED' };
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/communities?id=eq.${encodeURIComponent(communityId)}&select=id,status,treasury_policy,is_payout_frozen`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'content-type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      return { allowed: false, isPayoutFrozen: true, status: 'error', error: 'FAILED_TO_VERIFY_COMMUNITY_SOLVENCY' };
    }

    const rows = (await res.json()) as Array<{
      id: string;
      status: string;
      treasury_policy: string;
      is_payout_frozen: boolean;
    }>;

    if (!Array.isArray(rows) || rows.length === 0) {
      return { allowed: false, isPayoutFrozen: true, status: 'not_found', error: 'COMMUNITY_NOT_FOUND' };
    }

    const comm = rows[0];

    // Circuit breaker trip conditions (Invariant I-REC-1 & I-REC-6)
    if (comm.is_payout_frozen || comm.status === 'paused' || comm.treasury_policy === 'manual-review') {
      return {
        allowed: false,
        isPayoutFrozen: comm.is_payout_frozen,
        status: comm.status,
        treasuryPolicy: comm.treasury_policy,
        error: 'TREASURY_CIRCUIT_BREAKER_ACTIVE: Community payouts are frozen due to active reconciliation variance.',
      };
    }

    return {
      allowed: true,
      isPayoutFrozen: false,
      status: comm.status,
      treasuryPolicy: comm.treasury_policy,
    };
  } catch {
    // Fail closed per Playbook Rule 1
    return { allowed: false, isPayoutFrozen: true, status: 'network_failure', error: 'SOLVENCY_GATE_INTERNAL_ERROR' };
  }
}
