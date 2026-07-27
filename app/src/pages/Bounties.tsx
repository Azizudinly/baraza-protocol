import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, ExternalLink, LoaderCircle, LogIn, RefreshCw, UserRound } from 'lucide-react';
import Layout from '@/components/Layout';
import { useAccount } from '@/contexts/AccountContext';
import { listBountyClaimStates, submitBountyClaim, type BountyClaimStatus } from '@/lib/bountyClaims';
import { listGithubBounties, type GithubBounty } from '@/lib/githubBounties';
import { cn } from '@/lib/utils';
import { useSeo } from '@/lib/seo';

type BoardStatus = 'open' | 'pending_review' | 'claimed';

const FILTERS: Array<{ value: BoardStatus; label: string }> = [
  { value: 'open', label: 'Open' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'claimed', label: 'Claimed' },
];

const STATUS_LABELS: Record<BoardStatus, string> = {
  open: 'Open',
  pending_review: 'Pending review',
  claimed: 'Claimed',
};

const STATUS_STYLES: Record<BoardStatus, string> = {
  open: 'border-[#72D59A]/35 bg-[#72D59A]/10 text-[#9DE6B8]',
  pending_review: 'border-[#7DB7FF]/35 bg-[#7DB7FF]/10 text-[#A9CEFF]',
  claimed: 'border-[#F97316]/45 bg-[#F97316]/10 text-[#FFAA70]',
};

function formatPayout(amount: number | null): string {
  if (amount === null) return 'TBD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return 'No deadline';
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${deadline}T00:00:00Z`));
}

function boardStatus(bounty: GithubBounty, claimStatus?: BountyClaimStatus): BoardStatus {
  if (claimStatus === 'pending') return 'pending_review';
  if (claimStatus === 'approved') return 'claimed';
  return bounty.status === 'open' ? 'open' : 'claimed';
}

function BountySkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-56 animate-pulse rounded-lg border border-[#FFE083]/10 bg-[#2F2410] motion-reduce:animate-none" />
      ))}
    </div>
  );
}

interface BountyCardProps {
  bounty: GithubBounty;
  status: BoardStatus;
  ownedPending: boolean;
  submitting: boolean;
  errorMessage?: string;
  authenticated: boolean;
  accountReady: boolean;
  accountConfigured: boolean;
  onClaim: () => void;
  onLogin: () => void;
}

function BountyCard({
  bounty,
  status,
  ownedPending,
  submitting,
  errorMessage,
  authenticated,
  accountReady,
  accountConfigured,
  onClaim,
  onLogin,
}: BountyCardProps) {
  const canClaim = status === 'open' && authenticated && accountReady && accountConfigured && !submitting;

  return (
    <article className="rounded-lg border border-[#FFE083]/12 bg-[#2F2410] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.18)] sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-[#CDBF98]">
          {bounty.githubIssueNumber ? `Issue #${bounty.githubIssueNumber}` : 'Issue created after approval'}
        </span>
        <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', STATUS_STYLES[status])}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_9rem_13rem] md:items-center">
        <div className="min-w-0">
          <h2 className="text-wrap-balance text-lg font-bold leading-6 text-[#FFE083] sm:text-xl">{bounty.title}</h2>
          {bounty.bodyMd && <p className="mt-2 line-clamp-2 max-w-[70ch] text-sm leading-6 text-[#D8CCAA]">{bounty.bodyMd}</p>}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#E8DDBD]">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#F97316]" aria-hidden="true" />
              {formatDeadline(bounty.deadline)}
            </span>
            <span className="inline-flex items-center gap-2">
              <UserRound className="h-4 w-4 text-[#F97316]" aria-hidden="true" />
              {bounty.reviewer || 'Reviewer unassigned'}
            </span>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-[#CDBF98]">Payout</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-[#FFE083]">{formatPayout(bounty.amountUsd)}</p>
        </div>

        <div className="space-y-2">
          {status === 'open' && authenticated ? (
            <button
              type="button"
              onClick={onClaim}
              disabled={!canClaim}
              aria-describedby={errorMessage ? `claim-error-${bounty.bountyId}` : undefined}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-bold text-[#181303] transition-colors duration-200 hover:bg-[#FF8A33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE083] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2F2410] disabled:cursor-not-allowed disabled:bg-[#6B5B3A] disabled:text-[#CDBF98]"
            >
              {submitting ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
              {submitting ? 'Submitting…' : 'Claim bounty'}
            </button>
          ) : status === 'open' ? (
            <button
              type="button"
              onClick={onLogin}
              disabled={!accountReady || !accountConfigured}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#F97316] px-4 py-2.5 text-sm font-bold text-[#FFAA70] transition-colors duration-200 hover:bg-[#F97316]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE083] disabled:cursor-not-allowed disabled:border-[#6B5B3A] disabled:text-[#AFA27F]"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              {!accountReady ? 'Loading account…' : accountConfigured ? 'Sign in to claim' : 'Sign-in unavailable'}
            </button>
          ) : status === 'pending_review' ? (
            <div className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#7DB7FF]/35 bg-[#7DB7FF]/10 px-4 py-2.5 text-center text-sm font-bold text-[#A9CEFF]" role="status">
              <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
              {ownedPending ? 'Submitted — awaiting review' : 'Pending review'}
            </div>
          ) : bounty.htmlUrl ? (
            <a
              href={bounty.htmlUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#F97316]/45 bg-[#F97316]/10 px-4 py-2.5 text-sm font-bold text-[#FFAA70] transition-colors duration-200 hover:bg-[#F97316]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE083]"
            >
              View issue
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <div className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#F97316]/35 bg-[#F97316]/10 px-4 py-2.5 text-sm font-bold text-[#FFAA70]" role="status">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Claimed
            </div>
          )}

          {errorMessage && (
            <p id={`claim-error-${bounty.bountyId}`} role="alert" className="text-sm leading-5 text-[#FFB4A8]">
              {errorMessage}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function Bounties() {
  useSeo({
    title: 'Bounties',
    description: 'Browse open Baraza work and submit a claim for review.',
    path: '/bounties',
  });

  const account = useAccount();
  const [selectedStatus, setSelectedStatus] = useState<BoardStatus>('open');
  const [bounties, setBounties] = useState<GithubBounty[]>([]);
  const [claimStatuses, setClaimStatuses] = useState<Record<string, BountyClaimStatus>>({});
  const [ownedPending, setOwnedPending] = useState<Set<string>>(() => new Set());
  const [submittingBountyId, setSubmittingBountyId] = useState<string | null>(null);
  const [claimErrors, setClaimErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextBounties, nextClaims] = await Promise.all([
        listGithubBounties(),
        listBountyClaimStates(),
      ]);
      setBounties(nextBounties);
      setClaimStatuses(Object.fromEntries(nextClaims.map((claim) => [claim.bountyId, claim.status])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load bounties.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBoard();
  }, []);

  const bountyRows = useMemo(
    () => bounties.map((bounty) => ({
      bounty,
      status: boardStatus(bounty, claimStatuses[bounty.bountyId]),
    })),
    [bounties, claimStatuses],
  );

  const filteredBounties = useMemo(
    () => bountyRows.filter((row) => row.status === selectedStatus),
    [bountyRows, selectedStatus],
  );

  const statusCounts = useMemo(() => bountyRows.reduce<Record<BoardStatus, number>>((counts, row) => {
    counts[row.status] += 1;
    return counts;
  }, { open: 0, pending_review: 0, claimed: 0 }), [bountyRows]);

  const claimBounty = async (bounty: GithubBounty) => {
    setSubmittingBountyId(bounty.bountyId);
    setClaimErrors((current) => ({ ...current, [bounty.bountyId]: '' }));

    try {
      const accessToken = await account.getAccessToken();
      if (!accessToken) throw new Error('Your session could not be verified. Please sign in again.');

      await submitBountyClaim({
        bountyId: bounty.bountyId,
        claimantDisplayName: account.displayName,
        accessToken,
      });

      setClaimStatuses((current) => ({ ...current, [bounty.bountyId]: 'pending' }));
      setOwnedPending((current) => new Set(current).add(bounty.bountyId));
    } catch (claimError) {
      setClaimErrors((current) => ({
        ...current,
        [bounty.bountyId]: claimError instanceof Error ? claimError.message : 'Could not submit the claim.',
      }));
      try {
        const nextClaims = await listBountyClaimStates();
        setClaimStatuses(Object.fromEntries(nextClaims.map((claim) => [claim.bountyId, claim.status])));
      } catch {
        // Keep the actionable submission error visible if status refresh also fails.
      }
    } finally {
      setSubmittingBountyId(null);
    }
  };

  return (
    <Layout>
      <section className="min-h-screen bg-[#181303] pb-28 pt-24 text-[#F6EDCF] sm:pt-28">
        <div className="container mx-auto max-w-5xl px-4">
          <header className="border-b border-[#FFE083]/15 pb-6">
            <h1 className="text-3xl font-black text-[#FFE083] sm:text-4xl">Bounty board</h1>
            <p className="mt-3 max-w-[70ch] text-sm leading-6 text-[#D8CCAA] sm:text-base">
              Choose an open task and submit your claim for review. Work coordination moves to GitHub only after approval.
            </p>
          </header>

          <div className="mt-6 overflow-x-auto pb-1">
            <div className="inline-flex min-w-full gap-1 rounded-lg border border-[#FFE083]/15 bg-[#211A09] p-1 sm:min-w-0" role="tablist" aria-label="Bounty status">
              {FILTERS.map((filter) => {
                const active = selectedStatus === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedStatus(filter.value)}
                    className={cn(
                      'min-h-10 flex-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE083]',
                      active ? 'bg-[#F97316] text-[#181303]' : 'text-[#D8CCAA] hover:bg-[#2F2410] hover:text-[#FFE083]',
                    )}
                  >
                    {filter.label}
                    <span className={cn('ml-2 text-xs tabular-nums', active ? 'text-[#181303]/75' : 'text-[#AFA27F]')}>
                      {statusCounts[filter.value]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5" role="tabpanel">
            {loading ? (
              <BountySkeleton />
            ) : error ? (
              <div className="rounded-lg border border-[#F97316]/35 bg-[#2F2410] px-5 py-8 text-center">
                <p className="font-semibold text-[#FFE083]">Bounties could not be loaded.</p>
                <p className="mt-2 text-sm text-[#D8CCAA]">{error}</p>
                <button type="button" onClick={() => void loadBoard()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#F97316] px-4 py-2 text-sm font-bold text-[#FFAA70] hover:bg-[#F97316]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFE083]">
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : filteredBounties.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#FFE083]/25 bg-[#2F2410]/70 px-6 py-16 text-center">
                <p className="mx-auto max-w-md text-lg font-bold text-[#FFE083]">No bounties match this status yet.</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-[#D8CCAA]">Choose another status to continue browsing.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBounties.map(({ bounty, status }) => (
                  <BountyCard
                    key={bounty.bountyId}
                    bounty={bounty}
                    status={status}
                    ownedPending={ownedPending.has(bounty.bountyId)}
                    submitting={submittingBountyId === bounty.bountyId}
                    errorMessage={claimErrors[bounty.bountyId]}
                    authenticated={account.authenticated}
                    accountReady={account.ready}
                    accountConfigured={account.configured}
                    onClaim={() => void claimBounty(bounty)}
                    onLogin={account.login}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
