/**
 * Stellar Relayer Nonce Mutex & Sequence Synchronizer (RT-04 Fix)
 *
 * Prevents transaction collision (txBAD_SEQ) when multiple offline USSD (*384*5#)
 * or WhatsApp members submit concurrent governance votes.
 */

let isLocked = false;
let currentSequence: bigint | null = null;
const waitQueue: Array<() => void> = [];

/**
 * Executes an asynchronous transaction submission within an exclusive sequential lock,
 * guaranteeing monotonic sequence numbers.
 */
export async function withStellarNonceMutex<T>(
  action: (allocatedSeq: bigint | null) => Promise<T>,
): Promise<T> {
  // Acquire lock
  while (isLocked) {
    await new Promise<void>((resolve) => {
      waitQueue.push(resolve);
    });
  }

  isLocked = true;
  try {
    if (currentSequence !== null) {
      currentSequence += 1n;
    }
    const result = await action(currentSequence);
    return result;
  } finally {
    isLocked = false;
    const next = waitQueue.shift();
    if (next) {
      next();
    }
  }
}

/**
 * Resets or synchronizes the current base sequence number from Horizon RPC.
 */
export function setBaseSequence(seq: bigint): void {
  currentSequence = seq;
}

/**
 * Returns whether the relayer mutex queue currently has waiting transactions.
 */
export function getQueueDepth(): number {
  return waitQueue.length;
}
