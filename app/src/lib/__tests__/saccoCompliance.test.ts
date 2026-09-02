/**
 * Automated Verification Suite: Phase P4 SASRA SACCO Regulatory Compliance & Behavioral Deposit Monitoring
 *
 * Covers all 15 scenarios from the Phase P4 Theoretical Specification:
 * - Fail-closed gate evaluation (ZUE Theorem)
 * - Expiration monotonicity & atomic runtime expiry checks
 * - Kenyan statutory registration number & HTTPS URL regex heuristics
 * - Constant-time timing-safe compliance authorization
 * - API route behavior for submit, review, status, and monitor cron
 * - Non-SACCO bypass and non-SACCO submission rejection
 * - KES 100M deposit threshold constant integrity
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  evaluateSaccoGate,
  isValidCertificateUrl,
  isValidSaccoLicenseNumber,
  isComplianceAuthorized,
  SASRA_STATUTORY_DEPOSIT_CEILING_MINOR,
  type MinimalCommunityComplianceRecord,
} from '../compliance/saccoGate.js';

import handleSubmit from '../../../api/compliance/sacco-license-submit.js';
import handleReview from '../../../api/compliance/sacco-license-review.js';
import handleStatus from '../../../api/compliance/status.js';
import handleMonitorCron from '../../../api/cron/monitor-compliance.js';

describe('Phase P4: SASRA SACCO Regulatory Compliance & Behavioral Monitoring', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // =========================================================================
  // 1. Domain Feature Gate (Invariant I-REG-1 / ZUE Theorem)
  // =========================================================================
  describe('1. Fail-Closed Feature Gate (evaluateSaccoGate)', () => {
    it('1. Default SACCO community without license fails closed (UNLICENSED)', () => {
      const comm: MinimalCommunityComplianceRecord = {
        id: 'comm-sacco-01',
        type: 'sacco',
        sacco_license_status: 'UNLICENSED',
      };
      const result = evaluateSaccoGate(comm);
      expect(result.allowed).toBe(false);
      expect(result.status).toBe('UNLICENSED');
      expect(result.error).toBe('SACCO_LICENSE_REQUIRED');
    });

    it('2. Housing cooperative without license fails closed', () => {
      const comm: MinimalCommunityComplianceRecord = {
        id: 'comm-housing-01',
        type: 'housing',
        sacco_license_status: 'PENDING_REVIEW',
      };
      const result = evaluateSaccoGate(comm);
      expect(result.allowed).toBe(false);
      expect(result.status).toBe('PENDING_REVIEW');
      expect(result.error).toBe('SACCO_LICENSE_REQUIRED');
    });

    it('3. Rejection / Revocation / Missing status fails closed', () => {
      expect(evaluateSaccoGate({ id: 'c1', type: 'sacco', sacco_license_status: 'REJECTED' }).allowed).toBe(false);
      expect(evaluateSaccoGate({ id: 'c2', type: 'sacco', sacco_license_status: 'REVOKED' }).allowed).toBe(false);
      expect(evaluateSaccoGate({ id: 'c3', type: 'sacco', sacco_license_status: null }).allowed).toBe(false);
      expect(evaluateSaccoGate(null).allowed).toBe(false);
    });

    it('4. Non-SACCO community (chama, investment, dao) bypasses regulatory gate', () => {
      const chama: MinimalCommunityComplianceRecord = { id: 'c-chama', type: 'chama', sacco_license_status: 'UNLICENSED' };
      const dao: MinimalCommunityComplianceRecord = { id: 'c-dao', type: 'dao', sacco_license_status: 'UNLICENSED' };
      const investment: MinimalCommunityComplianceRecord = { id: 'c-inv', type: 'investment', sacco_license_status: 'UNLICENSED' };

      expect(evaluateSaccoGate(chama).allowed).toBe(true);
      expect(evaluateSaccoGate(dao).allowed).toBe(true);
      expect(evaluateSaccoGate(investment).allowed).toBe(true);
    });

    it('5. Verified SACCO community with active future expiry passes gate', () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      const comm: MinimalCommunityComplianceRecord = {
        id: 'comm-verified',
        type: 'sacco',
        sacco_license_status: 'VERIFIED',
        sacco_license_expires_at: futureDate,
      };
      const result = evaluateSaccoGate(comm);
      expect(result.allowed).toBe(true);
      expect(result.status).toBe('VERIFIED');
      expect(result.error).toBeUndefined();
    });

    it('6. Atomic runtime expiry: Verified SACCO with past expiry evaluates as EXPIRED and fails closed', () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const comm: MinimalCommunityComplianceRecord = {
        id: 'comm-expired',
        type: 'sacco',
        sacco_license_status: 'VERIFIED',
        sacco_license_expires_at: pastDate,
      };
      const result = evaluateSaccoGate(comm);
      expect(result.allowed).toBe(false);
      expect(result.status).toBe('EXPIRED');
      expect(result.error).toBe('SACCO_LICENSE_EXPIRED');
    });
  });

  // =========================================================================
  // 2. Statutory Validators (Kenya Cooperatives & SASRA Formats)
  // =========================================================================
  describe('2. Statutory Format Validation', () => {
    it('7. Validates Kenyan statutory registration numbers (CS/..., SASRA/DT/..., SASRA/NWDT/...)', () => {
      expect(isValidSaccoLicenseNumber('CS/12345')).toBe(true);
      expect(isValidSaccoLicenseNumber('CS/1')).toBe(true);
      expect(isValidSaccoLicenseNumber('CS/9999999')).toBe(true);
      expect(isValidSaccoLicenseNumber('SASRA/DT/102/2021')).toBe(true);
      expect(isValidSaccoLicenseNumber('SASRA/DT/55/24')).toBe(true);
      expect(isValidSaccoLicenseNumber('SASRA/NWDT/450/2022')).toBe(true);
    });

    it('8. Rejects malformed registration numbers', () => {
      expect(isValidSaccoLicenseNumber('')).toBe(false);
      expect(isValidSaccoLicenseNumber(null)).toBe(false);
      expect(isValidSaccoLicenseNumber('INVALID-123')).toBe(false);
      expect(isValidSaccoLicenseNumber('CS/ABC')).toBe(false);
      expect(isValidSaccoLicenseNumber('CBK/DT/123')).toBe(false);
      expect(isValidSaccoLicenseNumber('CS/12345678')).toBe(false); // exceeds 7 digits
    });

    it('9. Validates HTTPS certificate URLs and rejects non-HTTPS or loopback hosts', () => {
      expect(isValidCertificateUrl('https://storage.baraza.org/certs/sacco-101.pdf')).toBe(true);
      expect(isValidCertificateUrl('https://cloudflare-r2.com/baraza/cert.png')).toBe(true);

      // Insecure or private hosts
      expect(isValidCertificateUrl('http://insecure.com/cert.pdf')).toBe(false);
      expect(isValidCertificateUrl('https://localhost:8080/cert.pdf')).toBe(false);
      expect(isValidCertificateUrl('https://127.0.0.1/cert.pdf')).toBe(false);
      expect(isValidCertificateUrl('ftp://files.org/cert.pdf')).toBe(false);
      expect(isValidCertificateUrl('not-a-url')).toBe(false);
      expect(isValidCertificateUrl('')).toBe(false);
    });
  });

  // =========================================================================
  // 3. Constant-Time Authentication (Invariant I-REG-3)
  // =========================================================================
  describe('3. Constant-Time Compliance Authorization (isComplianceAuthorized)', () => {
    it('10. Authorizes matching secret with Bearer header', () => {
      process.env.COMPLIANCE_REVIEW_SECRET = 'secret_compliance_key_test_1234567890';
      const req = new Request('http://localhost/api/compliance/sacco-license-review', {
        headers: { authorization: 'Bearer secret_compliance_key_test_1234567890' },
      });
      expect(isComplianceAuthorized(req)).toBe(true);
    });

    it('11. Fails closed on missing secret, length mismatch, or incorrect token', () => {
      delete process.env.COMPLIANCE_REVIEW_SECRET;
      delete process.env.CRON_SECRET;
      const req = new Request('http://localhost', { headers: { authorization: 'Bearer abc' } });
      expect(isComplianceAuthorized(req)).toBe(false);

      process.env.COMPLIANCE_REVIEW_SECRET = 'exact_secret_key_32_bytes_long!!';
      const badReq = new Request('http://localhost', { headers: { authorization: 'Bearer wrong_secret_key_32_bytes_long!!' } });
      expect(isComplianceAuthorized(badReq)).toBe(false);

      const shortReq = new Request('http://localhost', { headers: { authorization: 'Bearer short' } });
      expect(isComplianceAuthorized(shortReq)).toBe(false);
    });
  });

  // =========================================================================
  // 4. Edge API Handlers: Submit, Review, Status & Cron
  // =========================================================================
  describe('4. Edge API Handlers', () => {
    it('12. sacco-license-submit validates payload inputs and rejects missing fields', async () => {
      const emptyReq = new Request('http://localhost/api/compliance/sacco-license-submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await handleSubmit(emptyReq);
      expect(res.status).toBe(400);

      const invalidRegReq = new Request('http://localhost/api/compliance/sacco-license-submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          communityId: 'c1',
          licenseNumber: 'INVALID_NUM',
          certificateUrl: 'https://storage.baraza.org/cert.pdf',
        }),
      });
      const regRes = await handleSubmit(invalidRegReq);
      expect(regRes.status).toBe(422);
    });

    it('13. sacco-license-review rejects unauthorized callers with 401', async () => {
      delete process.env.COMPLIANCE_REVIEW_SECRET;
      delete process.env.CRON_SECRET;

      const req = new Request('http://localhost/api/compliance/sacco-license-review', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ communityId: 'c1', decision: 'VERIFIED' }),
      });
      const res = await handleReview(req);
      expect(res.status).toBe(401);
    });

    it('14. sacco-license-review accepts valid authorized decision and returns status', async () => {
      process.env.COMPLIANCE_REVIEW_SECRET = 'test_compliance_secret_key_12345';

      const req = new Request('http://localhost/api/compliance/sacco-license-review', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer test_compliance_secret_key_12345',
        },
        body: JSON.stringify({
          communityId: 'c1',
          decision: 'VERIFIED',
          reviewNotes: 'Approved statutory registration verified.',
        }),
      });
      const res = await handleReview(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.verified).toBe(true);
      expect(data.status).toBe('VERIFIED');
    });

    it('15. monitor-compliance cron requires CRON_SECRET and enforces KES 100M threshold constant', async () => {
      // Missing auth fails closed (401)
      delete process.env.CRON_SECRET;
      const unauthReq = new Request('http://localhost/api/cron/monitor-compliance', { method: 'POST' });
      const unauthRes = await handleMonitorCron(unauthReq);
      expect(unauthRes.status).toBe(401);

      // Authorized call passes (sandbox fallback)
      process.env.CRON_SECRET = 'test_cron_secret_789';
      const authReq = new Request('http://localhost/api/cron/monitor-compliance', {
        method: 'POST',
        headers: { authorization: 'Bearer test_cron_secret_789' },
      });
      const authRes = await handleMonitorCron(authReq);
      expect(authRes.status).toBe(200);
      const data = await authRes.json();
      expect(data.ok).toBe(true);

      // Verify mathematical constant: 10,000,000,000 minor units = KES 100,000,000.00
      expect(SASRA_STATUTORY_DEPOSIT_CEILING_MINOR).toBe(10_000_000_000n);
      expect(Number(SASRA_STATUTORY_DEPOSIT_CEILING_MINOR) / 100).toBe(100_000_000);
    });

    it('16. status API returns community compliance status and metadata', async () => {
      const req = new Request('http://localhost/api/compliance/status?communityId=comm-status-01');
      const res = await handleStatus(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.communityId).toBe('comm-status-01');
      expect(data.status).toBe('UNLICENSED');
    });
  });
});
