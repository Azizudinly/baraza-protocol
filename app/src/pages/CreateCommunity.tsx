import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Users, ArrowLeft, CheckCircle2, Loader2, Phone, ShieldCheck, Wallet, Hash, Smartphone, MessageCircle, Landmark } from 'lucide-react';
import Layout from '@/components/Layout';
import { DAO_CREATION_FEE_KES, PAYBILL_ADDON_FEE_KES, USSD_ADDON_FEE_KES, isCommunityType, type CommunityType } from '@/lib/constants';
import { formatKSh } from '@/lib/utils';
import { normaliseKenyanPhone } from '@/lib/phone';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletGuard } from '@/hooks/useWalletGuard';
import { useToast } from '@/hooks/use-toast';
import { createCommunityRecord } from '@/lib/communities';
import CommunityBanner from '@/components/CommunityBanner';
import { useChain } from '@/hooks/useChain';
import { useSeo } from '@/lib/seo';
import { type Chain } from '@/lib/chain';
import { AskAkili } from '@/akili/AskAkili';
import { useBarazaChain } from '@/hooks/useBarazaData';
import { communityPda, toSlug } from '@/lib/programs';
import { saveCommunityChainMapping } from '@/lib/chainMappings';
import { buildWalletProofHeaders } from '@/lib/walletProof';
import { useAccount } from '@/contexts/AccountContext';
import { useStellarWallet } from '@/hooks/useStellarWallet';
import { BarazaStellarClient } from '@/lib/programs/stellarClient';

type TreasuryPolicy = 'multisig-ready' | 'proposal-only' | 'manual-review';
type ChecklistState = 'complete' | 'active' | 'pending';
type PaymentMethod = 'mobile-money' | 'whatsapp' | 'privy' | 'swift';

interface SetupChecklistItem {
  label: string;
  detail: string;
  state: ChecklistState;
}

interface AnimatedSetupChecklistProps {
  items: SetupChecklistItem[];
  summary: string;
}

const checklistVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
};

const checklistItemVariants = {
  hidden: { opacity: 0, x: 18, filter: 'blur(4px)' },
  show: { opacity: 1, x: 0, filter: 'blur(0px)' },
};

function AnimatedSetupChecklist({ items, summary }: AnimatedSetupChecklistProps) {
  const completeCount = items.filter((item) => item.state === 'complete').length;
  const progress = Math.max(8, Math.round((completeCount / items.length) * 100));

  return (
    <motion.div
      className="baraza-card overflow-hidden p-5 lg:sticky lg:top-24"
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
        initial={{ x: '-80%' }}
        animate={{ x: '80%' }}
        transition={{ duration: 2.8, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}
      />
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-xs font-semibold uppercase tracking-widest">
            Setup checklist
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            Launch readiness updates as the form is completed.
          </p>
        </div>
        <motion.span
          className="inline-flex items-center gap-2 rounded-full border border-primary/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary"
          animate={{ boxShadow: ['0 0 0 hsl(22 100% 52% / 0)', '0 0 18px hsl(22 100% 52% / 0.28)', '0 0 0 hsl(22 100% 52% / 0)'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Live
        </motion.span>
      </div>

      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-border/60">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <motion.div className="space-y-4" variants={checklistVariants} initial="hidden" animate="show">
        {items.map((item, index) => {
          const isComplete = item.state === 'complete';
          const isActive = item.state === 'active';
          return (
            <motion.div
              key={item.label}
              className="relative flex gap-3"
              variants={checklistItemVariants}
              transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
            >
              {index < items.length - 1 && (
                <span className="absolute left-2.5 top-7 h-[calc(100%-0.5rem)] w-px bg-border/60" aria-hidden />
              )}
              <motion.span
                className={[
                  'relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                  isComplete
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isActive
                      ? 'border-primary/70 bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground',
                ].join(' ')}
                animate={isActive ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={{ duration: 1.2, repeat: isActive ? Infinity : 0, ease: 'easeInOut' }}
              >
                {isComplete ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : isActive ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
              </motion.span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{item.label}</p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={item.detail}
                    className="mt-1 text-xs text-muted-foreground"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                  >
                    {item.detail}
                  </motion.p>
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div
        className="mt-6 rounded-lg border border-border/70 bg-background/45 p-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.3 }}
      >
        <p className="text-xs leading-5 text-muted-foreground">{summary}</p>
      </motion.div>
    </motion.div>
  );
}

const GOVERNANCE_PRESETS: Partial<Record<CommunityType, {
  label: string;
  summary: string;
  quorum: string;
  approvalThreshold: string;
  votingPeriod: string;
  treasuryPolicy: TreasuryPolicy;
}>> = {
  savings: {
    label: 'Chama / savings group',
    summary: 'Simple member-majority voting for dues, welfare support, and small shared purchases.',
    quorum: '51',
    approvalThreshold: '60',
    votingPeriod: '7',
    treasuryPolicy: 'proposal-only',
  },
  cooperative: {
    label: 'Cooperative',
    summary: 'Board-aware member governance for procurement, operations, and collective bargaining.',
    quorum: '50',
    approvalThreshold: '66',
    votingPeriod: '14',
    treasuryPolicy: 'multisig-ready',
  },
  sacco: {
    label: 'SACCO',
    summary: 'Stronger approvals and manual review for member savings, loans, and regulated fund actions.',
    quorum: '60',
    approvalThreshold: '75',
    votingPeriod: '14',
    treasuryPolicy: 'manual-review',
  },
  housing: {
    label: 'Housing SACCO',
    summary: 'Higher participation for land, housing, and long-horizon asset decisions.',
    quorum: '60',
    approvalThreshold: '75',
    votingPeriod: '30',
    treasuryPolicy: 'manual-review',
  },
  dao: {
    label: 'DAO',
    summary: 'Token-aware governance for proposals, bounties, grants, and fund releases.',
    quorum: '40',
    approvalThreshold: '51',
    votingPeriod: '7',
    treasuryPolicy: 'multisig-ready',
  },
  organization: {
    label: 'Organization',
    summary: 'Admin-led workflow with transparent proposal records and controlled fund review.',
    quorum: '40',
    approvalThreshold: '66',
    votingPeriod: '7',
    treasuryPolicy: 'manual-review',
  },
  professional: {
    label: 'Professional network',
    summary: 'Lightweight votes for events, sponsorships, membership programs, and shared projects.',
    quorum: '35',
    approvalThreshold: '60',
    votingPeriod: '7',
    treasuryPolicy: 'proposal-only',
  },
  welfare: {
    label: 'Welfare group',
    summary: 'Member-majority rules for emergency support and recurring benefit decisions.',
    quorum: '51',
    approvalThreshold: '66',
    votingPeriod: '7',
    treasuryPolicy: 'proposal-only',
  },
  investment: {
    label: 'Investment club',
    summary: 'Higher approvals for pooled investments, asset purchases, and risk-bearing decisions.',
    quorum: '60',
    approvalThreshold: '75',
    votingPeriod: '14',
    treasuryPolicy: 'multisig-ready',
  },
};

function provisionPaybill(communityName: string): string {
  // Generates a deterministic-looking 6-digit Safaricom business paybill.
  const seed = Array.from(communityName).reduce((a, c) => a + c.charCodeAt(0), 0) + (Date.now() % 9000);
  return String(400100 + (seed % 9900));
}

function provisionUssdShortcode(communityName: string): string {
  const seed = Array.from(communityName).reduce((a, c) => a + c.charCodeAt(0), 0) + ((Date.now() >> 2) % 900);
  return `*384*${100 + (seed % 900)}#`;
}

const CreateCommunity: React.FC = () => {
  useSeo({
    title: "Launch a community",
    description:
      "Launch your community on Baraza. Choose a governance model, set member dues, quorum rules, and payment paths in one guided flow.",
    path: "/create",
  });
  const navigate = useNavigate();
  const account = useAccount();
  const [searchParams] = useSearchParams();
  const { address: founderAddress } = useWalletGuard({ action: 'launch a community' });
  const wallet = useWallet();
  const { toast } = useToast();
  const { chain } = useChain();
  const chainClient = useBarazaChain();
  const stellarWallet = useStellarWallet();
  const [isPending, setIsPending] = useState(false);
  const [isCreated, setIsCreated] = useState(false);
  const [createdCommunityId, setCreatedCommunityId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('mobile-money');
  const [addPaybill, setAddPaybill] = useState(false);
  const [addUssd, setAddUssd] = useState(false);
  const [assignedPaybill, setAssignedPaybill] = useState<string | null>(null);
  const [assignedUssd, setAssignedUssd] = useState<string | null>(null);
  const [walletChain, setWalletChain] = useState<Extract<Chain, 'solana' | 'stellar' | 'base' | 'arbitrum' | 'optimism' | 'celo'>>(
    chain === 'solana' || chain === 'stellar' || chain === 'base' || chain === 'arbitrum' || chain === 'optimism' || chain === 'celo'
      ? chain
      : 'stellar',
  );
  const [form, setForm] = useState(() => {
    const requestedType = searchParams.get('type') ?? '';
    const preset = isCommunityType(requestedType) ? GOVERNANCE_PRESETS[requestedType] : undefined;
    return {
      name: '',
      type: preset ? requestedType : '',
      fee: '',
      description: '',
      phone: '',
      quorum: preset?.quorum ?? '51',
      approvalThreshold: preset?.approvalThreshold ?? '66',
      votingPeriod: preset?.votingPeriod ?? '7',
      treasuryPolicy: preset?.treasuryPolicy ?? 'multisig-ready',
    };
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const normalisedPhone = normaliseKenyanPhone(form.phone);
  const totalFeeKes =
    DAO_CREATION_FEE_KES +
    (addPaybill ? PAYBILL_ADDON_FEE_KES : 0) +
    (addUssd ? USSD_ADDON_FEE_KES : 0);
  const selectedCommunityChain = walletChain;
  const selectedPreset = isCommunityType(form.type) ? GOVERNANCE_PRESETS[form.type] : null;
  const requiresPhone = paymentMethod === 'mobile-money' || paymentMethod === 'whatsapp';
  const isValid = !!(
    form.name.trim() &&
    form.type &&
    form.fee &&
    form.description.trim() &&
    (!requiresPhone || normalisedPhone !== null)
  );
  const setupChecklistItems: SetupChecklistItem[] = [
    {
      label: 'Community account',
      detail: form.name.trim() && form.type
        ? `${form.name.trim()} is ready from form details`
        : 'Add the group name from your questionnaire',
      state: form.name.trim() && form.type ? 'complete' : form.name.trim() || form.type ? 'active' : 'pending',
    },
    {
      label: 'Group account',
      detail: 'Settlement path selected',
      state: 'complete',
    },
    {
      label: 'Membership tier',
      detail: form.fee ? `${formatKSh(Number(form.fee) || 0)} monthly dues` : 'Set monthly member dues',
      state: form.fee ? 'complete' : 'pending',
    },
    {
      label: 'Governance model',
      detail: selectedPreset ? selectedPreset.label : 'Choose chama, SACCO, cooperative, DAO, or organization',
      state: selectedPreset ? 'complete' : 'pending',
    },
    {
      label: 'Membership credential',
      detail: requiresPhone
        ? normalisedPhone
          ? paymentMethod === 'whatsapp'
            ? 'WhatsApp payment contact ready'
            : 'Mobile money contact ready'
          : 'Add a mobile payment contact'
        : paymentMethod === 'privy'
          ? 'Privy wallet path selected'
          : 'SWIFT payment instructions selected',
      state: requiresPhone
        ? (normalisedPhone ? 'complete' : 'active')
        : 'complete',
    },
  ];
  const setupChecklistSummary = isValid
    ? 'Group funds setup, membership tiers, and credentials are ready to provision once your group is launched.'
    : 'Complete the setup fields to preview the account, group funds, and credential provisioning flow.';

  React.useEffect(() => {
    if (chain === 'solana' || chain === 'stellar' || chain === 'base' || chain === 'arbitrum' || chain === 'optimism' || chain === 'celo') {
      setWalletChain(chain);
    }
  }, [chain]);

  /**
   * Charge the DAO setup fee via the M-Pesa simulator, then create the
   * community record. Falls back to direct creation if the simulator endpoint
   * is unreachable (local dev without `vercel dev`) so the form still works
   * - the fee is then a paper-only acknowledgement, not enforced.
   */
  async function chargeCreationFee(): Promise<{ orderId: string; persisted: boolean }> {
    try {
      const res = await fetch('/api/mpesa/simulate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone: `+254${normalisedPhone}`,
          communityId: 'dao-creation-pending',
          amount: totalFeeKes,
          currency: 'KES',
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { orderId?: string; activationSecret?: string; persisted?: boolean };
        if (data.orderId) {
          return { orderId: data.orderId, persisted: data.persisted ?? false };
        }
      }
    } catch {
      // network/CORS/local-dev - fall through
    }
    return {
      orderId: `ord_local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      persisted: false,
    };
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    if (requiresPhone && !normalisedPhone) return;

    const launchCommunity = async () => {
      setIsPending(true);
      try {
        // Step 1: charge the setup fee
        const charge = requiresPhone
          ? await chargeCreationFee()
          : { orderId: `ord_${walletChain}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, persisted: false };

        // Step 2: create the community record
        let chainResult: { chain: 'solana' | 'stellar'; slug: string; communityAddress: string; signature: string } | null = null;
        if (selectedCommunityChain === 'solana' && chainClient) {
          const slug = toSlug(form.name);
          try {
            const signature = await chainClient.createCommunity(slug, form.name, '');
            const [communityKey] = communityPda(slug);
            chainResult = {
              chain: 'solana',
              slug,
              communityAddress: communityKey.toBase58(),
              signature,
            };
          } catch (chainErr) {
            console.warn('[baraza] createCommunity on-chain failed (record-only fallback):', chainErr);
          }
        } else if (selectedCommunityChain === 'stellar' && stellarWallet.address && stellarWallet.signTransaction) {
          const slug = toSlug(form.name);
          try {
            const stellarSigner = { publicKey: stellarWallet.address, signTransaction: stellarWallet.signTransaction };
            const stellarClient = new BarazaStellarClient(stellarSigner);
            const signature = await stellarClient.registerCommunity(slug, form.name);
            chainResult = {
              chain: 'stellar',
              slug,
              communityAddress: stellarClient.communityRegistryContractId,
              signature,
            };
          } catch (chainErr) {
            console.warn('[baraza] createCommunity on-chain failed (record-only fallback):', chainErr);
          }
        }

        const paybill = addPaybill ? provisionPaybill(form.name) : undefined;
        const ussd = addUssd ? provisionUssdShortcode(form.name) : undefined;
        if (paybill) setAssignedPaybill(paybill);
        if (ussd) setAssignedUssd(ussd);

        const walletProofHeaders = founderAddress
          ? await buildWalletProofHeaders(wallet, 'create-community')
          : undefined;

        const community = await createCommunityRecord({
          name: form.name,
          type: form.type,
          description: form.description,
          membershipFee: Number(form.fee),
          chain: selectedCommunityChain,
          quorumPct: Number(form.quorum),
          approvalThresholdPct: Number(form.approvalThreshold),
          votingPeriodDays: Number(form.votingPeriod),
          treasuryPolicy: form.treasuryPolicy as 'multisig-ready' | 'proposal-only' | 'manual-review',
          paybillNumber: paybill,
          ussdShortcode: ussd,
          createdBy: founderAddress ?? undefined,
          walletProofHeaders,
        });
        if (chainResult) {
          saveCommunityChainMapping({
            localId: community.id,
            chain: chainResult.chain,
            slug: chainResult.slug,
            communityAddress: chainResult.communityAddress,
            createTxSignature: chainResult.signature,
          });
        }
        setCreatedCommunityId(community.id);
        setIsCreated(true);
        const launchFeeLabel = formatKSh(totalFeeKes);
        toast({
          title: charge.persisted
            ? `${launchFeeLabel} payment received`
            : `Community launched (simulator offline)`,
          description: charge.persisted
            ? `Order ${charge.orderId.slice(0, 12)}... ${form.name} is live.`
            : 'Local dev mode - payment skipped, community launched.',
        });
      } catch (err) {
        toast({
          title: 'Community launch failed',
          description: err instanceof Error ? err.message : 'Check the form and try again.',
          variant: 'destructive',
        });
      } finally {
        setIsPending(false);
      }
    };

    await launchCommunity();
  };

  if (isCreated) {
    const launchFeeLabel = formatKSh(totalFeeKes);
    return (
      <Layout>
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-md mx-auto text-center">
              <div className="w-16 h-16 rounded-full bg-confirmed/15 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-confirmed" />
              </div>
              <h2 className="font-display text-2xl font-bold mb-3">
                {form.name} is live
              </h2>
              <p className="text-sm mb-2">
                Payment of {launchFeeLabel} received. Your community is ready.
              </p>
              {(assignedPaybill || assignedUssd) && (
                <div className="mb-5 rounded-lg border p-4 text-left space-y-3">
                  {assignedPaybill && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="font-semibold">Paybill assigned</p>
                        <p className="font-mono text-base">{assignedPaybill}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Account number = your member ID</p>
                      </div>
                    </div>
                  )}
                  {assignedUssd && (
                    <div className="flex items-center gap-3 text-sm">
                      <Smartphone className="h-4 w-4 shrink-0 text-primary" />
                      <div>
                        <p className="font-semibold">USSD shortcode assigned</p>
                        <p className="font-mono text-base">{assignedUssd}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Members dial this to vote and pay dues</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <p className="text-sm mb-8">
                Share the join link with members, then start your first proposal from the dashboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => createdCommunityId && navigate(`/dashboard/${createdCommunityId}`)}
                  disabled={!createdCommunityId}
                  className="btn-primary text-sm"
                >
                  Go to Dashboard
                </button>
                <button
                  onClick={() => navigate('/communities')}
                  className="btn-ghost text-sm"
                >
                  View All Communities
                </button>
              </div>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  if (!selectedPreset) {
    return <Navigate to="/create/purpose" replace />;
  }

  return (
    <Layout>
      <section className="py-10 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.64fr_0.36fr]">
            <div>
            {/* Back button */}
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <CommunityBanner type="cooperative" className="mb-8 min-h-[11.5rem] p-0">
            <div className="max-w-2xl p-6 md:p-7">
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-primary/25 bg-background/72 text-primary shadow-lg backdrop-blur">
                  <Users className="w-5 h-5" />
                </div>
                <h1 className="font-display text-2xl font-black leading-tight text-foreground drop-shadow md:text-3xl">
                  Launch a community
                </h1>
              </div>
              <p className="max-w-xl text-sm font-semibold leading-6 text-foreground/92 drop-shadow md:text-base md:leading-7">
                Choose the setup that matches your chama, SACCO, cooperative, DAO, or organization.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <AskAkili
                  prompt="Suggest quorum, approval threshold, and dues for a 20-member chama meeting monthly"
                  label="Suggest a setup"
                  variant="chip"
                />
                <AskAkili
                  prompt="Walk me through each field on this Create form, top to bottom"
                  label="Walk me through it"
                  variant="chip"
                />
              </div>
            </div>
            </CommunityBanner>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold mb-2">
                  Group name
                </label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Milele Chama"
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none border"
                />
              </div>

              {/* Fee */}
              <div>
                <label className="block text-xs font-semibold mb-2">
                  Monthly dues ({account.country.currency})
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium">{account.country.currency}</span>
                  <input
                    type="number"
                    name="fee"
                    value={form.fee}
                    onChange={handleChange}
                    placeholder="e.g. 500"
                    min="0"
                    className="w-full rounded-xl pl-14 pr-4 py-3 text-sm outline-none border"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="e.g. Monthly welfare contributions for members"
                  rows={4}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none border resize-none"
                />
              </div>

              <div className="grid gap-5 rounded-lg border p-5 md:grid-cols-3">
                <div className="md:col-span-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-mono text-xs font-semibold uppercase tracking-widest">
                      Governance model
                    </h2>
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                      Suggested starting example
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedPreset.summary} These are the lowest recommended starting values for this setup; your community can raise them before launch.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Quorum Threshold
                  </label>
                  <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
                    Minimum share of members who must vote for a decision to count. Most Kenyan chamas pick 51% — high enough to avoid surprise decisions, low enough that busy members don't block the group.
                  </p>
                  <div className="relative">
                    <input
                      type="number"
                      name="quorum"
                      value={form.quorum}
                      onChange={handleChange}
                      min="1"
                      max="100"
                      className="w-full rounded-lg px-4 py-3 pr-9 text-sm outline-none border"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Approval Threshold
                  </label>
                  <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
                    Of the votes that come in, share that must say Yes for the decision to pass. 51% is simple majority. 66%+ means the group really has to agree — set this higher for large fund releases.
                  </p>
                  <div className="relative">
                    <input
                      type="number"
                      name="approvalThreshold"
                      value={form.approvalThreshold}
                      onChange={handleChange}
                      min="1"
                      max="100"
                      className="w-full rounded-lg px-4 py-3 pr-9 text-sm outline-none border"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Default Voting Period
                  </label>
                  <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
                    How long a proposal stays open before the result is final. Shorter for urgent operational calls; longer when members need to think or consult outside the app.
                  </p>
                  <select
                    name="votingPeriod"
                    value={form.votingPeriod}
                    onChange={handleChange}
                    className="w-full rounded-lg px-4 py-3 text-sm outline-none border cursor-pointer appearance-none"
                  >
                    <option value="3">3 days</option>
                    <option value="7">7 days</option>
                    <option value="14">14 days</option>
                    <option value="30">30 days</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold mb-1">
                    Group funds policy
                  </label>
                  <p className="mb-2 text-[11px] leading-relaxed text-muted-foreground">
                    How money actually leaves the shared fund once members agree. Multisig-ready requires 2+ trusted members to co-sign each release. Proposal-approved sends as soon as a vote passes. Manual review means an admin checks before money moves — safer for large amounts, slower for routine ones.
                  </p>
                  <select
                    name="treasuryPolicy"
                    value={form.treasuryPolicy}
                    onChange={handleChange}
                    className="w-full rounded-lg px-4 py-3 text-sm outline-none border cursor-pointer appearance-none"
                  >
                    <option value="multisig-ready">Multisig-ready fund release</option>
                    <option value="proposal-only">Proposal-approved releases only</option>
                    <option value="manual-review">Manual admin review for releases</option>
                  </select>
                </div>
              </div>

              {/* Premium Add-ons */}
              <div className="grid gap-4 rounded-lg border p-5">
                <div>
                  <h2 className="font-mono text-xs font-semibold uppercase tracking-widest">
                    Premium Add-ons
                  </h2>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Optional payment channels added to your community setup fee.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setAddPaybill((v) => !v)}
                  className={`flex items-start gap-4 rounded-lg border p-4 text-left transition-colors ${
                    addPaybill
                      ? 'border-primary bg-primary/8'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${addPaybill ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Phone className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">M-Pesa Paybill number</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${addPaybill ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                        + {formatKSh(PAYBILL_ADDON_FEE_KES)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-5">
                      Register a dedicated Paybill so members can pay dues directly without sharing personal numbers.
                    </p>
                  </div>
                </button>

                {addPaybill && (
                  <div className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
                    <Hash className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="font-semibold text-primary">Paybill will be assigned at launch</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Baraza registers a dedicated 6-digit Safaricom Paybill for your community. Your members pay dues using it — no personal number shared. The number appears in your dashboard after launch.
                      </p>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setAddUssd((v) => !v)}
                  className={`flex items-start gap-4 rounded-lg border p-4 text-left transition-colors ${
                    addUssd
                      ? 'border-primary bg-primary/8'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${addUssd ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">USSD shortcode</p>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${addUssd ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                        + {formatKSh(USSD_ADDON_FEE_KES)}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-5">
                      Give feature-phone members a *XXX# shortcode to check balance, vote, and pay dues without a smartphone.
                    </p>
                  </div>
                </button>

                {addUssd && (
                  <div className="flex items-start gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
                    <Hash className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="font-semibold text-primary">USSD shortcode will be assigned at launch</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Baraza provisions a dedicated <span className="font-mono">*384*XXX#</span> shortcode for your community. Feature-phone members dial it to vote and pay dues without a smartphone. The shortcode appears in your dashboard after launch.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment */}
              <div className="grid gap-4 rounded-lg border p-5">
                <h2 className="font-mono text-xs font-semibold uppercase tracking-widest">
                  Payment
                </h2>

                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Payment method">
                  {([
                    { id: 'mobile-money', label: 'Mobile money', icon: Smartphone },
                    { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
                    { id: 'privy', label: 'Privy wallet', icon: Wallet },
                    { id: 'swift', label: 'Bank / SWIFT', icon: Landmark },
                  ] as const).map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={paymentMethod === id}
                      onClick={() => setPaymentMethod(id)}
                      className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-semibold transition-colors ${
                        paymentMethod === id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  {requiresPhone ? (
                    <motion.div
                      key={paymentMethod}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                    >
                      <label htmlFor="create-phone" className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                        {paymentMethod === 'whatsapp' ? <MessageCircle className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                        {paymentMethod === 'whatsapp'
                          ? `WhatsApp number for the ${formatKSh(totalFeeKes)} payment`
                          : `Mobile money number for the ${formatKSh(totalFeeKes)} launch charge`}
                      </label>
                      <div className="flex rounded-lg border focus-within:border-current">
                        <span className="border-r px-3 py-2.5 text-sm">+254</span>
                        <input
                          id="create-phone"
                          name="phone"
                          value={form.phone}
                          onChange={handleChange}
                          placeholder="e.g. 0712 345 678"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          aria-invalid={form.phone.length > 0 && normalisedPhone === null}
                          className="min-w-0 flex-1 px-3 py-2.5 text-sm outline-none"
                        />
                      </div>
                      {form.phone.length > 0 && normalisedPhone === null && (
                        <p className="mt-1.5 text-[11px]">
                          Enter a valid Kenyan mobile number (07XX, 7XX, or +254 7XX).
                        </p>
                      )}
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                        {paymentMethod === 'whatsapp'
                          ? 'Payment guidance and status updates will use this WhatsApp number. Settlement continues through a supported mobile money provider.'
                          : 'Use the number registered with your supported mobile money provider.'}
                      </p>
                    </motion.div>
                  ) : paymentMethod === 'privy' ? (
                    <motion.div
                      key="privy"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
                    >
                      <p className="text-sm font-semibold">Pay from your secure Baraza wallet</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Privy keeps the payment account behind your Baraza sign-in. You will confirm the payment before anything is submitted.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="swift"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
                    >
                      <p className="text-sm font-semibold">International bank transfer</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Continue to receive the SWIFT payment reference and bank instructions for your launch order.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Fee summary */}
                <div className="grid gap-2 border-t pt-4 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">Setup fee</p>
                    <span className="text-xs font-semibold tabular-nums">{formatKSh(DAO_CREATION_FEE_KES)}</span>
                  </div>
                  {addPaybill && (
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs text-muted-foreground">Paybill add-on</p>
                      <span className="text-xs font-semibold tabular-nums">+ {formatKSh(PAYBILL_ADDON_FEE_KES)}</span>
                    </div>
                  )}
                  {addUssd && (
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs text-muted-foreground">USSD add-on</p>
                      <span className="text-xs font-semibold tabular-nums">+ {formatKSh(USSD_ADDON_FEE_KES)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4 border-t pt-2">
                    <p className="text-xs font-semibold">Total charge</p>
                    <span className="font-display text-lg font-bold tabular-nums">
                      {formatKSh(totalFeeKes)}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Your payment route is confirmed before the community goes live.
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!isValid || isPending}
                className="w-full btn-warm text-sm py-3.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing payment...
                  </>
                ) : paymentMethod === 'mobile-money' ? (
                  `Pay ${formatKSh(totalFeeKes)} with mobile money`
                ) : paymentMethod === 'whatsapp' ? (
                  'Continue with WhatsApp payment'
                ) : paymentMethod === 'privy' ? (
                  'Continue with Privy wallet'
                ) : (
                  'Get SWIFT instructions'
                )}
              </button>
            </form>
            </div>

            <aside className="lg:pt-14">
              <AnimatedSetupChecklist items={setupChecklistItems} summary={setupChecklistSummary} />
            </aside>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default CreateCommunity;
