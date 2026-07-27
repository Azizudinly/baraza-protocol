import { PrivyClient } from '@privy-io/node';

export const config = { runtime: 'nodejs' };

interface CreateClaimRequest {
  bountyId: string;
  claimantDisplayName: string;
}

interface SupabaseError {
  code?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_DISPLAY_NAME_LENGTH = 120;

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
}

function error(message: string, status: number): Response {
  return json({ error: message }, { status });
}

function bearerToken(req: Request): string | null {
  const match = req.headers.get('authorization')?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

function getPrivyClient(): PrivyClient | null {
  const appId = process.env.PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;

  return new PrivyClient({
    appId,
    appSecret,
    jwtVerificationKey: process.env.PRIVY_JWT_VERIFICATION_KEY?.trim() || undefined,
  });
}

function supabaseHeaders(serviceKey: string, prefer?: string): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function parseSupabaseError(response: Response): Promise<SupabaseError> {
  try {
    return await response.json() as SupabaseError;
  } catch {
    return {};
  }
}

export default async function handler(req: Request): Promise<Response> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) return error('Claim storage is not configured.', 503);

  if (req.method === 'GET') {
    const claimsResponse = await fetch(
      `${supabaseUrl}/rest/v1/claims?select=bounty_id,status&status=in.(pending,approved)`,
      { headers: supabaseHeaders(serviceKey) },
    );
    if (!claimsResponse.ok) return error('Could not load claim status.', 502);

    const claims = await claimsResponse.json() as Array<{ bounty_id: string; status: 'pending' | 'approved' }>;
    return json({
      claims: claims.map((claim) => ({
        bountyId: claim.bounty_id,
        status: claim.status,
      })),
    });
  }

  if (req.method !== 'POST') return error('Method not allowed.', 405);

  const token = bearerToken(req);
  if (!token) return error('A Privy access token is required.', 401);

  const privy = getPrivyClient();
  if (!privy) return error('Claim authentication is not configured.', 503);

  let claimantPrivyId: string;
  try {
    const verified = await privy.utils().auth().verifyAccessToken(token);
    claimantPrivyId = verified.user_id;
  } catch {
    return error('The Privy access token is invalid or expired.', 401);
  }

  let body: CreateClaimRequest;
  try {
    body = await req.json() as CreateClaimRequest;
  } catch {
    return error('A valid JSON body is required.', 400);
  }

  const bountyId = typeof body.bountyId === 'string' ? body.bountyId.trim() : '';
  const claimantDisplayName = typeof body.claimantDisplayName === 'string'
    ? body.claimantDisplayName.trim()
    : '';

  if (!UUID_PATTERN.test(bountyId)) return error('A valid bounty ID is required.', 400);
  if (!claimantDisplayName) return error('A display name is required.', 400);
  if (claimantDisplayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return error(`Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or fewer.`, 400);
  }

  const bountyResponse = await fetch(
    `${supabaseUrl}/rest/v1/bounties?bounty_id=eq.${encodeURIComponent(bountyId)}&select=bounty_id,status&limit=1`,
    { headers: supabaseHeaders(serviceKey) },
  );

  if (!bountyResponse.ok) return error('Could not verify the bounty.', 502);

  const bounties = await bountyResponse.json() as Array<{ bounty_id: string; status: string }>;
  const bounty = bounties[0];
  if (!bounty) return error('Bounty not found.', 404);
  if (bounty.status !== 'open') return error('This bounty is not open for claims.', 409);

  const claimResponse = await fetch(`${supabaseUrl}/rest/v1/claims`, {
    method: 'POST',
    headers: supabaseHeaders(serviceKey, 'return=representation'),
    body: JSON.stringify({
      bounty_id: bountyId,
      claimant_privy_id: claimantPrivyId,
      claimant_display_name: claimantDisplayName,
      status: 'pending',
    }),
  });

  if (!claimResponse.ok) {
    const detail = await parseSupabaseError(claimResponse);
    if (claimResponse.status === 409 || detail.code === '23505') {
      return error('This bounty already has a claim under review.', 409);
    }
    return error('Could not submit the claim.', 502);
  }

  const claims = await claimResponse.json() as Array<Record<string, unknown>>;
  return json({ claim: claims[0] }, { status: 201 });
}
