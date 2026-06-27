import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Eyebrow — uppercase tracked kicker above titles.
 *
 * Inline-flex, micro (11px) 600 uppercase 0.2em. Tones:
 *  - muted   secondary paper text (default)
 *  - brass   brass-deep accent
 *  - ink     strong ink
 *  - onInk   text on dark chrome (#f3efe6)
 *
 * `rule` adds a leading 1.5rem hairline tick in currentColor at .5 opacity.
 */
const eyebrowVariants = cva(
  "inline-flex items-center gap-[0.6rem] text-[11px] font-semibold uppercase tracking-[0.2em] leading-none",
  {
    variants: {
      tone: {
        muted: "text-[#5f5d54]",
        brass: "text-brass-deep",
        ink: "text-ink",
        onInk: "text-[#f3efe6]",
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
