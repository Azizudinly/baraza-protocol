import { describe, expect, it } from 'vitest';

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

async function verifyKotaniSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const expected = await generateKotaniSignature(rawBody, secret);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
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

async function verifyPaystackSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  const expected = await generatePaystackSignature(rawBody, secret);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

describe('Webhook Signature Verification Suite', () => {
  const kotaniSecret = 'kotani_test_secret_key_12345';
  const paystackSecret = 'paystack_test_secret_key_67890';

  describe('Kotani HMAC-SHA256', () => {
    it('verifies valid Kotani signature over JSON payload', async () => {
      const payload = JSON.stringify({
        event: 'transfer.success',
        reference: 'ord_12345678',
        amount: 512.50,
      });
      const sig = await generateKotaniSignature(payload, kotaniSecret);
      const isValid = await verifyKotaniSignature(payload, sig, kotaniSecret);
      expect(isValid).toBe(true);
    });

    it('rejects tampered payload', async () => {
      const payload = JSON.stringify({ reference: 'ord_12345678', amount: 512.50 });
      const tampered = JSON.stringify({ reference: 'ord_12345678', amount: 1000.00 });
      const sig = await generateKotaniSignature(payload, kotaniSecret);
      const isValid = await verifyKotaniSignature(tampered, sig, kotaniSecret);
      expect(isValid).toBe(false);
    });

    it('rejects invalid signature string', async () => {
      const payload = JSON.stringify({ reference: 'ord_12345678' });
      const isValid = await verifyKotaniSignature(payload, 'deadbeef0000', kotaniSecret);
      expect(isValid).toBe(false);
    });
  });

  describe('Paystack HMAC-SHA512', () => {
    it('verifies valid Paystack signature over charge.success payload', async () => {
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
      const isValid = await verifyPaystackSignature(payload, sig, paystackSecret);
      expect(isValid).toBe(true);
    });

    it('rejects tampered Paystack event payload', async () => {
      const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'ord_1' } });
      const tampered = JSON.stringify({ event: 'charge.success', data: { reference: 'ord_2' } });
      const sig = await generatePaystackSignature(payload, paystackSecret);
      const isValid = await verifyPaystackSignature(tampered, sig, paystackSecret);
      expect(isValid).toBe(false);
    });
  });
});
