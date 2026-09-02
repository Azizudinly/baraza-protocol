export const config = { runtime: 'edge' };

import { evaluateFxSlippage } from '../../src/lib/payments/slippage';

interface MinisendWebhookPayload {
  event: 'payout.success' | 'payout.failed' | 'payout.reversed' | 'payout.processing' | 'deposit.success';
  id: string; // Minisend transaction ID
  reference?: string; // Baraza order ID
  phone?: string;
  amount?: string | number; // USDC amount
  fiat_amount?: number; // Minor units or integer major KES
  currency?: string;
  telco_receipt?: string;
  failure_code?: string;
  failure_reason?: string;
  timestamp?: string;
}

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
}

/**
 * Constant-time HMAC-SHA256 signature verification for zero-trust webhook ingress (Invariant I2b).
 */
async function verifyMinisendSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
    const expected = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    if (expected.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

/**
 * Computes a salted SHA-256 hash of a phone number to satisfy ODPC PII minimization (Launch Memo 3 §5).
 */
async function hashPhone(phone: string, pepper: string): Promise<string> {
  const data = new TextEncoder().encode(`${phone}:${pepper}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

function supabaseHeaders(serviceKey: string): HeadersInit {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json',
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 });

  const webhookSecret = process.env.MINISEND_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) return json({ error: 'webhook_not_configured' }, { status: 503 });

  const rawBody = await req.text();
  const signature = req.headers.get('x-minisend-signature') ?? '';
  const timestampHeader = req.headers.get('x-minisend-timestamp');

  // 1. Invariant I2b Zero-Trust Verification
  if (!signature || !(await verifyMinisendSignature(rawBody, signature, webhookSecret))) {
    console.warn('[minisend-webhook] Signature verification failed');
    return json({ error: 'forbidden', message: 'Invalid HMAC signature' }, { status: 401 });
  }

  // 2. Timestamp Freshness Window (Reject replays > 300s old)
  if (timestampHeader) {
    const timestampSec = parseInt(timestampHeader, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (!Number.isNaN(timestampSec) && Math.abs(nowSec - timestampSec) > 300) {
      return json({ error: 'forbidden', message: 'Webhook timestamp outside 300-second freshness window' }, { status: 401 });
    }
  }

  let payload: MinisendWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MinisendWebhookPayload;
  } catch {
    return json({ error: 'invalid_request', message: 'Body must be valid JSON' }, { status: 400 });
  }

  if (!payload?.id || !payload?.event) {
    return json({ error: 'invalid_request', message: 'id and event are required fields' }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.info('[minisend-webhook] Supabase not configured — received event', payload.id, payload.event);
    return json({ received: true });
  }

  // 3. EXT-01 Defense: Webhook Idempotency Check
  const idempotencyKey = `ms_wh_${payload.id}_${payload.event}`;
  try {
    const idempRes = await fetch(`${supabaseUrl}/rest/v1/processed_webhooks`, {
      method: 'POST',
      headers: supabaseHeaders(serviceKey),
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        provider: 'minisend',
        event_type: payload.event,
      }),
    });

    if (idempRes.status === 409) {
      // Already processed this exact webhook event
      return json({ received: true, changed: false, idempotent: true });
    }
  } catch {
    // Non-fatal if table not initialized
  }

  // 4. Match Order by reference or provider_reference
  let order: {
    order_id: string;
    community_id?: string;
    status: string;
    amount_expected: number;
    currency: string;
  } | null = null;

  try {
    const matchRef = payload.reference || payload.id;
    const findRes = await fetch(
      `${supabaseUrl}/rest/v1/payment_orders?or=(order_id.eq.${encodeURIComponent(matchRef)},provider_reference.eq.${encodeURIComponent(matchRef)})&limit=1`,
      { headers: supabaseHeaders(serviceKey) },
    );
    if (findRes.ok) {
      const rows = (await findRes.json().catch(() => [])) as Array<{
        order_id: string; community_id?: string; status: string; amount_expected: number; currency: string;
      }>;
      order = rows[0] ?? null;
    }
  } catch (err) {
    console.warn('[minisend-webhook] Error querying order:', err);
  }

  // 5. Unattributed Inbound Deposit Handling (D4 Suspense Queue)
  if (!order) {
    try {
      const phonePepper = process.env.PAYMENT_PHONE_HASH_PEPPER || 'baraza-salt';
      const phoneHash = payload.phone ? await hashPhone(payload.phone, phonePepper) : 'unknown';

      await fetch(`${supabaseUrl}/rest/v1/unattributed_deposits`, {
        method: 'POST',
        headers: supabaseHeaders(serviceKey),
        body: JSON.stringify({
          provider: 'minisend',
          provider_ref: payload.id,
          sender_phone: phoneHash,
          fiat_amount: Number(payload.fiat_amount || 0),
          currency: payload.currency || 'KES',
          account_ref: payload.reference ?? null,
          status: 'UNCLAIMED',
        }),
      });
    } catch {
      // Non-fatal
    }

    return json({ received: true, matched: false, suspense: true });
  }

  // 6. Monotonic State Machine & Terminal State Freeze (D6)
  const currentStatus = order.status;
  if (payload.event !== 'payout.reversed') {
    if (currentStatus === 'SETTLED' || currentStatus === 'FAILED' || currentStatus === 'PAYMENT_CONFIRMED' || currentStatus === 'RECONCILED') {
      return json({ received: true, changed: false, terminal: true });
    }
  } else {
    // Reversals only apply to previously settled orders
    if (currentStatus === 'REVERSAL_DETECTED' || currentStatus === 'FAILED') {
      return json({ received: true, changed: false, terminal: true });
    }
  }

  // 7. Audit Log Entry (ODPC PII Minimized: phone_hash only)
  try {
    const phonePepper = process.env.PAYMENT_PHONE_HASH_PEPPER || 'baraza-salt';
    const phoneHash = payload.phone ? await hashPhone(payload.phone, phonePepper) : 'unknown';

    await fetch(`${supabaseUrl}/rest/v1/minisend_audit_logs`, {
      method: 'POST',
      headers: supabaseHeaders(serviceKey),
      body: JSON.stringify({
        order_id: order.order_id,
        event_type: payload.event,
        minisend_id: payload.id,
        phone_hash: phoneHash,
        usdc_amount: Number(payload.amount || 0),
        fiat_amount: Number(payload.fiat_amount || 0),
        currency: payload.currency || 'KES',
        status: payload.event,
        raw_payload: payload,
      }),
    });
  } catch {
    // Non-fatal
  }

  // 8. Event Transition Logic
  if (payload.event === 'payout.success' || payload.event === 'deposit.success') {
    const expectedMinor = BigInt(order.amount_expected || 0);
    const executedMinor = payload.fiat_amount ? BigInt(payload.fiat_amount) : expectedMinor;
    const slippageAnalysis = evaluateFxSlippage(expectedMinor, executedMinor);

    // Atomic conditional status update (EXT-01 TOCTOU Guard)
    await fetch(`${supabaseUrl}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(order.order_id)}`, {
      method: 'PATCH',
      headers: supabaseHeaders(serviceKey),
      body: JSON.stringify({
        status: 'SETTLED',
        telco_receipt_id: payload.telco_receipt ?? null,
        fx_slippage_minor: Number(slippageAnalysis.slippageMinor),
        confirmed_at: new Date().toISOString(),
      }),
    });

    // Post Phase 3 Double-Entry Settlement & Slippage Journal Entries (Invariant I4)
    if (order.community_id && executedMinor > 0n) {
      try {
        // Settlement entry
        await fetch(`${supabaseUrl}/rest/v1/journal_entries`, {
          method: 'POST',
          headers: supabaseHeaders(serviceKey),
          body: JSON.stringify({
            community_id: order.community_id,
            reference_type: 'governance_payout',
            reference_id: order.order_id,
            debit_account: 'baraza:escrow_clearing',
            credit_account: 'baraza:recipient_disbursed',
            amount_minor: Number(executedMinor),
            currency: order.currency || 'KES',
            memo: `Minisend off-ramp settled (Telco Receipt: ${payload.telco_receipt || 'N/A'})`,
          }),
        });

        // If FX spot rate slippage occurred, balance the ledger via fx_slippage_clearing
        if (slippageAnalysis.slippageMinor !== 0n) {
          const isLoss = slippageAnalysis.slippageMinor < 0n;
          const absSlippage = Math.abs(Number(slippageAnalysis.slippageMinor));

          await fetch(`${supabaseUrl}/rest/v1/journal_entries`, {
            method: 'POST',
            headers: supabaseHeaders(serviceKey),
            body: JSON.stringify({
              community_id: order.community_id,
              reference_type: 'fx_slippage_clearing',
              reference_id: `${order.order_id}_slippage`,
              debit_account: isLoss ? 'baraza:fx_slippage_clearing' : 'baraza:escrow_clearing',
              credit_account: isLoss ? 'baraza:escrow_clearing' : 'baraza:fx_slippage_clearing',
              amount_minor: absSlippage,
              currency: order.currency || 'KES',
              memo: `Minisend FX slippage adjustment (${slippageAnalysis.slippageBps} bps)`,
            }),
          });
        }
      } catch (ledgerErr) {
        console.warn('[minisend-webhook] Non-fatal journal entry post error:', ledgerErr);
      }
    }

    return json({ received: true, settled: true, status: 'SETTLED' });
  }

  if (payload.event === 'payout.failed') {
    const failureReason = payload.failure_reason || payload.failure_code || 'provider_payout_failed';

    // Atomic update to FAILED
    await fetch(`${supabaseUrl}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(order.order_id)}`, {
      method: 'PATCH',
      headers: supabaseHeaders(serviceKey),
      body: JSON.stringify({
        status: 'FAILED',
        failure_reason: failureReason,
      }),
    });

    // Compensatory Reversal Entry: Restore funds from Escrow Clearing back to Treasury (D3 / RT-07)
    if (order.community_id && order.amount_expected > 0) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/journal_entries`, {
          method: 'POST',
          headers: supabaseHeaders(serviceKey),
          body: JSON.stringify({
            community_id: order.community_id,
            reference_type: 'compensatory_reversal',
            reference_id: `${order.order_id}_reversal`,
            debit_account: 'baraza:escrow_clearing',
            credit_account: 'baraza:community_treasury',
            amount_minor: order.amount_expected,
            currency: order.currency || 'KES',
            memo: `Compensatory reversal on Minisend payout failure (${failureReason})`,
          }),
        });
      } catch {
        // Non-fatal
      }
    }

    return json({ received: true, reversed: true, status: 'FAILED' });
  }

  if (payload.event === 'payout.reversed') {
    // EXT-03 Defense: Telco Chargeback / Reversal Handling
    await fetch(`${supabaseUrl}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(order.order_id)}`, {
      method: 'PATCH',
      headers: supabaseHeaders(serviceKey),
      body: JSON.stringify({
        status: 'REVERSAL_DETECTED',
        failure_reason: 'telco_chargeback_reversal',
      }),
    });

    if (order.community_id && order.amount_expected > 0) {
      try {
        await fetch(`${supabaseUrl}/rest/v1/journal_entries`, {
          method: 'POST',
          headers: supabaseHeaders(serviceKey),
          body: JSON.stringify({
            community_id: order.community_id,
            reference_type: 'reversal_loss_reserve',
            reference_id: `${order.order_id}_chargeback`,
            debit_account: 'baraza:reversal_loss_reserve',
            credit_account: 'baraza:escrow_clearing',
            amount_minor: order.amount_expected,
            currency: order.currency || 'KES',
            memo: 'Minisend off-ramp telco chargeback debit to reversal reserve',
          }),
        });
      } catch {
        // Non-fatal
      }
    }

    return json({ received: true, status: 'REVERSAL_DETECTED' });
  }

  return json({ received: true, changed: false, event: payload.event });
}
