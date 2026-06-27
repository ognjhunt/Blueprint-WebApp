import * as React from "react";

import { cn } from "@/lib/utils";

type DeltaTone = "proof" | "block" | "warn" | "neutral";

const deltaToneClasses: Record<DeltaTone, string> = {
  proof: "text-proof-fg",
  block: "text-block-fg",
  warn: "text-warn-fg",
  neutral: "text-ink-400",
};

const deltaToneOnInkClasses: Record<DeltaTone, string> = {
  proof: "text-proof-500",
  block: "text-block-500",
  warn: "text-warn-500",
  neutral: "text-ink-300",
};

export interface MetricStatProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Micro uppercase kicker above the value. */
  label: string;
  /** The figure itself — rendered in mono. */
  value: React.ReactNode;
  /** Optional mono unit appended to the value. */
  unit?: React.ReactNode;
  /** Optional mono delta line (e.g. "+4.2pts"). */
  delta?: React.ReactNode;
  /** Tone applied to the delta. */
  deltaTone?: DeltaTone;
  /** Optional caption beneath the figure. */
  caption?: React.ReactNode;
  /** Horizontal alignment of the stack. */
  align?: "left" | "right";
  /** Render for placement on ink / graphite chrome. */
  onInk?: boolean;
}

/**
 * MetricStat — labeled figure for evaluation results.
 * Label (micro/uppercase/faint) + mono value + optional unit, delta and caption.
 */
const MetricStat = React.forwardRef<HTMLDivElement, MetricStatProps>(
  (
    {
      className,
      label,
      value,
      unit,
      delta,
      deltaTone = "neutral",
      caption,
      align = "left",
      onInk = false,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-1",
          align === "right" ? "items-end text-right" : "items-start text-left",
          className,
        )}
        {...props}
      >
        <span
          className={cn(
            "text-micro font-semibold uppercase tracking-eyebrow",
            onInk ? "text-ink-300" : "text-ink-400",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "flex items-baseline gap-1 font-mono font-medium leading-none tracking-tight",
            onInk
              ? "text-[color:var(--text-on-ink)]"
              : "text-ink-900",
          )}
        >
          <span className="text-[2rem]">{value}</span>
          {unit != null && (
            <span
              className={cn(
                "text-[0.9rem] font-normal",
                onInk ? "text-ink-300" : "text-ink-500",
              )}
            >
              {unit}
            </span>
          )}
        </span>
        {delta != null && (
          <span
            className={cn(
              "font-mono text-[13px] leading-none",
              onInk ? deltaToneOnInkClasses[deltaTone] : deltaToneClasses[deltaTone],
            )}
          >
            {delta}
          </span>
        )}
        {caption != null && (
          <span
            className={cn(
              "text-[13px] leading-snug",
              onInk ? "text-ink-300" : "text-ink-500",
            )}
          >
            {caption}
          </span>
        )}
      </div>
    );
  },
);
MetricStat.displayName = "MetricStat";

export { MetricStat };
