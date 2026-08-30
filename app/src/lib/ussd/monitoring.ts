/**
 * USSD monitoring instrumentation — Seku's filing (2026-06-17).
 *
 * Two responsibilities:
 *
 *   1. logSessionExit() — writes one row per session END so the cohort
 *      "USSD member paid once, never dialled back" becomes queryable. Reuses
 *      the existing HMAC pepper (`PAYMENT_PHONE_HASH_PEPPER`) so the
 *      phone_hash here joins to payment_orders.user_id_hash.
 *
 *   2. sweepInvisibleUssdMembers() — periodic cron sweep. Finds
 *      RECONCILED orders that are ≥30 days old and have no matching USSD
 *      session_exit since confirmation. Writes
 *      `metadata.invisible_member = true` on the order so operators can
 *      pull the cohort and reach out (SMS, ops follow-up).
 *
 * Both functions no-op when Supabase env is not configured — same posture
 * as the rest of the cron stack so dev / test never tries to PATCH.
 */

export type UssdExitReason =
  | 'completed'
  | 'invalid_input'
  | 'welcome_skipped'
  | 'welcome_completed'
  | 'main_menu_routed'
  | 'unknown';

export type UssdWelcomeState = 'none' | 'rendered' | 'completed' | 'skipped';

export interface SessionExitInput {
  sessionId: string;
  phoneNumber: string;
  countryCode?: string;
  serviceCode?: string;
  lastMenuPath?: string;
  resultAction: 'CON' | 'END';
  exitReason: UssdExitReason;
  durationMs?: number;
  welcomeState?: UssdWelcomeState;
}

export async function hashPhoneForLogging(phone: string): Promise<string | null> {
  const pepper = process.env.PAYMENT_PHONE_HASH_PEPPER?.trim();
  if (!pepper) return null;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(phone));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Write one session-exit row. Fire-and-forget — never throws to the caller.
 * Returns the phone_hash used on success, null when no logging occurred.
 */
export async function logSessionExit(input: SessionExitInput): Promise<string | null> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  const phoneHash = await hashPhoneForLogging(input.phoneNumber);
  if (!phoneHash) {
    // No pepper configured — record without a hash would be useless and
    // potentially expose phone via session_id correlation. Skip entirely.
    return null;
  }

  const row = {
    session_id: input.sessionId,
    phone_hash: phoneHash,
    country_code: input.countryCode ?? null,
    service_code: input.serviceCode ?? null,
    last_menu_path: input.lastMenuPath ?? null,
    result_action: input.resultAction,
    exit_reason: input.exitReason,
    duration_ms: input.durationMs ?? null,
    welcome_state: input.welcomeState ?? null,
  };

  try {
    await fetch(`${url}/rest/v1/ussd_session_exits`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'content-type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    });
    return phoneHash;
  } catch (err) {
    console.warn('[ussd-monitoring] logSessionExit failed', input.sessionId, err);
    return null;
  }
}

/**
 * Decide whether a result + welcome trail constitutes a worth-logging exit.
 * Used by the USSD API handler so we don't write a row for every keypress
 * (only the END terminations and welcome skips).
 */
export function classifyExit(args: {
  resultAction: 'CON' | 'END';
  resultText: string;
  welcomeWasPending: boolean;
  welcomeIsPendingAfter: boolean;
  smsFallbackQueued: boolean;
}): { exitReason: UssdExitReason; welcomeState: UssdWelcomeState } {
  const welcomeState: UssdWelcomeState = !args.welcomeWasPending
    ? 'none'
    : args.smsFallbackQueued
      ? 'skipped'
      : !args.welcomeIsPendingAfter
        ? 'completed'
        : 'rendered';

  if (args.resultAction === 'CON') {
    return { exitReason: 'unknown', welcomeState };
  }

  if (welcomeState === 'completed') return { exitReason: 'welcome_completed', welcomeState };
  if (welcomeState === 'skipped') return { exitReason: 'welcome_skipped', welcomeState };
  if (args.resultText.toLowerCase().includes('invalid')) {
    return { exitReason: 'invalid_input', welcomeState };
  }
  if (args.resultText.includes('Returning to Baraza menu')) {
    return { exitReason: 'main_menu_routed', welcomeState };
  }
  return { exitReason: 'completed', welcomeState };
}

interface InvisibleSweepResult {
  scanned: number;
  flagged: number;
}

/**
 * Cohort sweep. Finds RECONCILED USSD orders older than `staleDays` with no
 * USSD session_exit since confirmation, and flags
 * `metadata.invisible_member = true`. Returns counts for cron logging.
 *
 * Safe to re-run — already-flagged orders are filtered out.
 */
export async function sweepInvisibleUssdMembers(
  staleDays: number = 30,
): Promise<InvisibleSweepResult> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return { scanned: 0, flagged: 0 };

  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000).toISOString();
  const env =
    process.env.NODE_ENV === 'production' || process.env.CF_PAGES === '1' || process.env.VERCEL_ENV === 'production'
      ? 'production'
      : 'sandbox';

  // Pull candidate RECONCILED orders that haven't been flagged yet. Scope
  // to the same provider_environment as the rest of the promoter so the
  // sweep stays consistent across environments.
  const params = new URLSearchParams({
    status: 'eq.RECONCILED',
    provider_environment: `eq.${env}`,
    confirmed_at: `lt.${cutoff}`,
    'metadata->>source': 'eq.ussd',
    'not.metadata->>invisible_member': 'is.true',
    select: 'order_id,user_id_hash,confirmed_at',
    limit: '100',
  }).toString();

  let candidates: Array<{ order_id: string; user_id_hash: string | null; confirmed_at: string }>;
  try {
    const res = await fetch(`${url}/rest/v1/payment_orders?${params}`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!res.ok) return { scanned: 0, flagged: 0 };
    candidates = (await res.json().catch(() => [])) as typeof candidates;
  } catch {
    return { scanned: 0, flagged: 0 };
  }

  let flagged = 0;

  for (const c of candidates) {
    if (!c.user_id_hash) continue;

    // Look for any session_exit AFTER confirmation for this phone_hash.
    const seParams = new URLSearchParams({
      phone_hash: `eq.${c.user_id_hash}`,
      exited_at: `gt.${c.confirmed_at}`,
      select: 'id',
      limit: '1',
    }).toString();
    try {
      const seRes = await fetch(`${url}/rest/v1/ussd_session_exits?${seParams}`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      if (!seRes.ok) continue;
      const seRows = (await seRes.json().catch(() => [])) as unknown[];
      if (seRows.length > 0) continue; // member has dialled back — not invisible

      await fetch(
        `${url}/rest/v1/payment_orders?order_id=eq.${encodeURIComponent(c.order_id)}`,
        {
          method: 'PATCH',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            metadata: { invisible_member: true, invisible_flagged_at: new Date().toISOString() },
          }),
        },
      );
      flagged += 1;
    } catch {
      // ignore, continue sweep
    }
  }

  return { scanned: candidates.length, flagged };
}
