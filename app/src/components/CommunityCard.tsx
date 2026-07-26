import { Link } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, UserPlus, Users, TrendingUp, MessageSquare } from "lucide-react";
import { MagicCard } from "@/components/ui/magic-card";
import { formatKSh, cn } from "@/lib/utils";
import { getCommunityBannerImage } from "@/lib/communityVisuals";
import { getBountyStatsForCommunity } from "@/lib/bounties";

interface CommunityCardProps {
  id: string;
  name: string;
  type: string;
  description: string;
  membershipFee: number;
  memberCount: number;
  fundBalance: number;
  activeDecisions: number;
  image: string;
  layout?: "grid" | "list";
}

const typeConfig: Record<string, { bg: string; text: string; dot: string }> = {
  savings:      { bg: "bg-primary/12",      text: "text-primary",     dot: "bg-primary" },
  cooperative:  { bg: "bg-accent/12",       text: "text-accent",      dot: "bg-accent" },
  professional: { bg: "bg-secondary/12",    text: "text-secondary",   dot: "bg-secondary" },
  housing:      { bg: "bg-orange/12",       text: "text-orange",      dot: "bg-orange" },
  welfare:      { bg: "bg-primary/12",      text: "text-primary",     dot: "bg-primary" },
  investment:   { bg: "bg-accent/12",       text: "text-accent",      dot: "bg-accent" },
  other:        { bg: "bg-muted",           text: "text-muted-foreground", dot: "bg-muted-foreground" },
};

export default function CommunityCard({
  id, name, type, description, membershipFee, memberCount, fundBalance, activeDecisions, image, layout = "grid",
}: CommunityCardProps) {
  const tc = typeConfig[type] ?? typeConfig.other;
  const isList = layout === "list";
  const bountyStats = getBountyStatsForCommunity(id);

  return (
    <article className="h-full">
      <MagicCard className="h-full" gradientColor="hsl(var(--primary))" gradientSize={200} gradientOpacity={0.06}>
        <div className={cn(
          "h-full overflow-hidden",
          isList && "sm:flex",
          "bg-card border border-border/60 rounded-xl",
          "transition-all duration-300",
          "hover:border-primary/30 hover:shadow-[0_0_24px_hsl(22_100%_52%/0.18)]",
        )}>
          <div className={cn("relative h-28 overflow-hidden bg-gradient-to-br from-primary/30 to-accent/20", isList && "sm:h-full sm:min-h-56 sm:w-64 sm:shrink-0")}>
            <img
              src={getCommunityBannerImage(type)}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/45 to-transparent" />
            <div className="absolute bottom-4 left-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-background/80 font-display text-lg font-black text-primary shadow-lg backdrop-blur">
                {image}
              </div>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold capitalize backdrop-blur", tc.bg, tc.text)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", tc.dot)} />
                {type}
              </span>
            </div>
          </div>

          <div className={cn("flex h-full flex-col p-5", isList && "sm:flex-1")}>
            <div className={cn(isList && "sm:grid sm:grid-cols-[1fr_auto] sm:gap-6")}>
              <div className="min-w-0">
              <h3 className="font-display text-lg font-bold leading-tight text-foreground">
                {name}
              </h3>
              <p className={cn("mt-3 text-sm leading-6 text-muted-foreground", isList ? "line-clamp-3" : "line-clamp-2 flex-1")}>
                {description}
              </p>
              </div>

              <div className={cn("mt-4 flex items-center justify-between gap-3 sm:mt-0", !isList && "hidden")}>
                <div>
                  <p className="text-[10px] text-muted-foreground">Monthly fee</p>
                  <p className="text-sm font-bold text-accent tabular-nums">{formatKSh(membershipFee)}</p>
                </div>
              </div>
            </div>

          {bountyStats.featured && (
            <div className="mt-4 rounded-lg border border-secondary/25 bg-secondary/10 p-3">
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-secondary">
                  <BriefcaseBusiness className="h-3.5 w-3.5" />
                  {bountyStats.open} open {bountyStats.open === 1 ? "bounty" : "bounties"}
                </span>
                <span className="text-[10px] font-bold text-accent">{formatKSh(bountyStats.totalRewardKes)}</span>
              </div>
              <p className="truncate text-xs font-semibold text-foreground">{bountyStats.featured.title}</p>
            </div>
          )}

          <div className="mt-5 grid grid-cols-3 gap-1.5 border-t border-border/40 pt-4">
            <div className="flex flex-col items-center text-center gap-0.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground tabular-nums">{memberCount}</span>
              <span className="text-[9px] text-muted-foreground">Members</span>
            </div>
            <div className="flex flex-col items-center text-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5 text-accent" />
              <span className="text-[11px] font-semibold text-foreground tabular-nums truncate w-full text-center">
                {formatKSh(fundBalance)}
              </span>
              <span className="text-[9px] text-muted-foreground">Group funds</span>
            </div>
            <div className="flex flex-col items-center text-center gap-0.5">
              <MessageSquare className="w-3.5 h-3.5 text-secondary" />
              <span className="text-xs font-semibold text-foreground tabular-nums">{activeDecisions}</span>
              <span className="text-[9px] text-muted-foreground">Proposals</span>
            </div>
          </div>

          <div className={cn("mt-3.5 flex items-center justify-between", isList && "sm:hidden")}>
            <span className="text-[10px] text-muted-foreground">Monthly fee</span>
            <span className="text-xs font-bold text-accent tabular-nums">{formatKSh(membershipFee)}</span>
          </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Link to={`/join/${id}`} className="btn-warm justify-center gap-2 px-3 py-2 text-xs font-bold">
                <UserPlus className="h-3.5 w-3.5" />
                Become a member
              </Link>
              <Link to={`/dashboard/${id}`} className="btn-ghost justify-center gap-2 px-3 py-2 text-xs font-bold">
                View profile
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </MagicCard>
    </article>
  );
}
