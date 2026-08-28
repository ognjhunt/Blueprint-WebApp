import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  /** Body-s 500 strong label, rendered to the right of the box. */
  label?: React.ReactNode;
  /** Caption muted secondary line under the label. */
  description?: React.ReactNode;
  /** Class applied to the outer label/row wrapper when label/description is set. */
  containerClassName?: string;
}

/**
 * Checkbox — Blueprint square check.
 *
 * Square box 1.1rem; signal-amber fill + signal-ink check when checked, else the
 * panel ground with a line-strong border. Optional label (body-s 500 strong) +
 * description (caption muted). Built on shadcn/Radix Checkbox.
 */
export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, label, description, containerClassName, id, ...props }, ref) => {
  const reactId = React.useId();
  const boxId = id ?? reactId;

  const box = (
    <CheckboxPrimitive.Root
      ref={ref}
      id={boxId}
      className={cn(
        "peer flex h-[1.1rem] w-[1.1rem] shrink-0 items-center justify-center rounded-none border border-runway-line-strong bg-runway-panel text-runway-signal-ink",
        "outline-none transition-colors duration-200 ease-standard",
        "hover:border-runway-signal",
        "focus-visible:ring-2 focus-visible:ring-runway-signal focus-visible:ring-offset-2 focus-visible:ring-offset-runway-deep",
        "disabled:cursor-not-allowed disabled:opacity-45",
        "data-[state=checked]:border-runway-signal data-[state=checked]:bg-runway-signal data-[state=checked]:text-runway-signal-ink",
        "data-[state=indeterminate]:border-runway-signal data-[state=indeterminate]:bg-runway-signal data-[state=indeterminate]:text-runway-signal-ink",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="h-[0.8rem] w-[0.8rem]" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label && !description) {
    return box;
  }

  return (
    <div className={cn("flex items-start gap-2.5", containerClassName)}>
      <div className="flex h-[1.3125rem] items-center">{box}</div>
      <div className="flex flex-col gap-0.5">
        {label ? (
          <label
            htmlFor={boxId}
            className="cursor-pointer text-body-s font-medium text-runway-text peer-disabled:cursor-not-allowed peer-disabled:opacity-45"
          >
            {label}
          </label>
        ) : null}
        {description ? (
          <span className="text-caption text-runway-mute">{description}</span>
        ) : null}
      </div>
    </div>
  );
});
Checkbox.displayName = "Checkbox";
