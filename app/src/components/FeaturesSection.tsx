import { Link } from "react-router-dom";
import { ArrowRight, CircleDollarSign, Eye, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: CircleDollarSign,
    title: "Collect Dues",
    tilt: "group-hover:rotate-12",
    description:
      "Set the contribution, take M-Pesa or local-currency payments, and show who is current without a private spreadsheet. Late payers are visible to the group, not only to the treasurer. Members join with a phone number, so the chama does not stall while someone learns a wallet.",
  },
  {
    icon: Vote,
    title: "Vote Before Money Moves",
    tilt: "group-hover:-rotate-[14deg]",
    description:
      "Spending requests become proposals. Members see quorum and the outcome before funds leave the group. There is no quiet withdrawal from a shared float: the rule is public, the tally is public, and the release waits until the group has actually agreed.",
  },
  {
    icon: Eye,
    title: "Keep a Trail",
    tilt: "group-hover:rotate-[10deg]",
    description:
      "Dues, votes, and releases sit in one record. New members can inspect the same history as the treasurer. When someone asks where last month’s money went, the answer is the ledger — not a screenshot from a chat that half the group never saw.",
  },
];

export default function FeaturesSection() {
  return (
    <section className="scroll-mt-20 pt-14 pb-36 lg:pb-48" id="features">
      <div className="page-shell">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Features that keep the group honest
        </p>
        <h2 className="mx-auto mt-3 max-w-2xl text-center font-display text-3xl font-black leading-tight text-foreground md:text-4xl">
          Three Jobs. One Shared Ledger.
        </h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="group">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-display text-xl font-bold text-foreground">{feature.title}</h3>
                  <Icon
                    className={`h-10 w-10 shrink-0 text-primary origin-center transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-125 ${feature.tilt} motion-reduce:transition-none motion-reduce:group-hover:rotate-0 motion-reduce:group-hover:scale-100`}
                    strokeWidth={1.6}
                  />
                </div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{feature.description}</p>
              </article>
            );
          })}
        </div>
        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
    </section>
  );
}
