import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../../api/mpesa/transaction-status';

describe('mpesa transaction-status route', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('verifies an independent Daraja status check before exposing a positive result', async () => {
    vi.stubEnv('MPESA_CONSUMER_KEY', 'live-consumer-key');
    vi.stubEnv('MPESA_CONSUMER_SECRET', 'live-consumer-secret');
    vi.stubEnv('MPESA_SHORTCODE', '174379');
    vi.stubEnv('MPESA_INITIATOR_USERNAME', 'initiator');
    vi.stubEnv('MPESA_INITIATOR_SECURITY_CREDENTIAL', 'encrypted-credential');
    vi.stubEnv('MPESA_STATUS_RESULT_URL', 'https://example.com/api/mpesa/status-result');
    vi.stubEnv('MPESA_STATUS_TIMEOUT_URL', 'https://example.com/api/mpesa/status-timeout');
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

    const response = await handler(new Request('https://example.com/api/mpesa/transaction-status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transactionId: 'ws_live123' }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      mode: 'live',
      transactionId: 'ws_live123',
      resultCode: '0',
      verified: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/mpesa/transactionstatus/v1/query'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
