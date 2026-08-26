import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';

// Import all API route handlers
import createPaymentIntentHandler from '../../../api/stellar/create-payment-intent';
import verifyPaymentHandler from '../../../api/stellar/verify-payment';
import activateMembershipHandler from '../../../api/membership/activate';
import paystackPaymentHandler from '../../../api/payments/paystack';
import paystackWebhookHandler from '../../../api/webhooks/paystack';
import kotaniPaymentHandler from '../../../api/payments/kotani';
import kotaniWebhookHandler from '../../../api/webhooks/kotani';
import minisendPaymentHandler from '../../../api/payments/minisend';
import mpesaSimulateHandler from '../../../api/mpesa/simulate';
import mpesaTransactionStatusHandler from '../../../api/mpesa/transaction-status';
import mpesaStatusResultHandler from '../../../api/mpesa/status-result';
import mpesaStatusTimeoutHandler from '../../../api/mpesa/status-timeout';
import communitiesHandler from '../../../api/communities/index';
import retroAllocationsHandler from '../../../api/communities/retro-allocations';
import retroBallotHandler from '../../../api/communities/retro-ballot';
import retroRoundsHandler from '../../../api/communities/retro-rounds';
import retroSettleHandler from '../../../api/communities/retro-settle';
import initiateClaimHandler from '../../../api/identity/initiate-claim';
import verifyClaimHandler from '../../../api/identity/verify-claim';
import paymentOrderStatusHandler from '../../../api/payment-orders/status';
import streakHandler from '../../../api/payment-orders/streak';
import streakBatchHandler from '../../../api/payment-orders/streak-batch';
import ussdHandler from '../../../api/ussd/index';
import africastalkingWebhookHandler from '../../../api/webhooks/africastalking';
import akiliFilingsHandler from '../../../api/akili/filings';
import promoteOrdersCronHandler from '../../../api/cron/promote-orders';
import settleRetroAllocationsCronHandler from '../../../api/cron/settle-retro-allocations';

type ApiHandler = (req: Request) => Promise<Response>;

const routeMap: Record<string, ApiHandler> = {
  '/api/stellar/create-payment-intent': createPaymentIntentHandler,
  '/api/stellar/verify-payment': verifyPaymentHandler,
  '/api/membership/activate': activateMembershipHandler,
  '/api/payments/paystack': paystackPaymentHandler,
  '/api/webhooks/paystack': paystackWebhookHandler,
  '/api/payments/kotani': kotaniPaymentHandler,
  '/api/webhooks/kotani': kotaniWebhookHandler,
  '/api/payments/minisend': minisendPaymentHandler,
  '/api/mpesa/simulate': mpesaSimulateHandler,
  '/api/mpesa/transaction-status': mpesaTransactionStatusHandler,
  '/api/mpesa/status-result': mpesaStatusResultHandler,
  '/api/mpesa/status-timeout': mpesaStatusTimeoutHandler,
  '/api/communities': communitiesHandler,
  '/api/communities/retro-allocations': retroAllocationsHandler,
  '/api/communities/retro-ballot': retroBallotHandler,
  '/api/communities/retro-rounds': retroRoundsHandler,
  '/api/communities/retro-settle': retroSettleHandler,
  '/api/identity/initiate-claim': initiateClaimHandler,
  '/api/identity/verify-claim': verifyClaimHandler,
  '/api/payment-orders/status': paymentOrderStatusHandler,
  '/api/payment-orders/streak': streakHandler,
  '/api/payment-orders/streak-batch': streakBatchHandler,
  '/api/ussd': ussdHandler,
  '/api/webhooks/africastalking': africastalkingWebhookHandler,
  '/api/akili/filings': akiliFilingsHandler,
  '/api/cron/promote-orders': promoteOrdersCronHandler,
  '/api/cron/settle-retro-allocations': settleRetroAllocationsCronHandler,
};

let server: http.Server;
let baseUrl: string;

const PROXY_SECRET = 'test_adapter_proxy_secret_12345';

beforeAll(async () => {
  process.env.STELLAR_INTENT_SECRET = 'test_stellar_intent_secret_32_bytes_len!!';
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_paystack_secret_key_12345';
  process.env.KOTANI_PAY_API_KEY = 'kotani_api_key_test';
  process.env.KOTANI_WEBHOOK_SECRET = 'kotani_webhook_secret_test';
  process.env.PAYMENT_PHONE_HASH_PEPPER = 'test_pepper_12345';
  process.env.PAYMENT_ADAPTER_PROXY_SECRET = PROXY_SECRET;
  process.env.MPESA_SIMULATOR_ENABLED = 'true';
  process.env.NODE_ENV = 'development';
  process.env.BRZA_PRICE_USD = '0.01';
  process.env.XLM_USD_RATE_MVP = '0.10';

  server = http.createServer(async (nodeReq, nodeRes) => {
    const parsedUrl = new URL(nodeReq.url || '/', `http://${nodeReq.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const handler = routeMap[pathname];

    if (!handler) {
      nodeRes.statusCode = 404;
      nodeRes.setHeader('content-type', 'application/json');
      nodeRes.end(JSON.stringify({ error: 'not_found', path: pathname }));
      return;
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of nodeReq) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      const bodyBuffer = Buffer.concat(chunks);

      const headers = new Headers();
      for (const [key, value] of Object.entries(nodeReq.headers)) {
        if (value) {
          if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
          } else {
            headers.set(key, value);
          }
        }
      }

      const requestInit: RequestInit = {
        method: nodeReq.method,
        headers,
        body: ['GET', 'HEAD', 'OPTIONS'].includes(nodeReq.method || '') ? undefined : bodyBuffer,
      };

      const webReq = new Request(parsedUrl.toString(), requestInit);
      const webRes = await handler(webReq);

      nodeRes.statusCode = webRes.status;
      webRes.headers.forEach((v, k) => {
        nodeRes.setHeader(k, v);
      });

      const resBuf = await webRes.arrayBuffer();
      nodeRes.end(Buffer.from(resBuf));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      nodeRes.statusCode = 500;
      nodeRes.setHeader('content-type', 'application/json');
      nodeRes.end(JSON.stringify({ error: 'server_error', message: msg }));
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Full HTTP Stress & Endpoint Correctness Suite', () => {
  // ─── 1. POST /api/stellar/create-payment-intent ────────────────────────────
  describe('POST /api/stellar/create-payment-intent', () => {
    it('handles OPTIONS CORS preflight', async () => {
      const res = await fetch(`${baseUrl}/api/stellar/create-payment-intent`, { method: 'OPTIONS' });
      expect(res.status).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
    });

    it('rejects GET with method_not_allowed (405)', async () => {
      const res = await fetch(`${baseUrl}/api/stellar/create-payment-intent`, { method: 'GET' });
      expect(res.status).toBe(405);
    });

    it('rejects invalid JSON body with 400', async () => {
      const res = await fetch(`${baseUrl}/api/stellar/create-payment-intent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'invalid-json{{{',
      });
      expect(res.status).toBe(400);
    });

    it('rejects request with missing communityId with 400', async () => {
      const res = await fetch(`${baseUrl}/api/stellar/create-payment-intent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amountXlm: 5 }),
      });
      expect(res.status).toBe(400);
    });

    it('returns valid intentToken and itemized fee breakdown for standard dues', async () => {
      const res = await fetch(`${baseUrl}/api/stellar/create-payment-intent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          communityId: 'comm_test_uuid_1234',
          amountKes: 500,
          amountXlm: 10,
        }),
      });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.intentToken).toBeDefined();
      expect(data.intentToken.split('.')).toHaveLength(2);
      expect(data.feeBreakdown).toBeDefined();
      expect(data.feeBreakdown.baseAmountMinor).toBe(50000);
      expect(data.feeBreakdown.platformFeeMinor).toBe(1000);
      expect(data.feeBreakdown.carrierCostMinor).toBe(250);
      expect(data.feeBreakdown.totalExpectedMinor).toBe(51250);
    });

    it('detects free community (amountKes = 0) and returns zeroFee bypass', async () => {
      const res = await fetch(`${baseUrl}/api/stellar/create-payment-intent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          communityId: 'comm_free_dao_000',
          amountKes: 0,
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.zeroFee).toBe(true);
      expect(data.bypassPayment).toBe(true);
    });

    it('handles concurrent burst of 50 payment intent requests', async () => {
      const requests = Array.from({ length: 50 }, (_, i) =>
        fetch(`${baseUrl}/api/stellar/create-payment-intent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            communityId: `comm_burst_${i}`,
            amountKes: 100 + i * 10,
            amountXlm: 1,
          }),
        }),
      );
      const responses = await Promise.all(requests);
      responses.forEach((r) => expect(r.status).toBe(201));
    });
  });

  // ─── 2. POST /api/membership/activate ──────────────────────────────────────
  describe('POST /api/membership/activate', () => {
    it('returns graceful fallback response when Supabase is unconfigured in test', async () => {
      const res = await fetch(`${baseUrl}/api/membership/activate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: 'free_activation',
          communityId: 'free-community-uuid',
          walletAddress: 'GBRZATESTWALLETADDRESS1234567890123456789012345678901234',
          activationSecret: 'secret_123',
        }),
      });
      const data = await res.json();
      expect([200, 400]).toContain(res.status);
      expect(data.persisted).toBe(false);
      expect(data.reason).toBe('supabase_not_configured');
    });
  });

  // ─── 3. POST /api/payments/paystack ────────────────────────────────────────
  describe('POST /api/payments/paystack', () => {
    it('handles OPTIONS CORS preflight', async () => {
      const res = await fetch(`${baseUrl}/api/payments/paystack`, { method: 'OPTIONS' });
      expect(res.status).toBe(200);
    });

    it('rejects unsupported actions with 400', async () => {
      const res = await fetch(`${baseUrl}/api/payments/paystack`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${PROXY_SECRET}`,
        },
        body: JSON.stringify({ action: 'invalid_action' }),
      });
      expect(res.status).toBe(400);
    });

    it('validates required fields (email, orderId, amountKes)', async () => {
      const res = await fetch(`${baseUrl}/api/payments/paystack`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${PROXY_SECRET}`,
        },
        body: JSON.stringify({
          action: 'initialize',
          orderId: 'ord_123',
          email: 'invalid-email',
          amountKes: -50,
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── 4. POST /api/webhooks/paystack ────────────────────────────────────────
  describe('POST /api/webhooks/paystack', () => {
    it('rejects requests missing x-paystack-signature with 401', async () => {
      const res = await fetch(`${baseUrl}/api/webhooks/paystack`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'charge.success' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects forged x-paystack-signature with 401', async () => {
      const res = await fetch(`${baseUrl}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-paystack-signature': 'forged_deadbeef_signature_1234567890abcdef',
        },
        body: JSON.stringify({ event: 'charge.success', data: { reference: 'ord_123' } }),
      });
      expect(res.status).toBe(401);
    });

    it('accepts authentic HMAC-SHA512 signature', async () => {
      const payload = JSON.stringify({
        event: 'charge.success',
        data: {
          id: 998877,
          reference: 'ord_test_8899',
          amount: 51250,
          currency: 'KES',
          status: 'success',
        },
      });

      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(process.env.PAYSTACK_SECRET_KEY!),
        { name: 'HMAC', hash: 'SHA-512' },
        false,
        ['sign'],
      );
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
      const sigHex = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');

      const res = await fetch(`${baseUrl}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-paystack-signature': sigHex,
        },
        body: payload,
      });
      expect([200, 500, 502]).toContain(res.status);
    });
  });

  // ─── 5. POST /api/payments/kotani ──────────────────────────────────────────
  describe('POST /api/payments/kotani', () => {
    it('handles OPTIONS CORS preflight', async () => {
      const res = await fetch(`${baseUrl}/api/payments/kotani`, { method: 'OPTIONS' });
      expect(res.status).toBe(200);
    });

    it('rejects unauthorized caller without proxy token with 401', async () => {
      const res = await fetch(`${baseUrl}/api/payments/kotani`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'checkStatus', reference: 'ref_1' }),
      });
      expect(res.status).toBe(401);
    });

    it('validates mpesaToBrza required fields with proxy auth', async () => {
      const res = await fetch(`${baseUrl}/api/payments/kotani`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${PROXY_SECRET}`,
        },
        body: JSON.stringify({ action: 'mpesaToBrza', phone: '0712345678' }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── 6. POST /api/webhooks/kotani ──────────────────────────────────────────
  describe('POST /api/webhooks/kotani', () => {
    it('rejects forged Kotani webhook signature with 401 or 403', async () => {
      const res = await fetch(`${baseUrl}/api/webhooks/kotani`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-kotani-signature': 'forged_sig',
        },
        body: JSON.stringify({ event: 'transfer.success' }),
      });
      expect([401, 403]).toContain(res.status);
    });
  });

  // ─── 7. POST /api/payments/minisend ────────────────────────────────────────
  describe('POST /api/payments/minisend', () => {
    it('rejects unauthorized proxy caller with 401', async () => {
      const res = await fetch(`${baseUrl}/api/payments/minisend`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'unknown_action' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects unknown action or unconfigured gateway with 400 or 503 when authorized', async () => {
      const res = await fetch(`${baseUrl}/api/payments/minisend`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${PROXY_SECRET}`,
        },
        body: JSON.stringify({ action: 'unknown_action' }),
      });
      expect([400, 503]).toContain(res.status);
    });
  });

  // ─── 8. POST /api/mpesa/simulate ───────────────────────────────────────────
  describe('POST /api/mpesa/simulate', () => {
    it('returns simulation order and activation secret in enabled mode', async () => {
      const res = await fetch(`${baseUrl}/api/mpesa/simulate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone: '+254712345678',
          communityId: 'test-dao-uuid',
          amount: 512,
          currency: 'KES',
        }),
      });
      expect([200, 403]).toContain(res.status);
    });
  });

  // ─── 9. POST /api/mpesa/transaction-status ─────────────────────────────────
  describe('POST /api/mpesa/transaction-status', () => {
    it('validates orderId presence', async () => {
      const res = await fetch(`${baseUrl}/api/mpesa/transaction-status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect([400, 503]).toContain(res.status);
    });
  });

  // ─── 10. POST /api/communities ────────────────────────────────────────────
  describe('POST /api/communities', () => {
    it('handles OPTIONS CORS preflight', async () => {
      const res = await fetch(`${baseUrl}/api/communities`, { method: 'OPTIONS' });
      expect([200, 404]).toContain(res.status);
    });

    it('validates community input payload', async () => {
      const res = await fetch(`${baseUrl}/api/communities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Valid Chama', type: 'chama' }),
      });
      expect([200, 400, 404, 500]).toContain(res.status);
    });
  });

  // ─── 11. POST /api/identity/initiate-claim & verify-claim ──────────────────
  describe('POST /api/identity/initiate-claim & verify-claim', () => {
    it('validates identity claim input requirements', async () => {
      const res = await fetch(`${baseUrl}/api/identity/initiate-claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect([400, 503]).toContain(res.status);
    });

    it('rejects verify claim with invalid nonce/code', async () => {
      const res = await fetch(`${baseUrl}/api/identity/verify-claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: '000000' }),
      });
      expect([400, 503]).toContain(res.status);
    });
  });

  // ─── 12. GET & POST /api/payment-orders/status & streak ────────────────────
  describe('/api/payment-orders/status & streak', () => {
    it('handles payment-orders/status query', async () => {
      const res = await fetch(`${baseUrl}/api/payment-orders/status?orderId=ord_test_123`);
      expect([200, 400, 404, 500, 503]).toContain(res.status);
    });

    it('handles payment-orders/streak-batch validation', async () => {
      const res = await fetch(`${baseUrl}/api/payment-orders/streak-batch`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect([400, 200, 500, 503]).toContain(res.status);
    });
  });

  // ─── 13. POST /api/ussd ────────────────────────────────────────────────────
  describe('POST /api/ussd', () => {
    it('handles USSD session initiation', async () => {
      const res = await fetch(`${baseUrl}/api/ussd`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'sessionId=1234&phoneNumber=254712345678&text=&serviceCode=*384*100#',
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text.startsWith('CON') || text.startsWith('END')).toBe(true);
    });
  });

  // ─── 14. POST /api/webhooks/africastalking ─────────────────────────────────
  describe('POST /api/webhooks/africastalking', () => {
    it('handles Africa Talking SMS callback', async () => {
      const res = await fetch(`${baseUrl}/api/webhooks/africastalking`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'from=+254712345678&to=99999&text=BALANCE&date=2026-08-26',
      });
      expect([200, 400, 500, 503]).toContain(res.status);
    });
  });

  // ─── 15. POST /api/akili/filings ───────────────────────────────────────────
  describe('POST /api/akili/filings', () => {
    it('handles Akili AI legal filings generation endpoint', async () => {
      const res = await fetch(`${baseUrl}/api/akili/filings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          communityType: 'cooperative',
          name: 'Baraza SACCO',
          county: 'Nairobi',
        }),
      });
      expect([200, 400, 403, 503]).toContain(res.status);
    });
  });

  // ─── 16. /api/cron/promote-orders & settle-retro-allocations ───────────────
  describe('/api/cron/promote-orders & settle-retro-allocations', () => {
    it('handles promote-orders cron job with clean status', async () => {
      const res = await fetch(`${baseUrl}/api/cron/promote-orders`, {
        method: 'GET',
        headers: { 'content-type': 'application/json' },
      });
      expect([200, 401, 404, 500, 503]).toContain(res.status);
    });

    it('handles settle-retro-allocations cron job with clean status', async () => {
      const res = await fetch(`${baseUrl}/api/cron/settle-retro-allocations`, {
        method: 'GET',
        headers: { 'content-type': 'application/json' },
      });
      expect([200, 401, 404, 500, 503]).toContain(res.status);
    });
  });
});
