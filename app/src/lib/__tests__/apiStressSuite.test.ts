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

// ─── IN-MEMORY DATABASE ENGINE ───────────────────────────────────────────────
interface CommunityDBRow {
  id: string;
  name: string;
  type: string;
  description: string;
  activation_fee_minor: number;
  fee_type: 'one_time' | 'recurring_monthly' | 'free';
  carrier_pass_through: boolean;
  currency: string;
  created_at: string;
}

interface PaymentOrderDBRow {
  order_id: string;
  community_id: string;
  amount_expected: number;
  amount_minor: number;
  currency: string;
  status: string;
  provider_environment: string;
  activation_secret_hash: string | null;
  wallet_address: string | null;
  provider?: string | null;
  provider_reference?: string | null;
  paid_at?: string | null;
  updated_at?: string | null;
}

interface MembershipDBRow {
  member_id: string;
  community_id: string;
  user_id_hash: string;
  wallet_address: string;
  payment_order_id: string;
  status: string;
  voting_weight: number;
  activated_at: string;
}

const db = {
  communities: new Map<string, CommunityDBRow>(),
  paymentOrders: new Map<string, PaymentOrderDBRow>(),
  memberships: new Map<string, MembershipDBRow>(),
  reset() {
    this.communities.clear();
    this.paymentOrders.clear();
    this.memberships.clear();
  },
};

// ─── MOCK SUPABASE REST ROUTER ───────────────────────────────────────────────
async function handleMockSupabase(nodeReq: http.IncomingMessage, nodeRes: http.ServerResponse, parsedUrl: URL) {
  const pathname = parsedUrl.pathname;
  const method = nodeReq.method || 'GET';

  const chunks: Buffer[] = [];
  for await (const chunk of nodeReq) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  const bodyText = Buffer.concat(chunks).toString('utf-8');
  let bodyJson: Record<string, unknown> = {};
  if (bodyText) {
    try { bodyJson = JSON.parse(bodyText); } catch { /* ignore */ }
  }

  // 1. /rest/v1/communities
  if (pathname === '/rest/v1/communities') {
    if (method === 'GET') {
      const idFilter = parsedUrl.searchParams.get('id'); // e.g. "eq.comm_123"
      if (idFilter && idFilter.startsWith('eq.')) {
        const id = decodeURIComponent(idFilter.slice(3));
        const row = db.communities.get(id);
        nodeRes.statusCode = 200;
        nodeRes.setHeader('content-type', 'application/json');
        nodeRes.end(JSON.stringify(row ? [row] : []));
        return;
      }
      nodeRes.statusCode = 200;
      nodeRes.setHeader('content-type', 'application/json');
      nodeRes.end(JSON.stringify(Array.from(db.communities.values())));
      return;
    }

    if (method === 'POST') {
      const row: CommunityDBRow = {
        id: (bodyJson.id as string) || `comm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: (bodyJson.name as string) || 'Test Community',
        type: (bodyJson.type as string) || 'chama',
        description: (bodyJson.description as string) || '',
        activation_fee_minor: Number(bodyJson.activation_fee_minor ?? 50000),
        fee_type: (bodyJson.fee_type as 'one_time' | 'recurring_monthly' | 'free') || 'one_time',
        carrier_pass_through: bodyJson.carrier_pass_through !== false,
        currency: (bodyJson.currency as string) || 'KES',
        created_at: new Date().toISOString(),
      };
      db.communities.set(row.id, row);
      nodeRes.statusCode = 201;
      nodeRes.setHeader('content-type', 'application/json');
      nodeRes.end(JSON.stringify([row]));
      return;
    }
  }

  // 2. /rest/v1/payment_orders
  if (pathname === '/rest/v1/payment_orders') {
    if (method === 'GET') {
      const orderIdFilter = parsedUrl.searchParams.get('order_id');
      if (orderIdFilter && orderIdFilter.startsWith('eq.')) {
        const orderId = decodeURIComponent(orderIdFilter.slice(3));
        const row = db.paymentOrders.get(orderId);
        nodeRes.statusCode = 200;
        nodeRes.setHeader('content-type', 'application/json');
        nodeRes.end(JSON.stringify(row ? [row] : []));
        return;
      }
      nodeRes.statusCode = 200;
      nodeRes.setHeader('content-type', 'application/json');
      nodeRes.end(JSON.stringify(Array.from(db.paymentOrders.values())));
      return;
    }

    if (method === 'PATCH') {
      const orderIdFilter = parsedUrl.searchParams.get('order_id');
      if (orderIdFilter && orderIdFilter.startsWith('eq.')) {
        const orderId = decodeURIComponent(orderIdFilter.slice(3));
        const existing = db.paymentOrders.get(orderId);
        if (!existing) {
          nodeRes.statusCode = 404;
          nodeRes.end(JSON.stringify([]));
          return;
        }
        const updated: PaymentOrderDBRow = {
          ...existing,
          ...(bodyJson as Partial<PaymentOrderDBRow>),
          updated_at: new Date().toISOString(),
        };
        db.paymentOrders.set(orderId, updated);
        nodeRes.statusCode = 200;
        nodeRes.setHeader('content-type', 'application/json');
        nodeRes.end(JSON.stringify([updated]));
        return;
      }
    }
  }

  // 3. /rest/v1/memberships
  if (pathname === '/rest/v1/memberships') {
    if (method === 'GET') {
      const communityFilter = parsedUrl.searchParams.get('community_id');
      const walletFilter = parsedUrl.searchParams.get('wallet_address');
      const commId = communityFilter?.replace('eq.', '');
      const wallet = walletFilter?.replace('eq.', '');

      const matches = Array.from(db.memberships.values()).filter((m) => {
        if (commId && m.community_id !== commId) return false;
        if (wallet && m.wallet_address !== wallet) return false;
        return true;
      });

      nodeRes.statusCode = 200;
      nodeRes.setHeader('content-type', 'application/json');
      nodeRes.end(JSON.stringify(matches));
      return;
    }

    if (method === 'POST') {
      const key = `${bodyJson.community_id}::${bodyJson.wallet_address}`;
      const existing = Array.from(db.memberships.values()).find(
        (m) => m.community_id === bodyJson.community_id && m.wallet_address === bodyJson.wallet_address,
      );

      // Enforce unique constraint: memberships_active_community_wallet_unique
      if (existing) {
        nodeRes.statusCode = 409;
        nodeRes.setHeader('content-type', 'application/json');
        nodeRes.end(JSON.stringify({
          code: '23505',
          message: 'duplicate key value violates unique constraint "memberships_active_community_wallet_unique"',
        }));
        return;
      }

      const row: MembershipDBRow = {
        member_id: (bodyJson.member_id as string) || `mem_${Date.now()}`,
        community_id: bodyJson.community_id as string,
        user_id_hash: bodyJson.user_id_hash as string,
        wallet_address: bodyJson.wallet_address as string,
        payment_order_id: bodyJson.payment_order_id as string,
        status: (bodyJson.status as string) || 'ACTIVE',
        voting_weight: Number(bodyJson.voting_weight ?? 1),
        activated_at: new Date().toISOString(),
      };
      db.memberships.set(key, row);
      nodeRes.statusCode = 201;
      nodeRes.setHeader('content-type', 'application/json');
      nodeRes.end(JSON.stringify([row]));
      return;
    }
  }

  nodeRes.statusCode = 404;
  nodeRes.setHeader('content-type', 'application/json');
  nodeRes.end(JSON.stringify({ error: 'table_not_found', path: pathname }));
}

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
  server = http.createServer(async (nodeReq, nodeRes) => {
    const parsedUrl = new URL(nodeReq.url || '/', `http://${nodeReq.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // Route /rest/v1/* to in-memory Supabase database engine
    if (pathname.startsWith('/rest/v1/')) {
      await handleMockSupabase(nodeReq, nodeRes, parsedUrl);
      return;
    }

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

      // Wire real local HTTP database to Edge handlers
      process.env.SUPABASE_URL = baseUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_test_key_secret';
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

      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Database-Integrated Real HTTP Stress & Correctness Suite', () => {
  // ─── 1. DATABASE DYNAMIC PRICING INTEGRATION ────────────────────────────────
  describe('Database Dynamic Dues Resolution in create-payment-intent', () => {
    it('queries dynamic activation_fee_minor from database and computes exact itemized fees', async () => {
      // Seed a custom SACCO community into the database: KES 750 (75,000 cents) dues
      db.communities.set('sacco_custom_750', {
        id: 'sacco_custom_750',
        name: 'Umoja Housing SACCO',
        type: 'sacco',
        description: 'Housing dues',
        activation_fee_minor: 75000,
        fee_type: 'one_time',
        carrier_pass_through: true,
        currency: 'KES',
        created_at: new Date().toISOString(),
      });

      const res = await fetch(`${baseUrl}/api/stellar/create-payment-intent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          communityId: 'sacco_custom_750',
          amountXlm: 1,
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.intentToken).toBeDefined();

      // Verify math derived from database row:
      // Base: 75,000 cents (KES 750)
      // Platform (2%): 1,500 cents (KES 15.00)
      // Carrier (0.5%): 375 cents (KES 3.75)
      // Total: 76,875 cents (KES 768.75)
      expect(data.feeBreakdown.baseAmountMinor).toBe(75000);
      expect(data.feeBreakdown.platformFeeMinor).toBe(1500);
      expect(data.feeBreakdown.carrierCostMinor).toBe(375);
      expect(data.feeBreakdown.totalExpectedMinor).toBe(76875);
    });

    it('resolves fee_type="free" from database and instantly bypasses payment', async () => {
      // Seed a free community in database
      db.communities.set('free_developer_dao', {
        id: 'free_developer_dao',
        name: 'Nairobi Rust Builders',
        type: 'dao',
        description: 'Free open source builder guild',
        activation_fee_minor: 0,
        fee_type: 'free',
        carrier_pass_through: false,
        currency: 'KES',
        created_at: new Date().toISOString(),
      });

      const res = await fetch(`${baseUrl}/api/stellar/create-payment-intent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          communityId: 'free_developer_dao',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.zeroFee).toBe(true);
      expect(data.bypassPayment).toBe(true);
    });
  });

  // ─── 2. DATABASE MEMBERSHIP ACTIVATION & IDEMPOTENCY ────────────────────────
  describe('Database Membership Activation & Unique Constraint Integrity', () => {
    it('activates free community membership and persists durable row in database', async () => {
      // Free community seeded above
      const res = await fetch(`${baseUrl}/api/membership/activate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: 'free_activation',
          communityId: 'free_developer_dao',
          walletAddress: 'GBRZAFREEMEMBERWALLETADDRESS12345678901234567890123456789',
          activationSecret: 'free_secret',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.persisted).toBe(true);
      expect(data.created).toBe(true);
      expect(data.memberId).toBeDefined();

      // Verify row exists in database
      const key = 'free_developer_dao::GBRZAFREEMEMBERWALLETADDRESS12345678901234567890123456789';
      const stored = db.memberships.get(key);
      expect(stored).toBeDefined();
      expect(stored?.status).toBe('ACTIVE');
      expect(stored?.payment_order_id).toBe('free_activation');
    });

    it('enforces idempotency on duplicate membership join without database error', async () => {
      // Re-call activate with identical parameters
      const res = await fetch(`${baseUrl}/api/membership/activate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: 'free_activation',
          communityId: 'free_developer_dao',
          walletAddress: 'GBRZAFREEMEMBERWALLETADDRESS12345678901234567890123456789',
          activationSecret: 'free_secret',
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.created).toBe(false); // Indicates already existing record returned gracefully
    });

    it('rejects free activation bypass when community is NOT free in database', async () => {
      // sacco_custom_750 requires KES 750 dues
      const res = await fetch(`${baseUrl}/api/membership/activate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId: 'free_activation',
          communityId: 'sacco_custom_750',
          walletAddress: 'GBRZAATTACKERWALLET12345678901234567890123456789012345678',
          activationSecret: 'free_secret',
        }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('invalid_request');
    });
  });

  // ─── 3. DATABASE MULTI-RAIL WEBHOOK SETTLEMENT INTEGRATION ─────────────────
  describe('Database Multi-Rail Webhook Settlement & State Machine', () => {
    it('settles Paystack webhook, advances payment_orders to PROVIDER_CONFIRMED', async () => {
      // Seed pending order in database
      const orderId = 'ord_paystack_live_test_001';
      db.paymentOrders.set(orderId, {
        order_id: orderId,
        community_id: 'sacco_custom_750',
        amount_expected: 768.75,
        amount_minor: 76875,
        currency: 'KES',
        status: 'PENDING_PROVIDER',
        provider_environment: 'sandbox',
        activation_secret_hash: 'hash123',
        wallet_address: null,
      });

      const payload = JSON.stringify({
        event: 'charge.success',
        data: {
          id: 445566,
          reference: orderId,
          amount: 76875,
          currency: 'KES',
          status: 'success',
          paid_at: new Date().toISOString(),
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

      expect(res.status).toBe(200);
      const resJson = await res.json();
      expect(resJson.ok).toBe(true);
      expect(resJson.status).toBe('PROVIDER_CONFIRMED');

      // Verify database record was updated in place
      const updatedOrder = db.paymentOrders.get(orderId);
      expect(updatedOrder?.status).toBe('PROVIDER_CONFIRMED');
      expect(updatedOrder?.provider).toBe('paystack');
      expect(updatedOrder?.provider_reference).toBe('445566');
    });

    it('handles duplicate webhook delivery idempotently without state corruption', async () => {
      const orderId = 'ord_paystack_live_test_001';
      const payload = JSON.stringify({
        event: 'charge.success',
        data: {
          id: 445566,
          reference: orderId,
          amount: 76875,
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

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.message).toContain('already in status PROVIDER_CONFIRMED');
    });
  });

  // ─── 4. FULL API ENDPOINT STRESS & VERIFICATION ───────────────────────────
  describe('Full Project Endpoint Coverage', () => {
    it('executes 50 concurrent payment intent requests with live database lookups', async () => {
      const requests = Array.from({ length: 50 }, (_, i) =>
        fetch(`${baseUrl}/api/stellar/create-payment-intent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            communityId: 'sacco_custom_750',
            amountXlm: 1,
          }),
        }),
      );
      const responses = await Promise.all(requests);
      responses.forEach((r) => expect(r.status).toBe(201));
    });

    it('rejects unauthenticated proxy calls on kotani and minisend', async () => {
      const kotaniRes = await fetch(`${baseUrl}/api/payments/kotani`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'checkStatus', reference: 'ref_1' }),
      });
      expect(kotaniRes.status).toBe(401);

      const minisendRes = await fetch(`${baseUrl}/api/payments/minisend`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'unknown' }),
      });
      expect(minisendRes.status).toBe(401);
    });

    it('handles USSD gateway interactive session', async () => {
      const res = await fetch(`${baseUrl}/api/ussd`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'sessionId=sess_9988&phoneNumber=254712345678&text=&serviceCode=*384*100#',
      });
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text.startsWith('CON') || text.startsWith('END')).toBe(true);
    });
  });
});
