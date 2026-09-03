export const config = { runtime: 'nodejs' };

let cachedMetrics: { text: string; cachedAt: number } | null = null;
const TTL_MS = 30000;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const now = Date.now();
  if (cachedMetrics && now - cachedMetrics.cachedAt < TTL_MS) {
    return new Response(cachedMetrics.text, {
      status: 200,
      headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8', 'x-cache': 'HIT' },
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const ordersByStatus: Record<string, number> = {};
  let unackAlerts = 0;
  let activeCommunities = 0;
  let frozenCommunities = 0;

  if (supabaseUrl && serviceKey) {
    try {
      // 1. Fetch Orders Status Distribution
      const ordersRes = await fetch(`${supabaseUrl}/rest/v1/payment_orders?select=status`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      if (ordersRes.ok) {
        const rows = (await ordersRes.json()) as Array<{ status: string }>;
        for (const row of rows) {
          ordersByStatus[row.status] = (ordersByStatus[row.status] || 0) + 1;
        }
      }

      // 2. Fetch Active vs Frozen Communities
      const commRes = await fetch(`${supabaseUrl}/rest/v1/communities?select=status,is_payout_frozen`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      if (commRes.ok) {
        const comms = (await commRes.json()) as Array<{ status: string; is_payout_frozen: boolean }>;
        for (const c of comms) {
          if (c.status === 'active') activeCommunities++;
          if (c.is_payout_frozen) frozenCommunities++;
        }
      }

      // 3. Fetch Unacknowledged Compliance Alerts
      const alertsRes = await fetch(`${supabaseUrl}/rest/v1/compliance_alerts?acknowledged=eq.false&select=id`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      if (alertsRes.ok) {
        const alerts = await alertsRes.json();
        unackAlerts = Array.isArray(alerts) ? alerts.length : 0;
      }
    } catch {
      // Non-fatal, export best effort
    }
  }

  // Format Prometheus text exposition format (OpenMetrics RFC)
  const lines: string[] = [
    '# HELP baraza_active_communities_total Total number of active communities',
    '# TYPE baraza_active_communities_total gauge',
    `baraza_active_communities_total ${activeCommunities}`,
    '# HELP baraza_frozen_communities_total Total number of communities with payout circuit breaker active',
    '# TYPE baraza_frozen_communities_total gauge',
    `baraza_frozen_communities_total ${frozenCommunities}`,
    '# HELP baraza_unacknowledged_alerts_total Total unacknowledged compliance and reconciliation alerts',
    '# TYPE baraza_unacknowledged_alerts_total gauge',
    `baraza_unacknowledged_alerts_total ${unackAlerts}`,
    '# HELP baraza_orders_total Payment orders grouped by lifecycle status',
    '# TYPE baraza_orders_total gauge',
  ];

  for (const [status, count] of Object.entries(ordersByStatus)) {
    lines.push(`baraza_orders_total{status="${status}"} ${count}`);
  }

  const output = lines.join('\n') + '\n';
  cachedMetrics = { text: output, cachedAt: now };

  return new Response(output, {
    status: 200,
    headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8', 'x-cache': 'MISS' },
  });
}
