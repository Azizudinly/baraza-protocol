import { useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Chain } from '@/lib/chain';
import { createCommunityRecord } from '@/lib/communities';
import { normaliseKenyanPhone, toE164Kenyan } from '@/lib/phone';
import { bootstrapInvisibleWallet, type PrivyWalletBootstrapResult } from '@integrations/privy';
import {
  createUssdSession,
  advanceUssdSession,
  type UssdSession,
} from '@integrations/africastalking';
import {
  requestStkPush,
  verifyDarajaWebhookSignature,
  darajaSandboxEnabled,
  type DarajaWebhookPayload,
  type DarajaStkPushResult,
} from '@integrations/daraja';
import {
  getCoopTemplate,
  type CommunityType,
  type PayoutMode,
} from '@coop-templates';

export type Language = 'en' | 'sw';
export type ChainChoice = 'solana-devnet' | 'fuji' | 'base-sepolia' | 'stellar' | 'starknet';
export type TierChoice = 'mtaa' | 'kikundi' | 'sacco' | 'biashara' | 'serikali';
export type FlowStatus = 'idle' | 'working' | 'done';

const copy = {
  en: {
    title: 'Onboarding foundation',
    subtitle: 'Create the community record, activate members, and seed the first vote without exposing chain complexity.',
    community: 'Community creation',
    member: 'Member activation',
    proposal: 'First governance action',
    review: 'Review and queue',
    paymentWarning: 'Payment confirmed is not membership active. Activation completes after attestation, mint, and chain confirmation.',
    submitCommunity: 'Create community record',
    startActivation: 'Start STK push',
    activateBatch: 'Activate batch',
    createWelcome: 'Create welcome proposal',
  },
  sw: {
    title: 'Uanzishaji wa msingi',
    subtitle: 'Tengeneza rekodi ya jumuiya, washa wanachama, na anzisha kura ya kwanza bila ugumu wa chain.',
    community: 'Uundaji wa jumuiya',
    member: 'Uanzishaji wa mwanachama',
    proposal: 'Hatua ya kwanza ya uongozi',
    review: 'Pitia na panga',
    paymentWarning: 'Malipo kuthibitishwa si sawa na uanachama kuwa hai. Uanzishaji hukamilika baada ya attestation, mint, na chain confirmation.',
    submitCommunity: 'Tengeneza rekodi ya jumuiya',
    startActivation: 'Anzisha STK push',
    activateBatch: 'Washa kundi',
    createWelcome: 'Tengeneza pendekezo la makaribisho',
  },
} as const;

export const chainChoices: Array<{ id: ChainChoice; label: string; note: string; active: boolean }> = [
  { id: 'solana-devnet', label: 'Solana devnet', note: 'Default per loop order', active: true },
  { id: 'fuji', label: 'Fuji', note: 'Available for staging', active: true },
  { id: 'base-sepolia', label: 'Base Sepolia', note: 'Available for staging', active: true },
  { id: 'stellar', label: 'Stellar', note: 'Available for stage and settlement work', active: true },
  { id: 'starknet', label: 'Starknet', note: 'Coming soon', active: false },
];

export const tierChoices: Array<{ id: TierChoice; label: string; fee: number; note: string }> = [
  { id: 'mtaa', label: 'mtaa', fee: 0, note: 'Free starter tier' },
  { id: 'kikundi', label: 'kikundi', fee: 20, note: 'Light coordination' },
  { id: 'sacco', label: 'sacco', fee: 20, note: 'Compliance-aware defaults' },
  { id: 'biashara', label: 'biashara', fee: 20, note: 'Growth and payments' },
  { id: 'serikali', label: 'serikali', fee: 20, note: 'Public body pattern' },
];

export const proposalStatuses = ['Draft', 'Open', 'Quorum', 'Passed'];

// Shared fallback price for member activation when a tier's own fee is 0
// (the free 'mtaa' tier) -- both the single and batch STK push amounts, and
// the price shown to the user, must all derive from this one value so they
// can't drift apart again (m-003).
const DEFAULT_ACTIVATION_FEE_KES = 20;

// packages/integrations/src/daraja.ts never reads import.meta.env itself
// (so it stays safe to import server-side) -- this is the one place that
// reads the Vite env and passes the flag down explicitly.
const DARAJA_SANDBOX_FLAG = import.meta.env.VITE_DARAJA_SANDBOX as string | undefined;

export function chainLabel(value: ChainChoice): string {
  return chainChoices.find((item) => item.id === value)?.label ?? value;
}

function queuedChainLabel(choice: ChainChoice): Chain {
  switch (choice) {
    case 'stellar':
      return 'stellar';
    case 'base-sepolia':
      return 'base';
    default:
      return 'solana';
  }
}

export function useLeverageOnboarding() {
  const { toast } = useToast();
  const [language, setLanguage] = useState<Language>('en');
  const [communityType, setCommunityType] = useState<CommunityType>('chama');
  const [tier, setTier] = useState<TierChoice>('mtaa');
  const [chain, setChain] = useState<ChainChoice>('solana-devnet');
  const [payoutMode, setPayoutMode] = useState<PayoutMode>('rotating');
  const [halalMode, setHalalMode] = useState(true);
  const [phoneInput, setPhoneInput] = useState('');
  const [inviteCode, setInviteCode] = useState('BARAZA-2026');
  const [communityName, setCommunityName] = useState('Umoja Savings Circle');
  const [schedule, setSchedule] = useState('Monthly on the 5th');
  const [quorum, setQuorum] = useState(51);
  const [amendmentNotice, setAmendmentNotice] = useState(7);
  const [walletResult, setWalletResult] = useState<PrivyWalletBootstrapResult | null>(null);
  const [stkResult, setStkResult] = useState<DarajaStkPushResult | null>(null);
  const [ussdSession, setUssdSession] = useState<UssdSession>(() => createUssdSession(`ussd_${Date.now()}`));
  const [activationStep, setActivationStep] = useState<'pending' | 'requesting' | 'confirmed' | 'active'>('pending');
  const [proposalVote, setProposalVote] = useState<'yes' | 'no' | null>(null);
  const [communityStatus, setCommunityStatus] = useState<FlowStatus>('idle');
  const [activationStatus, setActivationStatus] = useState<FlowStatus>('idle');
  const [proposalStatus, setProposalStatus] = useState<FlowStatus>('idle');
  const [batchSize, setBatchSize] = useState(12);
  const [batchLog, setBatchLog] = useState<string[]>([]);

  const selectedTemplate = useMemo(() => getCoopTemplate(communityType), [communityType]);
  const currentCopy = copy[language];
  const localPhone = normaliseKenyanPhone(phoneInput);
  const e164Phone = toE164Kenyan(phoneInput);
  const membershipFee = tier === 'mtaa' ? 0 : 20;
  const activationAmountKes = membershipFee || DEFAULT_ACTIVATION_FEE_KES;

  const constitutionSummary = [
    selectedTemplate.defaultContributionSchedule,
    `${quorum}% quorum`,
    `${amendmentNotice}-day amendment notice`,
    payoutMode,
    halalMode ? 'halal mode on' : 'halal mode off',
  ].join(' · ');

  async function handleCommunityCreate(): Promise<void> {
    const phone = e164Phone ?? '+254700000000';
    setCommunityStatus('working');
    const wallet = await bootstrapInvisibleWallet({
      phone,
      communityType,
      mode: 'sandbox',
    });
    setWalletResult(wallet);

    const template = getCoopTemplate(communityType);
    await createCommunityRecord({
      name: communityName,
      type: communityType,
      description: `${template.summary} ${constitutionSummary}`,
      membershipFee,
      chain: queuedChainLabel(chain),
      quorumPct: quorum,
      approvalThresholdPct: selectedTemplate.featureFlags.complianceReports ? 66 : 60,
      votingPeriodDays: 7,
      treasuryPolicy: tier === 'mtaa' ? 'proposal-only' : 'multisig-ready',
      createdBy: wallet.walletAddress,
    });

    setCommunityStatus('done');
    toast({
      title: language === 'en' ? 'Community record queued' : 'Rekodi ya jumuiya imepangwa',
      description: language === 'en'
        ? 'Supabase write completed or fell back to local storage. On-chain deployment is queued, not executed.'
        : 'Uandishi wa Supabase umefanikiwa au umehifadhiwa local. Deployment ya chain imepangwa, haijatekelezwa.',
    });
  }

  async function handleActivation(): Promise<void> {
    setActivationStatus('working');
    const resolvedPhone = e164Phone ?? '+254700000000';
    const stk = await requestStkPush({
      phone: resolvedPhone,
      amountKes: activationAmountKes,
      reference: inviteCode,
      accountReference: communityName,
      sandbox: darajaSandboxEnabled(DARAJA_SANDBOX_FLAG),
    });
    setStkResult(stk);

    const payload: DarajaWebhookPayload = {
      Body: {
        stkCallback: {
          CheckoutRequestID: stk.checkoutRequestId,
          MerchantRequestID: stk.merchantRequestId,
          ResultCode: 0,
          ResultDesc: 'Success',
          CallbackMetadata: {
            Item: [
              { Name: 'MpesaReceiptNumber', Value: `MPESA${stk.checkoutRequestId.slice(0, 8).toUpperCase()}` },
              { Name: 'Amount', Value: activationAmountKes },
              { Name: 'PhoneNumber', Value: resolvedPhone },
            ],
          },
        },
      },
    };

    const verified = await verifyDarajaWebhookSignature(payload, null, null, DARAJA_SANDBOX_FLAG);
    if (verified) {
      setActivationStep('confirmed');
      setActivationStep('active');
      setActivationStatus('done');
      toast({
        title: language === 'en' ? 'Activation confirmed' : 'Uanzishaji umethibitishwa',
        description: language === 'en'
          ? 'Payment attested and member status moved to active in the sandbox flow.'
          : 'Malipo yamethibitishwa na hali ya mwanachama imehamishwa kuwa active kwenye sandbox.',
      });
    } else {
      setActivationStatus('idle');
    }
  }

  async function handleBatchActivation(): Promise<void> {
    const logs: string[] = [];
    for (let index = 0; index < batchSize; index += 1) {
      const resolvedPhone = `+254700000${String(index).padStart(3, '0')}`;
      const result = await requestStkPush({
        phone: resolvedPhone,
        amountKes: activationAmountKes,
        reference: `${inviteCode}-B${index + 1}`,
        accountReference: communityName,
        sandbox: darajaSandboxEnabled(DARAJA_SANDBOX_FLAG),
      });
      logs.push(`${result.sandboxReceipt ?? result.checkoutRequestId} -> active`);
    }
    setBatchLog(logs);
    setActivationStep('active');
    setActivationStatus('done');
  }

  function handleUssdAdvance(): void {
    const response = advanceUssdSession(ussdSession, phoneInput || inviteCode);
    setUssdSession({ ...ussdSession, state: response.state });
  }

  async function handleWelcomeProposal(): Promise<void> {
    setProposalStatus('working');
    setProposalVote('yes');
    setProposalStatus('done');
    toast({
      title: language === 'en' ? 'Welcome proposal seeded (sandbox)' : 'Pendekezo la makaribisho (sandbox)',
      description: language === 'en'
        ? 'This vote is held in local component state for the walkthrough only -- it is not written to the governance backend.'
        : 'Kura hii inahifadhiwa kwenye hali ya ndani ya ukurasa kwa maonyesho tu -- haijaandikwa kwenye mfumo wa uongozi.',
    });
  }

  return {
    language, setLanguage,
    communityType, setCommunityType,
    tier, setTier,
    chain, setChain,
    payoutMode, setPayoutMode,
    halalMode, setHalalMode,
    phoneInput, setPhoneInput,
    inviteCode, setInviteCode,
    communityName, setCommunityName,
    schedule, setSchedule,
    quorum, setQuorum,
    amendmentNotice, setAmendmentNotice,
    walletResult,
    stkResult,
    ussdSession,
    activationStep,
    proposalVote,
    communityStatus,
    activationStatus,
    proposalStatus,
    batchSize, setBatchSize,
    batchLog,
    selectedTemplate,
    currentCopy,
    localPhone,
    membershipFee,
    activationAmountKes,
    constitutionSummary,
    handleCommunityCreate,
    handleActivation,
    handleBatchActivation,
    handleUssdAdvance,
    handleWelcomeProposal,
  };
}
