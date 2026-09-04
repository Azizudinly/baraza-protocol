// app/api/_lib/validation.ts
// Strict Ingress Parameter Validation & PostgREST Grammar Protection

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

export function assertValidSlug(id: string | null | undefined, paramName: string): string {
  if (!id || typeof id !== 'string' || !/^[a-zA-Z0-9_-]{3,64}$/.test(id)) {
    throw new HttpError(400, `Invalid ${paramName}: must be 3-64 alphanumeric characters, underscores, or hyphens.`);
  }
  return id;
}

export function sanitizeText(input: string | null | undefined, maxLength: number = 500): string {
  if (!input || typeof input !== 'string') return '';
  // Normalize Unicode to Canonical Decomposition followed by Canonical Composition (NFKC)
  // Strip zero-width characters and homoglyph abuse
  let cleaned = input.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '');
  // Strip HTML / Script tags
  cleaned = cleaned.replace(/<[^>]*>?/gm, '');
  // Trim and clamp to maxLength
  return cleaned.trim().slice(0, maxLength);
}

export function assertValidHttpsUrl(url: string | null | undefined, paramName: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length > 512) {
    throw new HttpError(400, `Invalid ${paramName}: maximum length is 512 characters.`);
  }
  // Anti-SSRF check: Must be https and not target private IP space
  const httpsRegex = /^https:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/;
  if (!httpsRegex.test(trimmed)) {
    throw new HttpError(400, `Invalid ${paramName}: must be a valid HTTPS URL.`);
  }
  const privateIpRegex = /^(https?:\/\/)?(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.)/i;
  if (privateIpRegex.test(trimmed)) {
    throw new HttpError(400, `Invalid ${paramName}: URL points to an unroutable or private address space.`);
  }
  return trimmed;
}
