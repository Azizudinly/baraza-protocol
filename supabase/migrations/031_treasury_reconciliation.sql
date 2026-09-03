-- =============================================================================
-- Migration: 031_treasury_reconciliation.sql
-- Subsystem: Treasury Reconciliation Ledger & Health Observability (Phase P5)
-- =============================================================================

-- 1. Add is_payout_frozen to communities table
ALTER TABLE public.communities 
  ADD COLUMN IF NOT EXISTS is_payout_frozen BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_communities_payout_frozen 
  ON public.communities(is_payout_frozen) 
  WHERE is_payout_frozen = true;

-- 2. Create append-only reconciliation_audit_logs time-series table
CREATE TABLE IF NOT EXISTS public.reconciliation_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id TEXT NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    reconciliation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    onchain_balance_minor BIGINT NOT NULL,
    ledger_balance_minor BIGINT NOT NULL,
    cached_vault_balance_minor BIGINT NOT NULL,
    in_flight_deposits_minor BIGINT NOT NULL DEFAULT 0,
    in_flight_payouts_minor BIGINT NOT NULL DEFAULT 0,
    net_float_minor BIGINT NOT NULL DEFAULT 0,
    variance_minor BIGINT NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'KES',
    status TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    reconciled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Apply status check constraint using proven two-step pattern
ALTER TABLE public.reconciliation_audit_logs DROP CONSTRAINT IF EXISTS reconciliation_audit_status_chk;
ALTER TABLE public.reconciliation_audit_logs ADD CONSTRAINT reconciliation_audit_status_chk
    CHECK (status IN ('BALANCED', 'VARIANCE_DETECTED', 'RESOLVED', 'INFRASTRUCTURE_SKIPPED'));

-- 4. Expand compliance_alerts alert_type check constraint & add defaults
ALTER TABLE public.compliance_alerts DROP CONSTRAINT IF EXISTS compliance_alert_type_chk;
ALTER TABLE public.compliance_alerts ADD CONSTRAINT compliance_alert_type_chk 
    CHECK (alert_type IN (
        'SASRA_THRESHOLD_100M',
        'LICENSE_EXPIRED',
        'SYBIL_AFFILIATION_THRESHOLD',
        'TREASURY_RECONCILIATION_VARIANCE',
        'STALLED_PAYMENT_ORDER_24H'
    ));

ALTER TABLE public.compliance_alerts 
  ALTER COLUMN current_volume_minor SET DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 5. Expand payment_orders_status_chk to support off-ramps and honest refunds
ALTER TABLE public.payment_orders DROP CONSTRAINT IF EXISTS payment_orders_status_chk;
ALTER TABLE public.payment_orders ADD CONSTRAINT payment_orders_status_chk
    CHECK (status IN (
        'CREATED',
        'PAYMENT_REQUESTED',
        'PAYMENT_PENDING',
        'PAYMENT_CONFIRMED',
        'PROVIDER_CONFIRMED',
        'STATUS_QUERY_SENT',
        'ATTESTATION_SUBMITTED',
        'MINT_QUEUED',
        'MINT_SUBMITTED',
        'MINT_CONFIRMED',
        'INDEXER_CONFIRMED',
        'RECONCILED',
        'PAYMENT_EXPIRED',
        'PAYMENT_FAILED',
        'AMOUNT_MISMATCH',
        'MINT_FAILED_RETRYABLE',
        'MINT_FAILED_FINAL',
        'REFUND_QUEUED',
        'REFUND_SUBMITTED',
        'REFUND_CONFIRMED',
        'MANUAL_REVIEW',
        'OFFRAMP_INITIATED',
        'DISBURSEMENT_PENDING',
        'REFUND_REQUESTED'
    ));

-- 6. Time-Series Performance Indexes (Optimized for 5-minute ticks & audits)
CREATE INDEX IF NOT EXISTS idx_reconciliation_audit_community 
  ON public.reconciliation_audit_logs(community_id);

CREATE INDEX IF NOT EXISTS idx_reconciliation_audit_community_time 
  ON public.reconciliation_audit_logs(community_id, reconciled_at DESC);

CREATE INDEX IF NOT EXISTS idx_reconciliation_audit_status 
  ON public.reconciliation_audit_logs(status);

-- 7. Row-Level Security Configuration
ALTER TABLE public.reconciliation_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_reconciliation_audit_logs" ON public.reconciliation_audit_logs;
CREATE POLICY "service_role_all_reconciliation_audit_logs"
    ON public.reconciliation_audit_logs
    TO service_role
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "reconciliation_audit_public_read" ON public.reconciliation_audit_logs;
CREATE POLICY "reconciliation_audit_public_read"
    ON public.reconciliation_audit_logs
    FOR SELECT
    USING (true);
