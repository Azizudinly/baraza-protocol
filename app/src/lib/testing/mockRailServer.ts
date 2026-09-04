/**
 * Multi-Rail Dependency Emulator Server for Baraza Protocol
 *
 * Emulates external payment rails, telecom gateways, and blockchain nodes:
 * 1. Safaricom Daraja (M-Pesa OAuth, STK Push, B2C Payouts)
 * 2. Kotani Pay (On-ramp, Off-ramp, signed webhooks)
 * 3. Minisend (B2C Off-ramp disbursement engine)
 * 4. Paystack (Card/Bank charge initialization & webhooks)
 * 5. Africa's Talking (SMS delivery gateway)
 * 6. Stellar Horizon (Account balance, sequence number, and transaction submission)
 *
 * Includes S&P 500 Enterprise Chaos Engineering Engine:
 * - Deterministic / probabilistic fault injection (500, 502, 503, 429)
 * - Network latency jitter simulation ([min, max] ms)
 * - Abrupt socket termination / connection drop simulation
 * - Active asynchronous telco callback dispatch engine
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { AddressInfo } from 'node:net';

export interface ChaosConfig {
  enabled: boolean;
  failureRate?: number; // 0.0 to 1.0
  statusCode?: number; // 500, 502, 503, 504, 429
  errorPayload?: unknown;
  latencyJitterMs?: [number, number]; // [min, max] delay
  dropConnection?: boolean; // destroy socket immediately
  insufficientFloat?: boolean;
}

export interface MockRailServerInstance {
  server: http.Server;
  url: string;
  port: number;
  stop: () => Promise<void>;
  setChaos: (config: Partial<ChaosConfig>) => void;
  clearChaos: () => void;
  generateKotaniSignature: (payload: unknown, secret: string) => string;
  generatePaystackSignature: (payload: unknown, secret: string) => string;
  generateMinisendSignature: (payload: unknown, secret: string) => string;
  triggerAsyncWebhook: (
    targetUrl: string,
    payload: unknown,
    secret: string,
    provider?: 'kotani' | 'minisend' | 'paystack',
    delayMs?: number,
  ) => Promise<Response>;
}

export async function startMockRailServer(preferredPort = 0): Promise<MockRailServerInstance> {
  let currentChaos: ChaosConfig = { enabled: false };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method?.toUpperCase() || 'GET';

    // -------------------------------------------------------------------------
    // 0. S&P 500 Chaos Engineering & Fault Injection Pipeline
    // -------------------------------------------------------------------------
    if (currentChaos.enabled && method !== 'OPTIONS') {
      // 0a. Latency Jitter Injection
      if (currentChaos.latencyJitterMs) {
        const [min, max] = currentChaos.latencyJitterMs;
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // 0b. Connection Drop / Socket Abrupt Reset
      if (currentChaos.dropConnection) {
        req.socket.destroy();
        return;
      }

      // 0c. Telco / Liquidity Float Exhaustion
      if (currentChaos.insufficientFloat) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'INSUFFICIENT_FLOAT',
          message: 'Upstream liquidity float depleted for carrier rail',
          code: 'FLOAT_EXHAUSTED_5001',
        }));
        return;
      }

      const shouldFail = (currentChaos.statusCode !== undefined || currentChaos.failureRate !== undefined)
        ? (currentChaos.failureRate !== undefined ? Math.random() < currentChaos.failureRate : true)
        : false;

      if (shouldFail) {
        const status = currentChaos.statusCode || 503;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (status === 429) {
          headers['Retry-After'] = '2';
          headers['X-RateLimit-Limit'] = '100';
          headers['X-RateLimit-Remaining'] = '0';
        }
        res.writeHead(status, headers);
        res.end(JSON.stringify(
          currentChaos.errorPayload || {
            error: 'upstream_service_unavailable',
            message: 'Upstream payment rail gateway temporarily unavailable',
            retryable: true,
          },
        ));
        return;
      }
    }

    // Read body if POST/PUT/PATCH
    let bodyText = '';
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
      bodyText = Buffer.concat(chunks).toString('utf-8');
    }

    let parsedBody: Record<string, unknown> = {};
    if (bodyText) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch {
        // Leave as empty or urlencoded
      }
    }

    const sendJson = (status: number, data: unknown, extraHeaders: Record<string, string> = {}) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        ...extraHeaders,
      });
      res.end(JSON.stringify(data));
    };

    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      });
      res.end();
      return;
    }

    // -------------------------------------------------------------------------
    // 1. Safaricom Daraja / M-Pesa Rails
    // -------------------------------------------------------------------------
    if (pathname.includes('/oauth/v1/generate')) {
      sendJson(200, {
        access_token: 'daraja_mock_token_' + crypto.randomBytes(16).toString('hex'),
        expires_in: '3599',
      });
      return;
    }

    if (pathname.includes('/mpesa/stkpush/v1/processrequest')) {
      const checkoutId = 'ws_CO_MOCK_' + Date.now();
      const merchantId = 'merch_' + Date.now();

      // Automated asynchronous telco callback dispatch if CallBackURL provided
      if (typeof parsedBody.CallBackURL === 'string' && parsedBody.CallBackURL.startsWith('http')) {
        const callbackUrl = parsedBody.CallBackURL;
        const isFailure = parsedBody.simulateUserCancel === true;
        const callbackPayload = {
          Body: {
            stkCallback: {
              MerchantRequestID: merchantId,
              CheckoutRequestID: checkoutId,
              ResultCode: isFailure ? 1032 : 0,
              ResultDesc: isFailure ? 'Request cancelled by user' : 'The service request is processed successfully.',
              CallbackMetadata: isFailure ? undefined : {
                Item: [
                  { Name: 'Amount', Value: parsedBody.Amount || 1500 },
                  { Name: 'MpesaReceiptNumber', Value: 'QWE' + Date.now().toString().slice(-7) },
                  { Name: 'TransactionDate', Value: Number(new Date().toISOString().replace(/\D/g, '').slice(0, 14)) },
                  { Name: 'PhoneNumber', Value: parsedBody.PhoneNumber || 254712345678 },
                ],
              },
            },
          },
        };

        const delay = typeof parsedBody.callbackDelayMs === 'number' ? parsedBody.callbackDelayMs : 50;
        setTimeout(() => {
          fetch(callbackUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(callbackPayload),
          }).catch(() => {});
        }, delay);
      }

      sendJson(200, {
        MerchantRequestID: merchantId,
        CheckoutRequestID: checkoutId,
        ResponseCode: '0',
        ResponseDescription: 'Success. Request accepted for processing',
        CustomerMessage: 'Success. Request accepted for processing',
      });
      return;
    }

    if (pathname.includes('/mpesa/b2c/v1/paymentrequest')) {
      sendJson(200, {
        ConversationID: 'AG_MOCK_' + Date.now(),
        OriginatorConversationID: 'ORIG_MOCK_' + Date.now(),
        ResponseCode: '0',
        ResponseDescription: 'Accept the service request successfully.',
      });
      return;
    }

    // -------------------------------------------------------------------------
    // 2. Kotani Pay Rails
    // -------------------------------------------------------------------------
    if (pathname.startsWith('/api/v1/initiate') || pathname.startsWith('/api/v1/payments')) {
      sendJson(200, {
        status: 'PENDING',
        reference: 'kotani_ref_' + Date.now(),
        amount: parsedBody.amount || 1000,
        currency: parsedBody.currency || 'KES',
      });
      return;
    }

    if (pathname.startsWith('/api/v1/withdraw')) {
      sendJson(200, {
        status: 'SUCCESS',
        transaction_id: 'kotani_tx_' + Date.now(),
        message: 'Withdrawal initiated successfully',
      });
      return;
    }

    // -------------------------------------------------------------------------
    // 3. Minisend B2C Rails
    // -------------------------------------------------------------------------
    if (pathname.startsWith('/api/v1/payout')) {
      sendJson(200, {
        success: true,
        payout_id: 'ms_payout_' + Date.now(),
        status: 'PROCESSING',
        fee_minor: 1500,
      });
      return;
    }

    // -------------------------------------------------------------------------
    // 4. Paystack Rails
    // -------------------------------------------------------------------------
    if (pathname.startsWith('/transaction/initialize')) {
      sendJson(200, {
        status: true,
        message: 'Authorization URL created',
        data: {
          authorization_url: 'https://checkout.paystack.com/mock_auth_' + Date.now(),
          access_code: 'access_' + Date.now(),
          reference: 'pstk_ref_' + Date.now(),
        },
      });
      return;
    }

    // -------------------------------------------------------------------------
    // 5. Africa's Talking Rails
    // -------------------------------------------------------------------------
    if (pathname.includes('/version1/messaging')) {
      sendJson(200, {
        SMSMessageData: {
          Message: 'Sent to 1/1 Total Cost: KES 0.8000',
          Recipients: [
            {
              cost: 'KES 0.8000',
              messageId: 'ATXid_' + Date.now(),
              number: '+254712345678',
              status: 'Success',
              statusCode: 101,
            },
          ],
        },
      });
      return;
    }

    // -------------------------------------------------------------------------
    // 6. Stellar Horizon & Soroban RPC Simulator
    // -------------------------------------------------------------------------
    if (pathname.startsWith('/accounts/')) {
      const accountId = pathname.split('/accounts/')[1]?.split('/')[0] || 'GA_MOCK';
      sendJson(200, {
        id: accountId,
        account_id: accountId,
        sequence: '1234567890',
        subentry_count: 2,
        balances: [
          {
            asset_type: 'native',
            balance: '1000.0000000',
          },
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'BRZA',
            asset_issuer: 'GBRAZAPROTOCOLMINT1234567890123456789012345678901234567890',
            balance: '50000.0000000',
          },
          {
            asset_type: 'credit_alphanum4',
            asset_code: 'USDC',
            asset_issuer: 'GBUSDCISSUER123456789012345678901234567890123456789012345678',
            balance: '10000.0000000',
          },
        ],
        signers: [
          {
            key: accountId,
            weight: 1,
            type: 'ed25519_public_key',
          },
        ],
      });
      return;
    }

    if (pathname === '/transactions' && method === 'POST') {
      sendJson(200, {
        successful: true,
        hash: crypto.randomBytes(32).toString('hex'),
        ledger: 987654,
        envelope_xdr: 'AAAAAg...',
        result_xdr: 'AAAAAAAAAGQ...',
      });
      return;
    }

    if (pathname === '/fee_stats') {
      sendJson(200, {
        last_ledger: '987654',
        fee_charged: {
          max: '100',
          min: '100',
          mode: '100',
          p10: '100',
          p20: '100',
          p30: '100',
          p40: '100',
          p50: '100',
          p60: '100',
          p70: '100',
          p80: '100',
          p90: '100',
          p95: '100',
          p99: '100',
        },
      });
      return;
    }

    // Default Fallback
    sendJson(200, { ok: true, message: 'Baraza Mock Rail Endpoint', pathname, method });
  });

  await new Promise<void>((resolve) => {
    server.listen(preferredPort, '127.0.0.1', () => resolve());
  });

  const addr = server.address() as AddressInfo;
  const port = addr.port;
  const url = `http://127.0.0.1:${port}`;

  // Auxiliary Mock: Evolution WhatsApp API (Port 8080) for Scenario 100
  let evolutionServer: http.Server | null = null;
  try {
    const evo = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 200, message: 'Welcome to the Evolution API' }));
    });
    await new Promise<void>((resolve) => {
      evo.listen(8080, '127.0.0.1', () => resolve());
      evo.on('error', () => resolve());
    });
    evolutionServer = evo;
  } catch {
    // Port 8080 already bound by external service
  }

  const setChaos = (config: Partial<ChaosConfig>): void => {
    currentChaos = { ...currentChaos, ...config, enabled: config.enabled ?? true };
  };

  const clearChaos = (): void => {
    currentChaos = { enabled: false };
  };

  const generateKotaniSignature = (payload: unknown, secret: string): string => {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  };

  const generatePaystackSignature = (payload: unknown, secret: string): string => {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha512', secret).update(data).digest('hex');
  };

  const generateMinisendSignature = (payload: unknown, secret: string): string => {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  };

  const triggerAsyncWebhook = async (
    targetUrl: string,
    payload: unknown,
    secret: string,
    provider: 'kotani' | 'minisend' | 'paystack' = 'kotani',
    delayMs = 50,
  ): Promise<Response> => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    const rawBody = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const headers: Record<string, string> = { 'content-type': 'application/json' };

    if (provider === 'kotani') {
      headers['x-kotani-signature'] = generateKotaniSignature(rawBody, secret);
    } else if (provider === 'minisend') {
      headers['x-minisend-signature'] = generateMinisendSignature(rawBody, secret);
      headers['x-minisend-timestamp'] = Math.floor(Date.now() / 1000).toString();
    } else if (provider === 'paystack') {
      headers['x-paystack-signature'] = generatePaystackSignature(rawBody, secret);
    }

    return fetch(targetUrl, {
      method: 'POST',
      headers,
      body: rawBody,
    });
  };

  return {
    server,
    url,
    port,
    stop: async () => {
      if (evolutionServer) {
        await new Promise<void>((resolve) => {
          evolutionServer?.close(() => resolve());
        });
      }
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
    setChaos,
    clearChaos,
    generateKotaniSignature,
    generatePaystackSignature,
    generateMinisendSignature,
    triggerAsyncWebhook,
  };
}
