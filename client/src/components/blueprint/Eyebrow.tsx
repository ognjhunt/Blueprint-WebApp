import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Eyebrow — uppercase tracked kicker above titles.
 *
 * Inline-flex, mono micro (11px) 600 uppercase 0.2em. Tones:
 *  - muted   faint meta text (default) — `.runway-eyebrow-muted`
 *  - brass   signal amber accent — `.runway-eyebrow`
 *  - ink     strong bone text
 *  - onInk   strong bone text on the deepest chrome
 *
 * `rule` adds a leading 1.5rem hairline tick in currentColor at .5 opacity.
 */
const eyebrowVariants = cva(
  "inline-flex items-center gap-[0.6rem] font-mono text-[11px] font-semibold uppercase tracking-[0.2em] leading-none",
  {
    variants: {
      tone: {
        muted: "text-runway-faint",
        brass: "text-runway-signal",
        ink: "text-runway-text",
        onInk: "text-runway-text",
      },
    },
    defaultVariants: {
      tone: "muted",
    },
  },
);

export interface EyebrowProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof eyebrowVariants> {
  /** Adds a leading 1.5rem hairline tick in currentColor at .5 opacity. */
  rule?: boolean;
}

export const Eyebrow = React.forwardRef<HTMLSpanElement, EyebrowProps>(
  ({ className, tone, rule = false, children, ...props }, ref) => (
    <span ref={ref} className={cn(eyebrowVariants({ tone }), className)} {...props}>
      {rule ? (
        <span
          aria-hidden="true"
          className="h-px w-6 shrink-0 bg-current opacity-50"
        />
      ) : null}
      {children}
    </span>
  ),
);
Eyebrow.displayName = "Eyebrow";

export { eyebrowVariants };
