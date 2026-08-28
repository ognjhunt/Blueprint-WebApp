import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * StatusChip — the core signal device used in every table/card/queue.
 *
 * Outlined, never filled — a filled control on this surface always means
 * "primary action", so states have to read a different way. Each tone maps onto
 * a `.runway-chip-*` modifier (see the design system's status table).
 *  - proof   green  · validated / success        -> runway-chip-live
 *  - warn    amber  · pending / missing-evidence -> runway-chip-open
 *  - block   red    · failure / destructive      -> runway-chip-fail
 *  - info    sky    · action / ranking           -> runway-chip-neutral
 *  - neutral mute   · inactive                   -> runway-chip-quiet
 *  - ink     bone   · chip on the deepest chrome -> runway-chip-quiet, strong text
 *
 * Carries the `.runway-chip` shape: mono, uppercase, square, hairline border.
 * Leading dot (.4rem circle in fg) toggled by `dot` (default on; off for
 * label-style chips like "Rank 1").
 */
const statusChipVariants = cva("runway-chip", {
  variants: {
    tone: {
      proof: "runway-chip-live",
      warn: "runway-chip-open",
      block: "runway-chip-fail",
      info: "runway-chip-neutral",
      neutral: "runway-chip-quiet",
      ink: "runway-chip-quiet text-runway-text",
    },
    square: {
      true: "rounded-none",
      false: "rounded-none",
    },
  },
  defaultVariants: {
    tone: "neutral",
    square: false,
  },
});

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
