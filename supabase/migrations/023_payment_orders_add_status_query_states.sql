-- 023_payment_orders_add_status_query_states.sql
--
-- Main-4 requires STATUS_QUERY_SENT in the payment_orders state machine.
-- The status-result and status-timeout callbacks also transition through
-- PROVIDER_CONFIRMED and ATTESTATION_SUBMITTED.

ALTER TABLE payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_status_chk;

ALTER TABLE payment_orders
  ADD CONSTRAINT payment_orders_status_chk
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
    'MANUAL_REVIEW'
  ));
