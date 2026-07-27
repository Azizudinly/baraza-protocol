import { describe, expect, it } from 'vitest';
import {
  darajaSandboxEnabled,
  requestStkPush,
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

  it('respects an explicit sandbox: false and omits the sandbox receipt', async () => {
    const result = await requestStkPush({
      phone: '+254700000000',
      amountKes: 20,
      reference: 'INVITE-1',
      sandbox: false,
    });

    expect(result.mode).toBe('live');
    expect(result.sandboxReceipt).toBeUndefined();
  });

  it('derives deterministic, input-dependent checkout/merchant IDs', async () => {
    const a = await requestStkPush({ phone: '+254700000001', amountKes: 20, reference: 'REF-A' });
    const b = await requestStkPush({ phone: '+254700000001', amountKes: 20, reference: 'REF-A' });
    const c = await requestStkPush({ phone: '+254700000002', amountKes: 20, reference: 'REF-A' });

    expect(a.checkoutRequestId).toBe(b.checkoutRequestId);
    expect(a.checkoutRequestId).not.toBe(c.checkoutRequestId);
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
