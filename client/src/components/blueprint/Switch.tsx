import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

export interface SwitchProps
  extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  /** Body-s 500 label, rendered to the right of the track. */
  label?: React.ReactNode;
  /** Class applied to the outer label/row wrapper when label is set. */
  containerClassName?: string;
}

/**
 * Switch — Blueprint toggle.
 *
 * Track 2.2rem x 1.25rem, square; signal amber when on, raised ground with a
 * line-strong edge when off. Knob .95rem square — mute when off, signal-ink on
 * the amber fill — slides 200ms ease-out. Optional label.
 * Built on shadcn/Radix Switch.
 */
export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, label, containerClassName, id, ...props }, ref) => {
  const reactId = React.useId();
  const switchId = id ?? reactId;

  const control = (
    <SwitchPrimitives.Root
      ref={ref}
      id={switchId}
      className={cn(
        "peer relative inline-flex h-[1.25rem] w-[2.2rem] shrink-0 cursor-pointer items-center rounded-none border",
        "transition-colors duration-200 ease-out-bp outline-none",
        "focus-visible:ring-2 focus-visible:ring-runway-signal focus-visible:ring-offset-2 focus-visible:ring-offset-runway-deep",
        "disabled:cursor-not-allowed disabled:opacity-45",
        "border-runway-line-strong bg-runway-raised",
        "data-[state=checked]:border-runway-signal data-[state=checked]:bg-runway-signal",
        className,
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-[0.95rem] w-[0.95rem] rounded-none bg-runway-mute ring-0",
          "translate-x-[0.15rem] transition-transform duration-200 ease-out-bp",
          "data-[state=checked]:translate-x-[1.1rem] data-[state=checked]:bg-runway-signal-ink",
        )}
      />
    </SwitchPrimitives.Root>
  );

  if (!label) {
    return control;
  }

  return (
    <div className={cn("flex items-center gap-2.5", containerClassName)}>
      {control}
      <label
        htmlFor={switchId}
        className="cursor-pointer text-body-s font-medium text-runway-text peer-disabled:cursor-not-allowed peer-disabled:opacity-45"
      >
        {label}
      </label>
    </div>
  );
});
Switch.displayName = "Switch";
