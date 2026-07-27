import { Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { formatKSh } from '@/lib/utils';
import {
  useLeverageOnboarding,
  chainChoices,
  tierChoices,
  proposalStatuses,
  chainLabel,
  type FlowStatus,
  type TierChoice,
} from '@/hooks/useLeverageOnboarding';
import { listCoopTemplates, type PayoutMode } from '@coop-templates';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Globe2,
  Landmark,
  Languages,
  Loader2,
  MessageSquare,
  MoonStar,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Wallet,
  Vote,
} from 'lucide-react';

function sectionTone(active: boolean): string {
  return active ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/70 bg-background/50 text-muted-foreground';
}

function statusTone(status: FlowStatus): string {
  switch (status) {
    case 'done':
      return 'border-confirmed/40 bg-confirmed/10 text-confirmed';
    case 'working':
      return 'border-primary/40 bg-primary/10 text-primary';
    default:
      return 'border-border/60 bg-background/50 text-muted-foreground';
  }
}

export default function LeverageOnboarding() {
  // Internal onboarding testbed writes real community records (createCommunityRecord)
  // straight from sandbox integrations -- not gated for public/production traffic.
  // Split into a wrapper so the hook below is never called conditionally.
  if (import.meta.env.PROD) {
    return <Navigate to="/" replace />;
  }
  return <LeverageOnboardingScreen />;
}

function LeverageOnboardingScreen() {
  const {
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
    handleCommunityCreate,
    handleActivation,
    handleBatchActivation,
    handleUssdAdvance,
    handleWelcomeProposal,
  } = useLeverageOnboarding();

  return (
    <Layout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,187,0,0.16),transparent_32%),radial-gradient(circle_at_left,rgba(110,22,233,0.08),transparent_28%)]" />
        <div className="container relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Multi-chain leverage foundation
              </div>
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                {currentCopy.title}
              </h1>
              <p className="mt-3 max-w-3xl text-pretty text-sm leading-7 text-muted-foreground sm:text-base">
                {currentCopy.subtitle}
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/70 p-1">
              <button type="button" onClick={() => setLanguage('en')} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${language === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                <SunMedium className="h-3.5 w-3.5" />
                English
              </button>
              <button type="button" onClick={() => setLanguage('sw')} className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold ${language === 'sw' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>
                <MoonStar className="h-3.5 w-3.5" />
                Swahili
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.8fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{currentCopy.review}</p>
                    <h2 className="mt-1 text-lg font-semibold">{communityName}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {proposalStatuses.map((label, index) => (
                      <span key={label} className={`rounded-full border px-3 py-1 text-xs font-semibold ${index === 0 ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 text-muted-foreground'}`}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <button type="button" onClick={handleCommunityCreate} className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary px-4 py-4 text-left text-primary-foreground transition hover:opacity-95">
                    <span className="min-w-0">
                      <span className="block text-xs uppercase tracking-[0.18em] opacity-80">{currentCopy.community}</span>
                      <span className="mt-1 block text-sm font-semibold">{currentCopy.submitCommunity}</span>
                    </span>
                    {communityStatus === 'working' ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                  </button>
                  <button type="button" onClick={handleActivation} className="flex items-center justify-between rounded-xl border border-border/70 bg-background px-4 py-4 text-left transition hover:border-primary/40">
                    <span className="min-w-0">
                      <span className="block text-xs uppercase tracking-[0.18em] text-muted-foreground">{currentCopy.member}</span>
                      <span className="mt-1 block text-sm font-semibold">{currentCopy.startActivation}</span>
                    </span>
                    <Phone className="h-5 w-5 text-primary" />
                  </button>
                  <button type="button" onClick={handleWelcomeProposal} className="flex items-center justify-between rounded-xl border border-border/70 bg-background px-4 py-4 text-left transition hover:border-primary/40">
                    <span className="min-w-0">
                      <span className="block text-xs uppercase tracking-[0.18em] text-muted-foreground">{currentCopy.proposal}</span>
                      <span className="mt-1 block text-sm font-semibold">{currentCopy.createWelcome}</span>
                    </span>
                    <Vote className="h-5 w-5 text-primary" />
                  </button>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{currentCopy.community}</p>
                      <h3 className="mt-1 text-lg font-semibold">Flow A</h3>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(communityStatus)}`}>{communityStatus}</span>
                  </div>

                  <div className="mt-5 grid gap-4">
                    <label className="grid gap-2 text-sm">
                      <span className="font-semibold">Phone number</span>
                      <input value={phoneInput} onChange={(event) => setPhoneInput(event.target.value)} className="rounded-xl border border-border/70 bg-background px-4 py-3 text-sm outline-none ring-0 focus:border-primary" placeholder="07XX XXX XXX" />
                    </label>
                    <div className="grid gap-2 text-sm">
                      <span className="font-semibold">Community type</span>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {listCoopTemplates().map((template) => (
                          <button key={template.type} type="button" onClick={() => setCommunityType(template.type)} className={`rounded-xl border px-4 py-3 text-left transition ${sectionTone(communityType === template.type)}`}>
                            <span className="block text-sm font-semibold">{template.label}</span>
                            <span className="mt-1 block text-xs leading-5 opacity-80">{template.summary}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="grid gap-2 text-sm">
                      <span className="font-semibold">Community name</span>
                      <input value={communityName} onChange={(event) => setCommunityName(event.target.value)} className="rounded-xl border border-border/70 bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
                    </label>

                    <label className="grid gap-2 text-sm">
                      <span className="font-semibold">Contribution schedule</span>
                      <input value={schedule} onChange={(event) => setSchedule(event.target.value)} className="rounded-xl border border-border/70 bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm">
                        <span className="font-semibold">Payout mode</span>
                        <select value={payoutMode} onChange={(event) => setPayoutMode(event.target.value as PayoutMode)} className="rounded-xl border border-border/70 bg-background px-4 py-3 text-sm outline-none focus:border-primary">
                          <option value="rotating">Rotating</option>
                          <option value="proportional">Proportional</option>
                          <option value="milestone">Milestone</option>
                        </select>
                      </label>
                      <label className="grid gap-2 text-sm">
                        <span className="font-semibold">Tier</span>
                        <select value={tier} onChange={(event) => setTier(event.target.value as TierChoice)} className="rounded-xl border border-border/70 bg-background px-4 py-3 text-sm outline-none focus:border-primary">
                          {tierChoices.map((choice) => (
                            <option key={choice.id} value={choice.id}>
                              {choice.label} {choice.fee > 0 ? `- ${formatKSh(choice.fee)}` : '- free'}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="grid gap-2 text-sm">
                      <span className="font-semibold">Chain selection</span>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {chainChoices.map((choice) => (
                          <button
                            key={choice.id}
                            type="button"
                            onClick={() => setChain(choice.id)}
                            disabled={!choice.active}
                            className={`rounded-xl border px-4 py-3 text-left transition ${chain === choice.id ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/70 bg-background/50 text-muted-foreground'} ${choice.active ? '' : 'opacity-60'}`}
                          >
                            <span className="block text-sm font-semibold">{choice.label}</span>
                            <span className="mt-1 block text-xs leading-5">{choice.note}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="grid gap-2 text-sm">
                        <span className="font-semibold">Quorum</span>
                        <input type="number" min={1} max={100} value={quorum} onChange={(event) => setQuorum(Number(event.target.value))} className="rounded-xl border border-border/70 bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
                      </label>
                      <label className="grid gap-2 text-sm">
                        <span className="font-semibold">Amendment notice</span>
                        <input type="number" min={1} max={30} value={amendmentNotice} onChange={(event) => setAmendmentNotice(Number(event.target.value))} className="rounded-xl border border-border/70 bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
                      </label>
                    </div>

                    <label className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background px-4 py-3 text-sm">
                      <span>
                        <span className="block font-semibold">Halal mode</span>
                        <span className="block text-xs text-muted-foreground">Toggle for communities that need Sharia-sensitive defaults.</span>
                      </span>
                      <input type="checkbox" checked={halalMode} onChange={(event) => setHalalMode(event.target.checked)} className="h-4 w-4 accent-primary" />
                    </label>
                  </div>
                </article>

                <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{currentCopy.review}</p>
                      <h3 className="mt-1 text-lg font-semibold">Flow B</h3>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(activationStatus)}`}>{activationStatus}</span>
                  </div>

                  <div className="mt-5 grid gap-4">
                    <label className="grid gap-2 text-sm">
                      <span className="font-semibold">Invite link or code</span>
                      <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} className="rounded-xl border border-border/70 bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
                    </label>
                    <div className="grid gap-2 text-sm">
                      <span className="font-semibold">Phone to wallet</span>
                      <div className="rounded-xl border border-border/70 bg-background px-4 py-3 text-sm">
                        {localPhone ? `Validated phone ${localPhone}` : 'Waiting for a Kenyan mobile number'}
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm">
                      <span className="font-semibold">STK push sandbox</span>
                      <div className="rounded-xl border border-border/70 bg-background px-4 py-3 text-xs leading-6 text-muted-foreground">
                        {stkResult ? `Checkout ${stkResult.checkoutRequestId} · ${stkResult.sandboxReceipt ?? 'pending'}` : 'No payment pushed yet'}
                      </div>
                    </div>

                    <button type="button" onClick={handleActivation} className="inline-flex items-center justify-between rounded-xl border border-primary/30 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
                      <span>{currentCopy.startActivation}</span>
                      <Send className="h-4 w-4" />
                    </button>

                    <div className="rounded-2xl border border-border/70 bg-background p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">USSD skeleton</p>
                      <p className="mt-2 text-sm text-muted-foreground">Menu state: {ussdSession.state}</p>
                      <button type="button" onClick={handleUssdAdvance} className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-2 text-xs font-semibold">
                        Advance session
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <label className="grid gap-2 text-sm">
                      <span className="font-semibold">Batch size</span>
                      <input type="number" min={1} max={50} value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value))} className="rounded-xl border border-border/70 bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
                    </label>

                    <button type="button" onClick={handleBatchActivation} className="inline-flex items-center justify-between rounded-xl border border-border/70 bg-background px-4 py-3 text-sm font-semibold">
                      <span>{currentCopy.activateBatch}</span>
                      <Wallet className="h-4 w-4 text-primary" />
                    </button>

                    <div className="rounded-2xl border border-border/70 bg-background p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Batch log</p>
                      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                        {batchLog.length > 0 ? batchLog.map((entry) => <div key={entry}>{entry}</div>) : <div>No batch activations yet.</div>}
                      </div>
                    </div>
                  </div>
                </article>
              </div>

              <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{currentCopy.proposal}</p>
                    <h3 className="mt-1 text-lg font-semibold">Flow C</h3>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(proposalStatus)}`}>{proposalStatus}</span>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-2xl border border-border/70 bg-background p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Adopt constitution v1</p>
                        <p className="text-xs text-muted-foreground">One-tap vote UX with local proposal seeding.</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-border/70 px-3 py-3 text-sm">
                        <span className="block text-xs text-muted-foreground">Quorum</span>
                        <span className="block font-semibold">{quorum}%</span>
                      </div>
                      <div className="rounded-xl border border-border/70 px-3 py-3 text-sm">
                        <span className="block text-xs text-muted-foreground">Approval path</span>
                        <span className="block font-semibold">{selectedTemplate.featureFlags.complianceReports ? '66%+' : 'Simple majority'}</span>
                      </div>
                      <div className="rounded-xl border border-border/70 px-3 py-3 text-sm">
                        <span className="block text-xs text-muted-foreground">Wallet state</span>
                        <span className="block font-semibold">{walletResult ? walletResult.walletAddress.slice(0, 10) : 'not linked yet'}</span>
                      </div>
                      <div className="rounded-xl border border-border/70 px-3 py-3 text-sm">
                        <span className="block text-xs text-muted-foreground">Vote state</span>
                        <span className="block font-semibold">{proposalVote === 'yes' ? 'Yes' : proposalVote === 'no' ? 'No' : 'Awaiting vote'}</span>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
                      {currentCopy.paymentWarning}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70 bg-background p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Live summary</p>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex items-start justify-between gap-3"><dt className="text-muted-foreground">Template</dt><dd className="font-semibold">{selectedTemplate.label}</dd></div>
                      <div className="flex items-start justify-between gap-3"><dt className="text-muted-foreground">Contribution schedule</dt><dd className="text-right font-semibold">{schedule}</dd></div>
                      <div className="flex items-start justify-between gap-3"><dt className="text-muted-foreground">Payout mode</dt><dd className="font-semibold">{payoutMode}</dd></div>
                      <div className="flex items-start justify-between gap-3"><dt className="text-muted-foreground">Chain</dt><dd className="font-semibold">{chainLabel(chain)}</dd></div>
                      <div className="flex items-start justify-between gap-3"><dt className="text-muted-foreground">Tier</dt><dd className="font-semibold">{tier}</dd></div>
                      <div className="flex items-start justify-between gap-3"><dt className="text-muted-foreground">Membership fee</dt><dd className="font-semibold">{formatKSh(membershipFee)}</dd></div>
                    </dl>

                    <button type="button" onClick={handleWelcomeProposal} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">
                      <MessageSquare className="h-4 w-4" />
                      {currentCopy.createWelcome}
                    </button>
                  </div>
                </div>
              </article>
            </div>

            <aside className="space-y-6">
              <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">System snapshot</p>
                    <h3 className="mt-1 text-lg font-semibold">Architecture cues</h3>
                  </div>
                  <Globe2 className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="rounded-xl border border-border/70 bg-background px-4 py-3">Default chain loop: Solana devnet → Fuji → Base Sepolia → Stellar → Starknet parked</div>
                  <div className="rounded-xl border border-border/70 bg-background px-4 py-3">Payment path: Daraja sandbox STK push with webhook signature verification</div>
                  <div className="rounded-xl border border-border/70 bg-background px-4 py-3">Wallet path: Privy invisible wallet stub behind env-gated adapter</div>
                  <div className="rounded-xl border border-border/70 bg-background px-4 py-3">Membership: payment attested before active status is granted</div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Preset library</p>
                    <h3 className="mt-1 text-lg font-semibold">{selectedTemplate.label}</h3>
                  </div>
                  <Languages className="h-5 w-5 text-primary" />
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{selectedTemplate.summary}</p>
                <div className="mt-4 grid gap-3 text-sm">
                  <div className="rounded-xl border border-border/70 bg-background px-4 py-3">Contribution schedule: {selectedTemplate.defaultContributionSchedule}</div>
                  <div className="rounded-xl border border-border/70 bg-background px-4 py-3">Member limit: {selectedTemplate.memberLimit}</div>
                  <div className="rounded-xl border border-border/70 bg-background px-4 py-3">Halal mode default: {selectedTemplate.halalMode ? 'on' : 'off'}</div>
                  <div className="rounded-xl border border-border/70 bg-background px-4 py-3">Feature flags: {Object.entries(selectedTemplate.featureFlags).filter(([, value]) => value).map(([key]) => key).join(', ') || 'none'}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Integration status</p>
                    <h3 className="mt-1 text-lg font-semibold">Mocked vs live</h3>
                  </div>
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3"><span>Daraja</span><span className="font-semibold text-confirmed">sandbox</span></div>
                  <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3"><span>Privy</span><span className="font-semibold text-confirmed">stub</span></div>
                  <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3"><span>Messaging</span><span className="font-semibold text-confirmed">stub</span></div>
                  <div className="flex items-center justify-between rounded-xl border border-border/70 px-4 py-3"><span>AfricasTalking</span><span className="font-semibold text-confirmed">USSD skeleton</span></div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Activation details</p>
                    <h3 className="mt-1 text-lg font-semibold">One-off fees</h3>
                  </div>
                  <Landmark className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Member activation</span><span className="font-semibold">{formatKSh(activationAmountKes)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Bulk treasurer path</span><span className="font-semibold">{formatKSh(activationAmountKes)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Tier</span><span className="font-semibold">{tier}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Chain</span><span className="font-semibold">{chainLabel(chain)}</span></div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Live status</p>
                    <h3 className="mt-1 text-lg font-semibold">Current states</h3>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-confirmed" />
                </div>
                <div className="mt-4 grid gap-3 text-sm">
                  <div className="rounded-xl border border-border/70 px-4 py-3">Community: {communityStatus}</div>
                  <div className="rounded-xl border border-border/70 px-4 py-3">Activation: {activationStep}</div>
                  <div className="rounded-xl border border-border/70 px-4 py-3">Proposal vote: {proposalVote ?? 'pending'}</div>
                  <div className="rounded-xl border border-border/70 px-4 py-3">Wallet: {walletResult ? 'linked via stub' : 'not linked'}</div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </Layout>
  );
}


