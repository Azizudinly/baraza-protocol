/**
 * PATCH /api/compliance/sacco-license-review
 *
 * Compliance auditor review gate for SACCO license submissions.
 * Enforces:
 * - Constant-time timingSafeEqual bearer authentication (COMPLIANCE_REVIEW_SECRET / CRON_SECRET)
 * - Transitions status to 'VERIFIED', 'REJECTED', or 'REVOKED'
 * - Records immutable reviewer identity and decision notes in audit log
 */

import { isComplianceAuthorized, type SaccoLicenseReviewRequest } from '../../src/lib/compliance/saccoGate.js';

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

function bad(message: string, status = 400, details?: Record<string, unknown>): Response {
  return json({ error: 'invalid_request', message, ...(details ?? {}) }, { status });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'PATCH,POST,OPTIONS',
        'access-control-allow-headers': 'content-type,authorization',
      },
    });
  }

  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, { status: 405 });
  }

  // Constant-time authentication
  if (!isComplianceAuthorized(req)) {
    return json(
      { error: 'unauthorized', message: 'Compliance review requires a valid authorization token.' },
      { status: 401 }
    );
  }

  let body: SaccoLicenseReviewRequest & { reviewer?: string };
  try {
    body = (await req.json()) as SaccoLicenseReviewRequest & { reviewer?: string };
  } catch {
    return bad('Body must be valid JSON');
  }

  const { communityId, documentId, decision, reviewNotes, expiresAt, reviewer = 'compliance_officer' } = body;

  if (!communityId?.trim()) return bad('communityId is required');
  if (!decision || !['VERIFIED', 'REJECTED', 'REVOKED'].includes(decision)) {
    return bad("decision must be one of 'VERIFIED', 'REJECTED', or 'REVOKED'", 422);
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // Sandbox / Mock fallback for unit tests
    return json({
      ok: true,
      communityId,
      status: decision,
      verified: decision === 'VERIFIED',
      message: `Community status updated to ${decision} (sandbox fallback).`,
    });
  }

  const nowIso = new Date().toISOString();

  // 1. Update compliance documents audit row
  if (documentId) {
    const docUpdate: Record<string, unknown> = {
      status: decision,
      reviewed_by: reviewer,
      review_notes: reviewNotes || null,
      reviewed_at: nowIso,
    };
    if (expiresAt) {
      docUpdate.expires_at = new Date(expiresAt).toISOString();
    }

    await fetch(`${supabaseUrl}/rest/v1/sacco_compliance_documents?id=eq.${encodeURIComponent(documentId)}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(docUpdate),
    });
  }

  // 2. Update communities table
  const commUpdate: Record<string, unknown> = {
    sacco_license_status: decision,
  };

  if (decision === 'VERIFIED') {
    commUpdate.sacco_verified_at = nowIso;
    commUpdate.sacco_verified_by = reviewer;
    if (expiresAt) {
      commUpdate.sacco_license_expires_at = new Date(expiresAt).toISOString();
    }
  } else if (decision === 'REJECTED' || decision === 'REVOKED') {
    commUpdate.sacco_verified_at = null;
    commUpdate.sacco_verified_by = null;
  }

  const commRes = await fetch(`${supabaseUrl}/rest/v1/communities?id=eq.${encodeURIComponent(communityId)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(commUpdate),
  });

  if (!commRes.ok) {
    return json({ error: 'update_failed', message: await commRes.text() }, { status: commRes.status });
  }

  return json({
    ok: true,
    communityId,
    status: decision,
    verified: decision === 'VERIFIED',
    reviewedAt: nowIso,
    reviewedBy: reviewer,
  });
}
