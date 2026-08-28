import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Blueprint Button — square, mechanical, never pill-soft.
 *
 * Restyles the shadcn `<Button>` (cva) base with the Blueprint variant set and
 * exact size spec from COMPONENTS.md. Keeps `asChild` support.
 *
 * Variants:
 *  - action     signal amber fill, signal-ink text — primary CTA
 *  - brass      signal-deep amber fill, signal-ink text — high-emphasis marketing
 *  - secondary  ghost: transparent, line-strong border, signal on hover
 *  - ghost      transparent
 *  - danger     runway-red outline on a red-tinted wash
 *
 * Sizes (exact):
 *  - sm  h 2rem,     pad 0 .75rem,   13px
 *  - md  h 2.625rem, pad 0 1.125rem, 14px
 *  - lg  h 3.25rem,  pad 0 1.5rem,   15px
 *
 * Square, weight 600, uppercase 0.04em on the CTA variants, gap .5rem.
 * Transition: background 200ms + transform 120ms (ease-standard).
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none font-semibold tracking-[-0.01em] select-none cursor-pointer transition-[background-color,transform] duration-200 ease-standard active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-runway-signal focus-visible:ring-offset-2 focus-visible:ring-offset-runway-deep disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        action:
          "border border-runway-signal bg-runway-signal uppercase tracking-[0.04em] text-runway-signal-ink hover:border-runway-signal-lit hover:bg-runway-signal-lit",
        brass:
          "border border-runway-signal-deep bg-runway-signal-deep uppercase tracking-[0.04em] text-runway-signal-ink hover:border-runway-signal hover:bg-runway-signal",
        secondary:
          "border border-runway-line-strong bg-transparent uppercase tracking-[0.04em] text-runway-text hover:border-runway-signal hover:text-runway-signal",
        ghost: "bg-transparent text-runway-body hover:bg-runway-raised hover:text-runway-text",
        danger:
          "border border-runway-red-dim bg-block-bg uppercase tracking-[0.04em] text-runway-red hover:border-runway-red",
      },
      size: {
        sm: "h-8 px-3 text-[13px] [&_svg]:size-4",
        md: "h-[2.625rem] px-[1.125rem] text-sm [&_svg]:size-4",
        lg: "h-[3.25rem] px-6 text-[15px] [&_svg]:size-5",
      },
      full: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "action",
      size: "md",
      full: false,
    },
  },
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    VariantProps<typeof buttonVariants> {
  /** Render as a Radix Slot so the styles apply to a child element (e.g. an `<a>`). */
  asChild?: boolean;
  /** Optional leading lucide icon. */
  iconLeft?: React.ReactNode;
  /** Optional trailing lucide icon. */
  iconRight?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      full,
      asChild = false,
      iconLeft,
      iconRight,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const content = asChild ? (
      children
    ) : (
      <>
        {iconLeft}
        {children}
        {iconRight}
      </>
    );
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, full }), className)}
        ref={ref}
        {...props}
      >
        {content}
      </Comp>
    );
  },
);
Button.displayName = "Button";
