/**
 * Edge-compatible Circuit Breaker and Provider Failover Engine for Baraza Protocol.
 * Conforms to SAD §5.2, ADR-008, and Minisend Architecture Spec v3.1 (§3.7 & §7).
 *
 * Prevents cascading timeouts and provider blackouts by tripping when consecutive
 * upstream 5xx/timeout faults occur, enabling automated failover to alternate rails:
 * Primary (Minisend) -> Failover (Kotani Pay) -> Terminal (Direct Daraja).
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before the circuit opens (default 3). */
  failureThreshold: number;
  /** Sliding time window in ms to count consecutive failures (default 120,000ms = 2min). */
  windowMs: number;
  /** Cooldown time in ms before attempting a half-open trial request (default 60,000ms = 1min). */
  recoveryTimeoutMs: number;
}

interface ProviderCircuitStats {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  lastStateChange: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  windowMs: 120_000,
  recoveryTimeoutMs: 60_000,
};

// Global in-memory registry of provider circuit breakers (Edge-safe transient store)
const registry = new Map<string, ProviderCircuitStats>();

export class CircuitBreaker {
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private getStats(provider: string): ProviderCircuitStats {
    let stats = registry.get(provider);
    if (!stats) {
      stats = {
        state: 'CLOSED',
        consecutiveFailures: 0,
        lastFailureTime: 0,
        lastSuccessTime: 0,
        lastStateChange: Date.now(),
      };
      registry.set(provider, stats);
    }
    return stats;
  }

  /**
   * Evaluates the current state of the circuit breaker for a provider.
   */
  public getState(provider: string): CircuitState {
    const stats = this.getStats(provider);
    const now = Date.now();

    if (stats.state === 'OPEN') {
      if (now - stats.lastStateChange >= this.config.recoveryTimeoutMs) {
        stats.state = 'HALF_OPEN';
        stats.lastStateChange = now;
      }
    }

    return stats.state;
  }

  /**
   * Records a successful provider invocation, resetting failure counts and closing the circuit.
   */
  public recordSuccess(provider: string): void {
    const stats = this.getStats(provider);
    stats.consecutiveFailures = 0;
    stats.lastSuccessTime = Date.now();
    if (stats.state !== 'CLOSED') {
      stats.state = 'CLOSED';
      stats.lastStateChange = Date.now();
    }
  }

  /**
   * Records an upstream provider failure (HTTP 5xx, network timeout, connection reset).
   */
  public recordFailure(provider: string): void {
    const stats = this.getStats(provider);
    const now = Date.now();

    // Reset counter if outside the sliding window
    if (now - stats.lastFailureTime > this.config.windowMs) {
      stats.consecutiveFailures = 0;
    }

    stats.consecutiveFailures += 1;
    stats.lastFailureTime = now;

    if (stats.consecutiveFailures >= this.config.failureThreshold) {
      stats.state = 'OPEN';
      stats.lastStateChange = now;
    }
  }

  /**
   * Manually resets a provider's circuit stats (primarily for testing and operations).
   */
  public reset(provider: string): void {
    registry.delete(provider);
  }

  /**
   * Executes a protected provider operation with automatic failover fallback.
   */
  public async execute<T>(
    provider: string,
    primaryOperation: () => Promise<T>,
    fallbackOperation?: () => Promise<T>,
  ): Promise<{ result: T; routedProvider: string; fellBack: boolean }> {
    const state = this.getState(provider);

    if (state === 'OPEN') {
      if (fallbackOperation) {
        const fallbackResult = await fallbackOperation();
        return { result: fallbackResult, routedProvider: 'fallback', fellBack: true };
      }
      throw new Error(`Circuit breaker for ${provider} is OPEN (provider unavailable).`);
    }

    try {
      const result = await primaryOperation();
      this.recordSuccess(provider);
      return { result, routedProvider: provider, fellBack: false };
    } catch (err) {
      this.recordFailure(provider);
      if (fallbackOperation) {
        const fallbackResult = await fallbackOperation();
        return { result: fallbackResult, routedProvider: 'fallback', fellBack: true };
      }
      throw err;
    }
  }
}

export const defaultCircuitBreaker = new CircuitBreaker();
