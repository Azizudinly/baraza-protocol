import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import paystackWebhookHandler from '../../../api/webhooks/paystack';
import kotaniWebhookHandler from '../../../api/webhooks/kotani';

async function generateKotaniSignature(rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function generatePaystackSignature(rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

describe('Shipped Webhook Handlers Verification Suite', () => {
  const kotaniSecret = 'kotani_test_secret_key_12345';
  const paystackSecret = 'paystack_test_secret_key_67890';

  beforeEach(() => {
    process.env.KOTANI_WEBHOOK_SECRET = kotaniSecret;
    process.env.PAYSTACK_SECRET_KEY = paystackSecret;
  });

  afterEach(() => {
    delete process.env.KOTANI_WEBHOOK_SECRET;
    delete process.env.PAYSTACK_SECRET_KEY;
  });

  describe('Shipped Kotani Webhook Handler (HMAC-SHA256)', () => {
    it('rejects request missing x-kotani-signature with 403', async () => {
      const payload = JSON.stringify({ event: 'transfer.success', reference: 'ord_123' });
      const req = new Request('https://barazaprotocol.com/api/webhooks/kotani', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
      });
      const res = await kotaniWebhookHandler(req);
      expect(res.status).toBe(403);
    });

    it('accepts authentic HMAC-SHA256 signature on real Kotani handler', async () => {
      const payload = JSON.stringify({
        event: 'transfer.success',
        reference: 'ord_123',
        amount: 512.50,
      });
      const sig = await generateKotaniSignature(payload, kotaniSecret);
      const req = new Request('https://barazaprotocol.com/api/webhooks/kotani', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-kotani-signature': sig,
        },
        body: payload,
      });
      const res = await kotaniWebhookHandler(req);
      expect([200, 400, 500]).toContain(res.status);
    });
  });

  describe('Shipped Paystack Webhook Handler (HMAC-SHA512)', () => {
    it('rejects request missing x-paystack-signature with 401', async () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'ord_123' } });
      const req = new Request('https://barazaprotocol.com/api/webhooks/paystack', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
      });
      const res = await paystackWebhookHandler(req);
      expect(res.status).toBe(401);
    });

    it('rejects forged Paystack signature with 401', async () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'ord_123' } });
      const req = new Request('https://barazaprotocol.com/api/webhooks/paystack', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-paystack-signature': 'forged_signature_deadbeef',
        },
        body: payload,
      });
      const res = await paystackWebhookHandler(req);
      expect(res.status).toBe(401);
    });

    it('accepts authentic HMAC-SHA512 signature on real handler', async () => {
      const payload = JSON.stringify({
        event: 'charge.success',
        data: {
          id: 998877,
          reference: 'ord_paystack_8899',
          amount: 51250,
          currency: 'KES',
          status: 'success',
        },
      });
      const sig = await generatePaystackSignature(payload, paystackSecret);
      const req = new Request('https://barazaprotocol.com/api/webhooks/paystack', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-paystack-signature': sig,
        },
        body: payload,
      });
      const res = await paystackWebhookHandler(req);
      // Returns 200 or 500 (if DB unconfigured in isolated unit test), but signature verification succeeds!
      expect([200, 500]).toContain(res.status);
    });
  });
});
