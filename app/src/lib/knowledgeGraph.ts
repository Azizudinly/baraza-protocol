import { BARAZA_CHAIN_CONFIGS, type BarazaChainConfig } from '@/lib/chains/config';
import { MOCK_COMMUNITIES, MOCK_DECISIONS, type Community, type Decision } from '@/lib/constants';
import { listBounties, listBountiesAsync, type Bounty } from '@/lib/bounties';
import { reviewBounty, reviewCommunity, reviewProposal, type SecurityReview } from '@/lib/securityReview';
import { getSupabaseClient, listCommunities } from '@/lib/communities';
import { listMembershipsForCommunity, type MembershipRecord } from '@/lib/memberships';
import type { PaymentOrder, PaymentOrderStatus } from '@/lib/payments';

export type KnowledgeNodeType =
  | 'community'
  | 'chain'
  | 'proposal'
  | 'bounty'
  | 'membership'
  | 'payment-order'
  | 'security-review'
  | 'readiness-task'
  | 'capability';

export type KnowledgeEdgeType =
  | 'uses-chain'
  | 'has-proposal'
  | 'has-bounty'
  | 'has-member'
  | 'has-payment'
  | 'has-review'
  | 'needs-task'
  | 'supports-capability'
  | 'settles-on';

export interface KnowledgeNode {
  id: string;
  type: KnowledgeNodeType;
  label: string;
  status?: string;
  summary?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface KnowledgeEdge {
  id: string;
  from: string;
  to: string;
  type: KnowledgeEdgeType;
  label: string;
}

export interface KnowledgeGraph {
  generatedAt: string;
  source: 'supabase' | 'local';
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export interface KnowledgeGraphSummary {
  nodeCount: number;
  edgeCount: number;
  riskCount: number;
  watchCount: number;
  source: 'supabase' | 'local';
  membershipCount: number;
  paymentOrderCount: number;
  comingSoonChains: string[];
  testnetReadyChains: string[];
  topTasks: KnowledgeNode[];
}

interface PaymentOrderRow {
  order_id: string;
  community_id: string;
  status: PaymentOrderStatus;
  amount_expected: number | string;
  amount_received: number | string | null;
  currency: string;
  created_at: string;
  updated_at?: string | null;
  confirmed_at?: string | null;
}

interface MembershipRow {
  community_id: string;
  wallet_address: string | null;
  status: 'active' | 'pending' | 'revoked' | string;
  joined_at: string | null;
}

const READINESS_TASKS: KnowledgeNode[] = [
  {
    id: 'task:vercel-env',
    type: 'readiness-task',
    label: 'Add production Vercel environment variables',
    status: 'blocker',
    summary: 'Use .env.example as the source of truth and add real testnet keys in Vercel.',
  },
  {
    id: 'task:supabase-migrations',
    type: 'readiness-task',
    label: 'Run Supabase production migrations',
    status: 'blocker',
    summary: 'Payment orders, memberships, bounties, and review queues need durable tables.',
  },
  {
    id: 'task:solana-programs',
    type: 'readiness-task',
    label: 'Deploy Solana devnet programs',
    status: 'blocker',
    summary: 'Replace placeholder program IDs with verified devnet deployments.',
  },
  {
    id: 'task:stellar-live-tx',
    type: 'readiness-task',
    label: 'Test live Stellar payment verification',
    status: 'blocker',
    summary: 'Send a real testnet XLM transaction and confirm Horizon verification records the order.',
  },
  {
    id: 'task:stellar-soroban-v2-deploy',
    type: 'readiness-task',
    label: 'Deploy Soroban v2 five-contract workspace to testnet',
    status: 'blocker',
    summary: 'community_registry/governance/membership/payment_attestation/treasury_vault build and pass local tests. CreateCommunity.tsx and the governance hooks (useCreateDecision/useCastVote) now call them via lib/programs/stellarClient.ts when a contract ID is configured, mirroring the Solana chainClient pattern — but every address in stellarAddresses.ts is still NOT_DEPLOYED, so these calls fall back to off-chain-only today. Deploy via contracts/stellar/scripts/deploy.sh, record IDs in contracts/stellar/addresses/testnet-v2.json, then populate the VITE_STELLAR_*_ID env vars.',
  },
  {
    id: 'task:gooddollar-celo',
    type: 'readiness-task',
    label: 'Connect GoodDollar on Celo Alfajores',
    status: 'next',
    summary: 'Add G$ token and identity addresses, then test bounty reward adapter handoff.',
  },
];

function nodeId(type: KnowledgeNodeType, id: string): string {
  return `${type}:${id}`;
}

function reviewStatus(review: SecurityReview): string {
  if (review.level === 'risk') return 'risk';
  if (review.level === 'watch') return 'watch';
  return 'clear';
}

function chainNode(chain: BarazaChainConfig): KnowledgeNode {
  return {
    id: nodeId('chain', chain.id),
    type: 'chain',
    label: chain.label,
    status: chain.status,
    summary: `${chain.testnetName} via ${chain.suggestedWallet}`,
    metadata: {
      testnet: chain.testnetName,
      wallet: chain.suggestedWallet,
      nativeCurrency: chain.nativeCurrency,
      rpcEnvVar: chain.rpcEnvVar,
    },
  };
}

function communityNode(community: Community): KnowledgeNode {
  return {
    id: nodeId('community', community.id),
    type: 'community',
    label: community.name,
    status: community.type,
    summary: community.description,
    metadata: {
      members: community.memberCount,
      treasuryKes: community.fundBalance,
      monthlyDuesKes: community.membershipFee,
      chain: community.chain ?? 'solana',
    },
  };
}

function proposalNode(proposal: Decision): KnowledgeNode {
  return {
    id: nodeId('proposal', proposal.id),
    type: 'proposal',
    label: proposal.title,
    status: proposal.status,
    summary: proposal.description,
    metadata: {
      communityId: proposal.communityId,
      fundingKes: proposal.fundingAmount,
      votesFor: proposal.votesFor,
      votesAgainst: proposal.votesAgainst,
    },
  };
}

function bountyNode(bounty: Bounty): KnowledgeNode {
  return {
    id: nodeId('bounty', bounty.id),
    type: 'bounty',
    label: bounty.title,
    status: bounty.status,
    summary: bounty.summary,
    metadata: {
      communityId: bounty.communityId,
      rewardKes: bounty.rewardKes,
      rewardToken: bounty.rewardToken,
      access: bounty.access,
      deadline: bounty.deadline,
    },
  };
}

function membershipNode(record: MembershipRecord): KnowledgeNode {
  const wallet = record.walletAddress || 'unknown-account';
  return {
    id: nodeId('membership', `${record.communityId}:${wallet}`),
    type: 'membership',
    label: `${record.status} member`,
    status: record.status,
    summary: `Membership record for ${wallet.slice(0, 8)}...`,
    metadata: {
      communityId: record.communityId,
      walletAddress: wallet,
      joinedAt: record.joinedAt,
    },
  };
}

function paymentOrderNode(order: PaymentOrder): KnowledgeNode {
  return {
    id: nodeId('payment-order', order.order_id),
    type: 'payment-order',
    label: order.order_id,
    status: order.status,
    summary: `${order.currency} ${order.amount_received ?? order.amount_expected} for membership activation`,
    metadata: {
      communityId: order.community_id,
      currency: order.currency,
      expected: order.amount_expected,
      received: order.amount_received,
      confirmedAt: order.confirmed_at,
    },
  };
}

function reviewNode(subjectId: string, review: SecurityReview): KnowledgeNode {
  return {
    id: nodeId('security-review', subjectId),
    type: 'security-review',
    label: review.subject,
    status: reviewStatus(review),
    summary: review.summary,
    metadata: {
      score: review.score,
      nextStep: review.nextSteps[0] ?? null,
    },
  };
}

function capabilityNode(capability: string): KnowledgeNode {
  return {
    id: nodeId('capability', capability),
    type: 'capability',
    label: capability.replace('-', ' '),
  };
}

export function buildKnowledgeGraph(input?: {
  communities?: Community[];
  proposals?: Decision[];
  bounties?: Bounty[];
  memberships?: MembershipRecord[];
  paymentOrders?: PaymentOrder[];
  source?: 'supabase' | 'local';
  now?: string;
}): KnowledgeGraph {
  const communities = input?.communities ?? MOCK_COMMUNITIES;
  const proposals = input?.proposals ?? MOCK_DECISIONS;
  const bounties = input?.bounties ?? listBounties();
  const memberships = input?.memberships ?? communities.flatMap((community) => listMembershipsForCommunity(community.id));
  const paymentOrders = input?.paymentOrders ?? [];
  const nodes = new Map<string, KnowledgeNode>();
  const edges: KnowledgeEdge[] = [];

  const addNode = (node: KnowledgeNode) => nodes.set(node.id, node);
  const addEdge = (from: string, to: string, type: KnowledgeEdgeType, label: string) => {
    edges.push({ id: `${from}->${type}->${to}`, from, to, type, label });
  };

  Object.values(BARAZA_CHAIN_CONFIGS).forEach((chain) => {
    const chainId = nodeId('chain', chain.id);
    addNode(chainNode(chain));
    chain.capabilities.forEach((capability) => {
      const capabilityId = nodeId('capability', capability);
      addNode(capabilityNode(capability));
      addEdge(chainId, capabilityId, 'supports-capability', 'supports');
    });
  });

  READINESS_TASKS.forEach(addNode);

  communities.forEach((community) => {
    const communityId = nodeId('community', community.id);
    const chain = community.chain ?? 'solana';
    const chainId = nodeId('chain', chain);
    const review = reviewCommunity(community);
    const reviewId = nodeId('security-review', communityId);

    addNode(communityNode(community));
    addNode(reviewNode(communityId, review));
    addEdge(communityId, chainId, 'uses-chain', 'uses');
    addEdge(communityId, reviewId, 'has-review', 'Akili review');

    if (review.level !== 'pass') addEdge(reviewId, 'task:vercel-env', 'needs-task', 'needs review before launch');
  });

  proposals.forEach((proposal) => {
    const proposalId = nodeId('proposal', proposal.id);
    const communityId = nodeId('community', proposal.communityId);
    const review = reviewProposal(proposal, communities.find((community) => community.id === proposal.communityId));
    const reviewId = nodeId('security-review', proposalId);

    addNode(proposalNode(proposal));
    addNode(reviewNode(proposalId, review));
    addEdge(communityId, proposalId, 'has-proposal', 'proposal');
    addEdge(proposalId, reviewId, 'has-review', 'Akili review');
  });

  bounties.forEach((bounty) => {
    const bountyId = nodeId('bounty', bounty.id);
    const communityId = nodeId('community', bounty.communityId);
    const review = reviewBounty(bounty);
    const reviewId = nodeId('security-review', bountyId);

    addNode(bountyNode(bounty));
    addNode(reviewNode(bountyId, review));
    addEdge(communityId, bountyId, 'has-bounty', 'bounty');
    addEdge(bountyId, reviewId, 'has-review', 'Akili review');

    if (bounty.rewardToken === 'G$') addEdge(bountyId, nodeId('chain', 'celo'), 'settles-on', 'G$ reward');
    if (bounty.rewardToken === 'XLM') addEdge(bountyId, nodeId('chain', 'stellar'), 'settles-on', 'XLM reward');
    if (bounty.rewardToken === 'SOL') addEdge(bountyId, nodeId('chain', 'solana'), 'settles-on', 'SOL reward');
    if (bounty.rewardToken === 'BRZA') addEdge(bountyId, nodeId('chain', 'stellar'), 'settles-on', 'BRZA reward');
  });

  memberships.forEach((membership) => {
    const membershipId = nodeId('membership', `${membership.communityId}:${membership.walletAddress || 'unknown-account'}`);
    const communityId = nodeId('community', membership.communityId);
    addNode(membershipNode(membership));
    addEdge(communityId, membershipId, 'has-member', 'member');
  });

  paymentOrders.forEach((order) => {
    const orderId = nodeId('payment-order', order.order_id);
    const communityId = nodeId('community', order.community_id);
    addNode(paymentOrderNode(order));
    addEdge(communityId, orderId, 'has-payment', 'payment');

    if (order.currency.toUpperCase() === 'XLM') {
      addEdge(orderId, nodeId('chain', 'stellar'), 'settles-on', 'Stellar payment');
    }
  });

  for (const task of READINESS_TASKS) {
    if (task.id.includes('stellar')) addEdge(nodeId('chain', 'stellar'), task.id, 'needs-task', 'needs');
    if (task.id.includes('solana')) addEdge(nodeId('chain', 'solana'), task.id, 'needs-task', 'needs');
    if (task.id.includes('gooddollar')) addEdge(nodeId('chain', 'celo'), task.id, 'needs-task', 'needs');
  }

  return {
    generatedAt: input?.now ?? new Date().toISOString(),
    source: input?.source ?? 'local',
    nodes: Array.from(nodes.values()),
    edges,
  };
}

export function summarizeKnowledgeGraph(graph: KnowledgeGraph): KnowledgeGraphSummary {
  const reviews = graph.nodes.filter((node) => node.type === 'security-review');
  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    riskCount: reviews.filter((node) => node.status === 'risk').length,
    watchCount: reviews.filter((node) => node.status === 'watch').length,
    source: graph.source,
    membershipCount: graph.nodes.filter((node) => node.type === 'membership').length,
    paymentOrderCount: graph.nodes.filter((node) => node.type === 'payment-order').length,
    comingSoonChains: graph.nodes
      .filter((node) => node.type === 'chain' && node.status === 'coming-soon')
      .map((node) => node.label),
    testnetReadyChains: graph.nodes
      .filter((node) => node.type === 'chain' && node.status === 'testnet-ready')
      .map((node) => node.label),
    topTasks: graph.nodes
      .filter((node) => node.type === 'readiness-task')
      .sort((a, b) => String(a.status).localeCompare(String(b.status)))
      .slice(0, 5),
  };
}

function membershipFromRow(row: MembershipRow): MembershipRecord {
  return {
    communityId: row.community_id,
    walletAddress: row.wallet_address ?? 'unknown-account',
    status: row.status === 'active' || row.status === 'pending' || row.status === 'revoked' ? row.status : 'pending',
    joinedAt: row.joined_at ?? new Date().toISOString(),
    brzaBalance: 1,
  };
}

function paymentOrderFromRow(row: PaymentOrderRow): PaymentOrder {
  return {
    order_id: row.order_id,
    community_id: row.community_id,
    membership_tier_id: null,
    status: row.status,
    amount_expected: Number(row.amount_expected),
    amount_received: row.amount_received === null ? null : Number(row.amount_received),
    currency: row.currency,
    confirmed_at: row.confirmed_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
  };
}

export async function buildLiveKnowledgeGraph(): Promise<KnowledgeGraph & { source: 'supabase' | 'local' }> {
  const client = getSupabaseClient();
  if (!client) {
    return buildKnowledgeGraph({ source: 'local' });
  }

  const [communities, bounties, membershipsResult, paymentOrdersResult] = await Promise.all([
    listCommunities(),
    listBountiesAsync(),
    client
      .from('memberships')
      .select('community_id,wallet_address,status,joined_at')
      .limit(500),
    client
      .from('payment_orders')
      .select('order_id,community_id,status,amount_expected,amount_received,currency,confirmed_at,created_at,updated_at')
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  if (membershipsResult.error) throw membershipsResult.error;
  if (paymentOrdersResult.error) throw paymentOrdersResult.error;

  return buildKnowledgeGraph({
    communities,
    bounties,
    memberships: (membershipsResult.data ?? []).map((row) => membershipFromRow(row as MembershipRow)),
    paymentOrders: (paymentOrdersResult.data ?? []).map((row) => paymentOrderFromRow(row as PaymentOrderRow)),
    source: 'supabase',
  });
}

export function knowledgeGraphToMermaid(graph: KnowledgeGraph): string {
  const lines = ['graph TD'];
  graph.nodes.forEach((node) => {
    lines.push(`  ${node.id.replace(/[^a-zA-Z0-9]/g, '_')}["${node.label.replace(/"/g, '\\"')}"]`);
  });
  graph.edges.forEach((edge) => {
    lines.push(
      `  ${edge.from.replace(/[^a-zA-Z0-9]/g, '_')} -->|"${edge.label.replace(/"/g, '\\"')}"| ${edge.to.replace(/[^a-zA-Z0-9]/g, '_')}`,
    );
  });
  return lines.join('\n');
}
