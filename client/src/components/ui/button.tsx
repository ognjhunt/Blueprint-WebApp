import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-medium text-runway-text ring-offset-runway-deep transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-runway-signal focus-visible:ring-offset-2 cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-runway-signal bg-runway-signal font-semibold uppercase tracking-[0.04em] text-runway-signal-ink hover:border-runway-signal-lit hover:bg-runway-signal-lit active:border-runway-signal-deep active:bg-runway-signal-deep",
        destructive:
          "border border-runway-red bg-runway-red font-semibold uppercase tracking-[0.04em] text-runway-signal-ink hover:border-block-700 hover:bg-block-700",
        outline:
          "border border-runway-line-strong bg-transparent font-semibold uppercase tracking-[0.04em] text-runway-text hover:border-runway-signal hover:text-runway-signal",
        secondary:
          "border border-runway-line-strong bg-transparent font-semibold uppercase tracking-[0.04em] text-runway-text hover:border-runway-signal hover:text-runway-signal",
        ghost: "text-runway-body hover:bg-runway-raised hover:text-runway-text",
        link: "text-runway-signal underline-offset-4 hover:text-runway-signal-lit hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
