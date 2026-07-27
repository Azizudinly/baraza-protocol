-- 027_gated_bounty_claims.sql
--
-- Draft only. Do not apply until reviewed.
-- Adds the gated claim queue for the public GitHub bounty listings introduced
-- by 024_github_bounties_mirror.sql.
--
-- Prerequisite: public.is_admin(uuid) from the separately reviewed bounty
-- admin RLS migration must already exist in the target database. This
-- migration deliberately does not recreate the admin-role infrastructure.

do $$
begin
  if to_regprocedure('public.is_admin(uuid)') is null then
    raise exception
      'Migration 027 requires public.is_admin(uuid) from the bounty admin RLS migration';
  end if;
end
$$;

-- Decouple the Baraza bounty identifier from the optional GitHub issue. The
-- existing rows receive stable UUIDs before the new primary key is installed.
alter table public.bounties
  add column if not exists bounty_id uuid default gen_random_uuid();

update public.bounties
set bounty_id = gen_random_uuid()
where bounty_id is null;

alter table public.bounties
  alter column bounty_id set default gen_random_uuid(),
  alter column bounty_id set not null;

alter table public.bounties
  drop constraint if exists bounties_pkey,
  drop constraint if exists bounties_issue_number_unique;

alter table public.bounties
  rename column issue_number to github_issue_number;

alter table public.bounties
  alter column github_issue_number drop not null,
  alter column html_url drop not null,
  add constraint bounties_pkey primary key (bounty_id);

drop index if exists public.bounties_issue_number_unique;

create unique index if not exists bounties_github_issue_number_unique
  on public.bounties (github_issue_number)
  where github_issue_number is not null;

alter table public.bounties
  drop constraint if exists bounties_html_url_check;

alter table public.bounties
  add constraint bounties_html_url_check
  check (
    html_url is null
    or html_url ~ '^https://github\.com/[^/]+/[^/]+/issues/[0-9]+$'
  ),
  add constraint bounties_github_issue_fields_check
  check (
    (github_issue_number is null and html_url is null)
    or
    (github_issue_number is not null and html_url is not null)
  );

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  bounty_id uuid not null references public.bounties(bounty_id),
  claimant_privy_id text not null,
  claimant_display_name text not null,
  status text not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  github_issue_number integer,
  notes text,

  constraint claims_claimant_privy_id_not_blank
    check (length(btrim(claimant_privy_id)) > 0),
  constraint claims_claimant_display_name_not_blank
    check (length(btrim(claimant_display_name)) > 0),
  constraint claims_status_check
    check (status in ('pending', 'approved', 'rejected')),
  constraint claims_review_fields_check
    check (
      (status = 'pending' and reviewed_at is null and reviewed_by is null)
      or
      (status in ('approved', 'rejected') and reviewed_at is not null and reviewed_by is not null)
    ),
  constraint claims_github_issue_approval_check
    check (github_issue_number is null or status = 'approved'),
  constraint claims_github_issue_number_positive
    check (github_issue_number is null or github_issue_number > 0)
);

create index if not exists claims_claimant_privy_id_submitted_at_idx
  on public.claims (claimant_privy_id, submitted_at desc);

create index if not exists claims_status_submitted_at_idx
  on public.claims (status, submitted_at asc);

-- Database-level concurrency gate: at most one pending or approved claim can
-- exist for a bounty. Rejected claims remain as history and do not block a new
-- claim.
create unique index if not exists claims_one_open_per_bounty_idx
  on public.claims (bounty_id)
  where status in ('pending', 'approved');

alter table public.claims enable row level security;

-- Privy sessions are verified by the server claim endpoint. Browser clients
-- never receive claim-table write privileges, and the server always derives
-- claimant_privy_id from a cryptographically verified Privy access token.
revoke all on public.claims from anon;
revoke all on public.claims from authenticated;
grant all on public.claims to service_role;
