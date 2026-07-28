import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as handler } from '../../../api/cron/promote-orders';

function request(secret = 'cron-secret'): Request {
  return new Request('https://baraza.example/api/cron/promote-orders', {
    headers: { Authorization: `Bearer ${secret}` },
  });
}

beforeEach(() => {
  process.env.CRON_SECRET = 'cron-secret';
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CRON_SECRET;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.VERCEL_ENV;
});

describe('payment order demo promoter API', () => {
  it('rejects requests without the configured cron secret', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(request('wrong-secret'));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('promotes production orders when VERCEL_ENV=production', async () => {
    process.env.VERCEL_ENV = 'production';
    const fetchMock = vi.fn().mockResolvedValue(Response.json([]));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(request());

    expect(response.status).toBe(200);
    // 4 PROMOTIONS entries + 1 invisible-member sweep (Seku monitoring).
    // The MINT_QUEUED → MINT_SUBMITTED step is no longer a status walk —
    // it's handled by the real Stellar mint, which short-circuits without
    // BRZA_DISTRIBUTOR_SECRET set in this test.
    expect(fetchMock).toHaveBeenCalledTimes(5);
    for (const [url] of fetchMock.mock.calls) {
      expect(url).toContain('provider_environment=eq.production');
      expect(url).not.toContain('provider_environment=eq.sandbox');
    }
  });

  it('promotes only sandbox orders in non-production environments', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json([]));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(request());

    expect(response.status).toBe(200);
    // 4 PROMOTIONS entries + 1 invisible-member sweep (Seku monitoring).
    // The MINT_QUEUED → MINT_SUBMITTED step is no longer a status walk —
    // it's handled by the real Stellar mint, which short-circuits without
    // BRZA_DISTRIBUTOR_SECRET set in this test.
    expect(fetchMock).toHaveBeenCalledTimes(5);
    for (const [url] of fetchMock.mock.calls) {
      expect(url).toContain('provider_environment=eq.sandbox');
      expect(url).not.toContain('provider_environment=eq.production');
    }
  });
});
