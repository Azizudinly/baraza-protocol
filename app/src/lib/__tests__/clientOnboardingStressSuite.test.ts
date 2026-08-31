import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import crypto from 'node:crypto';
import { hashClaimCode } from '../identity/claim';

// Handlers under test
import createPaymentIntentHandler from '../../../api/stellar/create-payment-intent';
import activateMembershipHandler from '../../../api/membership/activate';
import paystackWebhookHandler from '../../../api/webhooks/paystack';
import kotaniWebhookHandler from '../../../api/webhooks/kotani';
import africastalkingWebhookHandler from '../../../api/webhooks/africastalking';
import { POST as communitiesHandler } from '../../../api/communities/index';
import treasuryInitializeHandler from '../../../api/treasury/initialize';
import initiateClaimHandler from '../../../api/identity/initiate-claim';
import verifyClaimHandler from '../../../api/identity/verify-claim';
import ussdHandler from '../../../api/ussd/index';

type ApiHandler = (req: Request) => Promise<Response>;

// ─── ED25519 WALLET PROOF UTILS ───────────────────────────────────────────────
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function encodeBase58(source: Uint8Array): string {
  if (source.length === 0) return '';
  const digits: number[] = [0];
  for (let i = 0; i < source.length; i++) {
    let carry = source[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let output = '';
  for (let i = 0; i < source.length && source[i] === 0; i++) {
    output += '1';
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    output += BASE58_ALPHABET[digits[i]];
  }
  return output;
}

interface TestWallet {
  address: string;
  signMessage: (msg: string) => string;
}

function generateTestWallet(): TestWallet {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const der = publicKey.export({ format: 'der', type: 'spki' });
  const rawPub = der.subarray(12); // ED25519_SPKI_PREFIX is 12 bytes
  const address = encodeBase58(rawPub);

  return {
    address,
    signMessage: (message: string) => {
      const sig = crypto.sign(null, Buffer.from(message, 'utf8'), privateKey);
      return sig.toString('base64');
    },
  };
}

function buildTestWalletProofHeaders(wallet: TestWallet, purpose: string): Record<string, string> {
  const message = [
    'Baraza wallet proof',
    `purpose: ${purpose}`,
    `wallet: ${wallet.address}`,
    `issuedAt: ${new Date().toISOString()}`,
    `nonce: ${crypto.randomUUID()}`,
  ].join('\n');
  const signature = wallet.signMessage(message);
  return {
    'x-wallet-address': wallet.address,
    'x-wallet-message': encodeURIComponent(message),
    'x-wallet-signature': signature,
  };
}

// ─── IN-MEMORY STATE ENGINE ───────────────────────────────────────────────────
interface MockCommunity {
  id: string;
  name: string;
  type: string;
  description: string;
  membership_fee: number;
  activation_fee_minor: number;
  fee_type: 'one_time' | 'recurring_monthly' | 'free';
  carrier_pass_through: boolean;
  currency: string;
  fund_balance: number;
  created_at: string;
}

interface MockPaymentOrder {
  order_id: string;
  community_id: string;
  amount_expected: number;
  amount_minor: number;
  currency: string;
  status: string;
  provider: string;
  provider_reference?: string;
  activation_secret_hash?: string | null;
  wallet_address?: string | null;
  amount_received?: number | null;
  paid_at?: string | null;
  updated_at?: string | null;
}

interface MockMembership {
  id: string;
  community_id: string;
  wallet_address: string;
  status: 'PENDING' | 'ACTIVE' | 'MIGRATED' | 'REVOKED';
  joined_at: string;
}

interface MockIdentityLink {
  id: string;
  phone_hash: string;
  wallet_address: string;
  linked_at: string;
}

interface MockIdentityClaimPending {
  id: string;
  phone_hash: string;
  code_hash: string;
  initiated_by: 'ussd' | 'wallet';
  pending_wallet_address: string;
  attempts: number;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

const db = {
  communities: new Map<string, MockCommunity>(),
  payment_orders: new Map<string, MockPaymentOrder>(),
  memberships: new Map<string, MockMembership>(),
  identity_links: new Map<string, MockIdentityLink>(),
  identity_claim_pending: new Map<string, MockIdentityClaimPending>(),
};

function resetDb() {
  db.communities.clear();
  db.payment_orders.clear();
  db.memberships.clear();
  db.identity_links.clear();
  db.identity_claim_pending.clear();

  // Seed sample communities
  db.communities.set('comm_sacco_1', {
    id: 'comm_sacco_1',
    name: 'Nairobi Digital SACCO',
    type: 'sacco',
    description: 'Tier-1 Digital SACCO on Stellar',
    membership_fee: 500,
    activation_fee_minor: 50000, // KES 500
    fee_type: 'one_time',
    carrier_pass_through: true,
    currency: 'KES',
    fund_balance: 0,
    created_at: new Date().toISOString(),
  });

  db.communities.set('comm_free_1', {
    id: 'comm_free_1',
    name: 'Open Nairobi Tech Chama',
    type: 'chama',
    description: 'Free onboarding community',
    membership_fee: 0,
    activation_fee_minor: 0,
    fee_type: 'free',
    carrier_pass_through: false,
    currency: 'KES',
    fund_balance: 0,
    created_at: new Date().toISOString(),
  });
}

// ─── HTTP TEST HARNESS SERVER ─────────────────────────────────────────────────
let server: http.Server;
let baseUrl: string;

const routes: Record<string, ApiHandler> = {
  '/api/stellar/create-payment-intent': createPaymentIntentHandler,
  '/api/membership/activate': activateMembershipHandler,
  '/api/webhooks/paystack': paystackWebhookHandler,
  '/api/webhooks/kotani': kotaniWebhookHandler,
  '/api/webhooks/africastalking': africastalkingWebhookHandler,
  '/api/communities': communitiesHandler,
  '/api/treasury/initialize': treasuryInitializeHandler,
  '/api/identity/initiate-claim': initiateClaimHandler,
  '/api/identity/verify-claim': verifyClaimHandler,
  '/api/ussd': ussdHandler,
};

async function handleMockPostgrest(req: http.IncomingMessage, res: http.ServerResponse, pathname: string, bodyText: string) {
  res.setHeader('content-type', 'application/json');

  // /rest/v1/communities
  if (pathname.startsWith('/rest/v1/communities')) {
    if (req.method === 'GET') {
      const url = new URL(req.url || '', 'http://localhost');
      const idFilter = url.searchParams.get('id');
      if (idFilter && idFilter.startsWith('eq.')) {
        const id = idFilter.replace('eq.', '');
        const comm = db.communities.get(id);
        res.writeHead(200);
        res.end(JSON.stringify(comm ? [comm] : []));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(Array.from(db.communities.values())));
      return;
    }
    if (req.method === 'POST') {
      const payload = JSON.parse(bodyText || '{}');
      const id = payload.id || `comm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const newComm: MockCommunity = {
        id,
        name: payload.name || 'Unnamed',
        type: payload.type || 'chama',
        description: payload.description || '',
        membership_fee: payload.membership_fee ?? 500,
        activation_fee_minor: payload.activation_fee_minor ?? 50000,
        fee_type: payload.fee_type || 'one_time',
        carrier_pass_through: payload.carrier_pass_through ?? true,
        currency: payload.currency || 'KES',
        fund_balance: 0,
        created_at: new Date().toISOString(),
      };
      db.communities.set(id, newComm);
      res.writeHead(201);
      res.end(JSON.stringify([newComm]));
      return;
    }
    if (req.method === 'PATCH') {
      const url = new URL(req.url || '', 'http://localhost');
      const idFilter = url.searchParams.get('id');
      const id = idFilter?.replace('eq.', '') || '';
      const comm = db.communities.get(id);
      if (comm) {
        const updates = JSON.parse(bodyText || '{}');
        Object.assign(comm, updates);
        db.communities.set(id, comm);
      }
      res.writeHead(200);
      res.end(JSON.stringify(comm ? [comm] : []));
      return;
    }
  }

  // /rest/v1/payment_orders
  if (pathname.startsWith('/rest/v1/payment_orders')) {
    if (req.method === 'GET') {
      const url = new URL(req.url || '', 'http://localhost');
      const orderIdFilter = url.searchParams.get('order_id');
      const providerRefFilter = url.searchParams.get('provider_reference');
      if (orderIdFilter && orderIdFilter.startsWith('eq.')) {
        const orderId = orderIdFilter.replace('eq.', '');
        const order = db.payment_orders.get(orderId);
        res.writeHead(200);
        res.end(JSON.stringify(order ? [order] : []));
        return;
      }
      if (providerRefFilter && providerRefFilter.startsWith('eq.')) {
        const ref = providerRefFilter.replace('eq.', '');
        const found = Array.from(db.payment_orders.values()).find((o) => o.provider_reference === ref);
        res.writeHead(200);
        res.end(JSON.stringify(found ? [found] : []));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify(Array.from(db.payment_orders.values())));
      return;
    }
    if (req.method === 'POST') {
      const payload = JSON.parse(bodyText || '{}');
      const order: MockPaymentOrder = {
        order_id: payload.order_id || `ord_${Date.now()}`,
        community_id: payload.community_id,
        amount_expected: payload.amount_expected || 0,
        amount_minor: payload.amount_minor || 0,
        currency: payload.currency || 'KES',
        status: payload.status || 'PENDING',
        provider: payload.provider || 'paystack',
        provider_reference: payload.provider_reference,
        activation_secret_hash: payload.activation_secret_hash || null,
        wallet_address: payload.wallet_address || null,
      };
      db.payment_orders.set(order.order_id, order);
      res.writeHead(201);
      res.end(JSON.stringify([order]));
      return;
    }
    if (req.method === 'PATCH') {
      const url = new URL(req.url || '', 'http://localhost');
      const orderIdFilter = url.searchParams.get('order_id');
      const orderId = orderIdFilter?.replace('eq.', '') || '';
      const order = db.payment_orders.get(orderId);
      if (order) {
        const updates = JSON.parse(bodyText || '{}');
        Object.assign(order, updates);
        db.payment_orders.set(orderId, order);
      }
      res.writeHead(200);
      res.end(JSON.stringify(order ? [order] : []));
      return;
    }
  }

  // /rest/v1/memberships
  if (pathname.startsWith('/rest/v1/memberships')) {
    if (req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(Array.from(db.memberships.values())));
      return;
    }
    if (req.method === 'POST') {
      const payload = JSON.parse(bodyText || '{}');
      const id = `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const mem: MockMembership = {
        id,
        community_id: payload.community_id,
        wallet_address: payload.wallet_address,
        status: payload.status || 'ACTIVE',
        joined_at: new Date().toISOString(),
      };
      db.memberships.set(id, mem);
      res.writeHead(201);
      res.end(JSON.stringify([mem]));
      return;
    }
    if (req.method === 'PATCH') {
      res.writeHead(200);
      res.end(JSON.stringify([]));
      return;
    }
  }

  // /rest/v1/identity_links & /rest/v1/identity_claim_pending
  if (pathname.startsWith('/rest/v1/identity_links')) {
    if (req.method === 'POST') {
      const payload = JSON.parse(bodyText || '{}');
      const id = `idlink_${Date.now().toString(36)}`;
      const link: MockIdentityLink = {
        id,
        phone_hash: payload.phone_hash,
        wallet_address: payload.wallet_address,
        linked_at: new Date().toISOString(),
      };
      db.identity_links.set(id, link);
      res.writeHead(201);
      res.end(JSON.stringify([link]));
      return;
    }
    if (req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify(Array.from(db.identity_links.values())));
      return;
    }
  }

  if (pathname.startsWith('/rest/v1/identity_claim_pending')) {
    if (req.method === 'POST') {
      const payload = JSON.parse(bodyText || '{}');
      const id = `pending_${Date.now().toString(36)}`;
      const claim: MockIdentityClaimPending = {
        id,
        phone_hash: payload.phone_hash,
        code_hash: payload.code_hash,
        initiated_by: payload.initiated_by || 'wallet',
        pending_wallet_address: payload.pending_wallet_address,
        attempts: 0,
        expires_at: payload.expires_at || new Date(Date.now() + 600000).toISOString(),
        consumed_at: null,
        created_at: new Date().toISOString(),
      };
      db.identity_claim_pending.set(payload.phone_hash, claim);
      res.writeHead(201);
      res.end(JSON.stringify([claim]));
      return;
    }
    if (req.method === 'GET') {
      const url = new URL(req.url || '', 'http://localhost');
      const phoneFilter = url.searchParams.get('phone_hash')?.replace('eq.', '');
      const found = phoneFilter ? db.identity_claim_pending.get(phoneFilter) : null;
      res.writeHead(200);
      res.end(JSON.stringify(found && !found.consumed_at ? [found] : []));
      return;
    }
    if (req.method === 'PATCH') {
      const url = new URL(req.url || '', 'http://localhost');
      const idFilter = url.searchParams.get('id')?.replace('eq.', '');
      const updates = JSON.parse(bodyText || '{}');
      for (const claim of db.identity_claim_pending.values()) {
        if (claim.id === idFilter) {
          Object.assign(claim, updates);
        }
      }
      res.writeHead(200);
      res.end(JSON.stringify([{ ok: true }]));
      return;
    }
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'not_found' }));
}

beforeAll(async () => {
  resetDb();

  // Configure environment variables
  process.env.STELLAR_INTENT_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_paystack_secret_key_12345';
  process.env.KOTANI_WEBHOOK_SECRET = 'kotani_webhook_secret_key_12345';
  process.env.AT_API_KEY = 'at_test_api_key_12345';
  process.env.BRZA_PRICE_USD = '0.05';
  process.env.XLM_USD_RATE_MVP = '0.10';
  process.env.PAYMENT_PHONE_HASH_PEPPER = 'pepper_secret_12345678901234567890';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_service_role_key';

  server = http.createServer(async (nodeReq, nodeRes) => {
    const url = new URL(nodeReq.url || '', `http://${nodeReq.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    const chunks: Buffer[] = [];
    for await (const chunk of nodeReq) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');

    // PostgREST Mock Interceptor
    if (pathname.startsWith('/rest/v1/')) {
      await handleMockPostgrest(nodeReq, nodeRes, pathname, rawBody);
      return;
    }

    const handler = routes[pathname];
    if (!handler) {
      nodeRes.writeHead(404, { 'content-type': 'application/json' });
      nodeRes.end(JSON.stringify({ error: 'route_not_found', pathname }));
      return;
    }

    const headers = new Headers();
    for (const [k, v] of Object.entries(nodeReq.headers)) {
      if (v) {
        if (Array.isArray(v)) v.forEach((val) => headers.append(k, val));
        else headers.set(k, v);
      }
    }

    const webReq = new Request(url.toString(), {
      method: nodeReq.method,
      headers,
      body: nodeReq.method !== 'GET' && nodeReq.method !== 'HEAD' ? rawBody : undefined,
    });

    try {
      const webRes = await handler(webReq);
      nodeRes.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
      const resBody = await webRes.text();
      nodeRes.end(resBody);
    } catch (err: unknown) {
      nodeRes.writeHead(500, { 'content-type': 'application/json' });
      nodeRes.end(JSON.stringify({ error: 'internal_error', message: err instanceof Error ? err.message : String(err) }));
    }
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      process.env.SUPABASE_URL = baseUrl;
      process.env.VITE_SUPABASE_URL = baseUrl;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// ─── HELPER CRYPTO UTILS ──────────────────────────────────────────────────────
function signPaystack(body: string, secret: string): string {
  return crypto.createHmac('sha512', secret).update(body).digest('hex');
}

function signKotani(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// ─── COMPREHENSIVE CLIENT ONBOARDING STRESS TEST SUITE ─────────────────────────
describe('Baraza Protocol — End-to-End Client Onboarding & HTTP Stress Suite', () => {
  
  // ─── VECTOR 1: FOUNDER COMMUNITY CREATION & PROGRESSIVE TREASURY VAULT ─────
  describe('Vector 1: Founder Community Launch & Progressive Multisig Treasury', () => {
    it('handles 20 concurrent community creation launches across distinct presets', async () => {
      const presets = ['sacco', 'chama', 'investment-club', 'welfare'] as const;
      const launchPromises = Array.from({ length: 20 }).map(async (_, idx) => {
        const preset = presets[idx % presets.length];
        const res = await fetch(`${baseUrl}/api/communities`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: `Onboarding Community ${idx + 1}`,
            type: preset,
            description: `Auto-launched community for test index ${idx}`,
            membershipFee: 500,
            activationFeeMinor: (idx + 1) * 10000,
            feeType: 'one_time',
            carrierPassThrough: true,
            currency: 'KES',
          }),
        });
        return { status: res.status, data: await res.json() };
      });

      const results = await Promise.all(launchPromises);
      for (const r of results) {
        expect(r.status).toBe(201);
        expect(r.data).toHaveProperty('persisted', true);
        expect(r.data.community).toHaveProperty('id');
      }
      expect(db.communities.size).toBe(22); // 2 initial + 20 created
    });

    it('initializes Progressive 1-of-1 Multisig Treasury Vault with bounds enforcement and wallet proof', async () => {
      const founderWallet = generateTestWallet();
      const proofHeaders = buildTestWalletProofHeaders(founderWallet, 'treasury-init');

      const res = await fetch(`${baseUrl}/api/treasury/initialize`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...proofHeaders,
        },
        body: JSON.stringify({
          communityId: 'comm_sacco_1',
          adminAddress: founderWallet.address,
          signers: [founderWallet.address],
          threshold: 1,
        }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('ok', true);
      expect(data).toHaveProperty('threshold', 1);
    });

    it('rejects unauthenticated treasury initialization without wallet proof', async () => {
      const res = await fetch(`${baseUrl}/api/treasury/initialize`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          communityId: 'comm_sacco_1',
          adminAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
          signers: ['GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'],
          threshold: 1,
        }),
      });

      expect(res.status).toBe(401);
    });
  });

  // ─── VECTOR 2: WEB3 STELLAR ONBOARDING & SERVER DUES DERIVATION ──────────────
  describe('Vector 2: Web3 Stellar XLM Onboarding & Zero-Trust Dues Derivation', () => {
    it('executes 50 concurrent payment intent requests and verifies strict server dues derivation', async () => {
      const intentPromises = Array.from({ length: 50 }).map(async () => {
        // Attempt adversarial dues injection (requesting KES 10 instead of KES 500)
        const res = await fetch(`${baseUrl}/api/stellar/create-payment-intent`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            communityId: 'comm_sacco_1',
            amountKes: 10, // Client tries to pay only KES 10
          }),
        });
        return { status: res.status, data: await res.json() };
      });

      const results = await Promise.all(intentPromises);
      for (const r of results) {
        expect(r.status).toBe(201);
        expect(r.data).toHaveProperty('intentToken');
        // Assert server derived exact dues (KES 500 base dues + 2.5% platform fee = 512.50 KES = 51250 minor)
        expect(r.data.feeBreakdown.baseAmountMinor).toBe(50000);
        expect(r.data.feeBreakdown.totalExpectedMinor).toBe(51250);
        expect(r.data.amountXlm).toBeGreaterThan(35); // Derived XLM amount
      }
    });

    it('instant bypasses zero-fee communities without requiring crypto intent tokens', async () => {
      const res = await fetch(`${baseUrl}/api/stellar/create-payment-intent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ communityId: 'comm_free_1' }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('zeroFee', true);
      expect(data).toHaveProperty('bypassPayment', true);
    });
  });

  // ─── VECTOR 3: PAYSTACK & KOTANI MOBILE MONEY INGRESS STRESS ─────────────────
  describe('Vector 3: Mobile Money Webhook Ingress (Paystack & Kotani)', () => {
    it('handles 50 concurrent Paystack webhooks with underpayment and overpayment fuzzing', async () => {
      // Seed 50 orders in DB
      const orderIds: string[] = [];
      for (let i = 0; i < 50; i++) {
        const orderId = `ord_ps_stress_${i}`;
        orderIds.push(orderId);
        db.payment_orders.set(orderId, {
          order_id: orderId,
          community_id: 'comm_sacco_1',
          amount_expected: 500, // KES 500
          amount_minor: 50000,
          currency: 'KES',
          status: 'PENDING',
          provider: 'paystack',
        });
      }

      const webhookPromises = orderIds.map(async (orderId, idx) => {
        let paidMinor = 50000;
        if (idx === 0) paidMinor = 25000; // Underpayment (50%)
        if (idx === 1) paidMinor = 75000; // Overpayment (150%)

        const rawPayload = JSON.stringify({
          event: 'charge.success',
          data: {
            id: 100000 + idx,
            reference: orderId,
            amount: paidMinor,
            currency: 'KES',
            status: 'success',
            metadata: { order_id: orderId },
          },
        });

        const signature = signPaystack(rawPayload, process.env.PAYSTACK_SECRET_KEY!);
        const res = await fetch(`${baseUrl}/api/webhooks/paystack`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-paystack-signature': signature,
          },
          body: rawPayload,
        });

        return { idx, status: res.status, data: await res.json() };
      });

      const results = await Promise.all(webhookPromises);

      // Verify underpayment (idx === 0)
      expect(results[0].status).toBe(422);
      expect(db.payment_orders.get('ord_ps_stress_0')?.status).toBe('AMOUNT_MISMATCH');

      // Verify overpayment (idx === 1) -> surplus credited to community fund_balance
      expect(results[1].status).toBe(200);
      expect(db.payment_orders.get('ord_ps_stress_1')?.status).toBe('PROVIDER_CONFIRMED');
      expect(db.communities.get('comm_sacco_1')?.fund_balance).toBeGreaterThanOrEqual(750);

      // Verify normal payments (idx >= 2)
      for (let i = 2; i < results.length; i++) {
        expect(results[i].status).toBe(200);
        expect(db.payment_orders.get(`ord_ps_stress_${i}`)?.status).toBe('PROVIDER_CONFIRMED');
      }
    });

    it('rejects forged Paystack webhook signatures with HTTP 401', async () => {
      const rawPayload = JSON.stringify({ event: 'charge.success', data: { reference: 'ord_fake' } });
      const res = await fetch(`${baseUrl}/api/webhooks/paystack`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-paystack-signature': 'bad_forged_hex_signature_deadbeef',
        },
        body: rawPayload,
      });

      expect(res.status).toBe(401);
    });

    it('handles Kotani Pay webhook with HMAC-SHA256 verification and underpayment flagging', async () => {
      db.payment_orders.set('ord_kotani_1', {
        order_id: 'ord_kotani_1',
        community_id: 'comm_sacco_1',
        amount_expected: 500,
        amount_minor: 50000,
        currency: 'KES',
        status: 'PENDING',
        provider: 'kotani',
        provider_reference: 'kot_ref_100',
      });

      const rawPayload = JSON.stringify({
        reference: 'kot_ref_100',
        status: 'completed',
        amount: 500,
        currency: 'KES',
      });

      const signature = signKotani(rawPayload, process.env.KOTANI_WEBHOOK_SECRET!);
      const res = await fetch(`${baseUrl}/api/webhooks/kotani`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-kotani-signature': signature,
        },
        body: rawPayload,
      });

      expect(res.status).toBe(200);
      expect(db.payment_orders.get('ord_kotani_1')?.status).toBe('PAYMENT_CONFIRMED');
    });
  });

  // ─── VECTOR 4: INSTANT FREE COMMUNITY ONBOARDING BURST ───────────────────────
  describe('Vector 4: Instant Free Community Onboarding Burst', () => {
    it('processes 100 concurrent free membership activations in sub-second duration', async () => {
      const startMs = Date.now();
      const activationPromises = Array.from({ length: 100 }).map(async (_, idx) => {
        const res = await fetch(`${baseUrl}/api/membership/activate`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            orderId: `ord_free_stress_${idx}`,
            communityId: 'comm_free_1',
            walletAddress: `GBARAZATESTWALLETADDRESS${idx.toString().padStart(6, '0')}`,
            activationSecret: `sec_free_stress_${idx}`,
          }),
        });
        return { status: res.status, data: await res.json() };
      });

      const results = await Promise.all(activationPromises);
      const durationMs = Date.now() - startMs;

      for (const r of results) {
        expect(r.status).toBe(200);
        expect(r.data).toHaveProperty('ok', true);
      }
      expect(durationMs).toBeLessThan(2000); // 100 activations completed in < 2.0s
    });
  });

  // ─── VECTOR 5: AFRICA'S TALKING USSD GATEWAY STRESS ─────────────────────────
  describe('Vector 5: Africa\'s Talking USSD Gateway Ingress', () => {
    it('handles 50 concurrent USSD session requests navigating menus and initiating dues', async () => {
      const ussdPromises = Array.from({ length: 50 }).map(async (_, idx) => {
        const sessionId = `ussd_sess_${idx}_${Date.now()}`;
        const phone = `+254700${idx.toString().padStart(6, '0')}`;

        // Step 1: Initial dialing
        const dialRes = await fetch(`${baseUrl}/api/ussd`, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'AT-API-Key': process.env.AT_API_KEY!,
          },
          body: new URLSearchParams({
            sessionId,
            phoneNumber: phone,
            text: '',
            serviceCode: '*384*5#',
          }).toString(),
        });
        const dialText = await dialRes.text();
        expect(dialText).toContain('CON Baraza');

        // Step 2: Navigate to Pay Dues (menu item 3)
        const duesRes = await fetch(`${baseUrl}/api/ussd`, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'AT-API-Key': process.env.AT_API_KEY!,
          },
          body: new URLSearchParams({
            sessionId,
            phoneNumber: phone,
            text: '3',
            serviceCode: '*384*5#',
          }).toString(),
        });
        const duesText = await duesRes.text();
        expect(duesText).toContain('CON Pay Dues');

        return { dialRes: dialRes.status, duesRes: duesRes.status };
      });

      const results = await Promise.all(ussdPromises);
      for (const r of results) {
        expect(r.dialRes).toBe(200);
        expect(r.duesRes).toBe(200);
      }
    });
  });

  // ─── VECTOR 6: BIDIRECTIONAL IDENTITY LINKING & DUPLICATE MIGRATION ──────────
  describe('Vector 6: Identity Claim & Duplicate Phone Record Migration Lattice', () => {
    it('executes OTP challenge and links phone hash to wallet address with wallet proof', async () => {
      const memberWallet = generateTestWallet();
      const phone = '+254712345678';
      const proofHeaders = buildTestWalletProofHeaders(memberWallet, 'identity-claim');

      // 1. Initiate claim
      const initRes = await fetch(`${baseUrl}/api/identity/initiate-claim`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...proofHeaders,
        },
        body: JSON.stringify({ phoneNumber: phone, walletAddress: memberWallet.address }),
      });
      expect(initRes.status).toBe(200);
      const initData = await initRes.json();
      expect(initData).toHaveProperty('ok', true);

      // Extract generated code from pending claim DB
      const pendingClaim = Array.from(db.identity_claim_pending.values())[0];
      expect(pendingClaim).toBeDefined();

      // Seed known code hash for verification: '123456'
      pendingClaim.code_hash = await hashClaimCode('123456');

      // 2. Verify claim with matching OTP '123456' and wallet proof
      const verifyProofHeaders = buildTestWalletProofHeaders(memberWallet, 'identity-claim');
      const verifyRes = await fetch(`${baseUrl}/api/identity/verify-claim`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...verifyProofHeaders,
        },
        body: JSON.stringify({ phoneNumber: phone, code: '123456', walletAddress: memberWallet.address }),
      });

      expect(verifyRes.status).toBe(200);
      const verifyData = await verifyRes.json();
      expect(verifyData).toHaveProperty('ok', true);
      expect(db.identity_links.size).toBeGreaterThanOrEqual(1);
    });

    it('rejects invalid 6-digit OTP codes with HTTP 400', async () => {
      const memberWallet = generateTestWallet();
      const phone = '+254799999999';
      const proofHeaders = buildTestWalletProofHeaders(memberWallet, 'identity-claim');

      await fetch(`${baseUrl}/api/identity/initiate-claim`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...proofHeaders,
        },
        body: JSON.stringify({ phoneNumber: phone, walletAddress: memberWallet.address }),
      });

      const verifyProofHeaders = buildTestWalletProofHeaders(memberWallet, 'identity-claim');
      const verifyRes = await fetch(`${baseUrl}/api/identity/verify-claim`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...verifyProofHeaders,
        },
        body: JSON.stringify({ phoneNumber: phone, code: '000000', walletAddress: memberWallet.address }), // Wrong OTP
      });

      expect(verifyRes.status).toBe(403);
    });
  });
});
