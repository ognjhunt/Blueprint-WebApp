import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface TileItem {
  label: string;
  href?: string;
  description?: string;
  /** Optional eyebrow above the label. Defaults to "Environment" for back-compat. */
  eyebrow?: string;
}

export interface TileGridProps {
  /** Convenience API: render uniform label/description tiles. */
  items?: TileItem[];
  /** Number of columns at the largest breakpoint. Default 3. */
  cols?: number;
  className?: string;
  /**
   * Flexible API: pass arbitrary tile nodes. Each direct child should carry its
   * own `bg-white` (or `bg-ink` for dark tiles) so the 1px gap reads as a
   * hairline. Takes precedence over `items` when provided.
   */
  children?: ReactNode;
}

/**
 * TileGrid — the workhorse hairline grid for feature / spec grids.
 *
 * Children read as tiles separated by 1px hairlines: a `repeat(cols,1fr)` grid
 * with a 1px gap over a #ded7c8 (deep-sand) background, wrapped by a 1px outer
 * line border + radius md. Each tile sits on white paper.
 *
 * Use `items` for uniform label tiles, or pass `children` for rich tiles
 * (price cards, image cards, etc.) — each child must set its own background.
 */
export function TileGrid({ items, cols = 3, className, children }: TileGridProps) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-md border border-line bg-[#ded7c8]",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {children
        ? children
        : (items ?? []).map((item) => {
        const content: ReactNode = (
          <div className="flex h-full flex-col justify-between gap-6">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-400">
              {item.eyebrow ?? "Environment"}
            </span>
            <div>
              <p className="text-lg font-medium tracking-tight text-ink-900">
                {item.label}
              </p>
              {item.description ? (
                <p className="mt-2 text-sm leading-6 text-ink-500">
                  {item.description}
                </p>
              ) : null}
            </div>
          </div>
        );

        const tileClass =
          "block h-full bg-white p-6 transition-colors duration-200 ease-standard";

        if (item.href) {
          return (
            <a
              key={item.label}
              href={item.href}
              className={cn(tileClass, "hover:bg-inset")}
            >
              {content}
            </a>
          );
        }

        return (
          <div key={item.label} className={tileClass}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
