import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn, formatKSh } from "@/lib/utils";
import { getCommunityBannerImage } from "@/lib/communityVisuals";
import type { Community } from "@/lib/constants";

interface CommunityBannerProps {
  type?: string | null;
  imageUrl?: string;
  communities?: Community[];
  intervalMs?: number;
  className?: string;
  children?: React.ReactNode;
}

function formatType(type?: string | null) {
  if (!type) return "Community";
  return type
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CommunityBanner({
  type,
  imageUrl,
  communities = [],
  intervalMs = 4200,
  className,
  children,
}: CommunityBannerProps) {
  const slides = useMemo(() => communities.filter(Boolean).slice(0, 8), [communities]);
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCommunity = slides[activeIndex];
  const bannerImage = imageUrl ?? getCommunityBannerImage(activeCommunity?.type ?? type);

  useEffect(() => {
    setActiveIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;

    const id = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [intervalMs, slides.length]);

  return (
    <div className={cn("relative overflow-hidden rounded-xl border border-primary/15 bg-card", className)}>
      <img
        key={activeCommunity?.id ?? bannerImage}
        src={bannerImage}
        alt=""
        className="community-banner-slide absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/88 to-background/22" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/92 via-transparent to-background/30" />
      <div className="absolute inset-0 bg-primary/8 mix-blend-soft-light" />
      {children && <div className="relative z-10">{children}</div>}

      {activeCommunity && (
        <aside
          className="absolute bottom-4 right-4 z-10 hidden w-[min(22rem,calc(100%-2rem))] rounded-lg border border-primary/20 bg-background/72 p-4 shadow-2xl backdrop-blur-xl md:block"
          aria-live="polite"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.24em] text-primary">
              Featured community
            </p>
            <span className="rounded-full border border-primary/25 px-2 py-1 text-[0.65rem] font-semibold text-primary">
              {activeIndex + 1}/{slides.length}
            </span>
          </div>

          <h2 className="font-display text-xl font-bold leading-tight" data-community-slide-title>
            {activeCommunity.name}
          </h2>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {formatType(activeCommunity.type)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-foreground/84">
            {activeCommunity.description}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <div>
              <p className="font-display text-base font-bold">{activeCommunity.memberCount}</p>
              <p className="text-muted-foreground">Members</p>
            </div>
            <div>
              <p className="font-display text-base font-bold">{activeCommunity.activeDecisions}</p>
              <p className="text-muted-foreground">Votes</p>
            </div>
            <div>
              <p className="font-display text-base font-bold">{formatKSh(activeCommunity.fundBalance)}</p>
              <p className="text-muted-foreground">Group funds</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-1.5" aria-label="Community banner slides">
              {slides.map((community, index) => (
                <button
                  key={community.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={cn(
                    "h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    index === activeIndex ? "w-7 bg-primary" : "w-2 bg-foreground/35 hover:bg-foreground/60",
                  )}
                  aria-label={`Show ${community.name}`}
                  aria-current={index === activeIndex}
                />
              ))}
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
              Browse all <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </aside>
      )}
    </div>
  );
}
