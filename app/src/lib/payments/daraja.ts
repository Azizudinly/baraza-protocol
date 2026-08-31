export interface DarajaStkPushInput {
  phone: string;
  amountKes: number;
  reference: string;
  accountReference?: string;
  callbackUrl?: string;
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

interface DarajaOAuthResponse {
  access_token?: string;
  expires_in?: number;
}

interface DarajaStkPushApiResponse {
  CheckoutRequestID?: string;
  MerchantRequestID?: string;
  ResponseCode?: string;
  ResponseDescription?: string;
  errorMessage?: string;
}

export interface DarajaTransactionStatusInput {
  transactionId: string;
  remarks?: string;
  resultUrl?: string;
  queueTimeoutUrl?: string;
  initiator?: string;
  securityCredential?: string;
  partyA?: string;
  sandbox?: boolean;
}

export interface DarajaTransactionStatusResult {
  provider: 'daraja';
  mode: 'sandbox' | 'live';
  transactionId: string;
  resultCode: string;
  resultDesc?: string;
  conversationId?: string;
  originatorConversationId?: string;
  acceptedAt: string;
}

const DARAJA_SANDBOX_BASE = 'https://sandbox.safaricom.co.ke';
const DARAJA_LIVE_BASE = 'https://api.safaricom.co.ke';

let cachedLiveAccessToken: { token: string; expiresAt: number } | null = null;

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

export function darajaSandboxEnabled(sandboxEnvFlag?: string): boolean {
  return sandboxEnvFlag !== 'false';
}

function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith('7') && digits.length === 9) return `254${digits}`;
  return digits;
}

function resolveDarajaBaseUrl(sandbox: boolean): string {
  return sandbox ? DARAJA_SANDBOX_BASE : DARAJA_LIVE_BASE;
}

function resolveTimestamp(date = new Date()): string {
  const year = date.getUTCFullYear().toString();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

function encodeBase64(value: string): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(value, 'utf8').toString('base64');
  let binary = '';
  for (const byte of new TextEncoder().encode(value)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function fetchLiveAccessToken(baseUrl: string): Promise<string> {
  if (cachedLiveAccessToken && cachedLiveAccessToken.expiresAt > Date.now() + 30_000) {
    return cachedLiveAccessToken.token;
  }

  const consumerKey = process.env.MPESA_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET?.trim();
  if (!consumerKey || !consumerSecret) {
    throw new Error('Daraja live credentials are not configured.');
  }

  const auth = encodeBase64(`${consumerKey}:${consumerSecret}`);
  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Daraja OAuth failed: ${detail}`);
  }

  const data = await response.json() as DarajaOAuthResponse;
  if (!data.access_token) throw new Error('Daraja OAuth response did not include an access token.');

  const expiresIn = Number(data.expires_in ?? 3600);
  cachedLiveAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max(0, expiresIn - 60) * 1000,
  };
  return data.access_token;
}

async function buildLiveStkPayload(input: DarajaStkPushInput): Promise<{ baseUrl: string; token: string; body: Record<string, unknown> }> {
  const baseUrl = resolveDarajaBaseUrl(false);
  const token = await fetchLiveAccessToken(baseUrl);
  const shortcode = process.env.MPESA_SHORTCODE?.trim();
  const passkey = process.env.MPESA_PASSKEY?.trim();
  if (!shortcode || !passkey) {
    throw new Error('Daraja live shortcode/passkey are not configured.');
  }

  const callbackUrl = input.callbackUrl?.trim() || process.env.MPESA_CALLBACK_URL?.trim();
  if (!callbackUrl) throw new Error('Daraja callback URL is required for live STK push.');

  const normalizedPhone = normalizePhoneNumber(input.phone);
  const timestamp = resolveTimestamp();
  const password = encodeBase64(`${shortcode}${passkey}${timestamp}`);
  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.trunc(input.amountKes),
    PartyA: normalizedPhone,
    PartyB: shortcode,
    PhoneNumber: normalizedPhone,
    CallBackURL: callbackUrl,
    AccountReference: input.accountReference?.trim() || input.reference,
    TransactionDesc: input.reference,
  } satisfies Record<string, unknown>;

  return { baseUrl, token, body };
}

function timingSafeEqualHex(a: string, b: string): boolean {
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
  const normalizedPhone = normalizePhoneNumber(input.phone);

  if (sandbox) {
    const checkoutRequestId = `ws_${(await sha256(`${normalizedPhone}:${input.amountKes}:${input.reference}`)).slice(0, 28)}`;
    const merchantRequestId = `mr_${(await sha256(`${input.reference}:${input.amountKes}`)).slice(0, 24)}`;

    return {
      provider: 'daraja',
      mode: 'sandbox',
      checkoutRequestId,
      merchantRequestId,
      paymentReference: input.reference,
      acceptedAt,
      sandboxReceipt: `DAR-${checkoutRequestId.slice(0, 8).toUpperCase()}`,
    };
  }

  if (typeof window !== 'undefined') {
    throw new Error('Daraja live STK push must run on the server.');
  }

  const { baseUrl, token, body } = await buildLiveStkPayload({ ...input, phone: normalizedPhone });
  const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({})) as DarajaStkPushApiResponse;
  if (!response.ok || data.ResponseCode !== '0' || !data.CheckoutRequestID || !data.MerchantRequestID) {
    throw new Error(data.errorMessage || data.ResponseDescription || `Daraja STK push failed with status ${response.status}.`);
  }

  return {
    provider: 'daraja',
    mode: 'live',
    checkoutRequestId: data.CheckoutRequestID,
    merchantRequestId: data.MerchantRequestID,
    paymentReference: input.reference,
    acceptedAt,
  };
}

export async function requestTransactionStatusQuery(input: DarajaTransactionStatusInput): Promise<DarajaTransactionStatusResult> {
  const acceptedAt = new Date().toISOString();
  const sandbox = input.sandbox ?? false;
  const baseUrl = resolveDarajaBaseUrl(sandbox);

  if (sandbox) {
    return {
      provider: 'daraja',
      mode: 'sandbox',
      transactionId: input.transactionId,
      resultCode: '0',
      resultDesc: 'Sandbox transaction-status verification accepted.',
      acceptedAt,
    };
  }

  if (typeof window !== 'undefined') {
    throw new Error('Daraja live transaction-status verification must run on the server.');
  }

  const token = await fetchLiveAccessToken(baseUrl);
  const shortcode = process.env.MPESA_SHORTCODE?.trim();
  const initiator = input.initiator?.trim() || process.env.MPESA_INITIATOR_USERNAME?.trim();
  const securityCredential = input.securityCredential?.trim() || process.env.MPESA_INITIATOR_SECURITY_CREDENTIAL?.trim();
  if (!shortcode) {
    throw new Error('Daraja shortcode is required for transaction-status verification.');
  }
  if (!initiator) {
    throw new Error('Daraja initiator username is required for transaction-status verification.');
  }
  if (!securityCredential) {
    throw new Error('Daraja initiator security credential is required for transaction-status verification.');
  }

  const resultUrl = input.resultUrl?.trim() || process.env.MPESA_STATUS_RESULT_URL?.trim();
  const queueTimeoutUrl = input.queueTimeoutUrl?.trim() || process.env.MPESA_STATUS_TIMEOUT_URL?.trim();
  if (!resultUrl) throw new Error('Daraja status result URL is required for transaction-status verification.');
  if (!queueTimeoutUrl) throw new Error('Daraja status timeout URL is required for transaction-status verification.');

  const body = {
    Initiator: initiator,
    SecurityCredential: securityCredential,
    CommandID: 'TransactionStatusQuery',
    TransactionID: input.transactionId,
    PartyA: input.partyA?.trim() || shortcode,
    IdentifierType: '4',
    ResultURL: resultUrl,
    QueueTimeOutURL: queueTimeoutUrl,
    Remarks: input.remarks?.trim() || 'Verification of contribution payment',
  } satisfies Record<string, unknown>;

  const response = await fetch(`${baseUrl}/mpesa/transactionstatus/v1/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({})) as {
    ResponseCode?: string;
    ResponseDescription?: string;
    ResultCode?: string;
    ResultDesc?: string;
    ConversationID?: string;
    OriginatorConversationID?: string;
    errorMessage?: string;
  };

  if (!response.ok || (data.ResponseCode !== '0' && data.ResultCode !== '0')) {
    throw new Error(data.errorMessage || data.ResponseDescription || data.ResultDesc || `Daraja transaction-status query failed with status ${response.status}.`);
  }

  return {
    provider: 'daraja',
    mode: 'live',
    transactionId: input.transactionId,
    resultCode: data.ResultCode ?? data.ResponseCode ?? '0',
    resultDesc: data.ResultDesc ?? data.ResponseDescription,
    conversationId: data.ConversationID,
    originatorConversationId: data.OriginatorConversationID,
    acceptedAt,
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
