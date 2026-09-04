// app/api/_lib/supabase.ts
// Shared Supabase Client Factory for Serverless API Handlers

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_LOCAL_SERVICE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MjUwMDAwMDAwMH0.YEHFlsDyYXjxJ5oIZyJ6HuS62T6qaal7bGnWI5GxbRs';

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_LOCAL_SERVICE_KEY;
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...(init?.headers ?? {}),
    },
  });
}
