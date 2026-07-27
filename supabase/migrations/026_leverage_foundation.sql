-- 026_leverage_foundation.sql
--
-- Draft only. Do NOT run in production until reviewed.
--
-- Scope:
-- - Community onboarding foundation
-- - Member activation ledger
-- - Tier feature flags for route/API gating
-- - Community-scoped admin helper
--
-- This migration follows the existing text-ID style used by the repo.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT auth.role() = 'service_role';
$$;

-- ---------------------------------------------------------------------------
-- Communities
-- ---------------------------------------------------------------------------

ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'chama',
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'mtaa',
  ADD COLUMN IF NOT EXISTS chain text NOT NULL DEFAULT 'solana',
  ADD COLUMN IF NOT EXISTS constitution jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS chain_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

-- Every value here must cover the union of:
--   - COMMUNITY_TYPES in app/src/lib/constants.ts (canonical source, 27 values)
--   - GOVERNANCE_PRESETS keys in app/src/pages/CreateCommunity.tsx (subset of the above)
--   - CommunityType in packages/coop-templates/src/index.ts (5-value curated subset)
--   - the 'chama' DEFAULT on the `type` column above
-- Covered by app/src/lib/__tests__/communityTypesMigration.test.ts, which fails
-- the build if any of those sources drift ahead of this list.
ALTER TABLE communities
  DROP CONSTRAINT IF EXISTS communities_type_chk;
ALTER TABLE communities
  ADD CONSTRAINT communities_type_chk
    CHECK (type IN (
      'chama', 'savings', 'stokvel', 'sacco', 'dao', 'cooperative', 'professional',
      'investment', 'rosca', 'asca', 'union', 'ngo', 'alumni', 'religious', 'sports',
      'homeowners', 'burial', 'tribe', 'welfare', 'pta', 'youth', 'political',
      'supply_chain', 'study', 'housing', 'organization', 'government'
    ));

ALTER TABLE communities
  DROP CONSTRAINT IF EXISTS communities_tier_chk;
ALTER TABLE communities
  ADD CONSTRAINT communities_tier_chk
    CHECK (tier IN ('mtaa', 'kikundi', 'sacco', 'biashara', 'serikali'));

ALTER TABLE communities
  DROP CONSTRAINT IF EXISTS communities_status_chk;
ALTER TABLE communities
  ADD CONSTRAINT communities_status_chk
    CHECK (status IN ('draft', 'queued', 'active', 'paused', 'archived'));

CREATE INDEX IF NOT EXISTS communities_type_idx   ON communities (type);
CREATE INDEX IF NOT EXISTS communities_tier_idx   ON communities (tier);
CREATE INDEX IF NOT EXISTS communities_status_idx ON communities (status);

-- ---------------------------------------------------------------------------
-- Members
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS members (
  member_id                text           PRIMARY KEY,
  auth_user_id             text           NOT NULL,
  community_id             text           NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  phone_hash               text           NOT NULL,
  wallet_address           text           NOT NULL,
  role                     text           NOT NULL DEFAULT 'member',
  activation_status        text           NOT NULL DEFAULT 'pending',
  activation_payment_ref   text,
  activated_at             timestamptz,
  created_at               timestamptz    NOT NULL DEFAULT now(),
  updated_at               timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT members_role_chk
    CHECK (role IN ('founder', 'admin', 'treasurer', 'member')),
  CONSTRAINT members_activation_status_chk
    CHECK (activation_status IN ('pending', 'active', 'suspended', 'revoked'))
);

CREATE INDEX IF NOT EXISTS members_community_id_idx
  ON members (community_id);
CREATE UNIQUE INDEX IF NOT EXISTS members_auth_user_id_unique
  ON members (auth_user_id);
CREATE INDEX IF NOT EXISTS members_wallet_address_idx
  ON members (wallet_address);
CREATE INDEX IF NOT EXISTS members_phone_hash_idx
  ON members (phone_hash);
CREATE UNIQUE INDEX IF NOT EXISTS members_community_phone_hash_unique
  ON members (community_id, phone_hash);

CREATE OR REPLACE FUNCTION public.is_community_admin(p_community_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM members m
      WHERE m.community_id = p_community_id
        AND m.auth_user_id = auth.uid()::text
        AND m.role IN ('founder', 'admin', 'treasurer')
        AND m.activation_status = 'active'
    );
$$;

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read their own community" ON members;
CREATE POLICY "Members can read their own community"
  ON members FOR SELECT
  USING (
    public.is_admin()
    OR auth_user_id = auth.uid()::text
  );

DROP POLICY IF EXISTS "Members can manage their own community" ON members;
CREATE POLICY "Members can manage their own community"
  ON members FOR ALL
  USING (public.is_community_admin(community_id))
  WITH CHECK (public.is_community_admin(community_id));

-- No member-facing self-UPDATE policy on this table. A prior draft added one
-- ("Members can update their own row", USING/WITH CHECK on auth_user_id only)
-- with no column restriction — Postgres RLS policies gate rows, not columns,
-- so it let any authenticated member run
--   UPDATE members SET role = 'admin' WHERE auth_user_id = auth.uid()::text
-- and self-promote to admin/founder. Removed rather than patched: RLS can't
-- express "this member may update wallet_address but not role" on its own.
-- Self-service field updates (e.g. wallet_address) must go through an API
-- route that validates the caller against auth_user_id, allowlists exactly
-- the columns being changed, and writes via the service_role key — never a
-- broad member-facing UPDATE policy on this table.
DROP POLICY IF EXISTS "Members can update their own row" ON members;

DROP TRIGGER IF EXISTS members_set_updated_at ON members;
CREATE TRIGGER members_set_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Activation payments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS activation_payments (
  activation_payment_id    text             PRIMARY KEY,
  mpesa_receipt            text             NOT NULL,
  amount                   numeric(20, 2)   NOT NULL,
  msisdn_hash              text             NOT NULL,
  member_id                text             NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  batch_id                 text,
  provider_environment     text             NOT NULL DEFAULT 'sandbox',
  provider_reference_hash  text,
  status                   text             NOT NULL DEFAULT 'received',
  created_at               timestamptz      NOT NULL DEFAULT now(),
  updated_at               timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT activation_payments_amount_chk
    CHECK (amount > 0),
  CONSTRAINT activation_payments_provider_environment_chk
    CHECK (provider_environment IN ('sandbox', 'production')),
  CONSTRAINT activation_payments_status_chk
    CHECK (status IN ('received', 'verified', 'failed', 'reversed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS activation_payments_mpesa_receipt_unique
  ON activation_payments (mpesa_receipt);
CREATE INDEX IF NOT EXISTS activation_payments_member_id_idx
  ON activation_payments (member_id);
CREATE INDEX IF NOT EXISTS activation_payments_batch_id_idx
  ON activation_payments (batch_id)
  WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS activation_payments_msisdn_hash_idx
  ON activation_payments (msisdn_hash);

ALTER TABLE activation_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Activation payments are readable by the owning member" ON activation_payments;
CREATE POLICY "Activation payments are readable by the owning member"
  ON activation_payments FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM members m
      WHERE m.member_id = activation_payments.member_id
        AND m.auth_user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "Activation payments are written by service role" ON activation_payments;
CREATE POLICY "Activation payments are written by service role"
  ON activation_payments FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS activation_payments_set_updated_at ON activation_payments;
CREATE TRIGGER activation_payments_set_updated_at
  BEFORE UPDATE ON activation_payments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Tier feature flags
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tier_features (
  tier                   text           PRIMARY KEY,
  member_limit           integer        NOT NULL,
  akili_access           boolean        NOT NULL DEFAULT false,
  api_access             boolean        NOT NULL DEFAULT false,
  compliance_reports     boolean        NOT NULL DEFAULT false,
  token_deployment       boolean        NOT NULL DEFAULT false,
  created_at             timestamptz    NOT NULL DEFAULT now(),
  updated_at             timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT tier_features_tier_chk
    CHECK (tier IN ('mtaa', 'kikundi', 'sacco', 'biashara', 'serikali')),
  CONSTRAINT tier_features_member_limit_chk
    CHECK (member_limit > 0)
);

INSERT INTO tier_features (tier, member_limit, akili_access, api_access, compliance_reports, token_deployment)
VALUES
  ('mtaa',      50,  false, false, false, false),
  ('kikundi',  200,  true,  false, false, false),
  ('sacco',    500,  true,  true,  true,  false),
  ('biashara', 500,  true,  true,  true,  true),
  ('serikali', 1000,  true,  true,  true,  true)
ON CONFLICT (tier) DO UPDATE SET
  member_limit       = EXCLUDED.member_limit,
  akili_access       = EXCLUDED.akili_access,
  api_access         = EXCLUDED.api_access,
  compliance_reports = EXCLUDED.compliance_reports,
  token_deployment   = EXCLUDED.token_deployment,
  updated_at         = now();

ALTER TABLE tier_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tier features are publicly readable" ON tier_features;
CREATE POLICY "Tier features are publicly readable"
  ON tier_features FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Tier features are admin managed" ON tier_features;
CREATE POLICY "Tier features are admin managed"
  ON tier_features FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS tier_features_set_updated_at ON tier_features;
CREATE TRIGGER tier_features_set_updated_at
  BEFORE UPDATE ON tier_features
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

