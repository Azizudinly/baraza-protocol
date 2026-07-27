export interface Community {
  id: string;
  name: string;
  type: string;
  description: string;
  membershipFee: number;
  memberCount: number;
  fundBalance: number;
  activeDecisions: number;
  createdAt: string;
  image: string;
  chain?:
    | 'solana'
    | 'stellar'
    | 'ethereum'
    | 'base'
    | 'arbitrum'
    | 'optimism'
    | 'polygon'
    | 'bnb'
    | 'celo'
    | 'xdc';
  quorumPct?: number;
  approvalThresholdPct?: number;
  votingPeriodDays?: number;
  treasuryPolicy?: 'multisig-ready' | 'proposal-only' | 'manual-review';
  paybillNumber?: string;
  ussdShortcode?: string;
  /**
   * Wallet address of the founder. Used by the Founder badge to verify
   * authorship. Optional because legacy rows and mock seeds may not carry it.
   */
  createdBy?: string;
}

export const DEFAULT_GOVERNANCE = {
  quorumPct: 51,
  approvalThresholdPct: 66,
  votingPeriodDays: 7,
  treasuryPolicy: 'multisig-ready' as const,
};

/**
 * One-time onboarding fee charged to the founding admin when creating a
 * Community DAO. Covers account setup, metadata pinning, and the operational
 * cost of the off-chain registry.
 */
export const DAO_CREATION_FEE_KES = 6500;
export const DAO_CREATION_FEE_USD = 50;

/** Premium add-on: registered M-Pesa Paybill number for member dues. */
export const PAYBILL_ADDON_FEE_KES = 2000;

/** Premium add-on: USSD shortcode for feature-phone member access. */
export const USSD_ADDON_FEE_KES = 3000;

/**
 * Mirrors the on-chain `ProposalStatus` enum in
 * `programs/governance/src/lib.rs`. UI surfaces these as lifecycle pills.
 */
export type ProposalLifecycleStage =
  | 'pending'
  | 'active'
  | 'defeated'
  | 'succeeded'
  | 'queued'
  | 'executed'
  | 'expired'
  | 'canceled'
  | 'vetoed';

export interface Decision {
  id: string;
  communityId: string;
  title: string;
  description: string;
  fundingAmount: number;
  proposedBy: string;
  votesFor: number;
  votesAgainst: number;
  totalMembers: number;
  status: 'active' | 'completed' | 'failed';
  /**
   * Optional. When the governance program is wired, this is the authoritative
   * on-chain stage. When absent, the UI infers a stage from `status`.
   */
  lifecycleStage?: ProposalLifecycleStage;
  createdAt: string;
  endsAt: string;
}

export const MOCK_COMMUNITIES: Community[] = [
  { id: '1', name: 'Kibera Youth Collective', type: 'savings', description: "A savings group for young entrepreneurs in Kibera. We pool resources monthly and support each other's business ventures.", membershipFee: 500, memberCount: 47, fundBalance: 234500, activeDecisions: 3, createdAt: '2024-11-15', image: 'KY', chain: 'solana' },
  { id: '2', name: 'Mama Mboga Association', type: 'cooperative', description: 'Market vendors cooperative for bulk purchasing, shared transport, and collective bargaining.', membershipFee: 200, memberCount: 123, fundBalance: 567800, activeDecisions: 5, createdAt: '2024-08-22', image: 'MM', chain: 'solana' },
  { id: '3', name: 'TechBridge Nairobi', type: 'professional', description: 'Professional network for tech workers. Monthly meetups, skills sharing, and emergency support fund.', membershipFee: 1000, memberCount: 89, fundBalance: 890000, activeDecisions: 2, createdAt: '2024-06-10', image: 'TB', chain: 'solana' },
  { id: '4', name: 'Mwanzo Housing Sacco', type: 'housing', description: 'Community housing initiative. Members contribute towards land purchase and affordable housing construction.', membershipFee: 2000, memberCount: 34, fundBalance: 1450000, activeDecisions: 1, createdAt: '2024-09-01', image: 'MH', chain: 'solana' },
];

export const MOCK_DECISIONS: Decision[] = [
  { id: '1', communityId: '1', title: 'Purchase Shared Boda-Boda', description: 'Proposal to purchase 2 motorcycles for shared use by members who need transport for their businesses. Each member can book time slots.', fundingAmount: 85000, proposedBy: 'Amani K.', votesFor: 32, votesAgainst: 8, totalMembers: 47, status: 'active', createdAt: '2025-05-01', endsAt: '2026-08-15' },
  { id: '2', communityId: '1', title: 'Emergency Fund for Members', description: 'Set aside KES 50,000 from the community fund as an emergency medical fund that members can access interest-free.', fundingAmount: 50000, proposedBy: 'Wanjiku M.', votesFor: 41, votesAgainst: 3, totalMembers: 47, status: 'active', createdAt: '2025-04-28', endsAt: '2026-08-12' },
  { id: '3', communityId: '1', title: 'Skill Training Workshop', description: 'Organize a 3-day financial literacy and digital skills workshop covering digital payments, budgeting, and mobile money tools.', fundingAmount: 30000, proposedBy: 'Ochieng D.', votesFor: 28, votesAgainst: 12, totalMembers: 47, status: 'completed', createdAt: '2025-03-10', endsAt: '2025-04-01' },
  { id: '4', communityId: '2', title: 'Bulk Purchase: Tomatoes & Onions', description: 'Negotiate bulk pricing with suppliers in Wakulima Market. Estimated 30% savings on procurement costs for all members.', fundingAmount: 120000, proposedBy: 'Aisha O.', votesFor: 98, votesAgainst: 15, totalMembers: 123, status: 'active', createdAt: '2025-05-03', endsAt: '2026-08-20' },
  { id: '5', communityId: '3', title: 'Hackathon Sponsorship', description: 'Sponsor 5 members to attend NairobiHacks 2025 with accommodation and entry fees covered by community fund.', fundingAmount: 75000, proposedBy: 'Kelvin N.', votesFor: 67, votesAgainst: 10, totalMembers: 89, status: 'active', createdAt: '2025-04-20', endsAt: '2026-08-10' },
];

// Canonical community type list — this is the single source of truth for every
// value the `communities.type` column can hold. It must stay a superset of:
//   - GOVERNANCE_PRESETS keys (app/src/pages/CreateCommunity.tsx)
//   - CommunityType in packages/coop-templates/src/index.ts
//   - communities_type_chk in supabase/migrations/026_leverage_foundation.sql
// 23 original entries — source: Notion product spec 2026-06-08.
// 'chama', 'housing', 'organization', 'government' added to close drift
// against GOVERNANCE_PRESETS, coop-templates, and the DB constraint's default.
export const COMMUNITY_TYPES = [
  { value: 'chama',             label: 'Chama' },
  { value: 'savings',           label: 'Savings Group (Chama)' },
  { value: 'stokvel',           label: 'Stokvel' },
  { value: 'sacco',             label: 'SACCO' },
  { value: 'dao',               label: 'DAO' },
  { value: 'cooperative',       label: 'Cooperative' },
  { value: 'professional',      label: 'Professional Network' },
  { value: 'investment',        label: 'Investment Club' },
  { value: 'rosca',             label: 'ROSCA (Rotating Savings)' },
  { value: 'asca',              label: 'ASCA / VSLA' },
  { value: 'union',             label: 'Union' },
  { value: 'ngo',               label: 'NGO' },
  { value: 'alumni',            label: 'Alumni Group' },
  { value: 'religious',         label: 'Religious Community' },
  { value: 'sports',            label: 'Sports Club' },
  { value: 'homeowners',        label: 'Homeowners Association' },
  { value: 'burial',            label: 'Burial Society' },
  { value: 'tribe',             label: 'Tribe / Clan Group' },
  { value: 'welfare',           label: 'Welfare Group' },
  { value: 'pta',               label: 'Parent–Teacher Association' },
  { value: 'youth',             label: 'Youth Group' },
  { value: 'political',         label: 'Political Caucus' },
  { value: 'supply_chain',      label: 'Supply Chain Cooperative' },
  { value: 'study',             label: 'Study Circle' },
  { value: 'housing',           label: 'Housing SACCO' },
  { value: 'organization',      label: 'Organization' },
  { value: 'government',        label: 'Government / Public Body' },
] as const;

export type CommunityType = (typeof COMMUNITY_TYPES)[number]['value'];

const COMMUNITY_TYPE_VALUE_SET = new Set<string>(COMMUNITY_TYPES.map((t) => t.value));

export function isCommunityType(value: string): value is CommunityType {
  return COMMUNITY_TYPE_VALUE_SET.has(value);
}
