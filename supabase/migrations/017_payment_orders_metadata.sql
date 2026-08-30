-- 017_payment_orders_metadata.sql
--
-- Add a JSONB metadata column to payment_orders so the cron promoter can
-- persist mint failure details (Horizon result codes, ledger numbers,
-- timestamps) alongside the MINT_FAILED_FINAL status.
--
-- Without this, the only record of *why* a mint failed lives in ephemeral
-- serverless logs — fine for live debugging, useless for back-filling a
-- triage queue or building admin tooling for stale orders.
--
-- The column is nullable and idempotent so this migration is safe to
-- re-run on installs that already include it from a future merge.

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Partial index: only payment_orders carrying any metadata get indexed.
-- We expect successful orders to leave it NULL, so the index stays small
-- and lookups for "all failed orders with metadata" stay fast.
CREATE INDEX IF NOT EXISTS payment_orders_metadata_idx
  ON payment_orders USING gin (metadata)
  WHERE metadata IS NOT NULL;
