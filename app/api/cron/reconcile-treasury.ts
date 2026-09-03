export const config = { runtime: 'nodejs' };

import { timingSafeEqual } from 'node:crypto';
import type { ReconciliationResult } from '../health/types';

function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';

  const authHeader = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

function supabaseHeaders(serviceKey: string): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json',
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!isCronAuthorized(req)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Database credentials not configured' }), { status: 503 });
  }

  // 1. Capture UTC ISO-8601 Temporal Snapshot Boundary (Invariant I-REC-1)
  const now = new Date();
  const snapshotIso = now.toISOString();
  // 15-minute in-flight grace window
  const graceWindowStartIso = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

  // 2. Fetch Active and Paused Communities
  let communities: Array<{
    id: string;
    liquid_vault_balance_minor: number | string;
    treasury_address?: string;
    status: string;
    is_payout_frozen: boolean;
  }> = [];

  try {
    const commRes = await fetch(
      `${supabaseUrl}/rest/v1/communities?status=in.(active,paused)&select=id,liquid_vault_balance_minor,treasury_address,status,is_payout_frozen`,
      { headers: supabaseHeaders(serviceKey) }
    );
    if (commRes.ok) {
      communities = await commRes.json();
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch communities', details: String(err) }), { status: 500 });
  }

  const results: ReconciliationResult[] = [];
  let varianceDetectedCount = 0;

  // 3. Process Communities in Bounded Concurrency Batches (batch_size = 5)
  const BATCH_SIZE = 5;
  for (let i = 0; i < communities.length; i += BATCH_SIZE) {
    const batch = communities.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (comm) => {
        const commId = comm.id;
        const cachedVaultMinor = BigInt(Math.max(0, Math.floor(Number(comm.liquid_vault_balance_minor || 0))));

        // A. Credit-Normal Ledger Calculation (Invariant I-REC-1)
        // Treasury balance = Credits - Debits
        let ledgerCreditsMinor = 0n;
        let ledgerDebitsMinor = 0n;

        try {
          const [creditsRes, debitsRes] = await Promise.all([
            fetch(
              `${supabaseUrl}/rest/v1/journal_entries?community_id=eq.${encodeURIComponent(commId)}&credit_account=eq.baraza:community_treasury&created_at=lte.${encodeURIComponent(snapshotIso)}&select=amount_minor`,
              { headers: supabaseHeaders(serviceKey) }
            ),
            fetch(
              `${supabaseUrl}/rest/v1/journal_entries?community_id=eq.${encodeURIComponent(commId)}&debit_account=eq.baraza:community_treasury&created_at=lte.${encodeURIComponent(snapshotIso)}&select=amount_minor`,
              { headers: supabaseHeaders(serviceKey) }
            ),
          ]);

          if (creditsRes.ok) {
            const rows = (await creditsRes.json()) as Array<{ amount_minor: number }>;
            for (const r of rows) ledgerCreditsMinor += BigInt(r.amount_minor || 0);
          }

          if (debitsRes.ok) {
            const rows = (await debitsRes.json()) as Array<{ amount_minor: number }>;
            for (const r of rows) ledgerDebitsMinor += BigInt(r.amount_minor || 0);
          }
        } catch (err) {
          console.warn(`[reconcile-treasury] Error reading journal for ${commId}:`, err);
        }

        const ledgerBalanceMinor = ledgerCreditsMinor - ledgerDebitsMinor;

        // B. Signed Net In-Flight Float Calculation (Deposits - Payouts)
        let inFlightDepositsMinor = 0n;
        let inFlightPayoutsMinor = 0n;

        try {
          const [depRes, payRes] = await Promise.all([
            fetch(
              `${supabaseUrl}/rest/v1/payment_orders?community_id=eq.${encodeURIComponent(commId)}&status=in.(MINT_QUEUED,MINT_SUBMITTED,ATTESTATION_SUBMITTED)&created_at=gte.${encodeURIComponent(graceWindowStartIso)}&created_at=lte.${encodeURIComponent(snapshotIso)}&select=amount_expected`,
              { headers: supabaseHeaders(serviceKey) }
            ),
            fetch(
              `${supabaseUrl}/rest/v1/payment_orders?community_id=eq.${encodeURIComponent(commId)}&status=in.(OFFRAMP_INITIATED,DISBURSEMENT_PENDING)&created_at=gte.${encodeURIComponent(graceWindowStartIso)}&created_at=lte.${encodeURIComponent(snapshotIso)}&select=amount_expected`,
              { headers: supabaseHeaders(serviceKey) }
            ),
          ]);

          if (depRes.ok) {
            const rows = (await depRes.json()) as Array<{ amount_expected: number }>;
            for (const r of rows) inFlightDepositsMinor += BigInt(r.amount_expected || 0);
          }

          if (payRes.ok) {
            const rows = (await payRes.json()) as Array<{ amount_expected: number }>;
            for (const r of rows) inFlightPayoutsMinor += BigInt(r.amount_expected || 0);
          }
        } catch (err) {
          console.warn(`[reconcile-treasury] Error reading float for ${commId}:`, err);
        }

        const netFloatMinor = inFlightDepositsMinor - inFlightPayoutsMinor;

        // C. Calculate Unexplained Drift
        // Drift = |(B_ledger + NetFloat) - B_cached|
        const expectedAdjustedLedger = ledgerBalanceMinor + netFloatMinor;
        const rawVariance = expectedAdjustedLedger - cachedVaultMinor;
        const varianceMinor = rawVariance < 0n ? -rawVariance : rawVariance;

        // D. Stellar Horizon On-Chain Query with 429/503 Isolation (Theorem 4)
        let onchainBalanceMinor = 0n;
        let isRpcDegraded = false;

        if (comm.treasury_address) {
          try {
            const horizonRes = await fetch(`${horizonUrl}/accounts/${comm.treasury_address}`, {
              signal: AbortSignal.timeout(3000),
            });

            if (horizonRes.status === 200) {
              const accountData = (await horizonRes.json()) as {
                balances?: Array<{ asset_code?: string; balance?: string; asset_type?: string }>;
              };
              for (const b of accountData.balances || []) {
                if (b.asset_code === 'USDC') {
                  // Translate USDC to KES minor units using default peg (130.50)
                  const usdcAmount = parseFloat(b.balance || '0');
                  onchainBalanceMinor += BigInt(Math.floor(usdcAmount * 130.5 * 100));
                } else if (b.asset_code === 'BRZA') {
                  onchainBalanceMinor += BigInt(Math.floor(parseFloat(b.balance || '0') * 100));
                }
              }
            } else if (horizonRes.status === 429 || horizonRes.status >= 500) {
              isRpcDegraded = true;
            }
          } catch {
            isRpcDegraded = true;
          }
        }

        const status: 'BALANCED' | 'VARIANCE_DETECTED' | 'INFRASTRUCTURE_SKIPPED' =
          isRpcDegraded && varianceMinor === 0n
            ? 'INFRASTRUCTURE_SKIPPED'
            : varianceMinor > 0n
            ? 'VARIANCE_DETECTED'
            : 'BALANCED';

        // E. Fail-Closed Circuit Breaker Tripwire on Drift (Theorem 1 & Invariant I-REC-6)
        if (status === 'VARIANCE_DETECTED') {
          varianceDetectedCount++;

          // Atomically freeze payouts for this specific community
          await fetch(`${supabaseUrl}/rest/v1/communities?id=eq.${encodeURIComponent(commId)}`, {
            method: 'PATCH',
            headers: supabaseHeaders(serviceKey),
            body: JSON.stringify({
              is_payout_frozen: true,
              treasury_policy: 'manual-review',
              status: 'paused',
            }),
          });

          // Insert high-priority compliance alert
          await fetch(`${supabaseUrl}/rest/v1/compliance_alerts`, {
            method: 'POST',
            headers: supabaseHeaders(serviceKey),
            body: JSON.stringify({
              community_id: commId,
              alert_type: 'TREASURY_RECONCILIATION_VARIANCE',
              current_volume_minor: Number(ledgerBalanceMinor),
              threshold_minor: Number(varianceMinor),
              metadata: {
                ledger_minor: Number(ledgerBalanceMinor),
                cached_minor: Number(cachedVaultMinor),
                net_float_minor: Number(netFloatMinor),
                variance_minor: Number(varianceMinor),
                snapshot_at: snapshotIso,
              },
            }),
          });
        }

        // F. Insert Audit Record into append-only time-series ledger
        await fetch(`${supabaseUrl}/rest/v1/reconciliation_audit_logs`, {
          method: 'POST',
          headers: supabaseHeaders(serviceKey),
          body: JSON.stringify({
            community_id: commId,
            onchain_balance_minor: Number(onchainBalanceMinor),
            ledger_balance_minor: Number(ledgerBalanceMinor),
            cached_vault_balance_minor: Number(cachedVaultMinor),
            in_flight_deposits_minor: Number(inFlightDepositsMinor),
            in_flight_payouts_minor: Number(inFlightPayoutsMinor),
            net_float_minor: Number(netFloatMinor),
            variance_minor: Number(varianceMinor),
            currency: 'KES',
            status,
            metadata: {
              reconciled_at: snapshotIso,
              rpc_degraded: isRpcDegraded,
            },
            reconciled_at: snapshotIso,
          }),
        });

        results.push({
          community_id: commId,
          onchain_balance_minor: onchainBalanceMinor,
          ledger_balance_minor: ledgerBalanceMinor,
          cached_vault_balance_minor: cachedVaultMinor,
          in_flight_deposits_minor: inFlightDepositsMinor,
          in_flight_payouts_minor: inFlightPayoutsMinor,
          net_float_minor: netFloatMinor,
          variance_minor: varianceMinor,
          status,
        });
      })
    );
  }

  return new Response(
    JSON.stringify({
      reconciled_count: communities.length,
      variance_count: varianceDetectedCount,
      timestamp: snapshotIso,
      results: results.map((r) => ({
        ...r,
        onchain_balance_minor: Number(r.onchain_balance_minor),
        ledger_balance_minor: Number(r.ledger_balance_minor),
        cached_vault_balance_minor: Number(r.cached_vault_balance_minor),
        in_flight_deposits_minor: Number(r.in_flight_deposits_minor),
        in_flight_payouts_minor: Number(r.in_flight_payouts_minor),
        net_float_minor: Number(r.net_float_minor),
        variance_minor: Number(r.variance_minor),
      })),
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}
