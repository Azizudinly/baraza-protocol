-- 028_proposals_snapshot_escrow.sql
--
-- Phase P2 Governance & Treasury Hardening Migration.
-- Addresses RT-01 (Quorum Snapshot), RT-02 (Encumbrance), RT-06 (Tied Extended) and RT-07 (Three-Phase Escrow).

-- 1. Add snapshotted member count, quorum basis points, funding amount, and execution state columns
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS snapshot_member_count  integer,
  ADD COLUMN IF NOT EXISTS quorum_threshold_bps   integer NOT NULL DEFAULT 2000, -- 2000 bps = 20.00%
  ADD COLUMN IF NOT EXISTS funding_amount_minor   bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tie_extended           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS execution_status       text DEFAULT 'pending';

-- 2. Expand status constraint to support 'tied' and 'tied_extended'
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_status_chk;
ALTER TABLE proposals ADD CONSTRAINT proposals_status_chk
  CHECK (status IN (
    'draft',
    'pending',
    'active',
    'passed',
    'failed',
    'tied',
    'tied_extended',
    'queued',
    'executed',
    'cancelled'
  ));

-- 3. Execution status constraint for three-phase saga tracking (RT-07)
ALTER TABLE proposals DROP CONSTRAINT IF EXISTS proposals_execution_status_chk;
ALTER TABLE proposals ADD CONSTRAINT proposals_execution_status_chk
  CHECK (execution_status IN (
    'pending',
    'encumbered',
    'escrow_clearing',
    'executed',
    'reversal_pending',
    'reversed',
    'failed'
  ));

-- 4. Treasury vault encumbrance tracking on communities
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS encumbered_balance_minor bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liquid_vault_balance_minor bigint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS proposals_execution_status_idx
  ON proposals (execution_status)
  WHERE execution_status != 'pending';
