-- 030_sacco_compliance.sql
-- Phase P4: SASRA SACCO Regulatory Compliance Subsystem (Class G Controls)
-- Law: Kenya Sacco Societies Act (Cap 490B) & Sacco Societies (Non-Deposit-Taking Business) Regulations 2020
-- Founder Directive: Launch Memo 3 §6 (Non-Intermediated Compliance Architecture)

-- 1. Extend Communities Table with License State
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS sacco_license_status TEXT NOT NULL DEFAULT 'UNLICENSED',
  ADD COLUMN IF NOT EXISTS sacco_license_number TEXT,
  ADD COLUMN IF NOT EXISTS sacco_license_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sacco_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sacco_verified_by TEXT;

-- Two-step constraint pattern (drop then add)
ALTER TABLE communities
  DROP CONSTRAINT IF EXISTS communities_sacco_license_status_chk;

ALTER TABLE communities
  ADD CONSTRAINT communities_sacco_license_status_chk
    CHECK (sacco_license_status IN (
      'UNLICENSED',
      'PENDING_REVIEW',
      'VERIFIED',
      'REJECTED',
      'EXPIRED',
      'REVOKED'
    ));

CREATE INDEX IF NOT EXISTS communities_sacco_status_idx
  ON communities (sacco_license_status);

-- 2. Create Immutable Compliance Document Audit Table
CREATE TABLE IF NOT EXISTS sacco_compliance_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id    TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  license_number  TEXT NOT NULL,
  certificate_url TEXT NOT NULL,
  document_type   TEXT NOT NULL DEFAULT 'cooperative_registration',
  submitted_by    TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  reviewed_by     TEXT,
  review_notes    TEXT,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,

  CONSTRAINT sacco_doc_type_chk
    CHECK (document_type IN ('cooperative_registration', 'sasra_license', 'bylaws', 'audit_accounts')),
  CONSTRAINT sacco_doc_status_chk
    CHECK (status IN ('PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED', 'REVOKED'))
);

CREATE INDEX IF NOT EXISTS idx_sacco_compliance_community
  ON sacco_compliance_documents (community_id);

CREATE INDEX IF NOT EXISTS idx_sacco_compliance_status
  ON sacco_compliance_documents (status);

-- 3. Create Compliance Threshold Alerts Ledger
CREATE TABLE IF NOT EXISTS compliance_alerts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id          TEXT NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  alert_type            TEXT NOT NULL,
  current_volume_minor  BIGINT NOT NULL,
  threshold_minor       BIGINT NOT NULL DEFAULT 10000000000, -- KES 100,000,000 in minor units
  acknowledged_at       TIMESTAMPTZ,
  acknowledged_by       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT compliance_alert_type_chk
    CHECK (alert_type IN ('SASRA_THRESHOLD_100M', 'LICENSE_EXPIRED', 'SYBIL_AFFILIATION_THRESHOLD'))
);

CREATE INDEX IF NOT EXISTS idx_compliance_alerts_community
  ON compliance_alerts (community_id);

-- 4. Row Level Security (RLS) Configuration
ALTER TABLE sacco_compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_alerts ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS "Service role full access on compliance documents" ON sacco_compliance_documents;
CREATE POLICY "Service role full access on compliance documents"
  ON sacco_compliance_documents
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on compliance alerts" ON compliance_alerts;
CREATE POLICY "Service role full access on compliance alerts"
  ON compliance_alerts
  TO service_role
  USING (true)
  WITH CHECK (true);
