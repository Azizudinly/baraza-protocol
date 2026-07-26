import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST as handler } from '../../../api/stellar/verify-payment';

const TX_HASH = 'a'.repeat(64);
const INTENT_SECRET = 'test-intent-secret-32-bytes-long!';

function legacyRequest(environment?: 'test' | 'live'): Request {
  return new Request('https://baraza.example/api/stellar/verify-payment', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ communityId: 'community-test', txHash: TX_HASH, amountXlm: 1, environment }),
  });
}

// Mirrors the token format from create-payment-intent.ts
async function makeIntentToken(communityId: string, amountXlm: number, secret: string, offsetMs = 0): Promise<string> {
  function base64url(bytes: Uint8Array): string {
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000 + offsetMs).toISOString();
  const payload = JSON.stringify({ communityId, amountXlm, expiresAt, nonce: 'testnonce' });
  const encodedPayload = btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
  return `${encodedPayload}.${base64url(new Uint8Array(sig))}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.STELLAR_NETWORK;
  delete process.env.STELLAR_HORIZON_URL;
  delete process.env.STELLAR_TREASURY_ACCOUNT;
  delete process.env.STELLAR_INTENT_SECRET;
});

describe('Stellar payment verification API', () => {
  it('rejects mainnet verification without a configured treasury account', async () => {
    process.env.STELLAR_NETWORK = 'mainnet';
    process.env.STELLAR_INTENT_SECRET = INTENT_SECRET;
    const token = await makeIntentToken('community-test', 1, INTENT_SECRET);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const req = new Request('https://baraza.example/api/stellar/verify-payment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intentToken: token, txHash: TX_HASH }),
    });
    const response = await handler(req);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: 'stellar_verifier_not_configured',
      message: 'STELLAR_TREASURY_ACCOUNT is required for Stellar mainnet verification.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects malformed configured treasury accounts before calling Horizon', async () => {
    const savedNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      process.env.STELLAR_TREASURY_ACCOUNT = 'not-a-stellar-account';
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const response = await handler(legacyRequest());

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        error: 'stellar_verifier_not_configured',
        message: 'STELLAR_TREASURY_ACCOUNT must be a valid Stellar G-account.',
      });
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = savedNodeEnv;
    }
  });

  it('allows legacy treasury-less verification on testnet for local review', async () => {
    const savedNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      process.env.STELLAR_NETWORK = 'testnet';
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(Response.json({ hash: TX_HASH, ledger: 123, successful: true }))
        .mockResolvedValueOnce(Response.json({
          _embedded: {
            records: [{ type: 'payment', asset_type: 'native', amount: '1.0000000', to: 'GDESTINATION' }],
          },
        }));
      vi.stubGlobal('fetch', fetchMock);

      const response = await handler(legacyRequest());

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        status: 'PAYMENT_CONFIRMED',
        rail: 'stellar',
        persisted: false,
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      process.env.NODE_ENV = savedNodeEnv;
    }
  });

  it('rejects mainnet requests that omit intentToken', async () => {
    process.env.STELLAR_NETWORK = 'mainnet';
    process.env.STELLAR_TREASURY_ACCOUNT = 'G' + 'A'.repeat(55);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // No intentToken — only legacy fields
    const req = new Request('https://baraza.example/api/stellar/verify-payment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ communityId: 'community-test', txHash: TX_HASH, amountXlm: 1 }),
    });
    const response = await handler(req);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'invalid_request',
      message: 'intentToken is required for production Stellar payments.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats live-mode requests as mainnet even when server env defaults to testnet', async () => {
    process.env.STELLAR_NETWORK = 'testnet';
    process.env.STELLAR_TREASURY_ACCOUNT = 'G' + 'A'.repeat(55);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(legacyRequest('live'));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'invalid_request',
      message: 'intentToken is required for production Stellar payments.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts a valid intentToken and extracts communityId from it', async () => {
    process.env.STELLAR_NETWORK = 'testnet';
    process.env.STELLAR_INTENT_SECRET = INTENT_SECRET;
    const token = await makeIntentToken('intent-community', 2.5, INTENT_SECRET);

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ hash: TX_HASH, ledger: 456, successful: true }))
      .mockResolvedValueOnce(Response.json({
        _embedded: {
          records: [{ type: 'payment', asset_type: 'native', amount: '2.5000000', to: 'GDESTINATION' }],
        },
      }));
    vi.stubGlobal('fetch', fetchMock);

    const req = new Request('https://baraza.example/api/stellar/verify-payment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intentToken: token, txHash: TX_HASH }),
    });
    const response = await handler(req);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'PAYMENT_CONFIRMED',
      rail: 'stellar',
      amountXlm: 2.5,
    });
  });

  it('rejects a tampered intentToken', async () => {
    process.env.STELLAR_NETWORK = 'testnet';
    process.env.STELLAR_INTENT_SECRET = INTENT_SECRET;
    const token = await makeIntentToken('community-x', 1, INTENT_SECRET);
    // Tamper: swap last char of sig
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const req = new Request('https://baraza.example/api/stellar/verify-payment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ intentToken: tampered, txHash: TX_HASH }),
    });
    const response = await handler(req);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
