import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const verifyAccessToken = vi.fn();

vi.mock('@privy-io/node', () => ({
  PrivyClient: class {
    utils() {
      return { auth: () => ({ verifyAccessToken }) };
    }
  },
}));

import handler from '../../../api/bounties/claims';

const BOUNTY_ID = '123e4567-e89b-42d3-a456-426614174000';

function request(body: Record<string, unknown>, token = 'valid-access-token'): Request {
  return new Request('https://baraza.example/api/bounties/claims', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.PRIVY_APP_ID = 'privy-app-id';
  process.env.PRIVY_APP_SECRET = 'privy-app-secret';
  process.env.SUPABASE_URL = 'https://supabase.example';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  verifyAccessToken.mockResolvedValue({ user_id: 'did:privy:verified-user' });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete process.env.PRIVY_APP_ID;
  delete process.env.PRIVY_APP_SECRET;
  delete process.env.PRIVY_JWT_VERIFICATION_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe('bounty claim API', () => {
  it('returns only sanitized open claim states', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json([
      { bounty_id: BOUNTY_ID, status: 'pending', claimant_privy_id: 'did:privy:hidden' },
    ]));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(new Request('https://baraza.example/api/bounties/claims'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      claims: [{ bountyId: BOUNTY_ID, status: 'pending' }],
    });
  });

  it('writes the verified Privy user ID instead of a client-supplied ID', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json([{ bounty_id: BOUNTY_ID, status: 'open' }]))
      .mockResolvedValueOnce(Response.json([{ id: 'claim-1', status: 'pending' }], { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(request({
      bountyId: BOUNTY_ID,
      claimantDisplayName: 'Amina',
      claimantPrivyId: 'did:privy:attacker-choice',
    }));

    expect(response.status).toBe(201);
    const insert = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(insert).toMatchObject({
      bounty_id: BOUNTY_ID,
      claimant_privy_id: 'did:privy:verified-user',
      claimant_display_name: 'Amina',
      status: 'pending',
    });
    expect(insert.claimant_privy_id).not.toBe('did:privy:attacker-choice');
  });

  it('rejects an invalid access token before calling Supabase', async () => {
    verifyAccessToken.mockRejectedValueOnce(new Error('invalid auth token'));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(request({ bountyId: BOUNTY_ID, claimantDisplayName: 'Amina' }, 'invalid'));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a conflict when another open claim wins the insert race', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json([{ bounty_id: BOUNTY_ID, status: 'open' }]))
      .mockResolvedValueOnce(Response.json({ code: '23505' }, { status: 409 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler(request({ bountyId: BOUNTY_ID, claimantDisplayName: 'Amina' }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'This bounty already has a claim under review.',
    });
  });
});
