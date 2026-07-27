import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CircleMinus, Loader2, MessageCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import Layout from "@/components/Layout";
import { DEFAULT_GOVERNANCE } from "@/lib/constants";
import { useCastVote, useDecision, useVoteStatus } from "@/hooks/useBarazaData";
import { daysRemaining, formatRailAmountFromKes, formatRailDate } from "@/lib/utils";
import { useWalletGuard } from "@/hooks/useWalletGuard";
import { useCommunity } from "@/hooks/useCommunities";
import { useToast } from "@/hooks/use-toast";
import { STAGE_META, inferStage } from "@/lib/proposalStatus";
import CommunityBanner from "@/components/CommunityBanner";
import { useSeo } from "@/lib/seo";
import AkiliSecurityReview from "@/akili/AkiliSecurityReview";
import { reviewProposal } from "@/lib/securityReview";
import { useChain } from "@/hooks/useChain";
import {
  addProposalComment,
  listProposalAuditTrail,
  listProposalComments,
  voteOptionLabel,
} from "@/lib/governance";
import type { VoteOption } from "@/types";

export default function ProposalDetail() {
  const { id, decisionId } = useParams<{ id: string; decisionId: string }>();
  const proposal = useDecision(decisionId ?? '');
  const { community } = useCommunity(proposal?.communityId);
  const { requireWallet, address } = useWalletGuard({ action: "vote on this proposal" });
  const { vote: submitVote, isLoading: isPending } = useCastVote();
  const existingVote = useVoteStatus(decisionId ?? '', address);
  const { toast } = useToast();
  const { chainMeta } = useChain();
  const [commentBody, setCommentBody] = useState("");
  const [commentVersion, setCommentVersion] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const comments = useMemo(() => proposal ? listProposalComments(proposal.id) : [], [proposal?.id, commentVersion]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const auditTrail = useMemo(() => proposal ? listProposalAuditTrail(proposal.id) : [], [proposal?.id, commentVersion]);

  useSeo({
    title: proposal && community
      ? `${proposal.title} — ${community.name}`
      : proposal?.title ?? "Proposal",
    description: proposal?.description ?? "View proposal details, vote, and track quorum on Baraza.",
    path: id && decisionId ? `/dashboard/${id}/decisions/${decisionId}` : undefined,
    noIndex: true,
  });

  if (!proposal) {
    return (
      <Layout>
        <section className="py-20">
          <div className="mx-auto max-w-md px-4 text-center">
            <h1 className="font-display text-2xl font-bold">Proposal not found</h1>
            <p className="mt-3 text-sm">
              This governance proposal doesn&apos;t exist or has been removed.
            </p>
            <Link to={id ? `/dashboard/${id}` : "/communities"} className="btn-warm mt-6 inline-flex items-center gap-2 text-sm">
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
          </div>
        </section>
      </Layout>
    );
  }

  const abstainVotes = proposal.votesAbstain ?? 0;
  const decidedVotes = proposal.votesFor + proposal.votesAgainst;
  // Abstaining counts toward quorum (participation) but not toward approval.
  const totalVotes = decidedVotes + abstainVotes;
  const support = decidedVotes > 0
    ? Math.round((proposal.votesFor / decidedVotes) * 100)
    : 0;
  // Unrounded: segment widths must sum to exactly 100.
  const forPct = totalVotes > 0 ? (proposal.votesFor / totalVotes) * 100 : 0;
  const againstPct = totalVotes > 0 ? (proposal.votesAgainst / totalVotes) * 100 : 0;
  const abstainPct = totalVotes > 0 ? 100 - forPct - againstPct : 0;
  const quorum = proposal.totalMembers > 0
    ? Math.round((totalVotes / proposal.totalMembers) * 100)
    : 0;
  const days = daysRemaining(proposal.endsAt);
  const stage = inferStage(proposal.status);
  const stageMeta = STAGE_META[stage];
  const StageIcon = stageMeta.icon;
  const isVotable = stageMeta.votable;
  const endsLabel = !isVotable
    ? "Voting closed"
    : days === 0
      ? "Closes today"
      : `Ends in ${days} day${days === 1 ? "" : "s"}`;
  const treasuryImpactPct = community?.fundBalance
    ? Math.round((proposal.fundingAmount / community.fundBalance) * 1000) / 10
    : null;
  const quorumRequiredPct = community?.quorumPct ?? DEFAULT_GOVERNANCE.quorumPct;
  const securityReview = reviewProposal(proposal, community ?? undefined);

  const handleVote = (vote: VoteOption) => async () => {
    await requireWallet(async () => {
      // requireWallet only runs the callback when connected, so address is set.
      const voterKey = address;
      if (!voterKey) return;
      const voteType = vote === 'yes' ? 'for' : vote === 'no' ? 'against' : 'abstain';
      const success = await submitVote(proposal.id, voterKey, voteType);
      if (success) {
        toast({
          title: `${voteOptionLabel(vote)} vote recorded`,
          description: "Your vote has been counted in this group's tally.",
        });
      } else {
        toast({
          title: "Vote could not be cast",
          description: existingVote
            ? "You already voted on this proposal."
            : "This proposal is not open for voting.",
          variant: "destructive",
        });
      }
    });
  };

  const handleAddComment = () => {
    try {
      addProposalComment({
        proposalId: proposal.id,
        memberId: "local-member",
        body: commentBody,
      });
      setCommentBody("");
      setCommentVersion((value) => value + 1);
    } catch (err) {
      toast({
        title: "Comment failed",
        description: err instanceof Error ? err.message : "Could not add proposal comment.",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <section className="py-10 md:py-14">
        <div className="container mx-auto px-4">
          <Link to={`/dashboard/${id ?? proposal.communityId}`} className="mb-6 inline-flex items-center gap-2 text-sm">
            <ArrowLeft className="h-4 w-4" />
            Back to proposals
          </Link>

          <div className="grid gap-6 xl:grid-cols-[0.68fr_0.32fr]">
            <main className="space-y-6">
              <CommunityBanner className="p-5 md:p-6">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${stageMeta.className}`}
                    aria-label={`Stage: ${stageMeta.label}`}
                  >
                    <StageIcon className="h-3 w-3" />
                    {stageMeta.label}
                  </span>
                  <span className="text-xs">#{proposal.id.padStart(3, "0")}</span>
                </div>
                <h1 className="font-display text-3xl font-bold">{proposal.title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6">{proposal.description}</p>
              </CommunityBanner>

              <div className="grid gap-4 md:grid-cols-4">
                {[
                  ["Requested funding", formatRailAmountFromKes(proposal.fundingAmount, chainMeta)],
                  ["Share of group funds", treasuryImpactPct !== null ? `-${treasuryImpactPct}%` : "—"],
                  ["Quorum required", `${quorumRequiredPct}%`],
                  ["Current approval", totalVotes > 0 ? `${support}%` : "—"],
                ].map(([label, value]) => (
                  <div key={label} className="baraza-card p-4">
                    <p className="font-mono text-xs uppercase tracking-widest">{label}</p>
                    <p className="mt-2 font-display text-xl font-bold">{value}</p>
                  </div>
                ))}
              </div>

              <div className="baraza-card p-5 md:p-6">
                <div className="mb-5 flex items-center justify-between gap-4 border-b pb-4">
                  <h2 className="font-display text-xl font-semibold">Member voting</h2>
                  <span className="text-sm">{endsLabel}</span>
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap justify-between gap-x-3 text-sm">
                    <span>Support ({proposal.votesFor})</span>
                    <span>Object ({proposal.votesAgainst})</span>
                    <span className="text-muted-foreground">Abstain ({abstainVotes})</span>
                  </div>
                  <div className="flex h-4 overflow-hidden rounded-full bg-muted">
                    <div className="bg-primary transition-all" style={{ width: `${forPct}%` }} />
                    <div className="bg-destructive/70 transition-all" style={{ width: `${againstPct}%` }} />
                    <div className="bg-muted-foreground/35 transition-all" style={{ width: `${abstainPct}%` }} />
                  </div>
                  <div className="flex justify-between font-mono text-xs">
                    <span>{support}% approval of decided votes</span>
                    <span>{quorum}% quorum progress</span>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={handleVote("yes")}
                    disabled={isPending || !isVotable || !!existingVote}
                    className="btn-warm justify-center gap-2 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                    Vote yes
                  </button>
                  <button
                    type="button"
                    onClick={handleVote("no")}
                    disabled={isPending || !isVotable || !!existingVote}
                    className="btn-ghost justify-center gap-2 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
                    Vote no
                  </button>
                  <button
                    type="button"
                    onClick={handleVote("abstain")}
                    disabled={isPending || !isVotable || !!existingVote}
                    className="btn-ghost justify-center gap-2 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleMinus className="h-4 w-4" />}
                    Abstain
                  </button>
                </div>
                <p className="mt-3 text-xs">
                  {existingVote
                    ? `You voted ${existingVote === 'for' ? 'yes' : existingVote === 'against' ? 'no' : 'abstain'} on this proposal.`
                    : "One vote per member. Your vote is recorded in the shared ledger."}
                </p>
              </div>

              <div className="baraza-card p-5 md:p-6">
                <div className="mb-4 flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-xl font-semibold">Proposal comments</h2>
                </div>
                <textarea
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder="Add a member comment or question for the proposal record."
                  className="min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
                <button type="button" onClick={handleAddComment} className="btn-warm mt-3 text-sm">
                  Add comment
                </button>
                <div className="mt-5 space-y-3">
                  {comments.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No comments yet. Members can ask questions before voting.
                    </p>
                  ) : comments.map((comment) => (
                    <article key={comment.id} className="rounded-lg border p-4">
                      <p className="text-sm leading-6">{comment.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {comment.memberId} · {formatRailDate(comment.createdAt, chainMeta, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </article>
                  ))}
                </div>
              </div>
            </main>

            <aside className="space-y-6">
              <AkiliSecurityReview review={securityReview} />

              <div className="baraza-card p-5">
                <h3 className="font-mono text-xs uppercase tracking-widest">Proposal activity</h3>
                <div className="mt-5 space-y-4 border-l pl-5">
                  <div className="relative">
                    <span className="absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full bg-primary" />
                    <p className="text-sm">Proposal opened for voting</p>
                    <p className="text-xs">
                      {formatRailDate(proposal.createdAt, chainMeta, { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="relative">
                    <span className="absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full bg-primary" />
                    <p className="text-sm">
                      {isVotable ? "Voting closes" : "Voting closed"}
                    </p>
                    <p className="text-xs">
                      {formatRailDate(proposal.endsAt, chainMeta, { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  {auditTrail.map((entry) => (
                    <div key={entry.id} className="relative">
                      <span className="absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full bg-accent" />
                      <p className="text-sm">{entry.action}</p>
                      <p className="text-xs">
                        {formatRailDate(entry.createdAt, chainMeta, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </Layout>
  );
}
