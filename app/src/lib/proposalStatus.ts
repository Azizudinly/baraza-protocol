/**
 * Proposal lifecycle stage display metadata + inference.
 *
 * Mirrors the on-chain `ProposalStatus` enum from
 * `programs/governance/src/lib.rs`. UI surfaces the stage as a colored pill;
 * once the governance program is wired, `lifecycleStage` will arrive on
 * Decision objects directly. Until then, `inferStage()` derives it from the
 * legacy `status` field on mock decisions.
 */

import type { ProposalLifecycleStage } from '@/lib/constants';
import {
  Ban,
  CheckCircle2,
  Clock,
  Clock3,
  Hourglass,
  ShieldOff,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

export interface StageMeta {
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for the pill background + text */
  className: string;
  /** Whether vote actions should be enabled in this stage */
  votable: boolean;
  /** Whether the stage is terminal (no further transitions) */
  terminal: boolean;
}

export const STAGE_META: Record<ProposalLifecycleStage, StageMeta> = {
  pending:   { label: 'Pending',   icon: Hourglass,    className: 'bg-accent/12 text-accent',          votable: false, terminal: false },
  active:    { label: 'Voting',    icon: Clock,        className: 'bg-primary/15 text-primary',         votable: true,  terminal: false },
  defeated:  { label: 'Defeated',  icon: XCircle,      className: 'bg-destructive/15 text-destructive', votable: false, terminal: true  },
  succeeded: { label: 'Passed',    icon: CheckCircle2, className: 'bg-confirmed/15 text-confirmed',     votable: false, terminal: false },
  queued:    { label: 'Queued',    icon: Clock3,       className: 'bg-accent/15 text-accent',           votable: false, terminal: false },
  executed:  { label: 'Executed',  icon: CheckCircle2, className: 'bg-confirmed/15 text-confirmed',     votable: false, terminal: true  },
  expired:   { label: 'Expired',   icon: XCircle,      className: 'bg-muted text-muted-foreground',     votable: false, terminal: true  },
  canceled:  { label: 'Canceled',  icon: Ban,          className: 'bg-muted text-muted-foreground',     votable: false, terminal: true  },
  vetoed:    { label: 'Vetoed',    icon: ShieldOff,    className: 'bg-destructive/15 text-destructive', votable: false, terminal: true  },
  tied:      { label: 'Tied',      icon: XCircle,      className: 'bg-muted text-muted-foreground',     votable: false, terminal: true  },
  tied_extended: { label: 'Deliberation Extended (48h)', icon: Clock3, className: 'bg-accent/15 text-accent font-semibold', votable: true, terminal: false },
};

/**
 * Infer a lifecycle stage from the legacy `status` field. Used when the
 * authoritative on-chain stage is not (yet) attached to a Decision.
 *
 * Unknown status values fall back to `'pending'` rather than `'active'` —
 * surfacing vote buttons on a proposal with mystery status is worse than
 * surfacing a quiet "Pending" pill that won't accept votes.
 */
export function inferStage(status: string): ProposalLifecycleStage {
  if (status === 'completed' || status === 'executed') return 'executed';
  if (status === 'failed') return 'defeated';
  if (status === 'passed' || status === 'succeeded') return 'succeeded';
  if (status === 'active') return 'active';
  if (status === 'tied_extended') return 'tied_extended';
  if (status === 'tied') return 'tied';
  return 'pending';
}
