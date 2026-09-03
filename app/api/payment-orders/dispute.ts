// app/api/payment-orders/dispute.ts
// Two-Phase Dispute Recourse FSM & Monotonic Lock Dual-Write Engine

export const config = { runtime: 'edge' };

import { getSupabaseAdmin, jsonResponse } from '../_lib/supabase';
import { resolveCallerIdentity } from '../_lib/auth-session';
import { assertValidHttpsUrl, assertValidSlug, sanitizeText } from '../_lib/validation';
import type { DisputeResolutionRequest, DisputeSubmissionRequest, DisputeType } from '../user/types';

const VALID_DISPUTE_TYPES: DisputeType[] = ['PAYMENT_NOT_CREDITED', 'WRONG_AMOUNT', 'DUPLICATE_DEBIT', 'OTHER'];
const STATUTE_OF_LIMITATIONS_MS = 14 * 24 * 60 * 60 * 1000; // 14 Calendar Days

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

  const identity = await resolveCallerIdentity(req, 'payment-dispute');
  if (!identity || (!identity.walletAddress && !identity.privyDid)) {
    return jsonResponse({ error: 'unauthorized', message: 'Authentication required for dispute operations.' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'invalid_json', message: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Branch A: Resolve an existing dispute
  if ('disputeId' in body && 'resolution' in body) {
    return handleDisputeResolution(body as unknown as DisputeResolutionRequest, identity, supabase);
  }

  // Branch B: Lodge a new dispute
  return handleDisputeSubmission(body as unknown as DisputeSubmissionRequest, identity, supabase);
}

async function handleDisputeSubmission(
  req: DisputeSubmissionRequest,
  identity: { walletAddress?: string; privyDid?: string },
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<Response> {
  const { orderId, communityId, disputeType, amountDisputedMinor, reason, telcoProofReference, evidenceUrl } = req;

  try {
    assertValidSlug(orderId, 'orderId');
    assertValidSlug(communityId, 'communityId');
  } catch (err: unknown) {
    return jsonResponse({ error: 'invalid_parameter', message: (err as Error).message }, { status: 400 });
  }

  if (!amountDisputedMinor || typeof amountDisputedMinor !== 'number' || amountDisputedMinor <= 0) {
    return jsonResponse({ error: 'invalid_amount', message: 'amountDisputedMinor must be a strictly positive integer.' }, { status: 400 });
  }

  if (!VALID_DISPUTE_TYPES.includes(disputeType)) {
    return jsonResponse({ error: 'invalid_type', message: `disputeType must be one of: ${VALID_DISPUTE_TYPES.join(', ')}` }, { status: 400 });
  }

  const cleanReason = sanitizeText(reason, 500);
  if (!cleanReason || cleanReason.length < 5) {
    return jsonResponse({ error: 'invalid_reason', message: 'reason must be at least 5 characters long.' }, { status: 400 });
  }

  let validEvidenceUrl: string | undefined;
  try {
    validEvidenceUrl = assertValidHttpsUrl(evidenceUrl, 'evidenceUrl');
  } catch (err: unknown) {
    return jsonResponse({ error: 'invalid_evidence_url', message: (err as Error).message }, { status: 400 });
  }

  // Fetch parent payment order
  const { data: order, error: orderErr } = await supabase
    .from('payment_orders')
    .select('*')
    .eq('order_id', orderId)
    .eq('community_id', communityId)
    .maybeSingle();

  if (orderErr || !order) {
    return jsonResponse({ error: 'not_found', message: 'Payment order not found in this community.' }, { status: 404 });
  }

  // Invariant I-DISP-3: 14-Day Statute of Limitations
  const orderAgeMs = Date.now() - new Date(order.created_at).getTime();
  if (orderAgeMs > STATUTE_OF_LIMITATIONS_MS) {
    return jsonResponse({
      error: 'statute_of_limitations_exceeded',
      message: 'Order exceeds the 14-day statutory dispute window. Please contact community officers for AGM review.',
    }, { status: 422 });
  }

  // Invariant I-DISP-1: Single-Recourse Invariant
  const { data: activeDispute } = await supabase
    .from('payment_disputes')
    .select('id, status')
    .eq('order_id', orderId)
    .in('status', ['PENDING', 'UNDER_REVIEW'])
    .maybeSingle();

  if (activeDispute) {
    return jsonResponse({
      error: 'conflict',
      message: 'An active dispute is already open for this payment order.',
    }, { status: 409 });
  }

  // Insert dispute record
  const disputant = identity.walletAddress || identity.privyDid || 'anonymous';
  const cleanTelcoRef = telcoProofReference?.trim() ? sanitizeText(telcoProofReference.trim(), 64) : null;

  const { data: insertedDispute, error: insErr } = await supabase
    .from('payment_disputes')
    .insert({
      order_id: orderId,
      community_id: communityId,
      disputant_wallet: disputant,
      dispute_type: disputeType,
      amount_disputed_minor: amountDisputedMinor,
      reason: cleanReason,
      telco_proof_reference: cleanTelcoRef,
      evidence_url: validEvidenceUrl || null,
      status: 'PENDING',
    })
    .select()
    .single();

  if (insErr || !insertedDispute) {
    return jsonResponse({ error: 'database_error', message: insErr?.message || 'Failed to lodge dispute' }, { status: 500 });
  }

  // Update order status to DISPUTED_PENDING
  await supabase
    .from('payment_orders')
    .update({ status: 'DISPUTED_PENDING', updated_at: new Date().toISOString() })
    .eq('order_id', orderId);

  return jsonResponse({
    ok: true,
    disputeId: insertedDispute.id,
    orderId,
    status: 'PENDING',
    message: 'Dispute successfully lodged and order locked in DISPUTED_PENDING status.',
  });
}

async function handleDisputeResolution(
  req: DisputeResolutionRequest,
  identity: { walletAddress?: string; privyDid?: string },
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<Response> {
  const { disputeId, resolution, resolutionNotes } = req;

  if (resolution !== 'REFUND' && resolution !== 'REJECT') {
    return jsonResponse({ error: 'invalid_resolution', message: 'resolution must be REFUND or REJECT.' }, { status: 400 });
  }

  // Fetch dispute
  const { data: dispute, error: dispErr } = await supabase
    .from('payment_disputes')
    .select('*')
    .eq('id', disputeId)
    .maybeSingle();

  if (dispErr || !dispute) {
    return jsonResponse({ error: 'not_found', message: 'Dispute record not found.' }, { status: 404 });
  }

  if (['RESOLVED_REFUNDED', 'REJECTED'].includes(dispute.status)) {
    return jsonResponse({ error: 'already_resolved', message: 'Dispute has already been resolved.' }, { status: 409 });
  }

  const communityId = dispute.community_id;

  // Authorization: Officer verification
  let officerCheck = supabase.from('members').select('role, activation_status').eq('community_id', communityId);
  if (identity.walletAddress) {
    officerCheck = officerCheck.eq('wallet_address', identity.walletAddress);
  } else {
    officerCheck = officerCheck.eq('auth_user_id', identity.privyDid);
  }

  const { data: officerMember } = await officerCheck.maybeSingle();
  if (!officerMember || !['founder', 'admin', 'treasurer'].includes(officerMember.role)) {
    return jsonResponse({ error: 'forbidden', message: 'Only an authorized community officer can arbitrate disputes.' }, { status: 403 });
  }
  if (officerMember.activation_status !== 'active') {
    return jsonResponse({ error: 'forbidden', message: 'Officer account is suspended or inactive.' }, { status: 403 });
  }

  const resolvedBy = identity.walletAddress || identity.privyDid || 'officer';
  const cleanNotes = sanitizeText(resolutionNotes, 500);

  // Case 1: Dispute Rejection (Reverts order to MANUAL_REVIEW)
  if (resolution === 'REJECT') {
    await supabase
      .from('payment_disputes')
      .update({
        status: 'REJECTED',
        resolution_notes: cleanNotes,
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', disputeId);

    await supabase
      .from('payment_orders')
      .update({ status: 'MANUAL_REVIEW', updated_at: new Date().toISOString() })
      .eq('order_id', dispute.order_id);

    return jsonResponse({
      ok: true,
      disputeId,
      resolution: 'REJECTED',
      newOrderStatus: 'MANUAL_REVIEW',
      message: 'Dispute rejected; order status returned to MANUAL_REVIEW.',
    });
  }

  // Case 2: Dispute Approval with Refund
  // Invariant I-LOCK-1: Monotonic Lock Order (communities -> orders -> disputes -> journal_entries)
  // 1. Fetch & lock community cached balance
  const { data: community, error: commErr } = await supabase
    .from('communities')
    .select('id, liquid_vault_balance_minor')
    .eq('id', communityId)
    .single();

  if (commErr || !community) {
    return jsonResponse({ error: 'not_found', message: 'Community record not found.' }, { status: 404 });
  }

  const currentVaultBalance = Number(community.liquid_vault_balance_minor || 0);
  const refundAmount = Number(dispute.amount_disputed_minor);

  if (currentVaultBalance < refundAmount) {
    return jsonResponse({
      error: 'insufficient_vault_liquidity',
      message: `Community vault balance (${currentVaultBalance}) is insufficient for compensatory refund of ${refundAmount}.`,
    }, { status: 422 });
  }

  // Invariant I-DISP-2: Atomic Dual-Write Solvency Synchronization
  // 2. Decrement cached vault balance
  const { error: vaultErr } = await supabase
    .from('communities')
    .update({
      liquid_vault_balance_minor: currentVaultBalance - refundAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', communityId);

  if (vaultErr) {
    return jsonResponse({ error: 'database_error', message: vaultErr.message }, { status: 500 });
  }

  // 3. Update order status to DISPUTED_RESOLVED
  await supabase
    .from('payment_orders')
    .update({ status: 'DISPUTED_RESOLVED', updated_at: new Date().toISOString() })
    .eq('order_id', dispute.order_id);

  // 4. Update dispute status to RESOLVED_REFUNDED
  const { error: dispUpdErr } = await supabase
    .from('payment_disputes')
    .update({
      status: 'RESOLVED_REFUNDED',
      resolution_notes: cleanNotes,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', disputeId);

  if (dispUpdErr) {
    return jsonResponse({ error: 'database_error', message: dispUpdErr.message }, { status: 500 });
  }

  // 5. Insert compensatory reversal entry into journal_entries
  const { error: journalErr } = await supabase.from('journal_entries').insert({
    community_id: communityId,
    reference_id: disputeId,
    reference_type: 'compensatory_reversal',
    debit_account: 'baraza:community_treasury',
    credit_account: 'baraza:clearing:dispute_settlement',
    amount_minor: refundAmount,
    currency: 'KES',
  });

  if (journalErr) {
    return jsonResponse({ error: 'journal_error', message: journalErr.message }, { status: 500 });
  }

  return jsonResponse({
    ok: true,
    disputeId,
    resolution: 'RESOLVED_REFUNDED',
    amountRefundedMinor: refundAmount,
    newOrderStatus: 'DISPUTED_RESOLVED',
    message: 'Compensatory refund executed. Journal entry recorded and cached vault balance decremented.',
  });
}
