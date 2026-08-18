/**
 * Retro-allocation mint cron.
 *
 * Two-step settlement matching the payment-order pattern:
 *
 *   pending   → atomically claim → submit via mintBrzaBatch → submitted (tx hash captured)
 *   submitted → confirmMintTransaction                     → confirmed | failed | (still pending)
 *
 * Once every allocation in a round is confirmed (no pending or submitted left),
 * the round advances from 'allocated' to 'settled'.
 *
 * Auth: Vercel cron sends `Authorization: Bearer ${CRON_SECRET}`. Manual
 * triggers from admins can supply `X-Admin-Wallet`. Either path is honored.
 *
 * Concurrency & Idempotency:
 *   - Overlapping/concurrent cron invocations are protected via atomic Compare-and-Set:
 *     Only the worker that successfully updates `settlement_status = 'pending'` → `'claiming'`
 *     proceeds to submit to `mintBrzaBatch`. Duplicate mint submissions are prevented.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  classifyMintError,
  confirmMintTransaction,
  mintBrzaBatch,
  STELLAR_MAX_OPS_PER_TX,
  type StellarNetworkName,
} from './_lib/stellar-mint.js';

export const config = { runtime: 'nodejs' };

export interface AllocationRow {
  id: string;
  round_id: string;
  recipient_wallet: string;
  brza_allocated: number;
  settlement_status: 'pending' | 'claiming' | 'submitted' | 'confirmed' | 'failed';
  settlement_tx: string | null;
}

function parseAdminWallets(): string[] {
  return (process.env.ADMIN_WALLETS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;

  const wallet = req.headers.get('x-admin-wallet');
  if (!wallet) return false;
  const allowed = parseAdminWallets();
  if (allowed.length === 0) return false;
  return allowed.includes(wallet);
}

function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface DistributorConfig {
  distributorSecret: string;
  issuerPublicKey: string;
  horizonUrl: string;
  network: StellarNetworkName;
}

function getDistributorConfig(): DistributorConfig | null {
  const distributorSecret = process.env.BRZA_DISTRIBUTOR_SECRET;
  const issuerPublicKey = process.env.BRZA_ISSUER_PUBLIC_KEY;
  const horizonUrl =
    process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';
  const networkEnv = (process.env.STELLAR_NETWORK ?? 'testnet') as StellarNetworkName;
  if (!distributorSecret || !issuerPublicKey) return null;
  return {
    distributorSecret,
    issuerPublicKey,
    horizonUrl,
    network: networkEnv,
  };
}

/**
 * Step 1: scan pending allocations grouped by round, atomically claim them, and submit batches.
 */
export async function submitPendingBatches(
  supabase: SupabaseClient,
  config: DistributorConfig,
): Promise<{ submitted: number; failed: number; rounds: number }> {
  const { data: pending } = await supabase
    .from('retro_allocations')
    .select('id, round_id, recipient_wallet, brza_allocated, settlement_status, settlement_tx')
    .eq('settlement_status', 'pending')
    .order('round_id, recipient_wallet')
    .limit(500);

  const rows = (pending ?? []) as AllocationRow[];
  if (rows.length === 0) {
    return { submitted: 0, failed: 0, rounds: 0 };
  }

  const byRound = new Map<string, AllocationRow[]>();
  for (const row of rows) {
    const list = byRound.get(row.round_id) ?? [];
    list.push(row);
    byRound.set(row.round_id, list);
  }

  let submitted = 0;
  let failed = 0;

  for (const [roundId, allocations] of byRound) {
    const batch = allocations.slice(0, STELLAR_MAX_OPS_PER_TX);
    const batchIds = batch.map((row) => row.id);

    // Atomically claim rows via Compare-and-Set: only claim rows still strictly 'pending'
    const { data: claimed } = await supabase
      .from('retro_allocations')
      .update({ settlement_status: 'claiming' })
      .in('id', batchIds)
      .eq('settlement_status', 'pending')
      .select('id, round_id, recipient_wallet, brza_allocated');

    const claimedBatch = (claimed ?? []) as AllocationRow[];
    if (claimedBatch.length === 0) {
      // Another concurrent worker claimed this batch in the race window; safely skip
      continue;
    }

    const result = await mintBrzaBatch({
      distributorSecret: config.distributorSecret,
      issuerPublicKey: config.issuerPublicKey,
      horizonUrl: config.horizonUrl,
      network: config.network,
      memo: `retro:${roundId.slice(0, 22)}`,
      entries: claimedBatch.map((row) => ({
        recipient: row.recipient_wallet,
        amount: String(row.brza_allocated),
      })),
    });

    if (result.ok) {
      const ids = claimedBatch.map((row) => row.id);
      await supabase
        .from('retro_allocations')
        .update({
          settlement_status: 'submitted',
          settlement_tx: result.txHash,
        })
        .in('id', ids);
      submitted += claimedBatch.length;
      continue;
    }

    if (result.retriable) {
      // Revert claimed rows back to 'pending' so next cron tick can retry
      const ids = claimedBatch.map((row) => row.id);
      await supabase
        .from('retro_allocations')
        .update({ settlement_status: 'pending' })
        .in('id', ids);
      continue;
    }

    // Terminal failure. If we have a failedOpIndex, isolate that one row and revert the rest
    if (typeof result.failedOpIndex === 'number' && result.failedOpIndex < claimedBatch.length) {
      const culprit = claimedBatch[result.failedOpIndex];
      await supabase
        .from('retro_allocations')
        .update({ settlement_status: 'failed' })
        .eq('id', culprit.id);
      failed += 1;

      // Revert other un-failed rows in this batch to pending
      const otherIds = claimedBatch.filter((r) => r.id !== culprit.id).map((r) => r.id);
      if (otherIds.length > 0) {
        await supabase
          .from('retro_allocations')
          .update({ settlement_status: 'pending' })
          .in('id', otherIds);
      }
    } else {
      // Mark entire claimed batch failed
      const ids = claimedBatch.map((row) => row.id);
      await supabase
        .from('retro_allocations')
        .update({ settlement_status: 'failed' })
        .in('id', ids);
      failed += claimedBatch.length;
    }
  }

  return { submitted, failed, rounds: byRound.size };
}

/**
 * Step 2: verify submitted allocations on Horizon. Confirmed → 'confirmed';
 * Horizon-revert → 'failed'; still propagating → leave at 'submitted'.
 */
export async function confirmSubmittedAllocations(
  supabase: SupabaseClient,
  config: DistributorConfig,
): Promise<{ confirmed: number; failed: number; pending: number }> {
  const { data: submitted } = await supabase
    .from('retro_allocations')
    .select('id, round_id, recipient_wallet, brza_allocated, settlement_status, settlement_tx')
    .eq('settlement_status', 'submitted')
    .not('settlement_tx', 'is', null)
    .limit(500);

  const rows = (submitted ?? []) as AllocationRow[];
  if (rows.length === 0) {
    return { confirmed: 0, failed: 0, pending: 0 };
  }

  const byTx = new Map<string, AllocationRow[]>();
  for (const row of rows) {
    if (!row.settlement_tx) continue;
    const list = byTx.get(row.settlement_tx) ?? [];
    list.push(row);
    byTx.set(row.settlement_tx, list);
  }

  let confirmed = 0;
  let failed = 0;
  let pendingCount = 0;

  for (const [txHash, group] of byTx) {
    const result = await confirmMintTransaction(config.horizonUrl, txHash);
    const ids = group.map((r) => r.id);
    const settledAt = new Date().toISOString();

    if (result.status === 'confirmed') {
      await supabase
        .from('retro_allocations')
        .update({ settlement_status: 'confirmed', settled_at: settledAt })
        .in('id', ids);
      confirmed += group.length;
    } else if (result.status === 'failed') {
      await supabase
        .from('retro_allocations')
        .update({ settlement_status: 'failed', settled_at: settledAt })
        .in('id', ids);
      failed += group.length;
    } else {
      pendingCount += group.length;
    }
  }

  return { confirmed, failed, pending: pendingCount };
}

/**
 * Step 3: advance rounds where every allocation is in a terminal state
 * (confirmed or failed) from 'allocated' to 'settled'.
 */
export async function settleCompletedRounds(supabase: SupabaseClient): Promise<number> {
  const { data: rounds } = await supabase
    .from('retro_rounds')
    .select('id')
    .eq('status', 'allocated');

  const roundRows = (rounds ?? []) as Array<{ id: string }>;
  if (roundRows.length === 0) return 0;

  let advanced = 0;
  for (const r of roundRows) {
    const { count: outstanding } = await supabase
      .from('retro_allocations')
      .select('id', { count: 'exact', head: true })
      .eq('round_id', r.id)
      .in('settlement_status', ['pending', 'claiming', 'submitted']);
    if ((outstanding ?? 0) === 0) {
      await supabase
        .from('retro_rounds')
        .update({ status: 'settled' })
        .eq('id', r.id)
        .eq('status', 'allocated');
      advanced += 1;
    }
  }
  return advanced;
}

async function runSettlement(): Promise<Response> {
  const supabase = getSupabase();
  if (!supabase) {
    return new Response(
      JSON.stringify({ ok: false, reason: 'no_supabase' }),
      { headers: { 'Content-Type': 'application/json' }, status: 503 },
    );
  }

  const config = getDistributorConfig();
  if (!config) {
    return new Response(
      JSON.stringify({
        ok: false,
        reason: 'no_distributor',
        message:
          'BRZA_DISTRIBUTOR_SECRET / BRZA_ISSUER_PUBLIC_KEY not configured. Pending allocations are untouched.',
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 },
    );
  }

  try {
    const submit = await submitPendingBatches(supabase, config);
    const confirm = await confirmSubmittedAllocations(supabase, config);
    const settled = await settleCompletedRounds(supabase);

    return new Response(
      JSON.stringify({
        ok: true,
        submit,
        confirm,
        roundsSettled: settled,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const classified = classifyMintError(err);
    return new Response(
      JSON.stringify({
        ok: false,
        error: classified.message,
        retriable: classified.retriable,
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 },
    );
  }
}

export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return runSettlement();
}

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return runSettlement();
}
