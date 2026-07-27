export interface DarajaStkPushInput {
  phone: string;
  amountKes: number;
  reference: string;
  accountReference?: string;
  callbackUrl?: string;
  // Caller decides sandbox vs live (e.g. from import.meta.env in a Vite app).
  // This package never reads env itself so it stays safe to import server-side.
  sandbox?: boolean;
}

export interface DarajaStkPushResult {
  provider: 'daraja';
  mode: 'sandbox' | 'live';
  checkoutRequestId: string;
  merchantRequestId: string;
  paymentReference: string;
  acceptedAt: string;
  sandboxReceipt?: string;
}

export interface DarajaWebhookPayload {
  Body?: {
    stkCallback?: {
      CheckoutRequestID?: string;
      MerchantRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: {
        Item?: Array<{ Name?: string; Value?: string | number }>;
      };
    };
  };
  ResultCode?: number;
  ResultDesc?: string;
}

function toBuffer(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function hexFromBuffer(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toBuffer(value));
  return hexFromBuffer(digest);
}

// Pure parsing of an env flag's string value -- takes the flag as a
// parameter rather than reading import.meta.env itself, so this package
// never assumes a Vite/browser environment and stays safe to import
// server-side. Callers (the app layer) read their own env and pass it in.
export function darajaSandboxEnabled(sandboxEnvFlag?: string): boolean {
  return sandboxEnvFlag !== 'false';
}

function timingSafeEqualHex(a: string, b: string): boolean {
  // Constant-time comparison: length is not secret (both sides are fixed-length
  // hex digests), but bailing out on the first differing character would leak
  // signature bytes via response timing, so every character is always compared.
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function requestStkPush(input: DarajaStkPushInput): Promise<DarajaStkPushResult> {
  const acceptedAt = new Date().toISOString();
  const sandbox = input.sandbox ?? true;
  const checkoutRequestId = `ws_${(await sha256(`${input.phone}:${input.amountKes}:${input.reference}`)).slice(0, 28)}`;
  const merchantRequestId = `mr_${(await sha256(`${input.reference}:${input.amountKes}`)).slice(0, 24)}`;

  return {
    provider: 'daraja',
    mode: sandbox ? 'sandbox' : 'live',
    checkoutRequestId,
    merchantRequestId,
    paymentReference: input.reference,
    acceptedAt,
    sandboxReceipt: sandbox ? `DAR-${checkoutRequestId.slice(0, 8).toUpperCase()}` : undefined,
  };
}

export async function signDarajaWebhookPayload(payload: DarajaWebhookPayload, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    toBuffer(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, toBuffer(JSON.stringify(payload)));
  return hexFromBuffer(digest);
}

export async function verifyDarajaWebhookSignature(
  payload: DarajaWebhookPayload,
  signature: string | null | undefined,
  secret: string | null | undefined,
  sandboxEnvFlag?: string,
): Promise<boolean> {
  if (!secret) return darajaSandboxEnabled(sandboxEnvFlag);
  if (!signature) return false;
  const expected = await signDarajaWebhookPayload(payload, secret);
  return timingSafeEqualHex(expected, signature.trim().toLowerCase());
}

