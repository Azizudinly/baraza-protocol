import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Compass, LayoutDashboard, Sparkles, WalletCards } from "lucide-react";
import { useAkiliChat } from "@/akili/useAkiliChat";

const platformLinks = [
  {
    icon: Compass,
    label: "Discover",
    title: "Find active communities",
    detail: "Browse communities — filter by type and payment rail.",
    to: "/communities",
  },
  {
    icon: WalletCards,
    label: "Launch",
    title: "Set group rules",
    detail: "Set dues, quorum, voting windows, and payment paths in one guided flow.",
    to: "/create",
  },
  {
    icon: LayoutDashboard,
    label: "Operate",
    title: "Run group fund decisions",
    detail: "Track members, proposals, balances, and releases from the dashboard.",
    to: "/profile",
  },
];

export default function AIPlatformSection() {
  const { open } = useAkiliChat();

  return (
    <section className="relative py-8 md:py-12" id="ai-platform">
      <div className="container mx-auto max-w-7xl px-4">
        <motion.div
          initial={{ y: 18, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch"
        >
          <div className="rounded-2xl border border-primary/20 bg-card p-5 shadow-[var(--shadow-card)] md:p-6">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Baraza platform
            </div>
            <h2 className="font-display text-2xl font-black leading-tight md:text-3xl">
              Website, operating platform, and AI guide in one clean flow.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base md:leading-7">
              Visitors can understand the model, organisers can launch a community, and members can
              vote and track funds — Akili is available when someone needs a next step.
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => open("Help me set up my community on Baraza")}
                className="btn-warm inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold"
              >
                Ask Akili
                <Bot className="h-4 w-4" />
              </button>
              <Link
                to="/communities"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 px-5 py-3 text-sm font-extrabold transition-colors hover:border-primary/50"
              >
                Enter platform
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Mobile: one card per swipe instead of a long stack */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0">
            {platformLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className="group min-w-[78%] snap-start rounded-2xl border border-border/70 bg-card/70 p-4 transition-all hover:border-primary/40 hover:bg-surface md:min-w-0"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="grid h-10 w-10 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[0.65rem] font-bold uppercase tracking-widest text-primary">
                      {item.label}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold leading-tight">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
                  <ArrowRight className="mt-4 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
