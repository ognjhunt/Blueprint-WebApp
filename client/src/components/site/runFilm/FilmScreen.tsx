/**
 * The screen the film plays on: a dark panel inset into whatever band hosts it,
 * carrying the same visible "Illustrative" marker every figure with schematic
 * values carries. Nothing in the film reads live run data.
 */
import type { ReactNode } from "react";

import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

export function FilmScreen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-white/10 bg-ink",
        className,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-2.5 sm:px-5 sm:py-3">
        <p className="truncate text-[12px] font-semibold tracking-[-0.01em] text-[color:var(--text-on-ink)] sm:text-[13px]">
          One Task Evaluation Run
        </p>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xs border border-white/15 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-300">
          <Info className="h-3 w-3" aria-hidden="true" />
          Illustrative
        </span>
      </div>
      {children}
    </div>
  );
}
