// app/api/communities/statement.ts
// Streaming Double-Entry Financial Statement Exporter (V8 TransformStream + Abort-Safe)

export const config = { runtime: 'edge' };

import { getSupabaseAdmin, jsonResponse } from '../_lib/supabase';
import { resolveCallerIdentity } from '../_lib/auth-session';
import { assertValidSlug } from '../_lib/validation';

export function normalizeStatementDateRange(
  startDateRaw?: string | null,
  endDateRaw?: string | null,
  country: string = 'KE'
): { startUtc: string; endUtc: string } {
  const offsetHours = country === 'NG' ? 1 : country === 'GH' ? 0 : country === 'RW' ? 2 : 3;
  const offsetSign = offsetHours >= 0 ? '+' : '-';
  const offsetStr = `${offsetSign}${String(Math.abs(offsetHours)).padStart(2, '0')}:00`;

  let startUtc: string;
  let endUtc: string;

  if (startDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(startDateRaw)) {
    startUtc = new Date(Date.parse(`${startDateRaw}T00:00:00${offsetStr}`)).toISOString();
  } else if (startDateRaw) {
    startUtc = new Date(startDateRaw).toISOString();
  } else {
    // Default: 30 days ago
    startUtc = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  }

  if (endDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(endDateRaw)) {
    endUtc = new Date(Date.parse(`${endDateRaw}T23:59:59.999${offsetStr}`)).toISOString();
  } else if (endDateRaw) {
    endUtc = new Date(endDateRaw).toISOString();
  } else {
    endUtc = new Date().toISOString();
  }

  return { startUtc, endUtc };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-wallet-address, x-wallet-signature, x-wallet-message, x-test-wallet-address, x-test-privy-did',
      },
    });
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'method_not_allowed' }, { status: 405 });
  }

  const url = new URL(req.url);
  const communityId = url.searchParams.get('communityId');
  const startDateRaw = url.searchParams.get('startDate');
  const endDateRaw = url.searchParams.get('endDate');
  const format = url.searchParams.get('format') === 'ndjson' ? 'ndjson' : 'csv';

  try {
    assertValidSlug(communityId, 'communityId');
  } catch (err: unknown) {
    return jsonResponse({ error: 'invalid_parameter', message: (err as Error).message }, { status: 400 });
  }

  // Caller Authorization Check
  const identity = await resolveCallerIdentity(req, 'statement-export');
  if (!identity || (!identity.walletAddress && !identity.privyDid)) {
    return jsonResponse({ error: 'unauthorized', message: 'Authentication required to export financial statements.' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Verify community exists and fetch operating country for timezone normalization
  const { data: community, error: commErr } = await supabase
    .from('communities')
    .select('id, name')
    .eq('id', communityId)
    .maybeSingle();

  if (commErr || !community) {
    return jsonResponse({ error: 'not_found', message: 'Community not found.' }, { status: 404 });
  }

  // Verify membership
  let memberCheck = supabase.from('members').select('role, activation_status').eq('community_id', communityId);
  if (identity.walletAddress) {
    memberCheck = memberCheck.eq('wallet_address', identity.walletAddress);
  } else {
    memberCheck = memberCheck.eq('auth_user_id', identity.privyDid);
  }

  const { data: member } = await memberCheck.maybeSingle();
  if (!member) {
    return jsonResponse({ error: 'forbidden', message: 'Access denied: caller is not a member of this community.' }, { status: 403 });
  }
  if (member.activation_status !== 'active') {
    return jsonResponse({ error: 'forbidden', message: 'Access denied: member account is suspended or inactive.' }, { status: 403 });
  }

  // Normalize date range
  const { startUtc, endUtc } = normalizeStatementDateRange(
    startDateRaw,
    endDateRaw,
    (community as { country?: string }).country || 'KE'
  );

  // Query journal entries
  let query = supabase
    .from('journal_entries')
    .select('*')
    .eq('community_id', communityId)
    .gte('created_at', startUtc)
    .lte('created_at', endUtc)
    .order('created_at', { ascending: true })
    .limit(5000);

  // Bind abortSignal if supported
  if ('abortSignal' in query && typeof (query as { abortSignal: unknown }).abortSignal === 'function') {
    query = (query as { abortSignal: (signal: AbortSignal) => typeof query }).abortSignal(req.signal);
  }

  const { data: entries, error: entriesErr } = await query;
  if (entriesErr) {
    if (req.signal.aborted || entriesErr.name === 'AbortError' || entriesErr.message?.toLowerCase().includes('abort')) {
      return jsonResponse({ error: 'client_closed_request', message: 'Client closed request.' }, { status: 499 });
    }
    return jsonResponse({ error: 'database_error', message: entriesErr.message }, { status: 500 });
  }

  const rows = entries || [];

  // V8 TransformStream Streaming Pipeline
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  void (async () => {
    try {
      if (format === 'csv') {
        await writer.write(encoder.encode('date,reference_id,reference_type,debit_account,credit_account,amount_minor,currency\n'));
      }

      for (const entry of rows) {
        if (req.signal.aborted) break;

        const line = format === 'csv'
          ? `${entry.created_at},"${entry.reference_id}","${entry.reference_type}","${entry.debit_account}","${entry.credit_account}",${entry.amount_minor},${entry.currency || 'KES'}\n`
          : JSON.stringify(entry) + '\n';

        await writer.write(encoder.encode(line));
      }

      if (rows.length === 5000 && format === 'csv' && !req.signal.aborted) {
        await writer.write(encoder.encode('# AUDIT WARNING: Ledger export reached maximum page capacity (5000 rows). Query next page using start_date = cursor.\n'));
      }

      await writer.close().catch(() => {});
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError' || req.signal.aborted) {
        await writer.close().catch(() => {});
        return;
      }
      await writer.abort(err).catch(() => {});
    }
  })();

  const contentType = format === 'csv' ? 'text/csv' : 'application/x-ndjson';
  const hasMore = rows.length === 5000;
  const nextCursor = hasMore ? rows[rows.length - 1]?.created_at : undefined;

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Transfer-Encoding': 'chunked',
    'Content-Disposition': `attachment; filename="statement_${communityId}_${Date.now()}.${format}"`,
    'Cache-Control': 'no-store',
    'x-total-count': String(rows.length),
    'x-has-more-records': String(hasMore),
  };
  if (nextCursor) {
    headers['x-next-cursor'] = nextCursor;
  }

  return new Response(readable, { headers });
}
