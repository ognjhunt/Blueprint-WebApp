import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * StatusChip — the core signal device used in every table/card/queue.
 *
 * Each tone pulls fg/bg/bd from its signal family (see TOKENS.md).
 *  - proof   green  · validated / success
 *  - warn    amber  · pending / missing-evidence
 *  - block   clay   · failure / destructive
 *  - info    blue   · action / ranking
 *  - neutral        · fg #3a3a33, bg #ebe4d7 (sunken)
 *  - ink            · dark chip on chrome
 *
 * Inline-flex, gap .4rem; padding .25rem .6rem; font micro (11px) 600 uppercase
 * 0.08em; radius sm (or xs when `square`). Leading dot (.4rem circle in fg)
 * toggled by `dot` (default on; off for label-style chips like "Rank 1").
 */
const statusChipVariants = cva(
  "inline-flex items-center gap-[0.4rem] px-[0.6rem] py-1 text-[11px] font-semibold uppercase tracking-[0.08em] leading-none border whitespace-nowrap",
  {
    variants: {
      tone: {
        proof: "text-proof-fg bg-proof-bg border-proof-bd",
        warn: "text-warn-fg bg-warn-bg border-warn-bd",
        block: "text-block-fg bg-block-bg border-block-bd",
        info: "text-info-fg bg-info-bg border-info-bd",
        neutral: "text-[#3a3a33] bg-sunken border-line",
        ink: "text-[#f3efe6] bg-ink border-white/10",
      },
      square: {
        true: "rounded-xs",
        false: "rounded-sm",
      },
    },
    defaultVariants: {
      tone: "neutral",
      square: false,
    },
  },
);

export interface StatusChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusChipVariants> {
  /** Show the leading .4rem dot (in fg). Default true; off for label chips. */
  dot?: boolean;
}

export const StatusChip = React.forwardRef<HTMLSpanElement, StatusChipProps>(
  ({ className, tone, square, dot = true, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(statusChipVariants({ tone, square }), className)}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className="h-[0.4rem] w-[0.4rem] shrink-0 rounded-full bg-current"
        />
      ) : null}
      {children}
    </span>
  ),
);
StatusChip.displayName = "StatusChip";

export { statusChipVariants };
