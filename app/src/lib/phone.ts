/**
 * Phone number helpers — multi-market E.164 normalization for East & West African
 * mobile money payment rails (Kenya, Uganda, Ghana, Nigeria).
 *
 * Conforms to SAD §3.6 (Kenya DPA 2019 / PII Minimization) and ITU-T E.164 standards.
 */

export interface PhoneNormalizationResult {
  /** Full ITU-T E.164 representation (e.g. '+254712345678'). */
  e164: string;
  /** ISO 3166-1 alpha-2 country code ('KE', 'UG', 'GH', 'NG', or 'GLOBAL'). */
  country: 'KE' | 'UG' | 'GH' | 'NG' | 'GLOBAL';
  /** Local subscriber number without international prefix. */
  localNumber: string;
}

/**
 * Normalises a Kenyan phone input to the 9-digit local subscriber form
 * (`7XX XXX XXX` or `1XX XXX XXX`). Accepts any of:
 *   - `7XX XXX XXX` / `1XX XXX XXX`
 *   - `07XX XXX XXX` / `01XX XXX XXX`
 *   - `+254 7XX...` / `254 7XX...` / `254 1XX...`
 * Returns null when the input is not a valid Kenyan mobile number.
 */
export function normaliseKenyanPhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('1'))) return digits;
  if (digits.length === 10 && (digits.startsWith('07') || digits.startsWith('01'))) return digits.slice(1);
  if (digits.length === 12 && (digits.startsWith('2547') || digits.startsWith('2541'))) return digits.slice(3);
  return null;
}

/** Convenience: returns the full +254 E.164 form, or null if invalid. */
export function toE164Kenyan(raw: string): string | null {
  const local = normaliseKenyanPhone(raw);
  return local ? `+254${local}` : null;
}

/**
 * Normalises a multi-market African phone number to its canonical E.164 format.
 * Supports Kenya (+254), Uganda (+256), Ghana (+233), and Nigeria (+234).
 *
 * @param raw Raw input string from UI, USSD, or API.
 * @param defaultCountry Default country fallback if no dial code present (default 'KE').
 */
export function toE164(raw: string, defaultCountry: 'KE' | 'UG' | 'GH' | 'NG' = 'KE'): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const clean = raw.trim();
  const digits = clean.replace(/\D/g, '');
  if (!digits || digits.length < 7 || digits.length > 15) return null;

  // 1. Explicitly country-code prefixed
  if (clean.startsWith('+') || digits.startsWith('254') || digits.startsWith('256') || digits.startsWith('233') || digits.startsWith('234')) {
    if (digits.startsWith('254') && digits.length === 12) {
      const sub = digits.slice(3);
      if (sub.startsWith('7') || sub.startsWith('1')) return `+${digits}`;
    }
    if (digits.startsWith('256') && digits.length === 12) {
      return `+${digits}`;
    }
    if (digits.startsWith('233') && (digits.length === 12 || digits.length === 11)) {
      return `+${digits}`;
    }
    if (digits.startsWith('234') && digits.length === 13) {
      return `+${digits}`;
    }
  }

  // 2. Local 0-prefixed or subscriber format based on defaultCountry
  if (defaultCountry === 'KE') {
    const keLocal = normaliseKenyanPhone(clean);
    return keLocal ? `+254${keLocal}` : null;
  }

  if (defaultCountry === 'UG') {
    if (digits.length === 10 && digits.startsWith('0')) return `+256${digits.slice(1)}`;
    if (digits.length === 9) return `+256${digits}`;
  }

  if (defaultCountry === 'GH') {
    if (digits.length === 10 && digits.startsWith('0')) return `+233${digits.slice(1)}`;
    if (digits.length === 9) return `+233${digits}`;
  }

  if (defaultCountry === 'NG') {
    if (digits.length === 11 && digits.startsWith('0')) return `+234${digits.slice(1)}`;
    if (digits.length === 10) return `+234${digits}`;
  }

  // Fallback to Kenyan normalization
  const fallback = normaliseKenyanPhone(clean);
  return fallback ? `+254${fallback}` : null;
}

/**
 * Validates whether a phone number matches standard E.164 pattern.
 */
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}
