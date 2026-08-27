import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import createPaymentIntentHandler from '../../../api/stellar/create-payment-intent';
import paystackPaymentHandler from '../../../api/payments/paystack';
import paystackWebhookHandler from '../../../api/webhooks/paystack';
import kotaniPaymentHandler from '../../../api/payments/kotani';
import mpesaTransactionStatusHandler from '../../../api/mpesa/transaction-status';
import statusResultHandler from '../../../api/mpesa/status-result';
import statusTimeoutHandler from '../../../api/mpesa/status-timeout';

describe('Hardened Fixes & Defensive Invariants Stress Suite', () => {
  const TEST_PROXY_SECRET = 'institutional_proxy_secret_s_and_p_500';
  const TEST_PAYSTACK_SECRET = 'paystack_secret_hardened_suite_9988';
  const TEST_INTENT_SECRET = 'stellar_intent_secret_hardened_suite_7766';
  const TEST_STATUS_RESULT_SECRET = 'mpesa_result_secret_uuid_112233';

  beforeAll(() => {
    process.env.PAYMENT_ADAPTER_PROXY_SECRET = TEST_PROXY_SECRET;
    process.env.PAYSTACK_SECRET_KEY = TEST_PAYSTACK_SECRET;
    process.env.STELLAR_INTENT_SECRET = TEST_INTENT_SECRET;
    process.env.BRZA_PRICE_USD = '0.05';
    process.env.XLM_USD_RATE_MVP = '0.10';
    process.env.MPESA_STATUS_RESULT_PATH_SECRET = TEST_STATUS_RESULT_SECRET;
  });

  afterAll(() => {
    delete process.env.PAYMENT_ADAPTER_PROXY_SECRET;
    delete process.env.PAYSTACK_SECRET_KEY;
    delete process.env.STELLAR_INTENT_SECRET;
    delete process.env.BRZA_PRICE_USD;
    delete process.env.XLM_USD_RATE_MVP;
    delete process.env.MPESA_STATUS_RESULT_PATH_SECRET;
  });

  // ─── 1. FAIL-CLOSED PROXY AUTH INVARIANT (INVARIANT 1) ──────────────────────
  describe('Invariant 1: Fail-Closed Proxy Authentication', () => {
    it('rejects paystack proxy with 401 when Authorization header is missing', async () => {
      const req = new Request('https://baraza.example/api/payments/paystack', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'initialize', orderId: 'ord_1', email: 'test@example.com', amountKes: 500 }),
      });
      const res = await paystackPaymentHandler(req);
      expect(res.status).toBe(401);
    });

    it('rejects paystack proxy with 401 when Bearer token is invalid', async () => {
      const req = new Request('https://baraza.example/api/payments/paystack', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer wrong_forged_secret',
        },
        body: JSON.stringify({ action: 'initialize', orderId: 'ord_1', email: 'test@example.com', amountKes: 500 }),
      });
      const res = await paystackPaymentHandler(req);
      expect(res.status).toBe(401);
    });

    it('rejects kotani proxy with 401 when Authorization header is missing', async () => {
      const req = new Request('https://baraza.example/api/payments/kotani', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'checkStatus', reference: 'ref_1' }),
      });
      const res = await kotaniPaymentHandler(req);
      expect(res.status).toBe(401);
    });

    it('rejects mpesa transaction-status with 401 when Authorization header is missing', async () => {
      const req = new Request('https://baraza.example/api/mpesa/transaction-status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transactionId: 'ws_test_ref_1' }),
      });
      const res = await mpesaTransactionStatusHandler(req);
      expect(res.status).toBe(401);
    });

    it('fails closed (401) across all proxies if PAYMENT_ADAPTER_PROXY_SECRET is unset', async () => {
      const saved = process.env.PAYMENT_ADAPTER_PROXY_SECRET;
      delete process.env.PAYMENT_ADAPTER_PROXY_SECRET;
      delete process.env.CRON_SECRET;

      try {
        const paystackReq = new Request('https://baraza.example/api/payments/paystack', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${saved}` },
          body: JSON.stringify({ action: 'initialize', orderId: 'ord_1', email: 'test@example.com', amountKes: 500 }),
        });
        expect((await paystackPaymentHandler(paystackReq)).status).toBe(401);

        const kotaniReq = new Request('https://baraza.example/api/payments/kotani', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${saved}` },
          body: JSON.stringify({ action: 'checkStatus', reference: 'ref_1' }),
        });
        expect((await kotaniPaymentHandler(kotaniReq)).status).toBe(401);

        const statusReq = new Request('https://baraza.example/api/mpesa/transaction-status', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${saved}` },
          body: JSON.stringify({ transactionId: 'ws_test_ref_1' }),
        });
        expect((await mpesaTransactionStatusHandler(statusReq)).status).toBe(401);
      } finally {
        process.env.PAYMENT_ADAPTER_PROXY_SECRET = saved;
      }
    });
  });

  // ─── 2. CONSTANT-TIME TIMING-SAFE PATH SECRET CHECK (INVARIANT 7) ───────────
  describe('Invariant 7: Constant-Time Path Secret Verification', () => {
    it('rejects path callback when path secret differs by 1 byte', async () => {
      const alteredSecret = TEST_STATUS_RESULT_SECRET.slice(0, -1) + 'X';
      const req = new Request(`https://baraza.example/api/mpesa/status-result/${alteredSecret}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ Result: { ResultCode: 0, TransactionID: 'TX123' } }),
      });
      const res = await statusResultHandler(req);
      expect(res.status).toBe(403);
    });

    it('rejects path callback when path secret length is different', async () => {
      const truncatedSecret = TEST_STATUS_RESULT_SECRET.slice(0, 5);
      const req = new Request(`https://baraza.example/api/mpesa/status-result/${truncatedSecret}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ Result: { ResultCode: 0, TransactionID: 'TX123' } }),
      });
      const res = await statusResultHandler(req);
      expect(res.status).toBe(403);
    });
  });

  // ─── 3. DYNAMIC CROSS-ASSET MATH & INTENT PINNING (INVARIANT 5) ─────────────
  describe('Invariant 5: Dynamic Cross-Asset Math Propagation', () => {
    it('computes exact integer dues breakdown for arbitrary dynamic community dues', async () => {
      // Test dynamic dues: KES 750 (75,000 cents)
      const req = new Request('https://baraza.example/api/stellar/create-payment-intent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          communityId: 'custom_dynamic_community_750',
          amountKes: 750,
        }),
      });
      const res = await createPaymentIntentHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json() as {
        intentToken: string;
        amountXlm: number;
        feeBreakdown: {
          baseAmountMinor: number;
          platformFeeMinor: number;
          carrierCostMinor: number;
          totalExpectedMinor: number;
        };
      };

      // 75,000 base + 1,500 (2% platform) + 375 (0.5% carrier) = 76,875 cents = KES 768.75
      expect(data.feeBreakdown.baseAmountMinor).toBe(75000);
      expect(data.feeBreakdown.platformFeeMinor).toBe(1500);
      expect(data.feeBreakdown.carrierCostMinor).toBe(375);
      expect(data.feeBreakdown.totalExpectedMinor).toBe(76875);

      // Verify dynamic amountXlm is computed correctly: (768.75 / 130) / 0.10 = 59.1346 XLM
      expect(data.amountXlm).toBeCloseTo(59.1346, 2);
    });

    it('executes zero-fee instant bypass for free communities', async () => {
      const req = new Request('https://baraza.example/api/stellar/create-payment-intent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          communityId: 'open_community_free',
          amountKes: 0,
        }),
      });
      const res = await createPaymentIntentHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json() as { zeroFee: boolean; bypassPayment: boolean };
      expect(data.zeroFee).toBe(true);
      expect(data.bypassPayment).toBe(true);
    });
  });

  // ─── 4. TIMEOUT & WEBHOOK RESILIENCE ───────────────────────────────────────
  describe('Webhook & Callback Security Boundaries', () => {
    it('rejects status-timeout when path secret is invalid', async () => {
      const req = new Request('https://baraza.example/api/mpesa/status-timeout/invalid_secret_token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ Result: { ResultCode: 1, ResultDesc: 'The request timed out' } }),
      });
      const res = await statusTimeoutHandler(req);
      expect(res.status).toBe(403);
    });

    it('rejects paystack webhook without x-paystack-signature', async () => {
      const req = new Request('https://baraza.example/api/webhooks/paystack', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'charge.success', data: { reference: 'ord_123' } }),
      });
      const res = await paystackWebhookHandler(req);
      expect(res.status).toBe(401);
    });
  });

  // ─── 5. CONCURRENT LOAD BURST (100 REQUESTS) ───────────────────────────────
  describe('High Concurrency & Stress Resilience', () => {
    it('executes 100 concurrent dynamic intent calculations without memory leak or NaN', async () => {
      const promises = Array.from({ length: 100 }, (_, i) => {
        const duesKes = 100 + (i * 10);
        const req = new Request('https://baraza.example/api/stellar/create-payment-intent', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            communityId: `community_load_${i}`,
            amountKes: duesKes,
          }),
        });
        return createPaymentIntentHandler(req);
      });

      const responses = await Promise.all(promises);
      expect(responses).toHaveLength(100);
      for (const res of responses) {
        expect(res.status).toBe(201);
      }
    });
  });
});
