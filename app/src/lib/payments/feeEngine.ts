/**
 * Pure, deterministic fee calculation engine for Baraza Protocol.
 * Conforms to SAD v1.0 §2.2, Holy Grail §8 (Addendum 2 Item 6), and Launch Memo 3 §4.
 *
 * Rules:
 *   1. Core platform fee is 2.0% on inbound money movement (rounded half-up).
 *   2. Outbound vault disbursements have 0% platform fee.
 *   3. Safaricom Paybill collection cost is 0.5% (capped at KES 200 / 20,000 cents),
 *      and free for transactions strictly under KES 200 (20,000 cents).
 *   4. Zero-fee communities bypass fee calculation and yield zero total.
 *   5. All monetary outputs are strictly non-negative integer minor units.
 */

export interface FeeBreakdown {
  /** Base community activation fee or dues in minor units (e.g. cents). */
  baseAmountMinor: number;
  /** 2.0% platform fee in minor units. */
  platformFeeMinor: number;
  /** Carrier collection cost in minor units. */
  carrierCostMinor: number;
  /** Total expected amount to be paid by member in minor units. */
  totalExpectedMinor: number;
  /** Currency code (e.g. 'KES'). */
  currency: string;
  /** Whether the community is completely free of activation dues. */
  isFree: boolean;
}

/**
 * Determines if a community is zero-fee / free based on its fee config.
 */
export function isZeroFee(baseAmountMinor: number, feeType?: string): boolean {
  if (!Number.isFinite(baseAmountMinor) || baseAmountMinor <= 0) return true;
  if (feeType === 'free') return true;
  return false;
}

/**
 * Calculates itemized dynamic fee breakdown for an inbound dues contribution.
 *
 * @param baseAmountMinor Base dues in integer minor currency units (e.g. 50,000 cents = KES 500).
 * @param currency Default 'KES'.
 * @param carrierPassThrough Whether carrier collection cost is added to total (default true).
 */
export function calculateDynamicFee(
  baseAmountMinor: number,
  currency = 'KES',
  carrierPassThrough = true,
): FeeBreakdown {
  const safeBase = Number.isFinite(baseAmountMinor) && baseAmountMinor > 0
    ? Math.floor(baseAmountMinor)
    : 0;

  if (safeBase === 0) {
    return {
      baseAmountMinor: 0,
      platformFeeMinor: 0,
      carrierCostMinor: 0,
      totalExpectedMinor: 0,
      currency,
      isFree: true,
    };
  }

  // 2.0% platform fee (Round-Half-Up)
  const platformFeeMinor = Math.round(safeBase * 0.02);

  // Safaricom Paybill Pass-Through: 0.5% capped at KES 200 (20,000 cents), free under KES 200 (20,000 cents)
  let carrierCostMinor = 0;
  if (carrierPassThrough && currency.toUpperCase() === 'KES') {
    if (safeBase >= 20000) {
      carrierCostMinor = Math.min(Math.round(safeBase * 0.005), 20000);
    }
  }

  const totalExpectedMinor = safeBase + platformFeeMinor + carrierCostMinor;

  return {
    baseAmountMinor: safeBase,
    platformFeeMinor,
    carrierCostMinor,
    totalExpectedMinor,
    currency: currency.toUpperCase(),
    isFree: false,
  };
}

/**
 * Formats integer minor currency units to major display string (e.g. 51250 cents -> "512.50").
 */
export function formatMinorToMajor(amountMinor: number): string {
  if (!Number.isFinite(amountMinor) || amountMinor <= 0) return '0.00';
  return (Math.floor(amountMinor) / 100).toFixed(2);
}
