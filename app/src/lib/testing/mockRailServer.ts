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
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { AddressInfo } from 'node:net';

export interface MockRailServerInstance {
  server: http.Server;
  url: string;
  port: number;
  stop: () => Promise<void>;
  generateKotaniSignature: (payload: unknown, secret: string) => string;
  generatePaystackSignature: (payload: unknown, secret: string) => string;
  generateMinisendSignature: (payload: unknown, secret: string) => string;
}

export async function startMockRailServer(preferredPort = 0): Promise<MockRailServerInstance> {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method?.toUpperCase() || 'GET';

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

    const sendJson = (status: number, data: unknown) => {
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': '*',
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
      sendJson(200, {
        MerchantRequestID: 'merch_' + Date.now(),
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

  return {
    server,
    url,
    port,
    stop: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
    generateKotaniSignature,
    generatePaystackSignature,
    generateMinisendSignature,
  };
}
