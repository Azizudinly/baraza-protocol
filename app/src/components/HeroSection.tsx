import { Link } from "react-router-dom";
import { useEffect, useState, type MouseEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowUp,
  Banknote,
  ShieldCheck,
  Sparkles,
  Users,
  Vote,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAkiliChat } from "@/akili/useAkiliChat";

const stats = [
  { label: "Group funds and votes", value: "Govern" },
  { label: "M-Pesa onboarding", value: "Mobile" },
  { label: "Activity tracking", value: "Track" },
];

const headlineWords = ["DAO", "SACCO", "Co-op"];

const walkthroughFrames: Array<{
  label: string;
  title: string;
  detail: string;
  progress: string;
  icon: LucideIcon;
}> = [
  {
    label: "Invite",
    title: "Share the join link",
    detail: "Members open the invite and review the rules before joining.",
    progress: "25%",
    icon: Users,
  },
  {
    label: "Dues",
    title: "Confirm payments",
    detail: "M-Pesa confirmations attach to member requests and group fund records.",
    progress: "50%",
    icon: Banknote,
  },
  {
    label: "Vote",
    title: "Reach quorum",
    detail: "Active members vote and see the decision status update clearly.",
    progress: "75%",
    icon: Vote,
  },
  {
    label: "Release",
    title: "Move funds by rule",
    detail: "Approved proposals become governed fund movement.",
    progress: "100%",
    icon: ShieldCheck,
  },
];

function HeroHeadline() {
  const [activeWord, setActiveWord] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const word = headlineWords[activeWord];

  useEffect(() => {
    if (prefersReducedMotion) return;
    const interval = window.setInterval(() => {
      setActiveWord((index) => (index + 1) % headlineWords.length);
    }, 2400);

    return () => window.clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <span className="block max-w-[13ch] sm:max-w-none">
      {/* Trailing spaces preserve word boundaries in textContent (SEO, social
          scrapers, screen-reader text mode) without affecting visual layout —
          block-display spans drop trailing whitespace. */}
      <span className="block text-foreground">Launch group fund </span>
      <span className="block text-foreground">tools for your </span>
      <span className="relative block min-h-[1em] overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={word}
            className="block bg-gradient-to-r from-primary via-warm to-accent bg-clip-text text-transparent"
            initial={prefersReducedMotion ? false : { y: "0.35em", opacity: 0 }}
            animate={prefersReducedMotion ? undefined : { y: 0, opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { y: "-0.35em", opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            {word}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}

function HeroPreview() {
  const [activeFrame, setActiveFrame] = useState(0);
  const frame = walkthroughFrames[activeFrame];
  const Icon = frame.icon;

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveFrame((index) => (index + 1) % walkthroughFrames.length);
    }, 5200);

    return () => window.clearInterval(interval);
  }, []);

  const handleScrollToFlow = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById("flow-walkthrough");
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", "#flow-walkthrough");
  };

  return (
    <div className="rise rise-4 mt-4 block min-[860px]:mt-0">
      <div className="relative mx-auto max-w-md min-[860px]:ml-auto">
        <a
          href="#flow-walkthrough"
          aria-label="See the full flow walkthrough"
          onClick={handleScrollToFlow}
          className="group relative block overflow-hidden rounded-xl border border-border/60 bg-card p-3 sm:rounded-2xl sm:p-4 focus-visible:outline-none focus-visible:ring-2"
        >
          <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4 sm:gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest">Flow preview</p>
              <p className="mt-1 font-display text-xl font-black sm:text-2xl">How it works</p>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs">
              4 steps
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          <div className="relative aspect-[16/8.4] w-full overflow-hidden rounded-lg bg-surface p-3 sm:aspect-video sm:rounded-xl sm:p-4">
            <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-br from-primary/20 via-transparent to-confirmed/15" />
            <div className="relative z-10 flex h-full flex-col justify-between">
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-lg border border-primary/25 bg-primary/12 text-primary sm:h-12 sm:w-12 sm:rounded-xl">
                  <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <span className="rounded-full border border-primary/25 bg-background/65 px-3 py-1 text-[11px] font-bold text-primary">
                  {frame.label}
                </span>
              </div>

              <div>
                <h3 className="font-display text-lg font-black leading-tight text-foreground sm:text-2xl">{frame.title}</h3>
                <p className="mt-1.5 max-w-sm text-xs font-medium leading-relaxed text-muted-foreground sm:mt-2 sm:text-sm">{frame.detail}</p>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg bg-surface p-2.5 sm:mt-4 sm:p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold">
              <span>Walkthrough progress</span>
              <span>{frame.progress}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: frame.progress }}
              />
            </div>
          </div>

          <div className="mt-2 grid grid-cols-4 gap-1.5 sm:mt-3" aria-hidden>
            {walkthroughFrames.map((step, index) => (
              <span
                key={step.label}
                className={cn(
                  "h-1.5 rounded-full transition-colors duration-300",
                  index === activeFrame ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        </a>
      </div>
    </div>
  );
}

function HeroAskAkiliBar() {
  const { open } = useAkiliChat();
  const [query, setQuery] = useState("");

  const handleAsk = () => {
    const message = query.trim();
    if (!message) return;
    setQuery("");
    open(message);
  };

  return (
    <div className="rise rise-5 mt-6 max-w-xl">
      <div className="group relative">
        <div
          className="absolute -inset-0.5 rounded-2xl opacity-30 blur-sm transition-opacity group-hover:opacity-60"
          style={{ background: "var(--gradient-primary)" }}
        />
        <div className="relative flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-lg">
          <Sparkles className="h-4 w-4 flex-shrink-0 text-primary" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && handleAsk()}
            placeholder="Ask Akili anything about Baraza…"
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={handleAsk}
            disabled={!query.trim()}
            aria-label="Ask Akili"
            className="flex h-8 w-8 items-center justify-center rounded-xl transition-all disabled:opacity-30"
            style={{ background: query.trim() ? "var(--gradient-warm)" : undefined }}
          >
            <ArrowUp className={cn("h-4 w-4", query.trim() ? "text-warm-foreground" : "text-muted-foreground")} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-[image:var(--gradient-hero)] pt-14 pb-8 sm:pt-20 lg:pt-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      <div className="container relative z-10 mx-auto max-w-7xl px-4">
        <div className="min-[860px]:grid min-[860px]:grid-cols-[minmax(0,1fr)_minmax(18rem,0.62fr)] min-[860px]:items-center min-[860px]:gap-10">
          <div className="max-w-2xl">
            <div className="rise rise-1 mb-5 inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/60 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground sm:mb-6">
              <ShieldCheck className="h-3.5 w-3.5" />
              Transparent group funds
            </div>
            <h1
              className="rise rise-2 font-display text-[clamp(3.1rem,11vw,4.7rem)] font-black leading-[0.9] tracking-tight sm:text-[clamp(4rem,6.5vw,5.35rem)]"
              aria-live="polite"
            >
              <HeroHeadline />
            </h1>

            <p className="rise rise-3 mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Collect dues in your local currency, vote on proposals, and keep group funds visible to every member.
            </p>

            <div className="rise rise-4 mt-6 flex flex-col gap-2 sm:mt-8 sm:flex-row sm:gap-3 min-[860px]:flex-col min-[1040px]:flex-row">
              <Link
                to="/communities"
                className="btn-warm inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-extrabold uppercase tracking-wide sm:w-auto min-[860px]:w-full min-[1040px]:w-auto"
              >
                Browse communities
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/create" className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-extrabold uppercase tracking-wide sm:w-auto min-[860px]:w-full min-[1040px]:w-auto">
                Launch a community
              </Link>
            </div>

            <HeroAskAkiliBar />

            {/* Label chips add noise on small screens — desktop only */}
            <div className="rise rise-5 mt-6 hidden max-w-xl grid-cols-3 gap-2 sm:grid sm:gap-3">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-border/60 bg-card/55 p-3">
                  <p className="font-display text-base font-bold sm:text-lg">{stat.value}</p>
                  <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          <HeroPreview />
        </div>

        <div className="mt-8 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>
    </section>
  );
}
