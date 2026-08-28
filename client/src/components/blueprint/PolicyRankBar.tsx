import * as React from "react";

import { cn } from "@/lib/utils";

type RankScale = "ratio" | "percent";

export interface PolicyRankBarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "label"> {
  /** Policy / checkpoint label. */
  label: React.ReactNode;
  /** Bar value — 0–1 when scale="ratio", 0–100 when scale="percent". */
  value: number;
  /** How `value` is interpreted. */
  scale?: RankScale;
  /** Optional rank badge (e.g. "1", "A"). Hidden when omitted. */
  rank?: React.ReactNode;
  /** Mark this row as the winner — bolder label + action-blue fill. */
  winner?: boolean;
  /** Override the right-hand figure. Defaults to the computed percentage. */
  metric?: React.ReactNode;
  /** Render for placement on ink / graphite chrome. */
  onInk?: boolean;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * PolicyRankBar — policy/checkpoint comparison bar (the eval signature).
 * Stack several to compare. Grid: minmax(5rem,8rem) 1fr auto.
 */
const PolicyRankBar = React.forwardRef<HTMLDivElement, PolicyRankBarProps>(
  (
    {
      className,
      label,
      value,
      scale = "ratio",
      rank,
      winner = false,
      metric,
      onInk = false,
      ...props
    },
    ref,
  ) => {
    const ratio = scale === "percent" ? clamp01(value / 100) : clamp01(value);
    const computed = `${Math.round(ratio * 100)}%`;

    return (
      <div
        ref={ref}
        className={cn(
          "grid items-center gap-[0.85rem]",
          "[grid-template-columns:minmax(5rem,8rem)_1fr_auto]",
          className,
        )}
        {...props}
      >
        <div className="flex min-w-0 items-center gap-2">
          {rank != null && (
            <span
              className={cn(
                "runway-num shrink-0 rounded-none border px-1.5 py-0.5 text-[0.7rem] font-semibold leading-none",
                onInk
                  ? "border-runway-line text-runway-body"
                  : "border-runway-line-strong text-runway-mute",
              )}
            >
              {rank}
            </span>
          )}
          <span
            className={cn(
              "truncate text-body-s",
              winner ? "font-bold text-runway-text" : "font-semibold text-runway-body",
            )}
          >
            {label}
          </span>
        </div>

        <div
          className={cn(
            "h-2 w-full overflow-hidden rounded-none",
            onInk ? "bg-runway-raised" : "bg-runway-line-soft",
          )}
          role="progressbar"
          aria-valuenow={Math.round(ratio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn(
              "h-full rounded-none transition-[width] duration-[350ms] ease-out-bp",
              winner ? "bg-runway-signal" : "bg-runway-mute",
            )}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>

        <span
          className={cn(
            "runway-num justify-self-end text-[13px]",
            winner ? "text-runway-signal" : "text-runway-text",
          )}
        >
          {metric ?? computed}
        </span>
      </div>
    );
  },
);
PolicyRankBar.displayName = "PolicyRankBar";

export { PolicyRankBar };
