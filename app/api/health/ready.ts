export const config = { runtime: 'nodejs' };

import type { ReadinessResponse, ComponentHealth } from './types';

let cachedReadiness: { payload: ReadinessResponse; cachedAt: number } | null = null;
const TTL_MS = 5000;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const now = Date.now();
  if (cachedReadiness && now - cachedReadiness.cachedAt < TTL_MS) {
    const isReady = cachedReadiness.payload.status !== 'not_ready';
    return new Response(JSON.stringify({ ...cachedReadiness.payload, cached: true }), {
      status: isReady ? 200 : 503,
      headers: { 'content-type': 'application/json', 'x-cache': 'HIT' },
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const horizonUrl = process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org';

  // 1. Check Database (Hard Dependency - Invariant I-REC-4)
  const dbStart = Date.now();
  const dbHealth: ComponentHealth = { tier: 'hard', status: 'unhealthy', latency_ms: 0 };
  if (supabaseUrl && serviceKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/communities?select=id&limit=1`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        signal: AbortSignal.timeout(3000),
      });
      dbHealth.latency_ms = Date.now() - dbStart;
      dbHealth.status = res.ok ? 'healthy' : 'unhealthy';
    } catch {
      dbHealth.latency_ms = Date.now() - dbStart;
      dbHealth.status = 'unhealthy';
      dbHealth.message = 'Database query timeout or connection refusal';
    }
  } else {
    dbHealth.latency_ms = 0;
    dbHealth.status = 'unhealthy';
    dbHealth.message = 'Database credentials not configured';
  }

  // 2. Check Stellar Horizon (Soft Dependency - Invariant I-REC-4)
  const horizonStart = Date.now();
  const horizonHealth: ComponentHealth = { tier: 'soft', status: 'unhealthy', latency_ms: 0 };
  try {
    const res = await fetch(`${horizonUrl}/`, { signal: AbortSignal.timeout(3000) });
    horizonHealth.latency_ms = Date.now() - horizonStart;
    horizonHealth.status = res.ok ? 'healthy' : 'degraded';
  } catch {
    horizonHealth.latency_ms = Date.now() - horizonStart;
    horizonHealth.status = 'degraded';
    horizonHealth.message = 'Horizon RPC timeout or network unreachable';
  }

  // 3. Check Redis / Mock Cache (Soft Dependency)
  const redisHealth: ComponentHealth = { tier: 'soft', status: 'healthy', latency_ms: 1 };

  // 4. Synthesize Status: DB failure -> 503; Horizon slow -> 200 Degraded
  const isDbHealthy = dbHealth.status === 'healthy';
  const overallStatus: 'ready' | 'degraded' | 'not_ready' = !isDbHealthy
    ? 'not_ready'
    : horizonHealth.status === 'healthy'
    ? 'ready'
    : 'degraded';

  const payload: ReadinessResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    cached: false,
    components: {
      database: dbHealth,
      stellar_horizon: horizonHealth,
      redis: redisHealth,
    },
  };

  cachedReadiness = { payload, cachedAt: now };

  const httpStatus = overallStatus === 'not_ready' ? 503 : 200;
  return new Response(JSON.stringify(payload), {
    status: httpStatus,
    headers: { 'content-type': 'application/json', 'x-cache': 'MISS' },
  });
}
