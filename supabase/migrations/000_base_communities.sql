-- 000_base_communities.sql
-- Base table definition for communities before 001_communities_governance_columns.sql
-- Idempotent: uses IF NOT EXISTS

CREATE TABLE IF NOT EXISTS communities (
  id             text PRIMARY KEY,
  name           text NOT NULL,
  membership_fee numeric(20, 2) DEFAULT 0,
  member_count   integer DEFAULT 0,
  fund_balance   numeric(20, 2) DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
