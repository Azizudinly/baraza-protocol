/**
 * Pure, deterministic BigInt financial arithmetic and FX slippage calculations for Baraza Protocol.
 * Conforms to SAD §3.5 Class A (Double-Entry Ledger Conservation) and Minisend Architecture Spec v3.1 (§3.1 & §3.6).
 *
 * Guarantees zero floating-point rounding drift by calculating all monetary values
 * in integer minor currency units (USDC micro-units 10^6, KES/UGX/GHS cents 10^2).
 */

export interface FxSlippageAnalysis {
  /** Expected fiat amount in integer minor units (e.g. 1305000 cents = 13,050.00 KES). */
  expectedFiatMinor: bigint;
  /** Actual fiat amount disbursed by provider in integer minor units. */
  executedFiatMinor: bigint;
  /** Signed slippage amount in minor units (positive = gain, negative = loss). */
  slippageMinor: bigint;
  /** Deviation in basis points (1 bp = 0.01%). Positive = gain, negative = loss. */
  slippageBps: number;
  /** True if the executed slippage is within the protocol's 1.50% (150 bps) tolerance. */
  isAcceptable: boolean;
}

/** Maximum allowable adverse FX slippage: 150 basis points (1.50%). */
export const MAX_SLIPPAGE_BPS_TOLERANCE = 150;

/** Safaricom single-transaction maximum ceiling in minor units: KES 250,000 (25,000,000 cents). */
export const TELCO_MAX_SINGLE_TX_MINOR = 25_000_000n;

/**
 * Converts a decimal USDC string (e.g. "100.50") into integer micro-units (10^6).
 */
export function usdcToMicroUnits(usdcAmountStr: string): bigint {
  const parts = usdcAmountStr.trim().split('.');
  const whole = BigInt(parts[0] || '0');
  const fractionStr = (parts[1] || '').padEnd(6, '0').slice(0, 6);
  const fraction = BigInt(fractionStr);
  return whole * 1_000_000n + fraction;
}

/**
 * Converts integer USDC micro-units into a formatted decimal string (e.g. 100500000n -> "100.500000").
 */
export function microUnitsToUsdc(microUnits: bigint): string {
  const whole = microUnits / 1_000_000n;
  const fraction = (microUnits % 1_000_000n).toString().padStart(6, '0');
  return `${whole}.${fraction}`;
}

/**
 * Converts quoted exchange rate (e.g. 130.50) and USDC amount string to expected fiat minor units (cents).
 * Formula: fiat_minor = (usdc_micro * rate_scaled) / 10^4
 *
 * @param usdcAmountStr E.g. "100.00"
 * @param fxRate E.g. 130.50 (meaning 1 USD = 130.50 KES)
 */
export function calculateExpectedFiat(usdcAmountStr: string, fxRate: number): bigint {
  if (!Number.isFinite(fxRate) || fxRate <= 0) return 0n;
  const usdcMicro = usdcToMicroUnits(usdcAmountStr);
  // Scale rate to 4 decimal places integer
  const rateScaled = BigInt(Math.round(fxRate * 10_000));
  // usdcMicro (10^6) * rateScaled (10^4) / 10^8 = fiatMinor (10^2)
  return (usdcMicro * rateScaled + 500_000n) / 1_000_000n / 100n;
}

/**
 * Evaluates spot FX slippage between expected quote and executed provider settlement.
 *
 * @param expectedFiatMinor Expected fiat in minor units (e.g. cents).
 * @param executedFiatMinor Actual fiat in minor units reported by provider.
 * @param maxAdverseBps Maximum allowable adverse slippage in bps (default 150 = 1.50%).
 */
export function evaluateFxSlippage(
  expectedFiatMinor: bigint,
  executedFiatMinor: bigint,
  maxAdverseBps = MAX_SLIPPAGE_BPS_TOLERANCE,
): FxSlippageAnalysis {
  if (expectedFiatMinor <= 0n) {
    return {
      expectedFiatMinor: 0n,
      executedFiatMinor,
      slippageMinor: 0n,
      slippageBps: 0,
      isAcceptable: true,
    };
  }

  const slippageMinor = executedFiatMinor - expectedFiatMinor;
  // slippageBps = (slippageMinor * 10000) / expectedFiatMinor
  const slippageBps = Number((slippageMinor * 10_000n) / expectedFiatMinor);
  // Adverse slippage is negative; acceptable if slippageBps >= -maxAdverseBps
  const isAcceptable = slippageBps >= -maxAdverseBps;

  return {
    expectedFiatMinor,
    executedFiatMinor,
    slippageMinor,
    slippageBps,
    isAcceptable,
  };
}

/**
 * Validates whether an outbound disbursement exceeds the single-transaction telco ceiling.
 *
 * @param fiatAmountMinor Fiat disbursement amount in minor units (cents).
 */
export function isWithinTelcoLimit(fiatAmountMinor: bigint): boolean {
  return fiatAmountMinor > 0n && fiatAmountMinor <= TELCO_MAX_SINGLE_TX_MINOR;
}
