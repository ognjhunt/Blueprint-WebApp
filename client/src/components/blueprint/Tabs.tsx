import * as React from "react";

import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  /** Optional mono count badge (e.g. failures count). */
  count?: number;
  disabled?: boolean;
}

export interface TabsProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Tab definitions. Each renders one underline tab with optional mono count badge. */
  items: TabItem[];
  /** Controlled active value. */
  value: string;
  /** Fired with the next value when a tab is activated. */
  onChange: (value: string) => void;
  /** Class applied to the tablist row (defaults carry gap + bottom border). */
  listClassName?: string;
}

/**
 * Tabs — Blueprint underline tab bar.
 *
 * Flex gap 1.5rem, bottom hairline. Each tab: mono uppercase meta label, padding
 * .75rem 0, margin-bottom -1px; active = signal text + 2px signal bottom border
 * (inactive transparent + faint). Optional mono count badge rendered as an
 * outlined chip. Controlled via value + onChange.
 */
export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      items,
      value,
      onChange,
      className,
      listClassName,
      "aria-label": ariaLabel,
      ...props
    },
    ref,
  ) => {
    const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

    const moveFocus = (currentIndex: number, direction: 1 | -1) => {
      const count = items.length;
      let next = currentIndex;
      for (let step = 0; step < count; step += 1) {
        next = (next + direction + count) % count;
        if (!items[next]?.disabled) break;
      }
      const target = tabRefs.current[next];
      const targetItem = items[next];
      if (target && targetItem && !targetItem.disabled) {
        target.focus();
        onChange(targetItem.value);
      }
    };

    const handleKeyDown = (
      event: React.KeyboardEvent<HTMLButtonElement>,
      index: number,
    ) => {
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        moveFocus(index, 1);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        moveFocus(index, -1);
      }
    };

    return (
      <div ref={ref} className={cn("w-full", className)} {...props}>
        <div
          role="tablist"
          aria-label={ariaLabel}
          className={cn(
            "flex gap-6 border-b border-runway-line",
            listClassName,
          )}
        >
          {items.map((item, index) => {
            const isActive = item.value === value;
            return (
              <button
                key={item.value}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={item.disabled}
                tabIndex={isActive ? 0 : -1}
                onClick={() => !item.disabled && onChange(item.value)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={cn(
                  "-mb-px inline-flex items-center gap-2 border-b-2 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]",
                  "outline-none transition-colors duration-200 ease-standard",
                  "focus-visible:ring-2 focus-visible:ring-runway-signal focus-visible:ring-offset-2 focus-visible:ring-offset-runway-deep",
                  "disabled:cursor-not-allowed disabled:opacity-45",
                  isActive
                    ? "border-runway-signal text-runway-signal"
                    : "border-transparent text-runway-faint hover:text-runway-text",
                )}
              >
                <span>{item.label}</span>
                {typeof item.count === "number" ? (
                  <span
                    className={cn(
                      "runway-num inline-flex min-w-[1.25rem] items-center justify-center rounded-none border px-1 py-px text-[0.7rem] leading-none",
                      isActive
                        ? "border-runway-signal-dim text-runway-signal"
                        : "border-runway-line-strong text-runway-mute",
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  },
);
Tabs.displayName = "Tabs";
