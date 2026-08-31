import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_GOVERNANCE, type Community, MOCK_COMMUNITIES } from '@/lib/constants';
import type { Chain } from '@/lib/chain';

type TreasuryPolicy = 'multisig-ready' | 'proposal-only' | 'manual-review';

export type CommunityInsert = {
  name: string;
  type: string;
  description: string;
  membershipFee: number;
  activationFeeMinor?: number;
  feeType?: 'one_time' | 'recurring_monthly' | 'free';
  carrierPassThrough?: boolean;
  currency?: string;
  chain?: Chain;
  quorumPct?: number;
  approvalThresholdPct?: number;
  votingPeriodDays?: number;
  treasuryPolicy?: TreasuryPolicy;
  paybillNumber?: string;
  ussdShortcode?: string;
  createdBy?: string;
  walletProofHeaders?: Record<string, string>;
};

export type CommunityRow = {
  id: string;
  name: string;
  type: string;
  description: string;
  membership_fee?: number | null;
  membershipFee?: number | null;
  activation_fee_minor?: number | null;
  activationFeeMinor?: number | null;
  fee_type?: string | null;
  feeType?: string | null;
  carrier_pass_through?: boolean | null;
  carrierPassThrough?: boolean | null;
  currency?: string | null;
  member_count?: number | null;
  memberCount?: number | null;
  fund_balance?: number | null;
  fundBalance?: number | null;
  active_decisions?: number | null;
  activeDecisions?: number | null;
  created_at?: string | null;
  createdAt?: string | null;
  image?: string | null;
  chain?: string | null;
  quorum_pct?: number | null;
  quorumPct?: number | null;
  approval_threshold_pct?: number | null;
  approvalThresholdPct?: number | null;
  voting_period_days?: number | null;
  votingPeriodDays?: number | null;
  treasury_policy?: string | null;
  treasuryPolicy?: string | null;
  paybill_number?: string | null;
  paybillNumber?: string | null;
  ussd_shortcode?: string | null;
  ussdShortcode?: string | null;
  created_by?: string | null;
  createdBy?: string | null;
};

const VALID_TREASURY_POLICIES: TreasuryPolicy[] = ['multisig-ready', 'proposal-only', 'manual-review'];

function parseTreasuryPolicy(raw: string | null | undefined): TreasuryPolicy {
  return VALID_TREASURY_POLICIES.includes(raw as TreasuryPolicy)
    ? (raw as TreasuryPolicy)
    : DEFAULT_GOVERNANCE.treasuryPolicy;
}

const LOCAL_STORAGE_KEY = 'baraza.communities.v1';

let supabase: SupabaseClient | null | undefined;

/**
 * Returns the configured Supabase client, or null when the env vars are not set.
 * Lazy + cached — the client is created on first call and reused.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (supabase !== undefined) return supabase;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  supabase = url && anonKey ? createClient(url, anonKey) : null;
  return supabase;
}

function getSupabase(): SupabaseClient | null {
  return getSupabaseClient();
}

/**
 * Whether Supabase is wired via `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
 * When false, the app uses localStorage + mock data; when true, communities
 * persist across sessions and devices via Postgres.
 */
export function isSupabaseConfigured(): boolean {
  return getSupabase() !== null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'BR';
}

// Chains a community can live on — `Chain` minus 'mpesa' (a payment rail, not a chain).
type CommunityChain = NonNullable<Community['chain']>;

const VALID_CHAINS: readonly CommunityChain[] = [
  'solana',
  'stellar',
  'ethereum',
  'base',
  'arbitrum',
  'optimism',
  'polygon',
  'bnb',
  'celo',
  'xdc',
];

function parseChain(raw: string | null | undefined): CommunityChain {
  return VALID_CHAINS.includes(raw as CommunityChain) ? (raw as CommunityChain) : 'solana';
}

function communityFromRow(row: CommunityRow): Community {
  const chain = parseChain(row.chain);
  const feeMinor = row.activation_fee_minor ?? row.activationFeeMinor;
  const resolvedFee = feeMinor !== undefined && feeMinor !== null
    ? feeMinor / 100
    : (row.membership_fee ?? row.membershipFee ?? 0);

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description,
    membershipFee: resolvedFee,
    memberCount: row.member_count ?? row.memberCount ?? 0,
    fundBalance: row.fund_balance ?? row.fundBalance ?? 0,
    activeDecisions: row.active_decisions ?? row.activeDecisions ?? 0,
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    image: row.image ?? initials(row.name),
    chain,
    quorumPct: row.quorum_pct ?? row.quorumPct ?? DEFAULT_GOVERNANCE.quorumPct,
    approvalThresholdPct:
      row.approval_threshold_pct ?? row.approvalThresholdPct ?? DEFAULT_GOVERNANCE.approvalThresholdPct,
    votingPeriodDays:
      row.voting_period_days ?? row.votingPeriodDays ?? DEFAULT_GOVERNANCE.votingPeriodDays,
    treasuryPolicy: parseTreasuryPolicy(row.treasury_policy ?? row.treasuryPolicy ?? null),
    paybillNumber: row.paybill_number ?? row.paybillNumber ?? undefined,
    ussdShortcode: row.ussd_shortcode ?? row.ussdShortcode ?? undefined,
    createdBy: row.created_by ?? row.createdBy ?? undefined,
  };
}

function readLocalCommunities(): Community[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(communityFromRow) : [];
  } catch {
    return [];
  }
}

function writeLocalCommunities(communities: Community[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(communities));
}

function sortByDate(communities: Community[]): Community[] {
  return [...communities].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// In dev/localStorage mode mock data seeds the UI; in Supabase mode real data stands alone.
function mergeWithMocks(communities: Community[]): Community[] {
  const byId = new Map<string, Community>();
  [...MOCK_COMMUNITIES, ...communities].forEach((c) => byId.set(c.id, c));
  return sortByDate(Array.from(byId.values()));
}

export async function listCommunities(): Promise<Community[]> {
  const client = getSupabase();
  if (!client) return mergeWithMocks(readLocalCommunities());

  const { data, error } = await client
    .from('communities')
    .select(
      'id,name,type,description,membership_fee,activation_fee_minor,fee_type,carrier_pass_through,currency,member_count,fund_balance,active_decisions,created_at,image,chain,quorum_pct,approval_threshold_pct,voting_period_days,treasury_policy,paybill_number,ussd_shortcode,created_by',
    )
    .order('created_at', { ascending: false });

  if (error) throw error;
  return sortByDate((data ?? []).map(communityFromRow));
}

export async function getCommunity(id: string): Promise<Community | null> {
  const client = getSupabase();
  if (!client) {
    return mergeWithMocks(readLocalCommunities()).find((community) => community.id === id) ?? null;
  }

  const { data, error } = await client
    .from('communities')
    .select(
      'id,name,type,description,membership_fee,activation_fee_minor,fee_type,carrier_pass_through,currency,member_count,fund_balance,active_decisions,created_at,image,chain,quorum_pct,approval_threshold_pct,voting_period_days,treasury_policy,paybill_number,ussd_shortcode,created_by',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (data) return communityFromRow(data);
  return MOCK_COMMUNITIES.find((community) => community.id === id) ?? null;
}

export async function createCommunityRecord(input: CommunityInsert): Promise<Community> {
  const now = new Date().toISOString();
  const chain: CommunityChain = parseChain(input.chain);
  const quorumPct = input.quorumPct ?? DEFAULT_GOVERNANCE.quorumPct;
  const approvalThresholdPct = input.approvalThresholdPct ?? DEFAULT_GOVERNANCE.approvalThresholdPct;
  const votingPeriodDays = input.votingPeriodDays ?? DEFAULT_GOVERNANCE.votingPeriodDays;
  const treasuryPolicy = input.treasuryPolicy ?? DEFAULT_GOVERNANCE.treasuryPolicy;

  const activationFeeMinor = input.activationFeeMinor !== undefined
    ? input.activationFeeMinor
    : Math.round(input.membershipFee * 100);

  const localCommunity: Community = {
    id: `community-${Date.now()}`,
    name: input.name.trim(),
    type: input.type,
    description: input.description.trim(),
    membershipFee: input.membershipFee,
    memberCount: 0,
    fundBalance: 0,
    activeDecisions: 0,
    createdAt: now,
    image: initials(input.name),
    chain,
    quorumPct,
    approvalThresholdPct,
    votingPeriodDays,
    treasuryPolicy,
    paybillNumber: input.paybillNumber || undefined,
    ussdShortcode: input.ussdShortcode || undefined,
    createdBy: input.createdBy || undefined,
  };

  try {
    const res = await fetch('/api/communities', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(input.walletProofHeaders ?? {}) },
      body: JSON.stringify({
        name: input.name,
        type: input.type,
        description: input.description,
        membershipFee: input.membershipFee,
        activationFeeMinor,
        feeType: input.feeType || (input.membershipFee === 0 ? 'free' : 'one_time'),
        carrierPassThrough: input.carrierPassThrough ?? true,
        currency: input.currency || 'KES',
        chain,
        quorumPct,
        approvalThresholdPct,
        votingPeriodDays,
        treasuryPolicy,
        paybillNumber: input.paybillNumber,
        ussdShortcode: input.ussdShortcode,
        createdBy: input.createdBy,
      }),
    });

    if (res.ok) {
      const payload = await res.json() as { persisted: boolean; community?: CommunityRow };
      if (payload.persisted && payload.community) {
        return communityFromRow(payload.community);
      }
    }
  } catch {
    // Network/CORS/local-dev fallback — fall through to localStorage
  }

  const communities = readLocalCommunities();
  writeLocalCommunities([localCommunity, ...communities]);
  return localCommunity;
}
