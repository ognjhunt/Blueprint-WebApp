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
 * Track 2.2rem x 1.25rem, radius full; brass when on (#a8854f border) else #cdc9bb.
 * Knob .95rem white circle, shadow-sm, slides 200ms ease-out. Optional label.
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
        "peer relative inline-flex h-[1.25rem] w-[2.2rem] shrink-0 cursor-pointer items-center rounded-full border",
        "transition-colors duration-200 ease-out-bp outline-none",
        "focus-visible:ring-2 focus-visible:ring-brass-deep/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        "disabled:cursor-not-allowed disabled:opacity-45",
        "border-[#cdc9bb] bg-[#cdc9bb]",
        "data-[state=checked]:border-brass-deep data-[state=checked]:bg-brass",
        className,
      )}
      {...props}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-[0.95rem] w-[0.95rem] rounded-full bg-white shadow-sm ring-0",
          "translate-x-[0.15rem] transition-transform duration-200 ease-out-bp",
          "data-[state=checked]:translate-x-[1.1rem]",
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
        className="cursor-pointer text-body-s font-medium text-ink-900 peer-disabled:cursor-not-allowed peer-disabled:opacity-45"
      >
        {label}
      </label>
    </div>
  );
});
Switch.displayName = "Switch";
