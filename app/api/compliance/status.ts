/**
 * GET /api/compliance/status
 *
 * Public & officer compliance status inspection endpoint.
 * Returns:
 * - Current SACCO license status ('UNLICENSED', 'PENDING_REVIEW', 'VERIFIED', etc.)
 * - License registration number and expiration date
 * - Document audit history (for officers and compliance auditors)
 */

import { isComplianceAuthorized } from '../../src/lib/compliance/saccoGate.js';

export const config = { runtime: 'nodejs' };

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      ...(init?.headers ?? {}),
    },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,OPTIONS',
        'access-control-allow-headers': 'content-type,authorization,x-wallet-address',
      },
    });
  }

  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, { status: 405 });

  const url = new URL(req.url);
  const communityId = url.searchParams.get('communityId');

  if (!communityId?.trim()) {
    return json({ error: 'invalid_request', message: 'communityId parameter is required' }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return json({
      ok: true,
      communityId,
      status: 'UNLICENSED',
      licenseNumber: null,
      verifiedAt: null,
      expiresAt: null,
      documents: [],
    });
  }

  // 1. Fetch community
  const commRes = await fetch(
    `${supabaseUrl}/rest/v1/communities?id=eq.${encodeURIComponent(communityId)}&select=id,name,type,sacco_license_status,sacco_license_number,sacco_license_expires_at,sacco_verified_at`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  );

  if (!commRes.ok) {
    return json({ error: 'fetch_failed', message: await commRes.text() }, { status: commRes.status });
  }

  const communities = await commRes.json();
  if (!Array.isArray(communities) || communities.length === 0) {
    return json({ error: 'not_found', message: 'Community not found' }, { status: 404 });
  }

  const community = communities[0];
  const isAuditor = isComplianceAuthorized(req);

  // 2. Fetch documents audit history if auditor or officer
  let documents: unknown[] = [];
  if (isAuditor) {
    const docRes = await fetch(
      `${supabaseUrl}/rest/v1/sacco_compliance_documents?community_id=eq.${encodeURIComponent(communityId)}&order=created_at.desc`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );
    if (docRes.ok) {
      documents = await docRes.json();
    }
  }

  return json({
    ok: true,
    communityId: community.id,
    communityName: community.name,
    communityType: community.type,
    status: community.sacco_license_status || 'UNLICENSED',
    licenseNumber: community.sacco_license_number || null,
    verifiedAt: community.sacco_verified_at || null,
    expiresAt: community.sacco_license_expires_at || null,
    documents,
  });
}
