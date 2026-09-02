/**
 * SACCO Regulatory Compliance Domain Gate & Validator (Class G Controls)
 *
 * Implements statutory verification for SACCO communities per:
 * - Kenya Sacco Societies Act (Cap 490B)
 * - Sacco Societies (Non-Deposit-Taking Business) Regulations 2020
 * - Baraza Protocol SAD §3.6 & Launch Memo 3 §6
 */

import { timingSafeEqual } from 'node:crypto';

export type SaccoLicenseStatus =
  | 'UNLICENSED'
  | 'PENDING_REVIEW'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REVOKED';

export type SaccoDocumentType =
  | 'cooperative_registration'
  | 'sasra_license'
  | 'bylaws'
  | 'audit_accounts';

export type ComplianceAlertType =
  | 'SASRA_THRESHOLD_100M'
  | 'LICENSE_EXPIRED'
  | 'SYBIL_AFFILIATION_THRESHOLD';

export interface SaccoLicenseSubmissionRequest {
  communityId: string;
  licenseNumber: string;
  certificateUrl: string;
  documentType?: SaccoDocumentType;
  expiresAt?: string; // ISO 8601
  walletProof?: {
    address: string;
    signature: string;
    message: string;
  };
}

export interface SaccoLicenseReviewRequest {
  communityId: string;
  documentId: string;
  decision: 'VERIFIED' | 'REJECTED' | 'REVOKED';
  reviewNotes?: string;
  expiresAt?: string;
}

/**
 * Statutory Non-Deposit Taking SACCO threshold under SASRA 2020 regulations.
 * KES 100,000,000 in integer minor units (cents): 10,000,000,000n
 */
export const SASRA_STATUTORY_DEPOSIT_CEILING_MINOR = 10_000_000_000n;

/**
 * Validates Kenyan statutory registration number formats:
 * 1. State Department for Cooperatives: CS/12345 (up to 7 digits)
 * 2. SASRA Deposit-Taking (DT): SASRA/DT/102/2021
 * 3. SASRA Non-Withdrawable Deposit-Taking (NWDT): SASRA/NWDT/450/2022
 */
export function isValidSaccoLicenseNumber(num: string | null | undefined): boolean {
  if (!num || typeof num !== 'string') return false;
  const clean = num.trim().toUpperCase();
  const coopRegex = /^CS\/[0-9]{1,7}$/;
  const sasraDtRegex = /^SASRA\/DT\/[0-9]{2,5}\/[0-9]{2,4}$/;
  const sasraNwdtRegex = /^SASRA\/NWDT\/[0-9]{2,5}\/[0-9]{2,4}$/;
  return coopRegex.test(clean) || sasraDtRegex.test(clean) || sasraNwdtRegex.test(clean);
}

/**
 * Validates document certificate URL:
 * - Must be valid HTTPS URI
 * - Hostname cannot be localhost or private loopback
 */
export function isValidCertificateUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Constant-time authentication verification for compliance auditor reviews.
 * Uses timingSafeEqual to eliminate side-channel timing leaks.
 */
export function isComplianceAuthorized(req: Request): boolean {
  const secret = process.env.COMPLIANCE_REVIEW_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;

  const headerBuf = Buffer.from(authHeader, 'utf8');
  const expectedBuf = Buffer.from(expected, 'utf8');

  if (headerBuf.length !== expectedBuf.length) {
    return false;
  }

  return timingSafeEqual(headerBuf, expectedBuf);
}

export interface MinimalCommunityComplianceRecord {
  id: string;
  type?: string | null;
  sacco_license_status?: string | null;
  sacco_license_expires_at?: string | null;
}

/**
 * Fail-closed runtime feature gate for SACCO-regulated operations.
 * Non-SACCO communities bypass this check.
 * SACCO communities must have status 'VERIFIED' and non-expired credentials.
 */
export function evaluateSaccoGate(
  community: MinimalCommunityComplianceRecord | null | undefined
): { allowed: boolean; status: SaccoLicenseStatus; error?: string } {
  if (!community) {
    return { allowed: false, status: 'UNLICENSED', error: 'COMMUNITY_NOT_FOUND' };
  }

  // Non-SACCO communities bypass the regulatory check
  const commType = community.type?.toLowerCase();
  if (commType !== 'sacco' && commType !== 'housing') {
    return { allowed: true, status: 'UNLICENSED' };
  }

  const rawStatus = community.sacco_license_status?.toUpperCase() || 'UNLICENSED';
  const status = (
    ['UNLICENSED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED', 'REVOKED'].includes(rawStatus)
      ? rawStatus
      : 'UNLICENSED'
  ) as SaccoLicenseStatus;

  // Invariant I-REG-5: Atomic runtime expiration check
  if (status === 'VERIFIED' && community.sacco_license_expires_at) {
    const expiresAt = new Date(community.sacco_license_expires_at).getTime();
    if (!isNaN(expiresAt) && Date.now() >= expiresAt) {
      return {
        allowed: false,
        status: 'EXPIRED',
        error: 'SACCO_LICENSE_EXPIRED',
      };
    }
  }

  // Invariant I-REG-1: Fail-closed assertion
  if (status !== 'VERIFIED') {
    return {
      allowed: false,
      status,
      error: 'SACCO_LICENSE_REQUIRED',
    };
  }

  return { allowed: true, status: 'VERIFIED' };
}
