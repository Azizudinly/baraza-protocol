import { describe, expect, it } from 'vitest';
import { normaliseKenyanPhone, toE164Kenyan, toE164, isValidE164 } from '@/lib/phone';

describe('normaliseKenyanPhone', () => {
  it('accepts 9-digit local form starting with 7 or 1', () => {
    expect(normaliseKenyanPhone('712345678')).toBe('712345678');
    expect(normaliseKenyanPhone('110123456')).toBe('110123456');
    expect(normaliseKenyanPhone('7XX XXX XXX'.replace(/X/g, '0'))).toBe('700000000');
  });

  it('accepts 10-digit form with leading 0', () => {
    expect(normaliseKenyanPhone('0712345678')).toBe('712345678');
    expect(normaliseKenyanPhone('0110123456')).toBe('110123456');
    expect(normaliseKenyanPhone('0712 345 678')).toBe('712345678');
  });

  it('accepts 12-digit form with country code', () => {
    expect(normaliseKenyanPhone('254712345678')).toBe('712345678');
    expect(normaliseKenyanPhone('+254 712 345 678')).toBe('712345678');
    expect(normaliseKenyanPhone('+254712345678')).toBe('712345678');
    expect(normaliseKenyanPhone('+254110123456')).toBe('110123456');
  });

  it('strips spaces, dashes, and parentheses', () => {
    expect(normaliseKenyanPhone('0712-345-678')).toBe('712345678');
    expect(normaliseKenyanPhone('(0712) 345 678')).toBe('712345678');
  });

  it('returns null for non-Kenyan or malformed input', () => {
    expect(normaliseKenyanPhone('')).toBeNull();
    expect(normaliseKenyanPhone('123')).toBeNull();
    expect(normaliseKenyanPhone('12345678')).toBeNull();          // 8 digits
    expect(normaliseKenyanPhone('512345678')).toBeNull();          // 9 digits but starts with 5
    expect(normaliseKenyanPhone('06123456789')).toBeNull();        // 11 digits, not 254-prefixed
    expect(normaliseKenyanPhone('+1 555 123 4567')).toBeNull();    // US format
  });
});

describe('toE164Kenyan', () => {
  it('returns +254-prefixed number for valid inputs', () => {
    expect(toE164Kenyan('0712345678')).toBe('+254712345678');
    expect(toE164Kenyan('712345678')).toBe('+254712345678');
    expect(toE164Kenyan('+254 712 345 678')).toBe('+254712345678');
  });

  it('returns null for invalid inputs', () => {
    expect(toE164Kenyan('')).toBeNull();
    expect(toE164Kenyan('not a phone')).toBeNull();
  });
});

describe('toE164 (Multi-Market)', () => {
  it('normalises Ugandan numbers', () => {
    expect(toE164('0772123456', 'UG')).toBe('+256772123456');
    expect(toE164('+256772123456')).toBe('+256772123456');
    expect(toE164('256772123456')).toBe('+256772123456');
  });

  it('normalises Ghanaian numbers', () => {
    expect(toE164('0244123456', 'GH')).toBe('+233244123456');
    expect(toE164('+233244123456')).toBe('+233244123456');
  });

  it('normalises Nigerian numbers', () => {
    expect(toE164('08031234567', 'NG')).toBe('+2348031234567');
    expect(toE164('+2348031234567')).toBe('+2348031234567');
  });

  it('validates standard E.164 pattern', () => {
    expect(isValidE164('+254712345678')).toBe(true);
    expect(isValidE164('+256772123456')).toBe(true);
    expect(isValidE164('0712345678')).toBe(false);
    expect(isValidE164('')).toBe(false);
  });
});
