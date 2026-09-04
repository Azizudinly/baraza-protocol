import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  iconOnly?: boolean;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  lockup?: "baraza" | "protocol";
}

const sizes = {
  sm: { icon: 26, font: "text-sm", protocol: "text-base" },
  md: { icon: 34, font: "text-lg", protocol: "text-xl" },
  lg: { icon: 44, font: "text-2xl", protocol: "text-3xl" },
};

export function BrandLogo({
  className,
  iconOnly = false,
  showIcon = true,
  size = "md",
  lockup = "baraza",
}: BrandLogoProps) {
  const { icon, font, protocol } = sizes[size];

  return (
    <div className={cn("flex items-center gap-2 leading-none", className)}>
      {showIcon && (
        <img
          src="/baraza-logo-v2.svg"
          alt=""
          width={icon}
          height={icon}
          className="shrink-0"
        />
      )}
      {!iconOnly && lockup === "protocol" && (
        <span className={cn("whitespace-nowrap font-display font-black tracking-tight", protocol)}>
          <span className="text-primary">Baraza</span>{" "}
          <span className="text-foreground">Protocol</span>
        </span>
      )}
      {!iconOnly && lockup === "baraza" && (
        <span className={cn("font-display font-black", font)}>
          <span className="text-foreground">bara</span>
          <span className="text-primary">za</span>
        </span>
      )}
    </div>
  );
}
