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
 * Flex gap 1.5rem, bottom border #ded7c8. Each tab: body-s 600, padding .75rem 0,
 * margin-bottom -1px; active = strong text + 2px brass bottom border (inactive
 * transparent + muted). Optional mono count badge (.7rem, xs radius, warn-050 bg
 * when active else sunken). Controlled via value + onChange.
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
            "flex gap-6 border-b border-line",
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
                  "-mb-px inline-flex items-center gap-2 border-b-2 py-3 text-body-s font-semibold",
                  "outline-none transition-colors duration-200 ease-standard",
                  "focus-visible:ring-2 focus-visible:ring-brass-deep/60",
                  "disabled:cursor-not-allowed disabled:opacity-45",
                  isActive
                    ? "border-brass text-ink-900"
                    : "border-transparent text-ink-500 hover:text-ink-700",
                )}
              >
                <span>{item.label}</span>
                {typeof item.count === "number" ? (
                  <span
                    className={cn(
                      "inline-flex min-w-[1.25rem] items-center justify-center rounded-xs px-1 py-px font-mono text-[0.7rem] leading-none",
                      isActive
                        ? "bg-warn-bg text-ink-700"
                        : "bg-sunken text-ink-500",
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
