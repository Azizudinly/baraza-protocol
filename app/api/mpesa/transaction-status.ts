export const config = { runtime: 'nodejs' };

import { requestTransactionStatusQuery } from '../../../packages/integrations/src/daraja';

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, { status: 405 });
  }

  try {
    const body = (await req.json()) as { transactionId?: string; sandbox?: boolean; remarks?: string };
    const transactionId = body.transactionId?.trim();
    if (!transactionId) {
      return json({ error: 'invalid_request', message: 'transactionId is required' }, { status: 400 });
    }

    const result = await requestTransactionStatusQuery({
      transactionId,
      remarks: body.remarks ?? 'Verification of contribution payment',
      resultUrl: process.env.MPESA_STATUS_RESULT_URL?.trim(),
      queueTimeoutUrl: process.env.MPESA_STATUS_TIMEOUT_URL?.trim(),
      sandbox: body.sandbox ?? false,
    });

    return json({
      ok: true,
      verified: true,
      mode: result.mode,
      transactionId: result.transactionId,
      resultCode: result.resultCode,
      resultDesc: result.resultDesc,
      conversationId: result.conversationId,
      originatorConversationId: result.originatorConversationId,
      acceptedAt: result.acceptedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'transaction_status_query_failed';
    return json({ ok: false, verified: false, error: message }, { status: 502 });
  }
}
