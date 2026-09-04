import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toTitleCase } from "@/lib/utils";

const stats = [
  { value: 27, label: toTitleCase("Group types, from chama to SACCO") },
  { value: 4, label: toTitleCase("Markets: Kenya, Uganda, Tanzania, Rwanda") },
  { value: 0, label: toTitleCase("Seed phrases required to join") },
];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useInView(threshold = 0.4) {
  const ref = useRef<HTMLDListElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, inView };
}

function CountStat({
  value,
  label,
  active,
}: {
  value: number;
  label: string;
  active: boolean;
}) {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);

  useEffect(() => {
    const target = active ? value : 0;
    if (prefersReducedMotion()) {
      displayRef.current = target;
      setDisplay(target);
      return;
    }

    const from = displayRef.current;
    if (from === target) return;

    let raf = 0;
    const started = performance.now();
    const duration = 700;
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = Math.round(from + (target - from) * eased);
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, value]);

  return (
    <div className="flex flex-col items-center text-center">
      <dt
        className="text-center font-display text-5xl font-black leading-none tracking-tight tabular-nums md:text-6xl"
        aria-label={String(value)}
      >
        {display}
      </dt>
      <dd className="mx-auto mt-2 max-w-[14rem] text-center text-sm leading-6 opacity-75">{label}</dd>
    </div>
  );
}

export default function AIPlatformSection() {
  const { ref, inView } = useInView();

  return (
    <section
      className="audience-band relative z-10 scroll-mt-20 bg-primary text-foreground"
      id="who-its-for"
    >
      <div className="page-shell">
        <div className="grid items-center gap-10 py-6 sm:py-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)] lg:gap-12 lg:py-8">
          <div className="relative z-10 mx-auto flex w-full max-w-[42rem] flex-col items-center lg:mx-0 lg:max-w-none">
            <figure className="relative -mt-20 mb-6 w-[min(100%,36rem)] origin-bottom rotate-[-6deg] bg-white p-3 shadow-[0_18px_40px_hsl(0_0%_0%/0.22)] sm:-mt-28 sm:mb-8 sm:w-[min(100%,40rem)] sm:p-4 lg:-mt-40 lg:w-[min(100%,42rem)]">
              <img
                src="/audience/group.jpg"
                alt="A chama gathered around a laptop, reviewing the group’s money together"
                width={1024}
                height={768}
                className="aspect-[4/3] w-full object-cover"
              />
            </figure>
            <div className="relative z-10 mt-12 flex w-full flex-col items-center justify-center gap-3 sm:mt-14 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/create/purpose">
                  Launch a Group
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/communities">Browse Groups</Link>
              </Button>
            </div>
          </div>

          <div className="text-center">
            <h2 className="font-display text-3xl font-black leading-[1.05] tracking-tight md:text-5xl">
              {toTitleCase("Built for groups that already exist.")}
            </h2>
            <p className="mt-5 text-base leading-7 opacity-85 sm:text-lg sm:leading-8">
              For treasurers who are tired of chasing dues in a chat thread. Chamas, SACCOs, and
              cooperatives already collect money and decide together. Baraza puts those two jobs in
              one place: members pay in, vote on spending, and see the same balance. SACCOs get an
              extra license check before a group can launch.
            </p>

            <dl ref={ref} className="mt-10 grid justify-items-center gap-8 text-center sm:grid-cols-3">
              {stats.map((stat) => (
                <CountStat
                  key={stat.label}
                  value={stat.value}
                  label={stat.label}
                  active={inView}
                />
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
