import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cn,
  daysRemaining,
  formatKSh,
  formatRailAmountFromKes,
  formatRailAmountWithKes,
  formatRailDate,
  formatUSD,
  toTitleCase,
  truncateAddress,
} from '@/lib/utils';
import { writeAccountCountry } from '@/lib/accountLocale';

beforeEach(() => writeAccountCountry('KE'));

describe('formatKSh', () => {
  it('formats zero', () => expect(formatKSh(0)).toBe('KSh 0'));
  it('formats thousands', () => expect(formatKSh(234500)).toBe('KSh 234,500'));
  it('formats millions', () => expect(formatKSh(1248500)).toBe('KSh 1,248,500'));
  it('formats small fee', () => expect(formatKSh(500)).toBe('KSh 500'));
});

describe('formatUSD', () => {
  it('formats whole-dollar amounts', () => expect(formatUSD(50)).toBe('$50'));
  it('formats cents when needed', () => expect(formatUSD(50.25)).toBe('$50.25'));
});

describe('rail formatting', () => {
  it('formats source amounts in the account currency regardless of payment route', () => {
    expect(formatRailAmountFromKes(2600, 'solana')).toBe('KSh 2,600');
    expect(formatRailAmountFromKes(2600, 'mpesa')).toBe('KSh 2,600');
    expect(formatRailAmountFromKes(1600, 'stellar')).toBe('KSh 1,600');
    expect(formatRailAmountFromKes(450000, 'base')).toBe('KSh 450,000');
  });

  it('does not expose route-native amounts', () => {
    expect(formatRailAmountWithKes(6500, 'solana')).toBe('KSh 6,500');
    expect(formatRailAmountWithKes(6500, 'mpesa')).toBe('KSh 6,500');
    expect(formatRailAmountWithKes(6500, 'base')).toBe('KSh 6,500');
  });

  it('formats dates in the account country timezone', () => {
    expect(formatRailDate('2026-05-26T00:30:00.000Z', 'solana', { day: '2-digit', month: 'short', year: 'numeric' })).toBe('26 May 2026');
    expect(formatRailDate('2026-05-26T00:30:00.000Z', 'celo', { day: '2-digit', month: 'short', year: 'numeric' })).toBe('26 May 2026');
  });
});

describe('truncateAddress', () => {
  const addr = 'So11111111111111111111111111111111111111112';

  it('shows first and last 4 chars by default', () => {
    expect(truncateAddress(addr)).toBe('So11...1112');
  });

  it('respects custom char count', () => {
    expect(truncateAddress(addr, 6)).toBe('So1111...111112');
  });

  it('handles short address', () => {
    expect(truncateAddress('abcd1234', 4)).toBe('abcd...1234');
  });
});

describe('daysRemaining', () => {
  it('returns 0 for past date', () => {
    expect(daysRemaining('2020-01-01')).toBe(0);
  });

  it('returns positive number for future date', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysRemaining(future)).toBeGreaterThan(0);
  });

  it('returns correct count for exactly 7 days away', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    expect(daysRemaining('2026-01-08T00:00:00Z')).toBe(7);
    vi.useRealTimers();
  });
});

describe('toTitleCase', () => {
  it('capitalizes principal words and keeps small words lowercase', () => {
    expect(toTitleCase('run the chama where every member can see the money.')).toBe(
      'Run the Chama Where Every Member Can See the Money.',
    );
  });

  it('capitalizes first and last words even when they are small', () => {
    expect(toTitleCase('a trail to keep')).toBe('A Trail to Keep');
  });

  it('title-cases hyphenated words and keeps acronyms', () => {
    expect(toTitleCase('phone-first M-Pesa for a SACCO')).toBe('Phone-First M-Pesa for a SACCO');
  });

  it('preserves product names with inner capitals', () => {
    expect(toTitleCase('link your GitHub account')).toBe('Link Your GitHub Account');
  });
});

describe('cn', () => {
  it('merges class names', () => expect(cn('foo', 'bar')).toBe('foo bar'));
  it('drops falsy values', () => {
    const falsy = (): string | false => false as const;
    expect(cn('foo', falsy() && 'bar')).toBe('foo');
  });
  it('resolves tailwind conflicts (later wins)', () => {
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });
});
