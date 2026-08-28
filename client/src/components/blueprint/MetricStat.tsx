import * as React from "react";

import { cn } from "@/lib/utils";

type DeltaTone = "proof" | "block" | "warn" | "neutral";

const deltaToneClasses: Record<DeltaTone, string> = {
  proof: "text-runway-green",
  block: "text-runway-red",
  warn: "text-runway-signal",
  neutral: "text-runway-faint",
};

const deltaToneOnInkClasses: Record<DeltaTone, string> = {
  proof: "text-proof-700",
  block: "text-block-700",
  warn: "text-runway-signal-lit",
  neutral: "text-runway-mute",
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
        <span className="runway-meta">
          {label}
        </span>
        <span className="runway-num flex items-baseline gap-1 font-medium leading-none text-runway-text">
          <span className="text-[2rem]">{value}</span>
          {unit != null && (
            <span
              className={cn(
                "text-[0.9rem] font-normal",
                onInk ? "text-runway-body" : "text-runway-mute",
              )}
            >
              {unit}
            </span>
          )}
        </span>
        {delta != null && (
          <span
            className={cn(
              "runway-num text-[13px] leading-none",
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
              onInk ? "text-runway-body" : "text-runway-mute",
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
