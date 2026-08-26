-- 024_communities_dynamic_activation_fee.sql
-- Adds dynamic activation pricing, fee models, and carrier pass-through flags.
-- Conforms to SAD v1.0 §2.2, Holy Grail §8, and Launch Direction Memo 3 §4.

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS activation_fee_minor BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_type TEXT NOT NULL DEFAULT 'one_time' 
    CHECK (fee_type IN ('one_time', 'recurring_monthly', 'free')),
  ADD COLUMN IF NOT EXISTS carrier_pass_through BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'KES';

COMMENT ON COLUMN communities.activation_fee_minor IS 'Base membership activation fee in integer minor currency units (e.g. cents). Zero indicates a free community.';
COMMENT ON COLUMN communities.fee_type IS 'Billing model: one_time, recurring_monthly, or free.';
COMMENT ON COLUMN communities.carrier_pass_through IS 'Whether carrier collection costs are passed through to the payer.';
COMMENT ON COLUMN communities.currency IS 'Default currency for dues and accounting (default: KES).';
