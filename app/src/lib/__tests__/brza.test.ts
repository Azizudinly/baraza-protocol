import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BARAZA_TV,
  BRZA_ALLOCATION,
  BRZA_ASSET,
  BRZA_EMISSION,
  BRZA_VESTING,
  XLM_USD_RATE_MVP,
  convertToBrza,
  convertXlmToBrza,
  formatLocal,
  getBrzaPriceUsd,
  isBrzaPriceConfigured,
  vestedAmount,
} from '@/lib/brza/constants';
import {
  fetchTreasuryBalance,
  fetchTreasuryByCommunityId,
  registerTreasury,
} from '@/lib/brza/treasury';
import { fetchPlatformTvl, getNextTarget, getPhase } from '@/lib/brza/tvl';
import { getBrzaBalance } from '@/lib/adapters/stellar';

vi.mock('@/lib/adapters/stellar', () => ({
  getBrzaBalance: vi.fn(),
}));

const mockGetBrzaBalance = vi.mocked(getBrzaBalance);

beforeEach(() => {
  mockGetBrzaBalance.mockReset();
});

describe('BRZA pricing', () => {
  it('publishes cache-safe token metadata URLs', () => {
    expect(BRZA_ASSET.logoUrl).toBe('https://barazaprotocol.com/brza-token-logo.svg');
    expect(BRZA_ASSET.metadataUrl).toBe('https://barazaprotocol.com/brza-token.json');
  });

  it('rejects unsupported currencies instead of treating them as USD', () => {
    expect(() => formatLocal(10, 'KSH')).toThrow(/unsupported fiat currency/i);
  });

  it('all phase prices ship unset (counsel-gated) and conversion throws until configured', () => {
    // Guard against reintroducing real offering prices into the public repo:
    // every phase price must remain the 0 placeholder until launch.
    for (const phase of ['phase0', 'seed', 'strategic', 'launch', 'market'] as const) {
      expect(isBrzaPriceConfigured(phase)).toBe(false);
      expect(() => getBrzaPriceUsd(phase)).toThrow(/price is not configured/i);
    }
    expect(() => convertToBrza(1000, 'KES')).toThrow(/price is not configured/i);
    expect(() => convertToBrza(10, 'USD', 'launch')).toThrow(/price is not configured/i);
  });
});

describe('BRZA allocation invariants', () => {
  // Allocation numbers and vesting day-counts are counsel-gated and ship as
  // 0 placeholders in the public repo. These tests lock that state: any
  // reintroduction of real figures before launch is a test failure.

  it('every BRZA_ALLOCATION bucket ships as a 0 placeholder (counsel-gated)', () => {
    for (const [bucket, tokens] of Object.entries(BRZA_ALLOCATION)) {
      expect(tokens, `allocation for ${bucket} must stay a 0 placeholder`).toBe(0);
    }
  });

  it('every BRZA_VESTING bucket tracks its BRZA_ALLOCATION counterpart and ships unset', () => {
    for (const [bucket, vest] of Object.entries(BRZA_VESTING)) {
      const allocated = BRZA_ALLOCATION[bucket as keyof typeof BRZA_ALLOCATION];
      expect(vest.tokens, `vesting tokens for ${bucket} must equal allocation`).toBe(allocated);
      expect(vest.cliffDays, `cliffDays for ${bucket} must stay a 0 placeholder`).toBe(0);
      expect(vest.vestingDays, `vestingDays for ${bucket} must stay a 0 placeholder`).toBe(0);
    }
  });

  it('total supply remains the public 1B figure', () => {
    expect(BRZA_ASSET.totalSupply).toBe(1_000_000_000);
  });

  it('BRZA_EMISSION sub-pool percentages sum to 1.0', () => {
    const sum =
      BRZA_EMISSION.bountyPoolPct +
      BRZA_EMISSION.membershipRewardPct +
      BRZA_EMISSION.governanceRewardPct +
      BRZA_EMISSION.reservedPct;
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('BRZA_EMISSION total equals the communityRewards bucket', () => {
    expect(BRZA_EMISSION.total).toBe(BRZA_ALLOCATION.communityRewards);
  });

  it('BARAZA_TV revenue share percentages sum to 1.0', () => {
    const sum =
      BARAZA_TV.creatorRevSharePct +
      BARAZA_TV.communityRevSharePct +
      BARAZA_TV.protocolFeePct;
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('founder buckets are symmetric (A === B)', () => {
    expect(BRZA_ALLOCATION.founderA).toBe(BRZA_ALLOCATION.founderB);
  });
});

describe('convertXlmToBrza', () => {
  // Source-of-truth check for the verify-payment derivation. Same inputs
  // must always produce same brza_allocated (reproducibility from pinned
  // intent rates is the whole reason both rates live in the intent payload).

  // All prices below are synthetic test fixtures — real phase prices are
  // counsel-gated, ship unset, and arrive at runtime via signed intent payloads.

  it('derives BRZA from XLM amount, XLM/USD rate, and BRZA price', () => {
    // 100 XLM × $0.10/XLM = $10 USD ÷ $0.05/BRZA (fixture) = 200 BRZA
    expect(convertXlmToBrza(100, 0.10, 0.05)).toBe(200);
  });

  it('rounds to 7 decimals to match BRZA_ASSET.decimals', () => {
    // 1.23456789 XLM × $0.10 = $0.123456789 ÷ $0.05 = 2.46913578
    // 7-decimal round: 2.4691358 (1e7 precision)
    const result = convertXlmToBrza(1.23456789, 0.10, 0.05);
    expect(result).toBeCloseTo(2.4691358, 7);
    // Confirm rounding actually happens (no 8th-decimal precision leak)
    expect(result.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(7);
  });

  it('scales linearly with XLM amount', () => {
    expect(convertXlmToBrza(50, 0.10, 0.05)).toBe(100);
    expect(convertXlmToBrza(200, 0.10, 0.05)).toBe(400);
  });

  it('respects different prices', () => {
    // Same 100 XLM × $0.10 = $10 USD at a $0.25 fixture price = 40 BRZA
    expect(convertXlmToBrza(100, 0.10, 0.25)).toBe(40);
  });

  it('rejects non-positive XLM amount', () => {
    expect(() => convertXlmToBrza(0, 0.10, 0.05)).toThrow(/amountXlm/);
    expect(() => convertXlmToBrza(-1, 0.10, 0.05)).toThrow(/amountXlm/);
    expect(() => convertXlmToBrza(NaN, 0.10, 0.05)).toThrow(/amountXlm/);
  });

  it('rejects non-positive XLM/USD rate', () => {
    expect(() => convertXlmToBrza(100, 0, 0.05)).toThrow(/xlmUsdRate/);
    expect(() => convertXlmToBrza(100, -0.1, 0.05)).toThrow(/xlmUsdRate/);
  });

  it('rejects non-positive BRZA price', () => {
    expect(() => convertXlmToBrza(100, 0.10, 0)).toThrow(/brzaPriceUsd/);
    expect(() => convertXlmToBrza(100, 0.10, -0.05)).toThrow(/brzaPriceUsd/);
  });

  it('XLM_USD_RATE_MVP placeholder is the documented 0.10', () => {
    // CLAUDE.md and the intent handler both assume 0.10 as the MVP rate.
    // Pin the value so silent drift between this constant and the edge
    // handler's hardcoded fallback becomes a test failure.
    expect(XLM_USD_RATE_MVP).toBe(0.10);
  });
});

describe('BRZA vesting', () => {
  it('returns 0 for every bucket while the schedule ships as placeholders', () => {
    // Allocation tokens and day-counts are counsel-gated 0 placeholders, so
    // nothing can vest regardless of elapsed time.
    for (const bucket of Object.keys(BRZA_VESTING) as Array<keyof typeof BRZA_VESTING>) {
      expect(vestedAmount(bucket, 0)).toBe(0);
      expect(vestedAmount(bucket, 10_000)).toBe(0);
    }
  });

  it('rejects negative elapsed time', () => {
    expect(() => vestedAmount('operations', -1)).toThrow(/non-negative/i);
  });
});

describe('BRZA treasury reads', () => {
  it('formats a valid Stellar balance, valuing at 0 while phase pricing is unset', async () => {
    mockGetBrzaBalance.mockResolvedValue({ balance: '1000', formatted: '1,000 BRZA' });
    await expect(fetchTreasuryBalance('GACCOUNT', 'KES')).resolves.toEqual({
      brza: '1,000 BRZA',
      local: 'KES 0',
      raw: 1000,
    });
  });

  it('rejects malformed Stellar balances', async () => {
    mockGetBrzaBalance.mockResolvedValue({ balance: 'nope', formatted: 'NaN BRZA' });
    await expect(fetchTreasuryBalance('GACCOUNT')).resolves.toMatchObject({
      raw: 0,
      error: expect.stringMatching(/invalid BRZA balance/i),
    });
  });

  it('reads a registered community treasury', async () => {
    mockGetBrzaBalance.mockResolvedValue({ balance: '5', formatted: '5 BRZA' });
    registerTreasury({ communityId: 'community-test', stellarAddress: 'GACCOUNT', localCurrency: 'USD' });
    await expect(fetchTreasuryByCommunityId('community-test')).resolves.toMatchObject({
      brza: '5 BRZA',
      local: 'USD 0',
      raw: 5,
    });
  });
});

describe('BRZA TVL', () => {
  it('stays in building phase while milestone targets ship unset', () => {
    // TVL targets are counsel-gated 0 placeholders — an unconfigured target
    // can never read as reached, and progress math must not divide by zero.
    expect(getPhase(0)).toBe('building');
    expect(getPhase(1_000_000_000)).toBe('building');
    expect(getNextTarget(-1).pct).toBe(0);
    expect(getNextTarget(1_000_000).pct).toBe(0);
  });

  it('ignores malformed balances when aggregating TVL, valuing at 0 while pricing is unset', async () => {
    mockGetBrzaBalance
      .mockResolvedValueOnce({ balance: '100', formatted: '100 BRZA' })
      .mockResolvedValueOnce({ balance: 'nope', formatted: 'NaN BRZA' });
    await expect(fetchPlatformTvl(['GONE', 'GTWO'], 2, 3)).resolves.toMatchObject({
      totalBrza: 100,
      totalUsd: 0,
      communityCount: 2,
      memberCount: 3,
    });
  });
});
