export type DependencyTier = 'hard' | 'soft';
export type ComponentStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ComponentHealth {
  tier: DependencyTier;
  status: ComponentStatus;
  latency_ms: number;
  message?: string;
}

export interface LivenessResponse {
  status: 'ok';
  timestamp: string;
  uptime_sec: number;
}

export interface ReadinessResponse {
  status: 'ready' | 'degraded' | 'not_ready';
  timestamp: string;
  cached: boolean;
  components: {
    database: ComponentHealth;
    stellar_horizon: ComponentHealth;
    redis: ComponentHealth;
  };
}

export interface ProtocolMetrics {
  orders_by_status: Record<string, number>;
  total_journal_entries: number;
  unacknowledged_alerts_count: number;
  active_communities_count: number;
  frozen_communities_count: number;
  timestamp: string;
}

export interface ReconciliationResult {
  community_id: string;
  onchain_balance_minor: bigint;
  ledger_balance_minor: bigint;
  cached_vault_balance_minor: bigint;
  in_flight_deposits_minor: bigint;
  in_flight_payouts_minor: bigint;
  net_float_minor: bigint;
  variance_minor: bigint;
  status: 'BALANCED' | 'VARIANCE_DETECTED' | 'INFRASTRUCTURE_SKIPPED';
  metadata?: Record<string, unknown>;
}
