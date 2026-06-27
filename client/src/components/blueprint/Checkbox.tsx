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
 * Square box 1.1rem, radius xs; brass fill + ink check when checked, else white +
 * #c8bfac border. Optional label (body-s 500 strong) + description (caption muted).
 * Built on shadcn/Radix Checkbox.
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
        "peer flex h-[1.1rem] w-[1.1rem] shrink-0 items-center justify-center rounded-xs border border-line-strong bg-white",
        "outline-none transition-colors duration-200 ease-standard",
        "focus-visible:ring-2 focus-visible:ring-brass-deep/60",
        "disabled:cursor-not-allowed disabled:opacity-45",
        "data-[state=checked]:border-brass data-[state=checked]:bg-brass data-[state=checked]:text-ink-900",
        "data-[state=indeterminate]:border-brass data-[state=indeterminate]:bg-brass data-[state=indeterminate]:text-ink-900",
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
            className="cursor-pointer text-body-s font-medium text-ink-900 peer-disabled:cursor-not-allowed peer-disabled:opacity-45"
          >
            {label}
          </label>
        ) : null}
        {description ? (
          <span className="text-caption text-ink-500">{description}</span>
        ) : null}
      </div>
    </div>
  );
});
Checkbox.displayName = "Checkbox";
