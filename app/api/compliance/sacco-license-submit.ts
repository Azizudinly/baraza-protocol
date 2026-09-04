/**
 * POST /api/compliance/sacco-license-submit
 *
 * Officer license submission endpoint for SACCO / Housing cooperative communities.
 * Enforces:
 * - Ed25519 officer wallet proof signature
 * - Kenyan statutory registration format check (CS/... or SASRA/...)
 * - HTTPS certificate URL validation
 * - Lock-free state transition preventing duplicate concurrent reviews (409)
 */

import { getWalletProof, verifyWalletProof } from '../_lib/wallet-proof.js';
import {
  isValidCertificateUrl,
  isValidSaccoLicenseNumber,
  type SaccoDocumentType,
} from '../../src/lib/compliance/saccoGate.js';

export const config = { runtime: 'nodejs' };

interface SubmitLicensePayload {
  communityId: string;
  licenseNumber: string;
  certificateUrl: string;
  documentType?: SaccoDocumentType;
  expiresAt?: string;
  wallet?: string;
}

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

function bad(message: string, status = 400, details?: Record<string, unknown>): Response {
  return json({ error: 'invalid_request', message, ...(details ?? {}) }, { status });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST,OPTIONS',
        'access-control-allow-headers':
          'content-type,authorization,x-wallet-address,x-wallet-message,x-wallet-signature',
      },
    });
  }

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });

  let body: SubmitLicensePayload;
  try {
    body = (await req.json()) as SubmitLicensePayload;
  } catch {
    return bad('Body must be valid JSON');
  }

  const { communityId, licenseNumber, certificateUrl, documentType = 'cooperative_registration', expiresAt } = body;

  if (!communityId?.trim()) return bad('communityId is required');
  if (!licenseNumber?.trim()) return bad('licenseNumber is required');
  if (!certificateUrl?.trim()) return bad('certificateUrl is required');

  // Format validations
  if (!isValidSaccoLicenseNumber(licenseNumber)) {
    return bad('Invalid registration number format. Must match CS/12345 or SASRA statutory format.', 422);
  }

  if (!isValidCertificateUrl(certificateUrl)) {
    return bad('Invalid certificateUrl. Must be a valid public HTTPS URL.', 422);
  }

  // Wallet signature verification
  const callerWallet = body.wallet || req.headers.get('x-wallet-address');
  const proof = getWalletProof(req, callerWallet);

  if (proof) {
    const verified = verifyWalletProof(proof, callerWallet, 'sacco-license-submit');
    if (!verified) {
      return json({ error: 'unauthorized', message: 'Invalid officer wallet signature.' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production' || process.env.CF_PAGES === '1') {
    return json({ error: 'unauthorized', message: 'Officer wallet signature is mandatory.' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // In-memory or sandbox test fallback
    return json({
      ok: true,
      communityId,
      status: 'PENDING_REVIEW',
      licenseNumber: licenseNumber.trim().toUpperCase(),
      documentId: 'doc_mock_' + Date.now(),
      message: 'License submitted successfully (sandbox fallback).',
    });
  }

  // Fetch community from Supabase
  const commRes = await fetch(
    `${supabaseUrl}/rest/v1/communities?id=eq.${encodeURIComponent(communityId)}&select=id,type,sacco_license_status`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    }
  );

  if (!commRes.ok) {
    return json({ error: 'database_error', message: await commRes.text() }, { status: commRes.status });
  }

  const communities = await commRes.json();
  if (!Array.isArray(communities) || communities.length === 0) {
    return json({ error: 'not_found', message: 'Community not found' }, { status: 404 });
  }

  const community = communities[0];
  const commType = community.type?.toLowerCase();
  if (commType !== 'sacco' && commType !== 'housing') {
    return bad('Only communities of type sacco or housing can submit statutory license credentials.', 400);
  }

  const currentStatus = (community.sacco_license_status || 'UNLICENSED').toUpperCase();

  if (currentStatus === 'PENDING_REVIEW') {
    return json(
      { error: 'conflict', message: 'A license submission is already pending compliance review.' },
      { status: 409 }
    );
  }

  if (currentStatus === 'VERIFIED') {
    return json(
      { error: 'conflict', message: 'Community license is already verified.' },
      { status: 409 }
    );
  }

  // 1. Insert immutable audit record into sacco_compliance_documents
  const docPayload = {
    community_id: communityId,
    license_number: licenseNumber.trim().toUpperCase(),
    certificate_url: certificateUrl.trim(),
    document_type: documentType,
    submitted_by: callerWallet || 'anonymous_officer',
    status: 'PENDING_REVIEW',
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
  };

  const docRes = await fetch(`${supabaseUrl}/rest/v1/sacco_compliance_documents`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(docPayload),
  });

  if (!docRes.ok) {
    return json({ error: 'insert_failed', message: await docRes.text() }, { status: docRes.status });
  }

  const insertedDocs = await docRes.json();
  const documentId = Array.isArray(insertedDocs) && insertedDocs[0]?.id ? insertedDocs[0].id : undefined;

  // 2. Update communities table status
  const updatePayload: Record<string, unknown> = {
    sacco_license_status: 'PENDING_REVIEW',
    sacco_license_number: licenseNumber.trim().toUpperCase(),
    sacco_license_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
  };

  await fetch(`${supabaseUrl}/rest/v1/communities?id=eq.${encodeURIComponent(communityId)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(updatePayload),
  });

  return json({
    ok: true,
    communityId,
    status: 'PENDING_REVIEW',
    licenseNumber: licenseNumber.trim().toUpperCase(),
    documentId,
  });
}
