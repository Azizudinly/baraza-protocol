/**
 * Status promoter — moves payment orders one step along the happy path on
 * every cron tick.
 *
 * The MINT_QUEUED → MINT_SUBMITTED transition is the only step that
 * actually does real Stellar work: it submits a BRZA payment from the
 * distributor to the recipient's wallet, captures the tx hash as
 * `mint_signature`, and advances status. Other transitions are still
 * status walks until the on-chain indexer wait logic lands (downstream).
 *
 * Key-gated: if BRZA_DISTRIBUTOR_SECRET or BRZA_ISSUER_PUBLIC_KEY is
 * unset, the mint step no-ops and orders stay at MINT_QUEUED. The rest
 * of the chain still progresses.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically
 * when scheduled via `vercel.json`. Manual calls in dev should set the same
 * header (or skip auth in dev mode).
 *
 * Each tick processes promotions in REVERSE order so an order moves at most
 * one stage per tick (otherwise PAYMENT_CONFIRMED would fast-forward to
 * RECONCILED in a single tick).
 *
 * Schedule: see `vercel.json` crons. Locked to "0 0 * * *" (daily) because
 * Vercel Hobby rejects any expression that fires more than once per day at
 * DEPLOY time. The design intent is a five-minute reconciliation cadence
 * (slash-5 stars) — restore the moment the project moves to Pro.
 * Member-facing impact today: payment promotion takes up to 24h instead
 * of up to 5min.
 */

import { timingSafeEqual } from 'node:crypto';

import {
  confirmMintTransaction,
  mintBrzaBatch,
  mintBrzaPayment,
  STELLAR_MAX_OPS_PER_TX,
  type StellarNetworkName,
} from './_lib/stellar-mint.js';
import { flagPendingWelcomeOnOrder } from '../../src/lib/ussd/welcome.js';
import { sweepInvisibleUssdMembers } from '../../src/lib/ussd/monitoring.js';

// nodejs runtime — Stellar SDK isn't edge-compatible (Buffer + Node fetch).
export const config = { runtime: 'nodejs' };

const PROMOTIONS: Array<{ from: string; to: string }> = [
  // Reverse order matters — see file header.
  // MINT_QUEUED → MINT_SUBMITTED is NOT here; handled by mintQueuedOrders()
  // which writes mint_signature alongside the status PATCH.
  // MINT_SUBMITTED → MINT_CONFIRMED is NOT here; handled by
  // confirmSubmittedMints() which queries Horizon to verify the tx landed
  // before advancing. A blind PATCH here would falsely advance reverted txs.
  { from: 'INDEXER_CONFIRMED', to: 'RECONCILED' },
  { from: 'MINT_CONFIRMED',    to: 'INDEXER_CONFIRMED' },
  { from: 'PAYMENT_CONFIRMED', to: 'MINT_QUEUED' },
];

/**
 * MINT_SUBMITTED orders older than this without confirmation get logged
 * as warnings for manual review. Horizon usually confirms within seconds;
 * 30min stuck means the tx expired (timeout exceeded) or the recipient's
 * account state changed after submission. Auto-failing isn't safe here —
 * a network partition could falsely mark good orders as failed.
 */
const MINT_SUBMITTED_STALE_MS = 30 * 60 * 1000;

interface MintQueuedOrder {
  order_id: string;
  wallet_address: string;
  brza_allocated: number | null;
}

const HORIZON_FALLBACKS: Record<StellarNetworkName, string> = {
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
};

function resolveNetwork(): StellarNetworkName {
  const raw = process.env.STELLAR_NETWORK ?? process.env.VITE_STELLAR_NETWORK;
  return raw === 'mainnet' ? 'mainnet' : 'testnet';
}

function resolveHorizonUrl(network: StellarNetworkName): string {
  const configured = process.env.STELLAR_HORIZON_URL ?? process.env.VITE_STELLAR_HORIZON_URL;
  if (configured?.trim()) return configured.replace(/\/$/, '');
  return HORIZON_FALLBACKS[network];
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
}

/**
 * Vercel Cron's trigger request doesn't always reach this handler as a
 * Headers instance (observed in production: `req.headers.get is not a
 * function`, unlike normal HTTP-triggered invocations of this same
 * nodejs function). Accept either a Headers-like object or a plain
 * header record so the cron tick never throws before the auth check runs.
 */
function getAuthorizationHeader(req: Request): string {
  const headers = req.headers as unknown;
  if (headers && typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get('authorization') ?? '';
  }
  const record = headers as Record<string, string | string[] | undefined> | undefined;
  const raw = record?.authorization ?? record?.['Authorization'];
  return (Array.isArray(raw) ? raw[0] : raw) ?? '';
}

function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const header = Buffer.from(getAuthorizationHeader(req));
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  return header.length === expected.length && timingSafeEqual(header, expected);
}

function paymentOrderFilter(from: string): string {
  const env =
    process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
      ? 'production'
      : 'sandbox';
  return new URLSearchParams({
    status: `eq.${from}`,
    provider_environment: `eq.${env}`,
  }).toString();
}

interface MintTickResult {
  attempted: number;
  minted: number;
  retriable_failed: number;
  terminal_failed: number;
  skipped_no_allocation: number;
  /** Count of multi-op batch txs submitted this tick. 0 means per-order path. */
  batched_txs?: number;
  /** Set when the key guard fired and no orders were attempted. */
  skipped_reason?: 'distributor_secret_unset' | 'issuer_pk_unset' | 'supabase_unset';
}

async function fetchMintQueue(): Promise<MintQueuedOrder[]> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return [];

  const params = new URLSearchParams({
    status: 'eq.MINT_QUEUED',
    provider_environment:
      process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
        ? 'eq.production'
        : 'eq.sandbox',
    select: 'order_id,wallet_address,brza_allocated',
    // Bound the work per tick. Stellar SDK's single-op tx submission is the
    // bottleneck here; batching into massPay() is a follow-up.
    limit: '25',
  }).toString();

  const res = await fetch(`${url}/rest/v1/payment_orders?${params}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
    },
  });
  if (!res.ok) {
    console.warn('[promote-orders] fetchMintQueue failed', res.status);
    return [];
  }
  return (await res.json().catch(() => [])) as MintQueuedOrder[];
}

async function markMintSubmitted(orderId: string, txHash: string): Promise<void> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  await fetch(`${url}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ status: 'MINT_SUBMITTED', mint_signature: txHash }),
  });
}

/**
 * Source of the mint failure — submission attempt vs. post-submission
 * Horizon lookup. Captured in metadata so admin tooling can split
 * "never landed" from "landed but reverted" without parsing error strings.
 */
type MintFailureStage = 'submission' | 'confirmation';

async function markMintFailed(
  orderId: string,
  error: string,
  stage: MintFailureStage = 'submission',
): Promise<void> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  // MINT_FAILED_FINAL is in migration 010's intent-token unique-index
  // exclusion list, so the user can retry the original signed intent.
  //
  // metadata is jsonb (migration 017). On installs that haven't run 017
  // yet, the PATCH 400s on the unknown column. We try with metadata first
  // and fall back to status-only — old installs still get the state walk,
  // just without the queryable failure record.
  const payload = {
    status: 'MINT_FAILED_FINAL',
    metadata: {
      mint_failure: {
        stage,
        error,
        failed_at: new Date().toISOString(),
      },
    },
  };

  const patchUrl = `${url}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}`;
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json',
  };

  const res = await fetch(patchUrl, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // Migration 017 not applied → metadata column missing. Fall back so
    // the status still advances; we lose the queryable failure trail
    // until the operator runs `supabase db push`.
    await fetch(patchUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'MINT_FAILED_FINAL' }),
    });
  }

  console.warn('[promote-orders] mint terminal failure', orderId, stage, error);
}

interface SubmittedOrder {
  order_id: string;
  mint_signature: string | null;
  updated_at: string;
}

interface ConfirmTickResult {
  attempted: number;
  confirmed: number;
  failed: number;
  still_pending: number;
  stale_pending: number;
  skipped_no_signature: number;
}

async function fetchSubmittedOrders(): Promise<SubmittedOrder[]> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return [];

  const params = new URLSearchParams({
    status: 'eq.MINT_SUBMITTED',
    provider_environment:
      process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production'
        ? 'eq.production'
        : 'eq.sandbox',
    select: 'order_id,mint_signature,updated_at',
    limit: '50',
  }).toString();

  const res = await fetch(`${url}/rest/v1/payment_orders?${params}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
    },
  });
  if (!res.ok) {
    console.warn('[promote-orders] fetchSubmittedOrders failed', res.status);
    return [];
  }
  return (await res.json().catch(() => [])) as SubmittedOrder[];
}

async function markMintConfirmed(orderId: string): Promise<void> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  await fetch(`${url}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ status: 'MINT_CONFIRMED' }),
  });

  // Nia's USSD welcome trigger — fire-and-forget. Looks up phone + community
  // for this order; if it's a USSD-originated first payment, flags a pending
  // welcome on the order metadata so the next dial gets W0.
  void maybeTriggerUssdWelcome(orderId);
}

async function maybeTriggerUssdWelcome(orderId: string): Promise<void> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  try {
    const params = new URLSearchParams({
      order_id: `eq.${orderId}`,
      select: 'community_id,provider,amount_expected,metadata',
      limit: '1',
    }).toString();
    const res = await fetch(`${url}/rest/v1/payment_orders?${params}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!res.ok) return;

    interface Row {
      community_id: string;
      provider: string;
      amount_expected: number;
      metadata?: { source?: string; phone?: string; phone_number?: string } | null;
    }
    const rows = (await res.json().catch(() => [])) as Row[];
    const row = rows[0];
    if (!row) return;

    // USSD-originated payments carry source: 'ussd' + phone in metadata. If
    // either is missing we can't issue a welcome — surface nothing.
    const phone = row.metadata?.phone ?? row.metadata?.phone_number;
    const isUssd =
      row.metadata?.source === 'ussd' || row.provider === 'africastalking';
    if (!isUssd || !phone) return;

    // Look up the community name. If communities table read fails or the row
    // is absent, fall back to the code as a safe display value.
    let communityName = row.community_id;
    try {
      const cRes = await fetch(
        `${url}/rest/v1/communities?id=eq.${encodeURIComponent(row.community_id)}&select=name`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      );
      if (cRes.ok) {
        const cRows = (await cRes.json().catch(() => [])) as Array<{ name?: string }>;
        if (cRows[0]?.name) communityName = cRows[0].name;
      }
    } catch {
      // ignore — fallback handled above
    }

    await flagPendingWelcomeOnOrder({
      orderId,
      phoneNumber: phone,
      communityCode: row.community_id,
      communityName,
      paymentAmountKes: row.amount_expected,
      monthsPaid: 1,
      totalMonthsExpected: 1,
    });
  } catch (err) {
    console.warn('[promote-orders] maybeTriggerUssdWelcome failed', orderId, err);
  }
}

async function confirmSubmittedMints(): Promise<ConfirmTickResult> {
  const network = resolveNetwork();
  const horizonUrl = resolveHorizonUrl(network);
  const queue = await fetchSubmittedOrders();

  let confirmed = 0;
  let failed = 0;
  let still_pending = 0;
  let stale_pending = 0;
  let skipped_no_signature = 0;

  const now = Date.now();

  for (const order of queue) {
    if (!order.mint_signature) {
      // Shouldn't happen — markMintSubmitted writes status + sig atomically.
      // Defensive: log and skip rather than confirm against an empty hash.
      console.warn(
        '[promote-orders] MINT_SUBMITTED with no mint_signature',
        order.order_id,
      );
      skipped_no_signature += 1;
      continue;
    }

    const result = await confirmMintTransaction(horizonUrl, order.mint_signature);

    if (result.status === 'confirmed') {
      await markMintConfirmed(order.order_id);
      confirmed += 1;
    } else if (result.status === 'failed') {
      await markMintFailed(order.order_id, result.error, 'confirmation');
      failed += 1;
    } else {
      still_pending += 1;
      // Stale check: an order that's been MINT_SUBMITTED for >30min without
      // Horizon confirmation needs eyes — likely tx timeout or partition.
      const updatedAt = Date.parse(order.updated_at);
      if (Number.isFinite(updatedAt) && now - updatedAt > MINT_SUBMITTED_STALE_MS) {
        stale_pending += 1;
        console.warn(
          '[promote-orders] MINT_SUBMITTED stale — manual review',
          order.order_id,
          'tx:', order.mint_signature,
          'age_ms:', now - updatedAt,
        );
      }
    }
  }

  return {
    attempted: queue.length,
    confirmed,
    failed,
    still_pending,
    stale_pending,
    skipped_no_signature,
  };
}

async function mintQueuedOrders(): Promise<MintTickResult> {
  const distributorSecret = process.env.BRZA_DISTRIBUTOR_SECRET;
  const issuerPublicKey = process.env.BRZA_ISSUER_PUBLIC_KEY;
  if (!distributorSecret) {
    return {
      attempted: 0,
      minted: 0,
      retriable_failed: 0,
      terminal_failed: 0,
      skipped_no_allocation: 0,
      skipped_reason: 'distributor_secret_unset',
    };
  }
  if (!issuerPublicKey) {
    return {
      attempted: 0,
      minted: 0,
      retriable_failed: 0,
      terminal_failed: 0,
      skipped_no_allocation: 0,
      skipped_reason: 'issuer_pk_unset',
    };
  }

  const network = resolveNetwork();
  const horizonUrl = resolveHorizonUrl(network);
  const queue = await fetchMintQueue();

  let minted = 0;
  let retriable_failed = 0;
  let terminal_failed = 0;
  let skipped_no_allocation = 0;
  let batched_txs = 0;

  // Partition the queue: only orders with a positive brza_allocated are
  // eligible for batching. Legacy NULL-allocation orders stay at MINT_QUEUED
  // for manual reconciliation per the original policy.
  const eligible = queue.filter((o) => {
    if (o.brza_allocated === null || o.brza_allocated <= 0) {
      skipped_no_allocation += 1;
      return false;
    }
    return true;
  });

  // Per-order fallback — used when the batch path can't be taken or when
  // a batch attempt fails and we need to isolate the bad order. Identical
  // to the original single-op submission path.
  async function mintOne(order: MintQueuedOrder): Promise<void> {
    const result = await mintBrzaPayment({
      distributorSecret: distributorSecret!,
      issuerPublicKey: issuerPublicKey!,
      recipient: order.wallet_address,
      amount: String(order.brza_allocated),
      memo: order.order_id, // Stellar memo ≤28 bytes; order_id is ~26 chars
      horizonUrl,
      network,
    });

    if (result.ok) {
      await markMintSubmitted(order.order_id, result.txHash);
      minted += 1;
    } else if (result.retriable) {
      retriable_failed += 1;
      console.warn('[promote-orders] mint retriable failure', order.order_id, result.error);
    } else {
      await markMintFailed(order.order_id, result.error, 'submission');
      terminal_failed += 1;
    }
  }

  // Single-order queue: batching saves no round-trips, so skip the
  // multi-op overhead and use the per-order path directly.
  if (eligible.length <= 1) {
    for (const order of eligible) {
      await mintOne(order);
    }
  } else {
    // Batched path: chunk the queue into ≤100-op groups (Stellar tx cap)
    // and submit each chunk as one atomic multi-op tx. Same memo across
    // the batch (order_ids don't fit collectively in 28 bytes).
    for (let i = 0; i < eligible.length; i += STELLAR_MAX_OPS_PER_TX) {
      const chunk = eligible.slice(i, i + STELLAR_MAX_OPS_PER_TX);

      const batchResult = await mintBrzaBatch({
        distributorSecret,
        issuerPublicKey,
        entries: chunk.map((o) => ({
          recipient: o.wallet_address,
          amount: String(o.brza_allocated),
        })),
        memo: `batch:${chunk.length}`,
        horizonUrl,
        network,
      });

      if (batchResult.ok) {
        // All N orders share the same tx hash — distinguishable by recipient
        // in Horizon's op listing for that tx.
        await Promise.all(chunk.map((o) => markMintSubmitted(o.order_id, batchResult.txHash)));
        minted += chunk.length;
        batched_txs += 1;
        continue;
      }

      // Batch failed. If Horizon pinpointed the bad op, mark that one
      // terminal and retry the rest individually so good orders aren't
      // held hostage by one bad recipient (no trustline / closed account).
      if (typeof batchResult.failedOpIndex === 'number') {
        const badOrder = chunk[batchResult.failedOpIndex];
        await markMintFailed(badOrder.order_id, batchResult.error, 'submission');
        terminal_failed += 1;

        for (let j = 0; j < chunk.length; j += 1) {
          if (j === batchResult.failedOpIndex) continue;
          await mintOne(chunk[j]);
        }
        continue;
      }

      // No op-level pinpoint (network blip, generic tx error). Fall back
      // to per-order so we still make progress on good orders this tick.
      console.warn('[promote-orders] batch failed, falling back per-order', batchResult.error);
      for (const order of chunk) {
        await mintOne(order);
      }
    }
  }

  return {
    attempted: queue.length,
    minted,
    retriable_failed,
    terminal_failed,
    skipped_no_allocation,
    batched_txs,
  };
}

async function patchOrders(from: string, to: string): Promise<number> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return 0;

  const res = await fetch(
    `${url}/rest/v1/payment_orders?${paymentOrderFilter(from)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'content-type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ status: to }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.warn('[promote-orders] PATCH failed', from, '→', to, res.status, detail);
    return 0;
  }

  const data = (await res.json().catch(() => [])) as unknown[];
  return Array.isArray(data) ? data.length : 0;
}

// Named export, not a bare default export — Vercel's Node.js runtime treats
// `export default function handler(req)` as the legacy `(req, res) => void`
// signature and silently discards the Response this returns, hanging the
// request until the function timeout (this is what caused the observed
// "Task timed out after 60 seconds" errors on this route in production).
// Vercel Cron invokes this route with GET.
async function handler(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return json({ error: 'unauthorized' }, { status: 401 });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({
      ok: false,
      reason: 'supabase_not_configured',
      note: 'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in Vercel project settings to enable the promoter.',
    }, { status: 200 });
  }

  // Order matters:
  //   1. mintQueuedOrders — submits new BRZA payments (MINT_QUEUED → MINT_SUBMITTED)
  //   2. confirmSubmittedMints — verifies prior submissions via Horizon
  //      (MINT_SUBMITTED → MINT_CONFIRMED or MINT_FAILED_FINAL)
  //   3. patchOrders walker — blind status walk for downstream stages
  //
  // Step 2 used to be a blind PATCH alongside the walker, which would
  // falsely advance reverted txs. Now it queries Horizon per order.
  const mintResult = await mintQueuedOrders();
  const confirmResult = await confirmSubmittedMints();

  const results: Record<string, { promoted: number }> = {};
  for (const { from, to } of PROMOTIONS) {
    const promoted = await patchOrders(from, to);
    results[`${from}->${to}`] = { promoted };
  }

  const totalPromoted = Object.values(results).reduce((sum, r) => sum + r.promoted, 0);

  // Seku monitoring: scan for RECONCILED USSD members who haven't dialled
  // back in 30 days and flag them for operator follow-up. Safe to run every
  // tick — the query filters out already-flagged orders.
  const invisible = await sweepInvisibleUssdMembers(30);

  return json({
    ok: true,
    totalPromoted,
    mint: mintResult,
    confirm: confirmResult,
    breakdown: results,
    invisibleSweep: invisible,
    tickAt: new Date().toISOString(),
  }, { status: 200 });
}

export { handler as GET, handler as POST };
