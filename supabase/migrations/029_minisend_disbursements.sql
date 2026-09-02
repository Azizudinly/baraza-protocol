-- 029_minisend_disbursements.sql
--
-- Phase P3 Minisend Stablecoin Off-Ramp & Double-Entry Ledger Evolution
-- Aligns with SAD §3.5 Class A, Master Manifest v4.0 §6, and Minisend Architecture Spec v3.1.

-- 1. Payment Orders Metadata Extensions
ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS provider_channel TEXT DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS usdc_amount NUMERIC(18, 6),
  ADD COLUMN IF NOT EXISTS chain_network TEXT DEFAULT 'stellar',
  ADD COLUMN IF NOT EXISTS telco_receipt_id TEXT,
  ADD COLUMN IF NOT EXISTS fx_rate_quoted NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS fx_rate_executed NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS fx_slippage_minor BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- 2. Extend Journal Entries Reference Types for Slippage & Reversals
-- Modify constraint if exists to support fx_slippage_clearing and reversal_loss_reserve
DO $$
BEGIN
  ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_reference_type_check;
  ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_reference_type_check CHECK (
    reference_type IN (
      'dues_ingress',
      'governance_payout',
      'retropgf_settlement',
      'escrow_clearing',
      'compensatory_reversal',
      'fee_collection',
      'fx_slippage_clearing',
      'reversal_loss_reserve'
    )
  );
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

-- 3. EXT-01 Defense: Prevent Duplicate Settlement Journal Entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_reference_uniq'
  ) THEN
    ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_reference_uniq UNIQUE (reference_id, reference_type);
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

-- 4. EXT-06 Defense: Optimistic Locking for Concurrent Encumbrance Updates
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS encumbrance_version INTEGER NOT NULL DEFAULT 0;

-- 5. Minisend Cryptographic Audit Logging (ODPC Compliant: phone_hash only)
CREATE TABLE IF NOT EXISTS minisend_audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        text NOT NULL,
  event_type      text NOT NULL,
  minisend_id     text NOT NULL,
  phone_hash      text NOT NULL,
  usdc_amount     numeric(18, 6) NOT NULL,
  fiat_amount     bigint NOT NULL,
  currency        text NOT NULL DEFAULT 'KES',
  status          text NOT NULL,
  raw_payload     jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS minisend_audit_order_idx
  ON minisend_audit_logs (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS minisend_audit_minisend_id_idx
  ON minisend_audit_logs (minisend_id);

-- 6. Unattributed / Orphan Deposits Suspense Tracking
CREATE TABLE IF NOT EXISTS unattributed_deposits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        text NOT NULL DEFAULT 'minisend',
  provider_ref    text NOT NULL UNIQUE,
  sender_phone    text NOT NULL,
  fiat_amount     bigint NOT NULL,
  currency        text NOT NULL DEFAULT 'KES',
  account_ref     text,
  status          text NOT NULL DEFAULT 'UNCLAIMED' CHECK (status IN ('UNCLAIMED', 'CLAIMED', 'REFUNDED')),
  claimed_by      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  claimed_at      timestamptz
);

CREATE INDEX IF NOT EXISTS unattributed_deposits_ref_idx
  ON unattributed_deposits (provider_ref, account_ref);

-- 7. Webhook Idempotency Ledger (EXT-01 Defense)
CREATE TABLE IF NOT EXISTS processed_webhooks (
  idempotency_key text PRIMARY KEY,
  provider        text NOT NULL,
  event_type      text NOT NULL,
  processed_at    timestamptz NOT NULL DEFAULT now()
);

-- 8. Row-Level Security
ALTER TABLE minisend_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE unattributed_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Minisend audit logs readable by service role" ON minisend_audit_logs;
CREATE POLICY "Minisend audit logs readable by service role"
  ON minisend_audit_logs FOR ALL
  USING (true);

DROP POLICY IF EXISTS "Unattributed deposits readable by authenticated" ON unattributed_deposits;
CREATE POLICY "Unattributed deposits readable by authenticated"
  ON unattributed_deposits FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Processed webhooks readable by service role" ON processed_webhooks;
CREATE POLICY "Processed webhooks readable by service role"
  ON processed_webhooks FOR ALL
  USING (true);
