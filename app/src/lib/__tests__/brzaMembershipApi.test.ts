import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../../api/payments/brza-membership';

const VALID_TREASURY = 'GBEQEOORBLDGA36MBIYBS2XI7YLT23BDJRBDNWP5RGDB6BFFRHWEBAHD';
const BODY = {
  phone: '+254712345678',
  communityId: 'community-test',
  communityCode: 'TEST',
  communityTreasuryAddress: VALID_TREASURY,
  amountKes: 1000,
  idempotencyKey: 'join-community-test-member-test',
};
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function request(body = BODY, secret = 'proxy-secret'): Request {
  return new Request('https://baraza.example/api/payments/brza-membership', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.PAYMENT_ADAPTER_PROXY_SECRET = 'proxy-secret';
  process.env.PAYMENT_PHONE_HASH_PEPPER = 'phone-hash-pepper';
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  process.env.KOTANI_PAY_API_KEY = 'kotani-key';
  process.env.KOTANI_API_BASE = 'https://kotani.example';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.PAYMENT_ADAPTER_PROXY_SECRET;
  delete process.env.PAYMENT_PHONE_HASH_PEPPER;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.KOTANI_PAY_API_KEY;
  delete process.env.KOTANI_API_BASE;
  delete process.env.VERCEL_ENV;
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe('BRZA membership payment API', () => {
  it('rejects browser-style requests without trusted server authorization', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(request(BODY, 'wrong-secret'));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('persists an order before requesting a Kotani on-ramp', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([{}], { status: 201 }))
      .mockResolvedValueOnce(Response.json({ reference: 'kotani-ref', status: 'pending' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(request());
    const result = await response.json();

    expect(response.status).toBe(201);
    expect(result).toMatchObject({
      providerReference: 'kotani-ref',
      status: 'PAYMENT_PENDING',
      persisted: true,
    });
    expect(result.activationSecret).toMatch(/^[a-f0-9]{48}$/);

    const createOrder = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(createOrder).toMatchObject({
      community_id: BODY.communityId,
      provider: 'kotani',
      amount_expected: BODY.amountKes,
      currency: 'KES',
      status: 'CREATED',
      idempotency_key: BODY.idempotencyKey,
    });
    expect(createOrder.phone_hash).not.toContain(BODY.phone);
    expect(createOrder.activation_secret_hash).not.toBe(result.activationSecret);

    const providerCall = JSON.parse(fetchMock.mock.calls[2][1].body as string);
    expect(providerCall).toMatchObject({
      phone: BODY.phone,
      destination: BODY.communityTreasuryAddress,
      memo: 'BRZA TEST',
    });
  });

  it('marks production orders as production orders', async () => {
    process.env.NODE_ENV = 'production';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([{}], { status: 201 }))
      .mockResolvedValueOnce(Response.json({ reference: 'kotani-ref', status: 'pending' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(request());

    expect(response.status).toBe(201);
    const createOrder = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(createOrder.provider_environment).toBe('production');
  });

  it('returns the existing order without charging Kotani twice', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json([{ order_id: 'ord_brza_existing' }]));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(request());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ orderId: 'ord_brza_existing' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requires reconciliation before confirming an immediately completed provider response', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([{}], { status: 201 }))
      .mockResolvedValueOnce(Response.json({ reference: 'kotani-ref', status: 'completed', kes_amount: BODY.amountKes }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(request());

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ status: 'PAYMENT_PENDING' });
    const pendingPatch = JSON.parse(fetchMock.mock.calls[3][1].body as string);
    expect(pendingPatch).toEqual({
      provider_reference: 'kotani-ref',
      status: 'PAYMENT_PENDING',
    });
  });

  it('records a failed order when Kotani cannot be reached', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([{}], { status: 201 }))
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(request());

    expect(response.status).toBe(502);
    const failedPatch = JSON.parse(fetchMock.mock.calls[3][1].body as string);
    expect(failedPatch).toEqual({ status: 'PAYMENT_FAILED' });
  });
});
