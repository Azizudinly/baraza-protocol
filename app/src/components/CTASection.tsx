import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Coins, Link2, ShieldCheck, Users } from "lucide-react";
import { ShimmerButton } from "@/components/ui/shimmer-button";

const steps = [
  { icon: Link2, title: "Choose how you sign in", desc: "Use your phone number for M-Pesa flows, or connect a supported account. No seed phrases needed to join." },
  { icon: ShieldCheck, title: "Set basics & rules", desc: "Name your community, set monthly dues in your account currency, and define quorum, approval, and voting period." },
  { icon: Users, title: "Invite members", desc: "Share the join link. Members can join with M-Pesa or a connected account." },
  { icon: Coins, title: "Govern transparently", desc: "Members propose, vote, and release funds. Every action stays visible in one shared record." },
];

const summary = [
  { label: "Setup time", value: "4 min" },
  { label: "Group funds mode", value: "Shared" },
  { label: "Decision rule", value: "Quorum" },
];

export default function CTASection() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.5 }}
          className="dark grid overflow-hidden rounded-2xl border border-border/70 bg-[image:var(--gradient-hero)] text-foreground shadow-[var(--shadow-deep)] lg:grid-cols-[0.9fr_1.1fr]"
        >
          <div className="border-b border-border/70 p-5 sm:p-8 md:p-10 lg:border-b-0 lg:border-r">
            <p className="text-xs font-semibold uppercase tracking-widest text-accent">Launch group funds</p>
            <h2 className="mt-3 max-w-xl font-display text-3xl font-bold leading-tight text-foreground md:text-4xl">
              Launch your community with rules everyone can inspect
            </h2>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
              Start with working group funds, not a blank workspace. Baraza gives members a shared
              dashboard from the first contribution to the final governance vote.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/create" tabIndex={-1}>
                <ShimmerButton
                  background="var(--gradient-warm)"
                  shimmerColor="rgba(255,255,255,0.5)"
                  className="w-full justify-center rounded-lg px-7 py-3.5 text-sm font-bold sm:w-auto"
                >
                  Launch a community
                  <ArrowRight className="h-4 w-4" />
                </ShimmerButton>
              </Link>
              <Link to="/communities" className="btn-ghost justify-center rounded-lg px-7 py-3.5 text-sm">
                Browse communities
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3">
              {summary.map((item) => (
                <div key={item.label} className="rounded-lg border border-border/60 bg-background/35 p-3">
                  <p className="text-[10px] uppercase text-muted-foreground">{item.label}</p>
                  <p className="mt-1 font-display text-sm font-bold text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 bg-surface/45 p-4 sm:p-5 sm:grid-cols-2 md:p-6">
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <div key={step.title} className="rounded-xl border border-border/70 bg-background/35 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="font-display text-xs text-muted-foreground">0{index + 1}</span>
                  </div>
                  <h3 className="font-display text-base font-bold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
