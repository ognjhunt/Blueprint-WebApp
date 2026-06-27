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
  info: { fg: "text-info-fg", bg: "bg-info-bg", bd: "border-info-bd", accent: "#1f4f8f" },
  proof: { fg: "text-proof-fg", bg: "bg-proof-bg", bd: "border-proof-bd", accent: "#1f6b4f" },
  warn: { fg: "text-warn-fg", bg: "bg-warn-bg", bd: "border-warn-bd", accent: "#9a6a16" },
  block: { fg: "text-block-fg", bg: "bg-block-bg", bd: "border-block-bd", accent: "#9b3027" },
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
          "flex gap-3 rounded-sm border px-4 py-[0.85rem]",
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
              "text-caption font-bold uppercase tracking-[0.08em]",
              tokens.fg,
            )}
          >
            {title}
          </span>
          <div className="text-body-s leading-[1.55] text-ink-800">
            {children}
          </div>
        </div>
      </div>
    );
  },
);
ProofBoundary.displayName = "ProofBoundary";

export { ProofBoundary };
