/**
 * Server-only BRZA mint helper. Submits a Stellar payment of BRZA from the
 * distributor account to a member's wallet. Used by the promote-orders cron
 * to settle pending mints; never imported by browser code.
 *
 * Why this lives here instead of importing app/src/lib/adapters/stellar.ts:
 * the adapter imports BRZA_ASSET from app/src/lib/brza/constants.ts, which
 * reads `import.meta.env` at module scope. That works in Vite browser
 * bundles, but breaks in server runtimes. So we take all config
 * explicitly here — keeps the cron bundleable on the server runtime.
 *
 * Error classification matters: Horizon errors have different recovery
 * paths. `tx_bad_seq` is racy and worth retrying next tick; `op_no_trust`
 * means the recipient never opened a BRZA trustline and a retry will fail
 * the same way until they do. The cron uses this signal to decide whether
 * to leave the order at MINT_QUEUED (retriable) or mark MINT_FAILED_FINAL
 * (terminal).
 */

import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-sdk';

export type StellarNetworkName = 'mainnet' | 'testnet';

export interface MintBrzaParams {
  /** Stellar S... secret key for the distributor account. */
  distributorSecret: string;
  /** Stellar G... public key for the BRZA asset issuer. */
  issuerPublicKey: string;
  /** Recipient wallet address (G...). */
  recipient: string;
  /** BRZA amount as a decimal string. Will be normalized to 7 decimals. */
  amount: string;
  /** Memo text (≤28 bytes). Use payment order_id for idempotency tracing. */
  memo?: string;
  /** Horizon URL — use the matching network. */
  horizonUrl: string;
  /** `mainnet` selects PUBLIC passphrase, otherwise TESTNET. */
  network: StellarNetworkName;
}

export type MintBrzaResult =
  | { ok: true; txHash: string }
  | { ok: false; error: string; retriable: boolean };

/**
 * Horizon op result codes that have no chance of succeeding on retry.
 * Everything else is treated as retriable (network blip, sequence race,
 * unknown 5xx, etc.).
 */
const TERMINAL_OP_CODES = new Set([
  'op_no_trust',         // Recipient has no BRZA trustline
  'op_no_issuer',        // Issuer account missing (config bug)
  'op_underfunded',      // Distributor lacks BRZA — operator must refill
  'op_line_full',        // Recipient trustline limit hit
  'op_src_no_trust',     // Distributor itself has no trustline
  'op_no_destination',   // Recipient account does not exist
  'op_malformed',        // Bad address or amount — config bug
]);

const TERMINAL_TX_CODES = new Set([
  'tx_no_source_account', // Distributor account missing
  'tx_insufficient_fee',  // Wallet of fees — but we use BASE_FEE; would be a config bug
  'tx_malformed',
]);

function normalizeAmount(amount: string): string {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error('BRZA amount must be a positive number');
  }
  return numeric.toFixed(7).replace(/\.?0+$/, '');
}

function buildMemo(memo: string | undefined): Memo {
  if (!memo) return Memo.none();
  if (new TextEncoder().encode(memo).length > 28) {
    throw new Error('Stellar memo text cannot exceed 28 bytes.');
  }
  return Memo.text(memo);
}

function passphrase(network: StellarNetworkName): string {
  return network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
}

/**
 * Inspect a thrown Horizon error and classify retriability. The SDK throws
 * `BadResponseError` with a nested `extras.result_codes` shape — we look at
 * the op codes first (more specific), then the tx code.
 */
export function classifyMintError(error: unknown): { message: string; retriable: boolean } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = error as any;
  const extras = anyErr?.response?.data?.extras ?? anyErr?.extras;
  const opCodes: string[] = Array.isArray(extras?.result_codes?.operations)
    ? extras.result_codes.operations
    : [];
  const txCode: string | undefined = extras?.result_codes?.transaction;

  for (const code of opCodes) {
    if (code && TERMINAL_OP_CODES.has(code)) {
      return { message: `Stellar op error: ${code}`, retriable: false };
    }
  }
  if (txCode && TERMINAL_TX_CODES.has(txCode)) {
    return { message: `Stellar tx error: ${txCode}`, retriable: false };
  }

  const message = anyErr?.message ?? String(error);
  return { message, retriable: true };
}

/**
 * Lookup result for a previously-submitted Stellar tx. The status walker
 * uses this to decide whether to advance `MINT_SUBMITTED → MINT_CONFIRMED`,
 * mark `MINT_FAILED_FINAL`, or leave the order alone for another tick.
 *
 * - `confirmed`: Horizon returned `successful: true` — tx is in a ledger.
 * - `failed`: Horizon returned `successful: false` — tx landed but reverted.
 *   Carries the decoded result code when available.
 * - `pending`: Horizon hasn't seen the tx yet (404). Could be propagation
 *   delay or the tx expired before inclusion. Caller decides via TTL.
 */
export type MintConfirmationResult =
  | { status: 'confirmed'; ledger: number }
  | { status: 'failed'; error: string }
  | { status: 'pending' };

function isNotFoundError(err: unknown): boolean {
  // Horizon SDK throws `NotFoundError` with status 404 when the tx
  // hasn't propagated yet. We treat that as pending, not as a failure.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = err as any;
  const status = anyErr?.response?.status ?? anyErr?.status;
  return status === 404 || anyErr?.name === 'NotFoundError';
}

/**
 * Query Horizon for a previously-submitted tx hash. Used by the cron to
 * verify `MINT_SUBMITTED` orders actually landed before advancing them.
 *
 * Without this check, a reverted tx (recipient closed trustline mid-flight,
 * sequence collision, etc.) would silently walk to MINT_CONFIRMED on the
 * next tick.
 */
export async function confirmMintTransaction(
  horizonUrl: string,
  txHash: string,
): Promise<MintConfirmationResult> {
  if (!txHash) {
    return { status: 'failed', error: 'missing tx hash' };
  }
  try {
    const server = new Horizon.Server(horizonUrl);
    const record = await server.transactions().transaction(txHash).call();
    if (record.successful) {
      return { status: 'confirmed', ledger: record.ledger_attr };
    }
    // Tx landed in a ledger but reverted. result_xdr would carry the op
    // codes; surfacing the raw xdr is enough for ops triage. record.ledger
    // is a callable that fetches the LedgerRecord; ledger_attr is the seq.
    return {
      status: 'failed',
      error: `tx reverted on ledger ${record.ledger_attr}${
        record.result_xdr ? ` (result_xdr: ${record.result_xdr})` : ''
      }`,
    };
  } catch (err) {
    if (isNotFoundError(err)) {
      return { status: 'pending' };
    }
    // Anything else (network error, 5xx) — treat as pending so we retry,
    // not as a confirmation. Caller TTL handles orders stuck too long.
    return { status: 'pending' };
  }
}

/**
 * Stellar Classic caps transaction operation count at 100. Cron batches
 * larger than this would build a tx that Horizon refuses with tx_too_many_ops.
 */
export const STELLAR_MAX_OPS_PER_TX = 100;

export interface MintBrzaBatchEntry {
  /** Recipient wallet address (G...). */
  recipient: string;
  /** BRZA amount as decimal string. Normalized to 7 decimals. */
  amount: string;
}

export interface MintBrzaBatchParams {
  distributorSecret: string;
  issuerPublicKey: string;
  /** Recipients to pay in a single multi-op tx. Capped at STELLAR_MAX_OPS_PER_TX. */
  entries: MintBrzaBatchEntry[];
  /** Optional memo applied to the batch tx. ≤28 bytes. */
  memo?: string;
  horizonUrl: string;
  network: StellarNetworkName;
}

export type MintBrzaBatchResult =
  | { ok: true; txHash: string; count: number }
  | {
      ok: false;
      error: string;
      retriable: boolean;
      /** Op index that failed when Horizon returns per-op result codes. */
      failedOpIndex?: number;
    };

/**
 * Extract a per-op failure index from a Horizon BadResponseError.
 * Horizon returns `result_codes.operations` as a parallel array — op
 * codes other than `op_success` mark which payment in the batch
 * caused the rejection.
 */
function findFailedOpIndex(error: unknown): number | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyErr = error as any;
  const extras = anyErr?.response?.data?.extras ?? anyErr?.extras;
  const opCodes: string[] = Array.isArray(extras?.result_codes?.operations)
    ? extras.result_codes.operations
    : [];
  const idx = opCodes.findIndex((code) => code && code !== 'op_success');
  return idx >= 0 ? idx : undefined;
}

/**
 * Submit a single multi-op Stellar tx paying BRZA to multiple recipients
 * at once. Atomic: either every entry is paid or none are.
 *
 * Use this in preference to looping `mintBrzaPayment` when the queue has
 * >1 order — one tx hits Horizon, one fee is paid, and the cron tick
 * shrinks from N round-trips to one.
 *
 * Caller policy on partial failure: when this returns `ok: false` with
 * a `failedOpIndex`, mark just that entry as failed and retry the rest
 * (either as another batch without it, or per-order). Without an index,
 * the whole batch is treated as retriable.
 */
export async function mintBrzaBatch(params: MintBrzaBatchParams): Promise<MintBrzaBatchResult> {
  if (params.entries.length === 0) {
    return { ok: false, error: 'empty batch', retriable: false };
  }
  if (params.entries.length > STELLAR_MAX_OPS_PER_TX) {
    return {
      ok: false,
      error: `batch size ${params.entries.length} exceeds Stellar ${STELLAR_MAX_OPS_PER_TX}-op limit`,
      retriable: false,
    };
  }

  let distributor: Keypair;
  let asset: Asset;
  let normalizedAmounts: string[];
  let memo: Memo;
  try {
    distributor = Keypair.fromSecret(params.distributorSecret);
    Keypair.fromPublicKey(params.issuerPublicKey);
    for (const entry of params.entries) {
      Keypair.fromPublicKey(entry.recipient);
    }
    asset = new Asset('BRZA', params.issuerPublicKey);
    normalizedAmounts = params.entries.map((e) => normalizeAmount(e.amount));
    memo = buildMemo(params.memo);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      retriable: false,
    };
  }

  try {
    const server = new Horizon.Server(params.horizonUrl);
    const account = await server.loadAccount(distributor.publicKey());
    // Fee = BASE_FEE per op so Horizon doesn't reject under tx_insufficient_fee
    // when surge pricing kicks in on a large batch.
    const fee = String(Number(BASE_FEE) * params.entries.length);
    const builder = new TransactionBuilder(account, {
      fee,
      networkPassphrase: passphrase(params.network),
    });
    for (let i = 0; i < params.entries.length; i += 1) {
      builder.addOperation(
        Operation.payment({
          destination: params.entries[i].recipient,
          asset,
          amount: normalizedAmounts[i],
        }),
      );
    }
    const tx = builder.addMemo(memo).setTimeout(30).build();
    tx.sign(distributor);
    const result = await server.submitTransaction(tx);
    return { ok: true, txHash: result.hash, count: params.entries.length };
  } catch (err) {
    const { message, retriable } = classifyMintError(err);
    return {
      ok: false,
      error: message,
      retriable,
      failedOpIndex: findFailedOpIndex(err),
    };
  }
}

export async function mintBrzaPayment(params: MintBrzaParams): Promise<MintBrzaResult> {
  let distributor: Keypair;
  let asset: Asset;
  let amount: string;
  let memo: Memo;
  try {
    distributor = Keypair.fromSecret(params.distributorSecret);
    // Validate issuer + recipient addresses; cheap pre-flight before hitting Horizon.
    Keypair.fromPublicKey(params.issuerPublicKey);
    Keypair.fromPublicKey(params.recipient);
    asset = new Asset('BRZA', params.issuerPublicKey);
    amount = normalizeAmount(params.amount);
    memo = buildMemo(params.memo);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      retriable: false, // Bad config — retry will fail the same way
    };
  }

  try {
    const server = new Horizon.Server(params.horizonUrl);
    const account = await server.loadAccount(distributor.publicKey());
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: passphrase(params.network),
    })
      .addOperation(
        Operation.payment({
          destination: params.recipient,
          asset,
          amount,
        }),
      )
      .addMemo(memo)
      .setTimeout(30)
      .build();
    tx.sign(distributor);
    const result = await server.submitTransaction(tx);
    return { ok: true, txHash: result.hash };
  } catch (err) {
    const { message, retriable } = classifyMintError(err);
    return { ok: false, error: message, retriable };
  }
}
