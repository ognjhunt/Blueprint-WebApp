import * as React from "react";
import { ShieldCheck, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type ProofBoundaryLevel = "info" | "proof" | "warn" | "block";

interface LevelTokens {
  /** foreground: accent border, icon, title */
  fg: string;
  /** tinted background */
  bg: string;
  /** hairline border */
  bd: string;
  /** inline accent-border color (matches fg, applied via style for the 3px rail) */
  accent: string;
}

const levelTokens: Record<ProofBoundaryLevel, LevelTokens> = {
  info: {
    fg: "text-runway-sky",
    bg: "bg-info-bg",
    bd: "border-runway-sky-dim",
    accent: "#9fb9cf",
  },
  proof: {
    fg: "text-runway-green",
    bg: "bg-proof-bg",
    bd: "border-runway-green-dim",
    accent: "#46b96c",
  },
  warn: {
    fg: "text-runway-signal",
    bg: "bg-warn-bg",
    bd: "border-runway-signal-dim",
    accent: "#ffb000",
  },
  block: {
    fg: "text-runway-red",
    bg: "bg-block-bg",
    bd: "border-runway-red-dim",
    accent: "#ff5c45",
  },
};

export interface ProofBoundaryProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Signal level — drives fg/bg/bd from the signal family. */
  level?: ProofBoundaryLevel;
  /** Uppercase caption title in the level foreground color. */
  title: React.ReactNode;
  /** Body copy — explains the trust boundary. */
  children: React.ReactNode;
  /** Override the leading icon (defaults to ShieldCheck). */
  icon?: LucideIcon;
}

/**
 * ProofBoundary — signature trust callout that separates real capture from
 * generated/advisory support. Use wherever output could be mistaken for ground truth.
 */
const ProofBoundary = React.forwardRef<HTMLDivElement, ProofBoundaryProps>(
  ({ className, level = "info", title, children, icon, ...props }, ref) => {
    const tokens = levelTokens[level];
    const Icon = icon ?? ShieldCheck;

    return (
      <div
        ref={ref}
        className={cn(
          "flex gap-3 rounded-none border px-4 py-[0.85rem]",
          tokens.bg,
          tokens.bd,
          className,
        )}
        style={{ borderLeft: `3px solid ${tokens.accent}` }}
        {...props}
      >
        <Icon
          className={cn("mt-0.5 h-[1.05rem] w-[1.05rem] shrink-0", tokens.fg)}
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <div className="flex min-w-0 flex-col gap-1">
          <span
            className={cn(
              "font-mono text-[11px] font-bold uppercase tracking-[0.14em]",
              tokens.fg,
            )}
          >
            {title}
          </span>
          <div className="text-body-s leading-[1.55] text-runway-body">
            {children}
          </div>
        </div>
      </div>
    );
  },
);
ProofBoundary.displayName = "ProofBoundary";

export { ProofBoundary };
