import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Eye,
  FileCheck2,
  LockKeyhole,
  Vote,
} from "lucide-react";
import { cn, formatKSh } from "@/lib/utils";

const workflow = [
  {
    icon: CircleDollarSign,
    label: "Collect",
    title: "Dues land in one shared group account",
    description:
      "Set monthly contributions, record member payments, and keep balances visible without chasing private ledgers.",
    metric: "91%",
    metricLabel: "dues collected",
  },
  {
    icon: Vote,
    label: "Govern",
    title: "Every spending request becomes a vote",
    description:
      "Members review proposals, support or object, and see quorum progress before funds can move.",
    metric: "64%",
    metricLabel: "quorum reached",
  },
  {
    icon: LockKeyhole,
    label: "Release",
    title: "Payouts follow the group rule",
    description:
      "Approval thresholds keep fund movement matched to the member decision.",
    metric: "17h",
    metricLabel: "vote window left",
  },
  {
    icon: Eye,
    label: "Audit",
    title: "A permanent trail for every shilling",
    description:
      "Contribution history, proposal outcomes, and disbursements stay traceable from the dashboard.",
    metric: "100%",
    metricLabel: "visible activity",
  },
];

const ledgerRows = [
  { item: "Monthly dues", status: "Confirmed", valueKes: 168000, prefix: "+", tone: "text-primary" },
  { item: "Maize mill vote", status: "In quorum", value: "78%", tone: "text-accent" },
  { item: "Supplier payout", status: "Approved", valueKes: 48000, prefix: "-", tone: "text-orange" },
  { item: "Emergency fund", status: "Locked", valueKes: 210000, prefix: "", tone: "text-secondary" },
];

function WorkflowCard({ step, index }: { step: (typeof workflow)[number]; index: number }) {
  const Icon = step.icon;

  return (
    <motion.div
      initial={{ y: 18, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, amount: 0 }}
      transition={{ delay: index * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative min-w-[82%] snap-start rounded-xl border border-border/70 bg-card/78 p-5 shadow-[var(--shadow-card)] sm:min-w-0",
        "transition-all duration-200 hover:border-primary/40 hover:bg-surface",
        // Editorial offset: cards 2 and 4 drop down so the 2x2 grid breaks
        // the uniform-AI-grid symmetry without changing card semantics.
        index % 2 === 1 && "sm:mt-10",
      )}
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-primary">{step.label}</span>
        </div>
        <span className="font-display text-xs text-muted-foreground">0{index + 1}</span>
      </div>

      <h3 className="font-display text-lg font-bold leading-snug text-foreground">{step.title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.description}</p>

      <div className="mt-5 flex items-end justify-between border-t border-border/50 pt-4">
        <div>
          <p className="font-display text-2xl font-bold text-foreground">{step.metric}</p>
          <p className="text-xs text-muted-foreground">{step.metricLabel}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
      </div>
    </motion.div>
  );
}

export default function FeaturesSection() {
  return (
    <section className="relative py-20" id="features">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="container mx-auto px-4">
        <div className="mb-10 grid gap-6 lg:grid-cols-[0.78fr_1fr] lg:items-end">
          <div>
            <motion.p
              initial={{ y: 14, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, amount: 0 }}
              className="text-xs font-semibold uppercase tracking-widest text-primary"
            >
              Product workflow
            </motion.p>
            <motion.h2
              initial={{ y: 14, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, amount: 0 }}
              transition={{ delay: 0.05 }}
              className="mt-3 max-w-2xl font-display text-3xl font-bold leading-tight text-foreground md:text-4xl"
            >
              The group funds loop your members can inspect
            </motion.h2>
          </div>
          <motion.p
            initial={{ y: 14, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-2xl text-base leading-relaxed text-muted-foreground lg:justify-self-end"
          >
            Baraza turns group finance into a clear operating flow: collect contributions,
            govern proposals, release funds by rule, and audit the full history.
          </motion.p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_0.78fr]">
          {/* Mobile: swipeable workflow cards instead of a tall stack */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0">
            {workflow.map((step, index) => (
              <WorkflowCard key={step.label} step={step} index={index} />
            ))}
          </div>

          <motion.div
            initial={{ y: 18, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true, amount: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-border/70 bg-surface/70 p-5 shadow-[var(--shadow-card)]"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Sample ledger</p>
                <h3 className="mt-1 font-display text-xl font-bold text-foreground">Group funds state</h3>
              </div>
              <FileCheck2 className="h-5 w-5 text-primary" />
            </div>

            <div className="space-y-3">
              {ledgerRows.map((row) => (
                <div
                  key={row.item}
                  className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-border/60 bg-background/35 p-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">{row.item}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                      {row.status}
                    </p>
                  </div>
                  <p className={cn("self-center text-sm font-bold tabular-nums", row.tone)}>
                    {'valueKes' in row ? `${row.prefix} ${formatKSh(row.valueKes ?? 0)}`.trim() : row.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-primary/20 bg-primary/8 p-4">
              <p className="text-sm font-semibold text-foreground">Shared visibility by default</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Members see the same source of truth before, during, and after each decision.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
