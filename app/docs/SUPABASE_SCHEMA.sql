-- Baraza MVP off-chain community records.
-- Run in Supabase SQL editor when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured.

create extension if not exists pgcrypto;

create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  description text not null,
  membership_fee integer not null default 0,
  member_count integer not null default 0,
  fund_balance integer not null default 0,
  active_decisions integer not null default 0,
  image text,
  created_at timestamptz not null default now()
);

alter table public.communities enable row level security;

drop policy if exists "Communities are publicly readable" on public.communities;
create policy "Communities are publicly readable"
  on public.communities for select
  using (true);

drop policy if exists "Prototype can create communities" on public.communities;
create policy "Prototype can create communities"
  on public.communities for insert
  with check (true);
