import * as React from "react";

import { cn } from "@/lib/utils";

export interface DataFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Sans caption label (the key). */
  label: React.ReactNode;
  /** The value — mono by default, set `mono={false}` for prose. */
  value: React.ReactNode;
  /** Render the value in mono (true) or as prose body text (false). */
  mono?: boolean;
  /** Show the bottom hairline divider. */
  border?: boolean;
  /** Optional trailing slot (e.g. StatusChip or a copy affordance). */
  trailing?: React.ReactNode;
  /** Render for placement on ink / graphite chrome. */
  onInk?: boolean;
}

/**
 * DataField — mono key/value row for manifests, provenance and Eval Card metadata.
 * Grid: minmax(7rem,0.42fr) 1fr auto.
 */
const DataField = React.forwardRef<HTMLDivElement, DataFieldProps>(
  (
    {
      className,
      label,
      value,
      mono = true,
      border = true,
      trailing,
      onInk = false,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "grid items-baseline gap-3 py-2",
          "[grid-template-columns:minmax(7rem,0.42fr)_1fr_auto]",
          border && "border-b",
          border && (onInk ? "border-[color:var(--border-ink)]" : "border-line-soft"),
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "text-caption font-medium",
            onInk ? "text-ink-300" : "text-ink-500",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            mono ? "font-mono text-[13px]" : "text-body-s",
            "min-w-0 break-words",
            onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
          )}
        >
          {value}
        </span>
        {trailing != null ? (
          <span className="flex items-center justify-self-end">{trailing}</span>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
    );
  },
);
DataField.displayName = "DataField";

export { DataField };
