type ChainId = 'solana' | 'stellar';

export type CommunityChainMapping = {
  localId: string;
  chain: ChainId;
  slug: string;
  communityAddress: string;
  createTxSignature?: string;
  createdAt: string;
};

export type DecisionChainMapping = {
  localId: string;
  communityLocalId: string;
  chain: ChainId;
  proposalAddress: string;
  proposalId: number;
  createTxSignature?: string;
  createdAt: string;
};

export type MemberChainMapping = {
  localId: string;
  communityLocalId: string;
  walletAddress: string;
  chain: ChainId;
  memberAddress: string;
  createdAt: string;
};

const COMMUNITY_KEY = 'baraza.chain.community.v1';
const DECISION_KEY = 'baraza.chain.decision.v1';
const MEMBER_KEY = 'baraza.chain.member.v1';

function readMap<T>(key: string): Record<string, T> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap<T>(key: string, values: Record<string, T>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(values));
}

export function saveCommunityChainMapping(mapping: Omit<CommunityChainMapping, 'createdAt'>): CommunityChainMapping {
  const mappings = readMap<CommunityChainMapping>(COMMUNITY_KEY);
  const saved = { ...mapping, createdAt: new Date().toISOString() };
  mappings[mapping.localId] = saved;
  writeMap(COMMUNITY_KEY, mappings);
  return saved;
}

export function getCommunityChainMapping(localId: string): CommunityChainMapping | null {
  return readMap<CommunityChainMapping>(COMMUNITY_KEY)[localId] ?? null;
}

export function saveDecisionChainMapping(mapping: Omit<DecisionChainMapping, 'createdAt'>): DecisionChainMapping {
  const mappings = readMap<DecisionChainMapping>(DECISION_KEY);
  const saved = { ...mapping, createdAt: new Date().toISOString() };
  mappings[mapping.localId] = saved;
  writeMap(DECISION_KEY, mappings);
  return saved;
}

export function getDecisionChainMapping(localId: string): DecisionChainMapping | null {
  return readMap<DecisionChainMapping>(DECISION_KEY)[localId] ?? null;
}

export function saveMemberChainMapping(mapping: Omit<MemberChainMapping, 'createdAt'>): MemberChainMapping {
  const mappings = readMap<MemberChainMapping>(MEMBER_KEY);
  const saved = { ...mapping, createdAt: new Date().toISOString() };
  mappings[mapping.localId] = saved;
  writeMap(MEMBER_KEY, mappings);
  return saved;
}

export function getMemberChainMapping(localId: string): MemberChainMapping | null {
  return readMap<MemberChainMapping>(MEMBER_KEY)[localId] ?? null;
}
