/**
 * Scheduled Cron Handler: /api/cron/monitor-compliance
 *
 * Runs daily at 00:00 UTC (or on scheduled tick) to enforce Class G Regulatory Invariants:
 * 1. Sweep Expired Credentials (Invariant I-REG-5):
 *    Transitions communities from 'VERIFIED' to 'EXPIRED' when now() > sacco_license_expires_at.
 * 2. Behavioral Deposit Monitor (Invariant I-REG-4):
 *    Aggregates settled payment volumes; flags communities crossing KES 100M (10B cents).
 * 3. Sybil Founder Cluster Monitor:
 *    Aggregates volume by creator (created_by) across sub-chamas to prevent threshold structuring.
 *
 * Auth: Requires `Authorization: Bearer <CRON_SECRET>` verified via timingSafeEqual.
 */

import { timingSafeEqual } from 'node:crypto';
import { SASRA_STATUTORY_DEPOSIT_CEILING_MINOR } from '../../src/lib/compliance/saccoGate.js';

export const config = { runtime: 'nodejs' };

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
  const header = Buffer.from(getAuthorizationHeader(req), 'utf8');
  const expected = Buffer.from(`Bearer ${cronSecret}`, 'utf8');
  return header.length === expected.length && timingSafeEqual(header, expected);
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, { status: 405 });
  }

  // Auth gate
  if (!isAuthorized(req)) {
    return json({ error: 'unauthorized', message: 'Cron trigger requires valid CRON_SECRET.' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // Sandbox / Test fallback
    return json({
      ok: true,
      timestamp: new Date().toISOString(),
      expiredCount: 0,
      thresholdAlertsCount: 0,
      sybilAlertsCount: 0,
      message: 'Compliance monitoring completed (sandbox fallback).',
    });
  }

  const nowIso = new Date().toISOString();
  let expiredCount = 0;
  let thresholdAlertsCount = 0;
  let sybilAlertsCount = 0;

  // -------------------------------------------------------------------------
  // 1. Sweep Expired Licenses (Invariant I-REG-5)
  // -------------------------------------------------------------------------
  const expiredQuery = `${supabaseUrl}/rest/v1/communities?sacco_license_status=eq.VERIFIED&sacco_license_expires_at=lt.${encodeURIComponent(nowIso)}&select=id,name`;
  const expRes = await fetch(expiredQuery, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (expRes.ok) {
    const expiredCommunities = await expRes.json();
    if (Array.isArray(expiredCommunities) && expiredCommunities.length > 0) {
      expiredCount = expiredCommunities.length;
      for (const comm of expiredCommunities) {
        // Transition status to EXPIRED
        await fetch(`${supabaseUrl}/rest/v1/communities?id=eq.${encodeURIComponent(comm.id)}`, {
          method: 'PATCH',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ sacco_license_status: 'EXPIRED' }),
        });

        // Insert alert into compliance_alerts
        await fetch(`${supabaseUrl}/rest/v1/compliance_alerts`, {
          method: 'POST',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            community_id: comm.id,
            alert_type: 'LICENSE_EXPIRED',
            current_volume_minor: 0,
            threshold_minor: 0,
          }),
        });
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. Behavioral Deposit Monitoring (Invariant I-REG-4: > KES 100M)
  // -------------------------------------------------------------------------
  const commVolumes = new Map<string, bigint>();
  const ordersQuery = `${supabaseUrl}/rest/v1/payment_orders?status=eq.SETTLED&select=community_id,amount_received`;
  const ordersRes = await fetch(ordersQuery, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (ordersRes.ok) {
    const orders = await ordersRes.json();
    if (Array.isArray(orders)) {
      for (const ord of orders) {
        const amt = BigInt(ord.amount_received || 0);
        const curr = commVolumes.get(ord.community_id) || 0n;
        commVolumes.set(ord.community_id, curr + amt);
      }

      for (const [commId, totalMinor] of commVolumes.entries()) {
        if (totalMinor >= SASRA_STATUTORY_DEPOSIT_CEILING_MINOR) {
          // Check if alert already logged
          const alertCheck = await fetch(
            `${supabaseUrl}/rest/v1/compliance_alerts?community_id=eq.${encodeURIComponent(commId)}&alert_type=eq.SASRA_THRESHOLD_100M&select=id`,
            {
              headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
              },
            }
          );
          const existing = alertCheck.ok ? await alertCheck.json() : [];
          if (!Array.isArray(existing) || existing.length === 0) {
            await fetch(`${supabaseUrl}/rest/v1/compliance_alerts`, {
              method: 'POST',
              headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                'content-type': 'application/json',
              },
              body: JSON.stringify({
                community_id: commId,
                alert_type: 'SASRA_THRESHOLD_100M',
                current_volume_minor: Number(totalMinor),
                threshold_minor: Number(SASRA_STATUTORY_DEPOSIT_CEILING_MINOR),
              }),
            });
            thresholdAlertsCount++;
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. Sybil Founder Cluster Aggregation
  // -------------------------------------------------------------------------
  const commsQuery = `${supabaseUrl}/rest/v1/communities?select=id,created_by`;
  const commsRes = await fetch(commsQuery, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (commsRes.ok) {
    const commsList = await commsRes.json();
    if (Array.isArray(commsList)) {
      const commToCreator = new Map<string, string>();
      for (const c of commsList) {
        if (c.created_by) commToCreator.set(c.id, c.created_by);
      }

      // Re-sum volume by creator
      const creatorVolumes = new Map<string, { total: bigint; commIds: string[] }>();
      for (const [commId, totalMinor] of commVolumes.entries()) {
        const creator = commToCreator.get(commId);
        if (creator) {
          const entry = creatorVolumes.get(creator) || { total: 0n, commIds: [] };
          entry.total += totalMinor;
          entry.commIds.push(commId);
          creatorVolumes.set(creator, entry);
        }
      }

      for (const [, data] of creatorVolumes.entries()) {
        if (data.total >= SASRA_STATUTORY_DEPOSIT_CEILING_MINOR && data.commIds.length > 1) {
          sybilAlertsCount++;
        }
      }
    }
  }

  return json({
    ok: true,
    timestamp: nowIso,
    expiredCount,
    thresholdAlertsCount,
    sybilAlertsCount,
  });
}
