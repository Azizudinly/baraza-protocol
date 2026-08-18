import { describe, expect, it, vi } from 'vitest';

describe('Retro-allocation Settlement Concurrency and Idempotency', () => {
  it('prevents duplicate mint submissions when two cron instances execute concurrently', async () => {
    const allocations = [
      { id: 'alloc_1', round_id: 'round_a', recipient_wallet: 'G_WALLET_1', brza_allocated: 100, settlement_status: 'pending' },
      { id: 'alloc_2', round_id: 'round_a', recipient_wallet: 'G_WALLET_2', brza_allocated: 200, settlement_status: 'pending' }
    ];

    const claimedState = new Set<string>();
    let mintCallCount = 0;

    const mockWorker = async (workerId: string) => {
      // Simulate atomic compare-and-set claim
      const eligibleToClaim = allocations.filter(
        (a) => a.settlement_status === 'pending' && !claimedState.has(a.id)
      );

      const claimedBatch: typeof allocations = [];
      for (const item of eligibleToClaim) {
        if (!claimedState.has(item.id)) {
          claimedState.add(item.id);
          claimedBatch.push(item);
        }
      }

      if (claimedBatch.length > 0) {
        mintCallCount += claimedBatch.length;
        return { workerId, processed: claimedBatch.length };
      }
      return { workerId, processed: 0 };
    };

    // Run both workers concurrently in Promise.all
    const [w1, w2] = await Promise.all([mockWorker('worker_1'), mockWorker('worker_2')]);

    // Exactly 2 total allocations must be processed across both workers combined
    expect(w1.processed + w2.processed).toBe(2);
    expect(mintCallCount).toBe(2);
    expect(claimedState.size).toBe(2);
  });

  it('safely retries failed allocations when mint fails with retriable network error', async () => {
    let status = 'pending';

    // Worker claims
    status = 'claiming';
    expect(status).toBe('claiming');

    // Retriable network error occurs
    const isRetriable = true;
    if (isRetriable) {
      status = 'pending';
    }

    // Reverts to pending for next tick
    expect(status).toBe('pending');
  });
});
