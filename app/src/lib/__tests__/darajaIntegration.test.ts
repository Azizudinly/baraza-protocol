import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  darajaSandboxEnabled,
  requestStkPush,
  requestTransactionStatusQuery,
  signDarajaWebhookPayload,
  verifyDarajaWebhookSignature,
  type DarajaWebhookPayload,
} from '@integrations/daraja';

const payload: DarajaWebhookPayload = {
  Body: {
    stkCallback: {
      CheckoutRequestID: 'ws_test123',
      MerchantRequestID: 'mr_test123',
      ResultCode: 0,
      ResultDesc: 'Success',
    },
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('darajaSandboxEnabled', () => {
  it('defaults to sandbox when the flag is unset (m-003: caller-supplied, no import.meta.env inside the package)', () => {
    expect(darajaSandboxEnabled(undefined)).toBe(true);
  });

  it('is disabled only when the flag is exactly the string "false"', () => {
    expect(darajaSandboxEnabled('false')).toBe(false);
    expect(darajaSandboxEnabled('true')).toBe(true);
    expect(darajaSandboxEnabled('False')).toBe(true);
    expect(darajaSandboxEnabled('')).toBe(true);
  });
});

describe('requestStkPush', () => {
  it('defaults to sandbox mode and issues a sandbox receipt', async () => {
    const result = await requestStkPush({
      phone: '+254700000000',
      amountKes: 20,
      reference: 'INVITE-1',
    });

    expect(result.mode).toBe('sandbox');
    expect(result.sandboxReceipt).toBeDefined();
    expect(result.checkoutRequestId).toMatch(/^ws_/);
    expect(result.merchantRequestId).toMatch(/^mr_/);
  });

  it('respects an explicit sandbox: false and uses the live OAuth/STK path when credentials are present', async () => {
    vi.stubEnv('MPESA_CONSUMER_KEY', 'live-consumer-key');
    vi.stubEnv('MPESA_CONSUMER_SECRET', 'live-consumer-secret');
    vi.stubEnv('MPESA_SHORTCODE', '174379');
    vi.stubEnv('MPESA_PASSKEY', 'live-passkey');
    vi.stubEnv('MPESA_CALLBACK_URL', 'https://example.com/api/mpesa/callback');
    vi.stubGlobal('window', undefined);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/oauth/v1/generate')) {
        return new Response(JSON.stringify({ access_token: 'live-token', expires_in: 3600 }), { status: 200 });
      }
      if (url.includes('/mpesa/stkpush/v1/processrequest')) {
        return new Response(
          JSON.stringify({
            ResponseCode: '0',
            ResponseDescription: 'Success',
            CheckoutRequestID: 'ws_live123',
            MerchantRequestID: 'mr_live123',
          }),
          { status: 200 },
        );
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestStkPush({
      phone: '+254700000000',
      amountKes: 20,
      reference: 'INVITE-1',
      sandbox: false,
    });

    expect(result.mode).toBe('live');
    expect(result.sandboxReceipt).toBeUndefined();
    expect(result.checkoutRequestId).toBe('ws_live123');
    expect(result.merchantRequestId).toBe('mr_live123');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('derives deterministic, input-dependent checkout/merchant IDs', async () => {
    const a = await requestStkPush({ phone: '+254700000001', amountKes: 20, reference: 'REF-A' });
    const b = await requestStkPush({ phone: '+254700000001', amountKes: 20, reference: 'REF-A' });
    const c = await requestStkPush({ phone: '+254700000002', amountKes: 20, reference: 'REF-A' });

    expect(a.checkoutRequestId).toBe(b.checkoutRequestId);
    expect(a.checkoutRequestId).not.toBe(c.checkoutRequestId);
  });
});

describe('requestTransactionStatusQuery', () => {
  it('fires an independent TransactionStatusQuery using live credentials before trusting a callback', async () => {
    vi.stubEnv('MPESA_CONSUMER_KEY', 'live-consumer-key');
    vi.stubEnv('MPESA_CONSUMER_SECRET', 'live-consumer-secret');
    vi.stubEnv('MPESA_SHORTCODE', '174379');
    vi.stubEnv('MPESA_PASSKEY', 'live-passkey');
    vi.stubEnv('MPESA_INITIATOR_USERNAME', 'initiator');
    vi.stubEnv('MPESA_INITIATOR_SECURITY_CREDENTIAL', 'encrypted-credential');
    vi.stubEnv('MPESA_CALLBACK_URL', 'https://example.com/api/mpesa/callback');
    vi.stubGlobal('window', undefined);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/oauth/v1/generate')) {
        return new Response(JSON.stringify({ access_token: 'live-token', expires_in: 3600 }), { status: 200 });
      }
      if (url.includes('/mpesa/transactionstatus/v1/query')) {
        return new Response(JSON.stringify({
          ResponseCode: '0',
          ResponseDescription: 'The service request is processed successfully.',
          ConversationID: 'CON-123',
          OriginatorConversationID: 'ORG-123',
          ResultCode: '0',
          ResultDesc: 'The service request is processed successfully.',
        }), { status: 200 });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestTransactionStatusQuery({
      transactionId: 'ws_live123',
      remarks: 'Verification of contribution payment',
      resultUrl: 'https://example.com/api/mpesa/status-result',
      queueTimeoutUrl: 'https://example.com/api/mpesa/status-timeout',
    });

    expect(result.mode).toBe('live');
    expect(result.resultCode).toBe('0');
    expect(result.transactionId).toBe('ws_live123');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/mpesa/transactionstatus/v1/query'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});

describe('verifyDarajaWebhookSignature', () => {
  it('falls back to darajaSandboxEnabled(flag) when no secret is configured', async () => {
    await expect(verifyDarajaWebhookSignature(payload, null, null, undefined)).resolves.toBe(true);
    await expect(verifyDarajaWebhookSignature(payload, null, null, 'false')).resolves.toBe(false);
  });

  it('rejects when a secret is configured but no signature was sent', async () => {
    await expect(verifyDarajaWebhookSignature(payload, null, 'shared-secret')).resolves.toBe(false);
    await expect(verifyDarajaWebhookSignature(payload, undefined, 'shared-secret')).resolves.toBe(false);
  });

  it('accepts a correctly signed payload (case/whitespace-insensitive)', async () => {
    const secret = 'daraja-webhook-secret';
    const signature = await signDarajaWebhookPayload(payload, secret);

    await expect(verifyDarajaWebhookSignature(payload, signature, secret)).resolves.toBe(true);
    await expect(verifyDarajaWebhookSignature(payload, ` ${signature.toUpperCase()} `, secret)).resolves.toBe(true);
  });

  it('rejects a tampered payload (C-style regression guard for M-002: no early-exit === leak)', async () => {
    const secret = 'daraja-webhook-secret';
    const signature = await signDarajaWebhookPayload(payload, secret);
    const tamperedPayload: DarajaWebhookPayload = {
      ...payload,
      Body: { stkCallback: { ...payload.Body!.stkCallback, ResultCode: 1 } },
    };

    await expect(verifyDarajaWebhookSignature(tamperedPayload, signature, secret)).resolves.toBe(false);
  });

  it('rejects a signature with the wrong secret', async () => {
    const signature = await signDarajaWebhookPayload(payload, 'correct-secret');

    await expect(verifyDarajaWebhookSignature(payload, signature, 'wrong-secret')).resolves.toBe(false);
  });

  it('rejects a same-length but differing-content signature (exercises every branch of the constant-time compare)', async () => {
    const secret = 'daraja-webhook-secret';
    const signature = await signDarajaWebhookPayload(payload, secret);
    const lastChar = signature[signature.length - 1];
    const flippedLastChar = signature.slice(0, -1) + (lastChar === '0' ? '1' : '0');

    await expect(verifyDarajaWebhookSignature(payload, flippedLastChar, secret)).resolves.toBe(false);
  });

  it('rejects a different-length signature', async () => {
    const secret = 'daraja-webhook-secret';
    const signature = await signDarajaWebhookPayload(payload, secret);

    await expect(verifyDarajaWebhookSignature(payload, signature.slice(0, -4), secret)).resolves.toBe(false);
  });
});
