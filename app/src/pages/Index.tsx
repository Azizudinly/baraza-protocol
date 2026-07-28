import { Link } from "react-router-dom";
import { ChevronRight, Coins, Medal, MessageSquareText } from "lucide-react";
import Layout from "@/components/Layout";
import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import AIPlatformSection from "@/components/AIPlatformSection";
import FlowWalkthrough from "@/components/FlowWalkthrough";
import ShowReelSection from "@/components/ShowReelSection";
import { CommunityMarquee } from "@/components/CommunityMarquee";
import CTASection from "@/components/CTASection";
import { useSeo } from "@/lib/seo";

const contributors = [
  { name: "Zara Mwangi", role: "Operations lead", points: "2.4k" },
  { name: "Samuel Okafor", role: "Audit steward", points: "1.9k" },
  { name: "Kofi Mensah", role: "Strategy committee", points: "1.7k" },
];

const bounties = [
  {
    title: "Draft the monthly update",
    meta: "500 pts · 2 slots left",
    detail: "Summarize savings progress, group fund moves, and community wins.",
  },
  {
    title: "Audit transaction records",
    meta: "1200 pts · high priority",
    detail: "Verify internal notes against the public community history.",
  },
  {
    title: "Organize the next meetup",
    meta: "800 pts · event",
    detail: "Coordinate venue, attendance, and volunteer roles for the gathering.",
  },
];

export default function Index() {
  useSeo({
    title: "Community group funds and governance, built for collective trust",
    description:
      "Baraza helps savings groups, SACCOs, and community collectives run transparent group funds, voting, and contribution workflows without exposing members to technical complexity.",
    path: "/",
  });

  return (
    <Layout>
      <HeroSection />
      <FeaturesSection />
      <AIPlatformSection />
      <FlowWalkthrough />
      <ShowReelSection />
      <CommunityMarquee />

      <section className="py-12 sm:py-14">
        <div className="container mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="rise rise-2 rounded-[1.4rem] border border-border/70 bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3">
              <Medal className="h-5 w-5 text-secondary" />
              <h2 className="font-display text-2xl font-black text-foreground">
                Top contributors
              </h2>
            </div>
            <div className="mt-6 space-y-5">
              {contributors.map((person, index) => (
                <div key={person.name} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-full border border-border/70 bg-surface text-sm font-black text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{person.name}</p>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {person.role}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-bold text-primary">{person.points}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Points
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rise rise-3 rounded-[1.4rem] border border-border/70 bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Coins className="h-5 w-5 text-primary" />
                <h2 className="font-display text-2xl font-black text-foreground">Open bounties</h2>
              </div>
              <Link
                to="/bounties"
                className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.16em] text-primary transition-colors hover:text-foreground"
              >
                View all
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {bounties.map((bounty) => (
                <div
                  key={bounty.title}
                  className="rounded-[1rem] border border-border/70 bg-background/75 p-4"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-[0.75rem] bg-primary/12 text-primary">
                    <MessageSquareText className="h-4 w-4" />
                  </div>
                  <h3 className="mt-4 text-sm font-bold leading-5 text-foreground">
                    {bounty.title}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{bounty.detail}</p>
                  <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-secondary">
                    {bounty.meta}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CTASection />
    </Layout>
  );
}
