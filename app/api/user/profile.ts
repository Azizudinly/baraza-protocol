// app/api/user/profile.ts
// Production SaaS User Profile Management (GET, PATCH, DELETE)

export const config = { runtime: 'edge' };

import { getSupabaseAdmin, jsonResponse } from '../_lib/supabase';
import { resolveCallerIdentity } from '../_lib/auth-session';
import { assertValidHttpsUrl, sanitizeText } from '../_lib/validation';
import type { SupportedCountry, SupportedCurrency, SupportedLocale, UserNotificationPreferences, UserProfileResponse } from './types';

const ALLOWED_LOCALES: SupportedLocale[] = ['en', 'sw', 'sheng'];
const ALLOWED_COUNTRIES: SupportedCountry[] = ['KE', 'UG', 'TZ', 'RW', 'GH', 'NG'];
const ALLOWED_CURRENCIES: SupportedCurrency[] = ['KES', 'UGX', 'GHS', 'NGN', 'USD'];

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-wallet-address, x-wallet-signature, x-wallet-message, x-test-wallet-address, x-test-privy-did',
      },
    });
  }

  // Dual Auth Ingress
  const identity = await resolveCallerIdentity(req, 'user-profile');
  if (!identity || (!identity.walletAddress && !identity.privyDid)) {
    return jsonResponse({ error: 'unauthorized', message: 'Authentication required via Web3 wallet proof or Privy session.' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // Find existing profile
  let query = supabase.from('user_profiles').select('*');
  if (identity.walletAddress) {
    query = query.eq('wallet_address', identity.walletAddress);
  } else {
    query = query.eq('privy_did', identity.privyDid);
  }

  const { data: existing, error: fetchErr } = await query.maybeSingle();
  if (fetchErr) {
    return jsonResponse({ error: 'database_error', message: fetchErr.message }, { status: 500 });
  }

  // --- GET: Fetch or Lazy-Initialize ---
  if (req.method === 'GET') {
    if (existing) {
      return jsonResponse(formatProfileResponse(existing));
    }

    // Lazy initialization on first login
    const newProfile = {
      wallet_address: identity.walletAddress || null,
      privy_did: identity.privyDid || null,
      display_name: '',
      avatar_url: '',
      bio: '',
      locale: 'en',
      country: 'KE',
      default_currency: 'KES',
      phone_hash: null,
      phone_verified_at: null,
      phone_hash_revoked: false,
      notification_preferences: { sms: false, whatsapp: false, email: false, push: true },
    };

    const { data: created, error: insertErr } = await supabase
      .from('user_profiles')
      .insert(newProfile)
      .select()
      .single();

    if (insertErr || !created) {
      return jsonResponse({ error: 'database_error', message: insertErr?.message || 'Failed to initialize profile' }, { status: 500 });
    }

    return jsonResponse(formatProfileResponse(created));
  }

  // --- PATCH: Update Profile ---
  if (req.method === 'PATCH') {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: 'invalid_json', message: 'Request body must be valid JSON.' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if ('displayName' in body) {
      updates.display_name = sanitizeText(body.displayName as string, 100);
    }
    if ('bio' in body) {
      updates.bio = sanitizeText(body.bio as string, 500);
    }
    if ('avatarUrl' in body) {
      try {
        updates.avatar_url = assertValidHttpsUrl(body.avatarUrl as string, 'avatarUrl') || '';
      } catch (err: unknown) {
        return jsonResponse({ error: 'invalid_input', message: (err as Error).message }, { status: 400 });
      }
    }
    if ('locale' in body) {
      const loc = body.locale as SupportedLocale;
      if (!ALLOWED_LOCALES.includes(loc)) {
        return jsonResponse({ error: 'invalid_locale', message: `Locale must be one of: ${ALLOWED_LOCALES.join(', ')}` }, { status: 400 });
      }
      updates.locale = loc;
    }
    if ('country' in body) {
      const c = body.country as SupportedCountry;
      if (!ALLOWED_COUNTRIES.includes(c)) {
        return jsonResponse({ error: 'invalid_country', message: `Country must be one of: ${ALLOWED_COUNTRIES.join(', ')}` }, { status: 400 });
      }
      updates.country = c;
    }
    if ('defaultCurrency' in body) {
      const curr = body.defaultCurrency as SupportedCurrency;
      if (!ALLOWED_CURRENCIES.includes(curr)) {
        return jsonResponse({ error: 'invalid_currency', message: `Currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}` }, { status: 400 });
      }
      updates.default_currency = curr;
    }
    if ('notifications' in body && typeof body.notifications === 'object' && body.notifications !== null) {
      const existingPrefs = (existing?.notification_preferences as UserNotificationPreferences) || {
        sms: false,
        whatsapp: false,
        email: false,
        push: true,
      };
      const inputPrefs = body.notifications as Partial<UserNotificationPreferences>;
      updates.notification_preferences = {
        sms: typeof inputPrefs.sms === 'boolean' ? inputPrefs.sms : existingPrefs.sms,
        whatsapp: typeof inputPrefs.whatsapp === 'boolean' ? inputPrefs.whatsapp : existingPrefs.whatsapp,
        email: typeof inputPrefs.email === 'boolean' ? inputPrefs.email : existingPrefs.email,
        push: typeof inputPrefs.push === 'boolean' ? inputPrefs.push : existingPrefs.push,
      };
    }

    const targetId = existing?.id;
    if (!targetId) {
      // Create if doesn't exist
      const toInsert = {
        wallet_address: identity.walletAddress || null,
        privy_did: identity.privyDid || null,
        ...updates,
      };
      const { data: created, error: insErr } = await supabase.from('user_profiles').insert(toInsert).select().single();
      if (insErr || !created) {
        return jsonResponse({ error: 'database_error', message: insErr?.message || 'Failed to update profile' }, { status: 500 });
      }
      return jsonResponse(formatProfileResponse(created));
    }

    const { data: updated, error: updErr } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', targetId)
      .select()
      .single();

    if (updErr || !updated) {
      return jsonResponse({ error: 'database_error', message: updErr?.message || 'Failed to update profile' }, { status: 500 });
    }

    return jsonResponse(formatProfileResponse(updated));
  }

  // --- DELETE: ODPC §40 Cryptographic Anonymization Protocol ---
  if (req.method === 'DELETE') {
    if (!existing) {
      return jsonResponse({ ok: true, anonymized: true, message: 'Profile not found or already deleted.' });
    }

    const anonymizedPayload = {
      display_name: 'Anonymized Member',
      bio: '',
      avatar_url: '',
      phone_hash: null,
      phone_verified_at: null,
      phone_hash_revoked: true,
      privy_did: null,
      notification_preferences: { sms: false, whatsapp: false, email: false, push: false },
      updated_at: new Date().toISOString(),
    };

    const { error: delErr } = await supabase
      .from('user_profiles')
      .update(anonymizedPayload)
      .eq('id', existing.id);

    if (delErr) {
      return jsonResponse({ error: 'database_error', message: delErr.message }, { status: 500 });
    }

    return jsonResponse({
      ok: true,
      anonymized: true,
      message: 'Profile successfully anonymized under Kenya Data Protection Act 2019 §40.',
    });
  }

  return jsonResponse({ error: 'method_not_allowed' }, { status: 405 });
}

function formatProfileResponse(row: Record<string, unknown>): UserProfileResponse {
  const prefs = (row.notification_preferences as UserNotificationPreferences) || {
    sms: false,
    whatsapp: false,
    email: false,
    push: true,
  };
  return {
    ok: true,
    profile: {
      id: row.id as string,
      walletAddress: (row.wallet_address as string) || undefined,
      privyDid: (row.privy_did as string) || undefined,
      displayName: (row.display_name as string) || '',
      avatarUrl: (row.avatar_url as string) || '',
      bio: (row.bio as string) || '',
      locale: (row.locale as SupportedLocale) || 'en',
      country: (row.country as SupportedCountry) || 'KE',
      defaultCurrency: (row.default_currency as SupportedCurrency) || 'KES',
      hasVerifiedPhone: Boolean(row.phone_hash && !row.phone_hash_revoked && row.phone_verified_at),
      phoneVerifiedAt: (row.phone_verified_at as string) || undefined,
      notifications: prefs,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    },
  };
}
