import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Eyebrow } from "./Eyebrow";

/**
 * Card — base paper panel with optional eyebrow/title header + footer.
 *
 * Tones:
 *  - card      panel surface, line hairline (default)
 *  - inset     recessed onto the page canvas
 *  - ink       deepest chrome band
 *  - elevated  raised ground + a stronger edge (no shadow on the dark ground)
 *
 * Square. Padding `pad`: none / sm 1rem / md 1.5rem / lg 2rem.
 * Header: eyebrow (mono uppercase muted) + condensed uppercase title with an
 * optional right slot (`headerRight`, e.g. a StatusChip). Footer sits above a
 * line-soft top border.
 * `framed` adds corner registration marks via `.bp-focus-frame`.
 */
const cardVariants = cva("relative rounded-none border", {
  variants: {
    tone: {
      card: "bg-runway-panel border-runway-line text-runway-body",
      inset: "bg-runway-deep border-runway-line text-runway-body",
      ink: "bg-runway-black border-runway-line text-runway-body",
      elevated: "bg-runway-raised border-runway-line-strong text-runway-body",
    },
  },
  defaultVariants: {
    tone: "card",
  },
});

const padMap = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

type CardPad = keyof typeof padMap;

export interface CardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof cardVariants> {
  /** Body padding. none / sm (1rem) / md (1.5rem) / lg (2rem). Default md. */
  pad?: CardPad;
  /** Optional eyebrow kicker above the title. */
  eyebrow?: React.ReactNode;
  /** Optional title (title-m). Rendering the header requires title or eyebrow. */
  title?: React.ReactNode;
  /** Optional right-aligned header slot (e.g. a StatusChip). */
  headerRight?: React.ReactNode;
  /** Optional footer, rendered above a line-soft top border. */
  footer?: React.ReactNode;
  /** Adds corner registration marks for capture / evidence surfaces. */
  framed?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      tone,
      pad = "md",
      eyebrow,
      title,
      headerRight,
      footer,
      framed = false,
      children,
      ...props
    },
    ref,
  ) => {
    const onInk = tone === "ink";
    const hasHeader = eyebrow != null || title != null || headerRight != null;
    const bodyPad = padMap[pad];

    return (
      <div
        ref={ref}
        className={cn(cardVariants({ tone }), framed && "bp-focus-frame", className)}
        {...props}
      >
        {hasHeader ? (
          <div
            className={cn(
              "flex items-start justify-between gap-4",
              bodyPad,
              children != null && "pb-0",
            )}
          >
            <div className="flex min-w-0 flex-col gap-2">
              {eyebrow != null ? (
                <Eyebrow tone={onInk ? "onInk" : "muted"}>{eyebrow}</Eyebrow>
              ) : null}
              {title != null ? (
                <h3 className="font-display text-title-m font-semibold uppercase tracking-[0.005em] text-runway-text">
                  {title}
                </h3>
              ) : null}
            </div>
            {headerRight != null ? (
              <div className="shrink-0">{headerRight}</div>
            ) : null}
          </div>
        ) : null}

        {children != null ? (
          <div className={cn(bodyPad, hasHeader && "pt-4")}>{children}</div>
        ) : null}

        {footer != null ? (
          <div
            className={cn(
              "border-t",
              onInk ? "border-runway-line" : "border-runway-line-soft",
              bodyPad || "p-6",
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    );
  },
);
Card.displayName = "Card";

export { cardVariants };
