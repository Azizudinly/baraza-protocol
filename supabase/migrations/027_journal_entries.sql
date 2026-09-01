-- 027_journal_entries.sql
--
-- Phase P2 Double-Entry General Ledger (SAD §3.5 Class A & Master Manifest v4.0 §6).
-- Enforces Invariant I4 (Conservation of Ledger Value: Σ Debit ≡ Σ Credit).
--
-- Supported transaction event references:
--   - dues_ingress: Member contribution splits into Treasury + Platform Fee + Carrier Pass
--   - governance_payout: Passed proposal disbursement from Treasury to Recipient/Escrow
--   - retropgf_settlement: Retroactive public goods funding allocation
--   - escrow_clearing: Intermediate holding state during off-ramp B2C processing (RT-07 Fix)
--   - compensatory_reversal: Atomic refund if fiat off-ramp fails (RT-07 Fix)
--   - fee_collection: Protocol fee accounting

CREATE TABLE IF NOT EXISTS journal_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id    text NOT NULL,
  reference_type  text NOT NULL CHECK (reference_type IN (
    'dues_ingress',
    'governance_payout',
    'retropgf_settlement',
    'escrow_clearing',
    'compensatory_reversal',
    'fee_collection'
  )),
  reference_id    text NOT NULL,
  debit_account   text NOT NULL,
  credit_account  text NOT NULL,
  amount_minor    bigint NOT NULL CHECK (amount_minor > 0),
  currency        text NOT NULL DEFAULT 'KES',
  memo            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Query optimizations for community auditing and event tracing
CREATE INDEX IF NOT EXISTS journal_entries_community_idx
  ON journal_entries (community_id, created_at DESC);

CREATE INDEX IF NOT EXISTS journal_entries_reference_idx
  ON journal_entries (reference_type, reference_id);

-- Row-Level Security:
-- Journal entries are financial audit trails: public select within community,
-- insert restricted to service role / edge API.
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Journal entries are publicly readable" ON journal_entries;
CREATE POLICY "Journal entries are publicly readable"
  ON journal_entries FOR SELECT
  USING (true);
