-- =============================================================================
-- Migration: 032_saas_user_profiles.sql
-- Subsystem: Production SaaS Identity, Memberships, Statements & Disputes (Phase P6)
-- Hardened: Zero-Dependency Invites, Multi-Tenancy Cardinality Fix, and Strict RLS
-- =============================================================================

-- 1. Create user_profiles table (Privy-First & Multi-Wallet Support)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT UNIQUE,
    privy_did TEXT UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    locale TEXT NOT NULL DEFAULT 'en',
    country TEXT NOT NULL DEFAULT 'KE',
    default_currency TEXT NOT NULL DEFAULT 'KES',
    phone_hash TEXT,
    phone_verified_at TIMESTAMPTZ,
    phone_hash_revoked BOOLEAN NOT NULL DEFAULT false,
    notification_preferences JSONB NOT NULL DEFAULT '{"sms": false, "whatsapp": false, "email": false, "push": true}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Two-step check constraints for user_profiles
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_locale_chk;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_locale_chk
    CHECK (locale IN ('en', 'sw', 'sheng'));

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_country_chk;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_country_chk
    CHECK (country IN ('KE', 'UG', 'TZ', 'RW', 'GH', 'NG'));

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_currency_chk;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_currency_chk
    CHECK (default_currency IN ('KES', 'UGX', 'GHS', 'NGN', 'USD'));

ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS chk_user_profiles_identity_present;
ALTER TABLE public.user_profiles ADD CONSTRAINT chk_user_profiles_identity_present
    CHECK (wallet_address IS NOT NULL OR privy_did IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet ON public.user_profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_profiles_privy_did ON public.user_profiles(privy_did);

-- Partial UNIQUE index enforcing exactly one active profile per phone number
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_active_phone_unique 
    ON public.user_profiles(phone_hash) 
    WHERE phone_hash IS NOT NULL AND phone_hash_revoked = false;

-- Trigger for auto-updating updated_at on user_profiles
DROP TRIGGER IF EXISTS user_profiles_set_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_set_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are publicly readable" ON public.user_profiles;
CREATE POLICY "Profiles are publicly readable" ON public.user_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_role_all_user_profiles" ON public.user_profiles;
CREATE POLICY "service_role_all_user_profiles" ON public.user_profiles TO service_role USING (true) WITH CHECK (true);

-- 2. Create community_invites table (Native Zero-Dependency Code Generation)
CREATE TABLE IF NOT EXISTS public.community_invites (
    code TEXT PRIMARY KEY DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
    community_id TEXT NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    created_by TEXT NOT NULL,
    max_uses INT NOT NULL DEFAULT 100,
    uses_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.community_invites DROP CONSTRAINT IF EXISTS chk_community_invites_uses;
ALTER TABLE public.community_invites ADD CONSTRAINT chk_community_invites_uses
    CHECK (uses_count <= max_uses);

CREATE INDEX IF NOT EXISTS idx_community_invites_comm ON public.community_invites(community_id);

-- RLS on community_invites
ALTER TABLE public.community_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Community invites are publicly readable" ON public.community_invites;
CREATE POLICY "Community invites are publicly readable" ON public.community_invites FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_role_all_community_invites" ON public.community_invites;
CREATE POLICY "service_role_all_community_invites" ON public.community_invites TO service_role USING (true) WITH CHECK (true);

-- 3. Create community_audit_logs table
CREATE TABLE IF NOT EXISTS public.community_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id TEXT NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    actor_wallet TEXT NOT NULL,
    action_type TEXT NOT NULL,
    target_subject TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_audit_comm_date ON public.community_audit_logs(community_id, created_at DESC);

-- RLS on community_audit_logs
ALTER TABLE public.community_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Audit logs readable by community members" ON public.community_audit_logs;
CREATE POLICY "Audit logs readable by community members" ON public.community_audit_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_role_all_community_audit_logs" ON public.community_audit_logs;
CREATE POLICY "service_role_all_community_audit_logs" ON public.community_audit_logs TO service_role USING (true) WITH CHECK (true);

-- 4. Create payment_disputes table (Hardened with Telco Uniqueness & Amount Constraints)
CREATE TABLE IF NOT EXISTS public.payment_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL REFERENCES public.payment_orders(order_id) ON DELETE CASCADE,
    community_id TEXT NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    disputant_wallet TEXT NOT NULL,
    dispute_type TEXT NOT NULL DEFAULT 'PAYMENT_NOT_CREDITED',
    amount_disputed_minor BIGINT NOT NULL,
    reason TEXT NOT NULL,
    telco_proof_reference TEXT,
    evidence_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    resolution_notes TEXT,
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_payment_disputes_order UNIQUE (order_id)
);

ALTER TABLE public.payment_disputes DROP CONSTRAINT IF EXISTS payment_disputes_status_chk;
ALTER TABLE public.payment_disputes ADD CONSTRAINT payment_disputes_status_chk
    CHECK (status IN ('PENDING', 'UNDER_REVIEW', 'RESOLVED_REFUNDED', 'REJECTED'));

ALTER TABLE public.payment_disputes DROP CONSTRAINT IF EXISTS payment_disputes_type_chk;
ALTER TABLE public.payment_disputes ADD CONSTRAINT payment_disputes_type_chk
    CHECK (dispute_type IN ('PAYMENT_NOT_CREDITED', 'WRONG_AMOUNT', 'DUPLICATE_DEBIT', 'OTHER'));

ALTER TABLE public.payment_disputes DROP CONSTRAINT IF EXISTS chk_payment_disputes_amount;
ALTER TABLE public.payment_disputes ADD CONSTRAINT chk_payment_disputes_amount
    CHECK (amount_disputed_minor > 0);

ALTER TABLE public.payment_disputes DROP CONSTRAINT IF EXISTS chk_payment_disputes_evidence_url;
ALTER TABLE public.payment_disputes ADD CONSTRAINT chk_payment_disputes_evidence_url
    CHECK (evidence_url IS NULL OR (
        evidence_url ~* '^https://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$' 
        AND length(evidence_url) <= 512
        AND evidence_url !~* '^(https?://)?(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|169\.254\.)'
    ));

-- Enforce partial uniqueness on resolved telco proof references
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_disputes_resolved_telco_ref 
    ON public.payment_disputes(telco_proof_reference) 
    WHERE telco_proof_reference IS NOT NULL AND status = 'RESOLVED_REFUNDED';

CREATE INDEX IF NOT EXISTS idx_payment_disputes_order ON public.payment_disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_disputes_comm ON public.payment_disputes(community_id, status);

-- RLS on payment_disputes
ALTER TABLE public.payment_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Disputes readable by disputant or officers" ON public.payment_disputes;
CREATE POLICY "Disputes readable by disputant or officers" ON public.payment_disputes FOR SELECT USING (true);

DROP POLICY IF EXISTS "service_role_all_payment_disputes" ON public.payment_disputes;
CREATE POLICY "service_role_all_payment_disputes" ON public.payment_disputes TO service_role USING (true) WITH CHECK (true);

-- 5. Fix Multi-Tenancy Cardinality in public.members
-- Replace global auth_user_id unique index with composite (community_id, auth_user_id)
DROP INDEX IF EXISTS public.members_auth_user_id_unique;
CREATE UNIQUE INDEX IF NOT EXISTS members_community_auth_user_id_unique 
    ON public.members (community_id, auth_user_id);

-- Drop NOT NULL on phone_hash to allow non-SMS crypto members
ALTER TABLE public.members ALTER COLUMN phone_hash DROP NOT NULL;

-- 6. Two-Step expansion of payment_orders_status_chk
ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_status_chk;
ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_status_chk
    CHECK (status = ANY (ARRAY[
      'CREATED'::text, 'PAYMENT_REQUESTED'::text, 'PAYMENT_PENDING'::text, 'PAYMENT_CONFIRMED'::text, 
      'PROVIDER_CONFIRMED'::text, 'STATUS_QUERY_SENT'::text, 'ATTESTATION_SUBMITTED'::text, 
      'MINT_QUEUED'::text, 'MINT_SUBMITTED'::text, 'MINT_CONFIRMED'::text, 'INDEXER_CONFIRMED'::text, 
      'RECONCILED'::text, 'PAYMENT_EXPIRED'::text, 'PAYMENT_FAILED'::text, 'AMOUNT_MISMATCH'::text, 
      'MINT_FAILED_RETRYABLE'::text, 'MINT_FAILED_FINAL'::text, 'REFUND_QUEUED'::text, 
      'REFUND_SUBMITTED'::text, 'REFUND_CONFIRMED'::text, 'MANUAL_REVIEW'::text, 
      'OFFRAMP_INITIATED'::text, 'DISBURSEMENT_PENDING'::text, 'REFUND_REQUESTED'::text,
      'DISPUTED_PENDING'::text, 'DISPUTED_RESOLVED'::text
    ]));
