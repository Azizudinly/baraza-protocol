-- 019_identity_links.sql
--
-- Identity continuity (Phase 9). Bidirectional claim flow that links a
-- HMAC'd phone identity (phone_hash) to a Stellar/Solana wallet address.
--
-- Council ruling 2026-06-19 set phone_hash as canonical: Nia's W3 promise
-- ("your phone IS your membership") is load-bearing for chama culture.
-- Wallets are devices that come and go; phones persist with the member.
-- Memberships, badges, vote weight, and BRZA balance MUST resolve through
-- the canonical phone_hash when one is linked.
--
-- HMAC pepper reused: PAYMENT_PHONE_HASH_PEPPER — same as payment_orders
-- user_id_hash and memberships.phone_hash, so all four tables join on the
-- same identity key.

-- One row per linked (phone_hash, wallet_address) pair.
-- A wallet has at most one linked identity (uniqueness on wallet_address).
-- A phone_hash can have many wallets (multi-device, SIM rotation, family
-- shared phone where each member uses their own wallet but holds the same
-- phone). The canonical identity is the phone_hash; the wallets are
-- pointers.
CREATE TABLE IF NOT EXISTS identity_links (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash          text         NOT NULL,
  wallet_address      text         NOT NULL UNIQUE,
  linked_at           timestamptz  NOT NULL DEFAULT now(),
  -- 'ussd_initiated' — phone-based member started the claim, completed on web
  -- 'wallet_initiated' — wallet-based member started the claim, completed via SMS
  claim_method        text         NOT NULL CHECK (claim_method IN ('ussd_initiated', 'wallet_initiated')),
  -- HMAC(code || nonce, pepper). Evidences the claim event without storing
  -- the code itself. Audit-only; not used for runtime verification.
  verification_proof  text         NOT NULL
);

CREATE INDEX IF NOT EXISTS identity_links_phone_hash_idx
  ON identity_links (phone_hash);

-- Pending claims. Short-lived (10 minutes by convention; enforced by API).
-- The 6-digit code is stored as SHA-256(code) — comparison is constant-time
-- in the API layer via crypto.timingSafeEqual.
CREATE TABLE IF NOT EXISTS identity_claim_pending (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash               text         NOT NULL,
  code_hash                text         NOT NULL,
  initiated_by             text         NOT NULL CHECK (initiated_by IN ('ussd', 'wallet')),
  -- Set when the wallet is known at initiation time (wallet-side flow).
  -- Null for USSD-initiated claims; the wallet is supplied at verify time.
  pending_wallet_address   text,
  attempts                 integer      NOT NULL DEFAULT 0,
  expires_at               timestamptz  NOT NULL,
  consumed_at              timestamptz,
  created_at               timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS identity_claim_pending_phone_hash_idx
  ON identity_claim_pending (phone_hash)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS identity_claim_pending_expires_at_idx
  ON identity_claim_pending (expires_at)
  WHERE consumed_at IS NULL;

-- RLS: no public reads. Service role only.
ALTER TABLE identity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_claim_pending ENABLE ROW LEVEL SECURITY;

-- Operator note: stale pending claims should be culled by a periodic job.
-- A bounded grow-only table is acceptable for v1 — at ten claims per
-- member per year the table stays small even at protocol scale.
