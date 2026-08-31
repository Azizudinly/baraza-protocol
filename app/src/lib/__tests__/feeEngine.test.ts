import { describe, expect, it } from 'vitest';
import { calculateDynamicFee, formatMinorToMajor, isZeroFee } from '../payments/feeEngine';

describe('feeEngine', () => {
  describe('isZeroFee', () => {
    it('returns true for 0 or negative amounts', () => {
      expect(isZeroFee(0)).toBe(true);
      expect(isZeroFee(-100)).toBe(true);
      expect(isZeroFee(NaN)).toBe(true);
    });

    it('returns true for feeType free regardless of amount', () => {
      expect(isZeroFee(50000, 'free')).toBe(true);
    });

    it('returns false for positive amounts with paid feeType', () => {
      expect(isZeroFee(50000, 'one_time')).toBe(false);
      expect(isZeroFee(50000, 'recurring_monthly')).toBe(false);
      expect(isZeroFee(100)).toBe(false);
    });
  });

  describe('calculateDynamicFee', () => {
    it('returns isFree=true and zero totals for 0 base dues', () => {
      const res = calculateDynamicFee(0);
      expect(res.isFree).toBe(true);
      expect(res.baseAmountMinor).toBe(0);
      expect(res.platformFeeMinor).toBe(0);
      expect(res.carrierCostMinor).toBe(0);
      expect(res.totalExpectedMinor).toBe(0);
    });

    it('calculates standard KES 500 (50,000 cents) dues correctly', () => {
      const res = calculateDynamicFee(50000, 'KES', true);
      expect(res.isFree).toBe(false);
      expect(res.baseAmountMinor).toBe(50000);
      // 2% of 50,000 = 1,000 cents (KES 10.00)
      expect(res.platformFeeMinor).toBe(1000);
      // 0.5% of 50,000 = 250 cents (KES 2.50)
      expect(res.carrierCostMinor).toBe(250);
      // Total = 50,000 + 1,000 + 250 = 51,250 cents (KES 512.50)
      expect(res.totalExpectedMinor).toBe(51250);
      expect(res.currency).toBe('KES');
    });

    it('applies 0 carrier fee for dues strictly under KES 200 (20,000 cents)', () => {
      // KES 150 = 15,000 cents
      const res = calculateDynamicFee(15000, 'KES', true);
      expect(res.baseAmountMinor).toBe(15000);
      // 2% of 15,000 = 300 cents (KES 3.00)
      expect(res.platformFeeMinor).toBe(300);
      // Free under KES 200
      expect(res.carrierCostMinor).toBe(0);
      expect(res.totalExpectedMinor).toBe(15300);
    });

    it('clamps carrier fee at KES 200 ceiling (20,000 cents) for large contributions', () => {
      // KES 100,000 = 10,000,000 cents
      const res = calculateDynamicFee(10000000, 'KES', true);
      expect(res.baseAmountMinor).toBe(10000000);
      // 2% of 10,000,000 = 200,000 cents (KES 2,000)
      expect(res.platformFeeMinor).toBe(200000);
      // 0.5% of 10M is 50,000 cents, but must be capped at 20,000 cents (KES 200)
      expect(res.carrierCostMinor).toBe(20000);
      expect(res.totalExpectedMinor).toBe(10220000);
    });

    it('correctly rounds half-up on fractional cents', () => {
      // 125 cents * 0.02 = 2.5 cents -> rounds to 3
      const res = calculateDynamicFee(125, 'KES', false);
      expect(res.platformFeeMinor).toBe(3);
      expect(res.totalExpectedMinor).toBe(128);
    });

    it('guarantees integer minor precision across 1,000 random inputs', () => {
      for (let i = 0; i < 1000; i++) {
        const randomAmount = Math.floor(Math.random() * 50000000) + 1;
        const res = calculateDynamicFee(randomAmount);
        expect(Number.isInteger(res.baseAmountMinor)).toBe(true);
        expect(Number.isInteger(res.platformFeeMinor)).toBe(true);
        expect(Number.isInteger(res.carrierCostMinor)).toBe(true);
        expect(Number.isInteger(res.totalExpectedMinor)).toBe(true);
        expect(res.totalExpectedMinor).toBe(
          res.baseAmountMinor + res.platformFeeMinor + res.carrierCostMinor,
        );
      }
    });
  });

  describe('formatMinorToMajor', () => {
    it('formats cents to major string', () => {
      expect(formatMinorToMajor(51250)).toBe('512.50');
      expect(formatMinorToMajor(100)).toBe('1.00');
      expect(formatMinorToMajor(50)).toBe('0.50');
      expect(formatMinorToMajor(0)).toBe('0.00');
      expect(formatMinorToMajor(-10)).toBe('0.00');
    });
  });
});
