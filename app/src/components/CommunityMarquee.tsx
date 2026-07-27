import { Marquee } from "@/components/ui/marquee";
import { Banknote, CheckCircle2, Clock3, TrendingUp, Users, Vote } from "lucide-react";
import { formatKSh } from "@/lib/utils";

const communities = [
  { name: "Kilimani Chama", type: "Savings", members: 48, fundKes: 2_400_000, signal: "+12%" },
  { name: "Westlands SACCO", type: "Co-op", members: 120, fundKes: 8_100_000, signal: "+31%" },
  { name: "Techies Welfare", type: "Welfare", members: 32, fundKes: 640_000, signal: "+8%" },
  { name: "Mama Mboga Fund", type: "Investment", members: 65, fundKes: 1_800_000, signal: "+18%" },
  { name: "Estate Owners", type: "Housing", members: 90, fundKes: 12_000_000, signal: "+24%" },
  { name: "Green Farms Co-op", type: "Co-op", members: 78, fundKes: 3_200_000, signal: "+15%" },
];

const recentActivity = [
  { action: "Proposal passed", community: "Kilimani Chama", time: "2m", icon: Vote },
  { action: "Dues confirmed", community: "Westlands SACCO", time: "8m", icon: Banknote },
  { action: "Group funds grew", community: "Estate Owners", time: "15m", icon: TrendingUp },
  { action: "Payout released", community: "Mama Mboga Fund", time: "22m", icon: CheckCircle2 },
  { action: "Vote concluded", community: "Techies Welfare", time: "34m", icon: Vote },
  { action: "Members added", community: "Green Farms Co-op", time: "1h", icon: Users },
];

function CommunityChip({ community }: { community: (typeof communities)[number] }) {
  return (
    <div className="grid min-w-[278px] grid-cols-[1fr_auto] gap-4 rounded-xl border border-border/70 bg-card/70 px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <p className="truncate text-sm font-semibold text-foreground">{community.name}</p>
        </div>
        <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
          {community.type} / {community.members} members
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold tabular-nums text-accent">{formatKSh(community.fundKes)}</p>
        <p className="text-[11px] font-semibold tabular-nums text-primary">{community.signal}</p>
      </div>
    </div>
  );
}

function ActivityChip({ item }: { item: (typeof recentActivity)[number] }) {
  const Icon = item.icon;

  return (
    <div className="flex min-w-[292px] items-center gap-3 rounded-xl border border-border/70 bg-surface/70 px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-foreground">{item.action}</p>
        <p className="truncate text-[11px] text-muted-foreground">{item.community}</p>
      </div>
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Clock3 className="h-3 w-3" />
        {item.time}
      </span>
    </div>
  );
}

export function CommunityMarquee() {
  return (
    <section className="relative overflow-hidden py-12">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="container mx-auto mb-6 px-4">
        <div className="grid gap-3 md:grid-cols-[auto_1fr] md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Sample groups</p>
            <h2 className="mt-2 font-display text-2xl font-bold text-foreground md:text-3xl">
              Community treasuries in motion
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:justify-self-end md:text-right">
            A rolling view of balances, votes, and member activity across active Baraza groups.
          </p>
        </div>
      </div>

      <div className="relative flex w-full max-w-full flex-col gap-3 overflow-hidden">
        <Marquee pauseOnHover className="[--duration:34s]" repeat={2}>
          {communities.map((community) => (
            <CommunityChip key={community.name} community={community} />
          ))}
        </Marquee>

        <Marquee pauseOnHover reverse className="[--duration:28s]" repeat={2}>
          {recentActivity.map((activity) => (
            <ActivityChip key={`${activity.action}-${activity.community}`} item={activity} />
          ))}
        </Marquee>

        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-background to-transparent" />
      </div>
    </section>
  );
}
