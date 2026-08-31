import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import transactionStatusHandler from '../../../api/mpesa/transaction-status';
import simulateHandler from '../../../api/mpesa/simulate';
import statusResultHandler from '../../../api/mpesa/status-result';
import statusTimeoutHandler from '../../../api/mpesa/status-timeout';

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

  it('accepts query initiation but does not claim payment verification', async () => {
    vi.stubEnv('MPESA_CONSUMER_KEY', 'live-consumer-key');
    vi.stubEnv('MPESA_CONSUMER_SECRET', 'live-consumer-secret');
    vi.stubEnv('MPESA_SHORTCODE', '174379');
    vi.stubEnv('MPESA_INITIATOR_USERNAME', 'initiator');
    vi.stubEnv('MPESA_INITIATOR_SECURITY_CREDENTIAL', 'encrypted-credential');
    vi.stubEnv('MPESA_STATUS_RESULT_URL', 'https://example.com/api/mpesa/status-result');
    vi.stubEnv('MPESA_STATUS_TIMEOUT_URL', 'https://example.com/api/mpesa/status-timeout');
    vi.stubEnv('PAYMENT_ADAPTER_PROXY_SECRET', 'test-proxy-secret');
    vi.stubEnv('SUPABASE_URL', 'https://supabase.example');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
    vi.stubGlobal('window', undefined);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
      if (url.includes('/rest/v1/payment_orders?provider_reference=eq.ws_live123')) {
        return Response.json([{ order_id: 'ord_123', status: 'PROVIDER_CONFIRMED' }]);
      }
      if (url.includes('/rest/v1/payment_orders?order_id=eq.ord_123') && init?.method === 'PATCH') {
        return new Response(null, { status: 204 });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await transactionStatusHandler(new Request('https://example.com/api/mpesa/transaction-status', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer test-proxy-secret',
      },
      body: JSON.stringify({ transactionId: 'ws_live123' }),
    }));

    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, unknown>;
    expect(body).toMatchObject({
      mode: 'live',
      transactionId: 'ws_live123',
      queryAccepted: true,
      awaitingResult: true,
    });
    expect(body).not.toHaveProperty('verified');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/mpesa/transactionstatus/v1/query'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejects unauthenticated requests with 401', async () => {
    vi.stubEnv('PAYMENT_ADAPTER_PROXY_SECRET', 'test-proxy-secret');
    const response = await transactionStatusHandler(new Request('https://example.com/api/mpesa/transaction-status', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transactionId: 'ws_live123' }),
    }));
    expect(response.status).toBe(401);
  });
});

describe('mpesa simulate route', () => {
  it('never persists confirmed_at for PAYMENT_PENDING simulator orders', async () => {
    vi.stubEnv('MPESA_SIMULATOR_ENABLED', 'true');
    vi.stubEnv('MPESA_SIMULATOR_SECRET', 'sim-secret');
    vi.stubEnv('SUPABASE_URL', 'https://supabase.example');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(payload.status).toBe('PAYMENT_PENDING');
        expect(payload).not.toHaveProperty('confirmed_at');
        return Response.json([{ order_id: 'ord_sim_1' }], { status: 201 });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await simulateHandler(new Request('https://example.com/api/mpesa/simulate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer sim-secret',
      },
      body: JSON.stringify({
        phone: '+254700000000',
        communityId: 'community-test',
        amount: 100,
      }),
    }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('mpesa status-result callback route', () => {
  beforeEach(() => {
    vi.stubEnv('MPESA_STATUS_RESULT_PATH_SECRET', 'result-secret');
    vi.stubEnv('MPESA_STATUS_CALLBACK_IP_ALLOWLIST', '198.51.100.10,203.0.113.0/24');
    vi.stubEnv('SUPABASE_URL', 'https://supabase.example');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  });

  it('rejects invalid authentication before parsing body', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await statusResultHandler(new Request('https://example.com/api/mpesa/status-result/result-secret', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.1' },
      body: '{',
    }));

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('moves STATUS_QUERY_SENT to ATTESTATION_SUBMITTED on ResultCode 0', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/rest/v1/payment_orders?provider_reference=eq.ws_live123')) {
        return Response.json([{ order_id: 'ord_123', status: 'STATUS_QUERY_SENT' }]);
      }
      if (url.includes('/rest/v1/payment_orders?order_id=eq.ord_123') && init?.method === 'PATCH') {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(payload.status).toBe('ATTESTATION_SUBMITTED');
        return new Response(null, { status: 204 });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await statusResultHandler(new Request('https://example.com/api/mpesa/status-result/result-secret', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.8' },
      body: JSON.stringify({
        Result: {
          ResultCode: 0,
          ResultDesc: 'Success',
          TransactionID: 'ws_live123',
        },
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      changed: true,
      status: 'ATTESTATION_SUBMITTED',
    });
  });

  it('keeps the flow retriable and does not submit attestation on non-zero ResultCode', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/rest/v1/payment_orders?provider_reference=eq.ws_live123')) {
        return Response.json([{ order_id: 'ord_123', status: 'STATUS_QUERY_SENT' }]);
      }
      if (url.includes('/rest/v1/payment_orders?order_id=eq.ord_123') && init?.method === 'PATCH') {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(payload.status).toBe('PROVIDER_CONFIRMED');
        return new Response(null, { status: 204 });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await statusResultHandler(new Request('https://example.com/api/mpesa/status-result/result-secret', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.12' },
      body: JSON.stringify({
        Result: {
          ResultCode: 1,
          ResultDesc: 'No matching transaction',
          TransactionID: 'ws_live123',
        },
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      changed: true,
      retriable: true,
      status: 'PROVIDER_CONFIRMED',
    });
  });

  it('is idempotent when the result callback is redelivered', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/rest/v1/payment_orders?provider_reference=eq.ws_live123')) {
        return Response.json([{ order_id: 'ord_123', status: 'ATTESTATION_SUBMITTED' }]);
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await statusResultHandler(new Request('https://example.com/api/mpesa/status-result/result-secret', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.14' },
      body: JSON.stringify({
        Result: {
          ResultCode: 0,
          TransactionID: 'ws_live123',
        },
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      changed: false,
      idempotent: true,
      status: 'ATTESTATION_SUBMITTED',
    });
  });
});

describe('mpesa status-timeout callback route', () => {
  beforeEach(() => {
    vi.stubEnv('MPESA_STATUS_TIMEOUT_PATH_SECRET', 'timeout-secret');
    vi.stubEnv('MPESA_STATUS_CALLBACK_IP_ALLOWLIST', '198.51.100.10,203.0.113.0/24');
    vi.stubEnv('SUPABASE_URL', 'https://supabase.example');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key');
  });

  it('moves STATUS_QUERY_SENT back to PROVIDER_CONFIRMED for retry', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/rest/v1/payment_orders?provider_reference=eq.ws_live123')) {
        return Response.json([{ order_id: 'ord_123', status: 'STATUS_QUERY_SENT' }]);
      }
      if (url.includes('/rest/v1/payment_orders?order_id=eq.ord_123') && init?.method === 'PATCH') {
        const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
        expect(payload.status).toBe('PROVIDER_CONFIRMED');
        return new Response(null, { status: 204 });
      }
      return new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await statusTimeoutHandler(new Request('https://example.com/api/mpesa/status-timeout/timeout-secret', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.30' },
      body: JSON.stringify({
        Result: {
          TransactionID: 'ws_live123',
        },
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      changed: true,
      retriable: true,
      status: 'PROVIDER_CONFIRMED',
    });
  });
});
