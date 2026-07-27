import { useState } from "react";
import {
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Link2,
  ShieldCheck,
  Users,
  Vote,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

type FlowKey = "member" | "organizer";

interface FlowStep {
  title: string;
  detail: string;
  icon: LucideIcon;
  stat: string;
}

const flows: Record<FlowKey, { label: string; title: string; steps: FlowStep[] }> = {
  member: {
    label: "Member",
    title: "Join, pay, vote, and track the shared group funds.",
    steps: [
      {
        title: "Open invite",
        detail: "A member follows the join link and reviews the rules before joining.",
        icon: Link2,
        stat: "01",
      },
      {
        title: "Pay dues",
        detail: "Members can pay by M-Pesa or their account, then attach proof to the membership request.",
        icon: CircleDollarSign,
        stat: "Local",
      },
      {
        title: "Vote",
        detail: "Active members vote on proposals with visible quorum progress.",
        icon: Vote,
        stat: "73%",
      },
      {
        title: "Verify",
        detail: "Group funds activity stays visible after every contribution and decision.",
        icon: CheckCircle2,
        stat: "Live",
      },
    ],
  },
  organizer: {
    label: "Organizer",
    title: "Launch the group, set rules, admit members, and release funds.",
    steps: [
      {
        title: "Launch group",
        detail: "Set the group name, type, dues, quorum, approval, and vote window.",
        icon: ClipboardList,
        stat: "4m",
      },
      {
        title: "Invite group",
        detail: "Share one joining path for connected accounts and phone-first members.",
        icon: Users,
        stat: "Link",
      },
      {
        title: "Confirm money",
        detail: "Payment confirmations connect contributions to the shared record automatically.",
        icon: Banknote,
        stat: "Verified",
      },
      {
        title: "Release by rule",
        detail: "Approved proposals become controlled fund movement.",
        icon: ShieldCheck,
        stat: "Rule",
      },
    ],
  },
};

function FlowPoint({ step, index }: { step: FlowStep; index: number }) {
  const Icon = step.icon;
  return (
    <div
      className={cn(
        "flex min-w-[78%] snap-start flex-col gap-3 rounded-xl border border-border/50 bg-surface p-4 md:min-w-0 md:p-5",
        // Editorial wave: cards 2 and 4 drop down a half-step on desktop so
        // the 4-col flow row reads as a rhythm rather than identical tiles.
        index % 2 === 1 && "md:translate-y-6",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <span className="select-none font-mono text-3xl font-black leading-none text-primary/15 tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div>
        <span className="inline-flex rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          {step.stat}
        </span>
        <h3 className="mt-2 font-display text-base font-bold">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.detail}</p>
      </div>
    </div>
  );
}

export default function FlowWalkthrough() {
  const [activeFlow, setActiveFlow] = useState<FlowKey>("member");
  const flow = flows[activeFlow];

  return (
    <section id="flow-walkthrough" className="relative scroll-mt-16 py-10 md:py-12">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="mx-auto">
          <motion.div
            className="mb-6"
            initial={{ y: 24, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest">Flow walkthrough</p>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold leading-tight md:text-4xl">
              Two paths, one shared source of truth
            </h2>
          </motion.div>

          <motion.div
            className="overflow-hidden rounded-2xl border border-border/60 bg-card p-4 md:p-7"
            initial={{ y: 24, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, delay: 0.1 }}
          >
            {/* Tab toggle */}
            <div className="relative mx-auto mb-8 grid w-full max-w-xl grid-cols-2 rounded-2xl bg-muted p-1.5">
              {(Object.keys(flows) as FlowKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveFlow(key)}
                  className={cn(
                    "rounded-xl px-5 py-3 text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 md:text-xl",
                    activeFlow === key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  aria-pressed={activeFlow === key}
                >
                  {flows[key].label}
                </button>
              ))}
            </div>

            {/* Flow content */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeFlow}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                <p className="mx-auto mb-6 max-w-2xl text-center text-base leading-relaxed text-muted-foreground md:text-lg">
                  {flow.title}
                </p>

                {/* Mobile: swipeable steps instead of a 4-card stack */}
                <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 md:pb-0">
                  {flow.steps.map((step, index) => (
                    <FlowPoint key={step.title} step={step} index={index} />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
