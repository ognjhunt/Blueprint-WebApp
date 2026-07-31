/**
 * The stepped telling of "The Run Film".
 *
 * This is not a fallback poster and not a blank box: it is a complete, readable
 * account of the same story, and it is what the largest share of readers
 * actually get — the prerendered HTML, every phone, every reader with
 * `prefers-reduced-motion: reduce`, and anyone with JavaScript off.
 *
 * It reuses the stage from `acts.tsx` frozen at the final act, so the machine is
 * shown fully resolved, and then narrates the seven acts in order underneath.
 * Nothing here is behind a scroll gesture and nothing pins.
 */
import { useMotionValue } from "framer-motion";

import { runFilmActs, runFilmStampNote, runFilmStamps } from "@/data/publicSiteCopy";
import { cn } from "@/lib/utils";

import { Reveal } from "../motion";
import { RunFilmStage } from "./acts";
import { LAST_ACT } from "./useActProgress";
import { FilmScreen } from "./FilmScreen";

/**
 * The acts in words. Plain language leads, the internal term follows as a chip,
 * and each act says who performed it.
 */
export function ActList({ compact = false }: { compact?: boolean }) {
  return (
    <ol
      className={cn(
        "grid gap-x-10 gap-y-8 sm:grid-cols-2",
        compact ? "lg:grid-cols-4" : "lg:grid-cols-3",
      )}
    >
      {runFilmActs.map((filmAct, index) => (
        <Reveal as="li" key={filmAct.id} from="up" distance={16} delay={index * 0.04}>
          <div className="min-w-0 border-t border-line pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass-deep">
                {String(index + 1).padStart(2, "0")} · {filmAct.label}
              </p>
              {/* Who did this. Two acts are the buyer's; the rest are ours. */}
              <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-400">
                {filmAct.actor}
              </span>
            </div>
            <p className="mt-3 max-w-[44ch] text-[14px] leading-[1.6] text-ink-700">
              {filmAct.caption}
            </p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-400">
              {filmAct.term}
            </p>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}

/**
 * What a run never grants. This is deliberately outside the decorative stage and
 * readable by assistive technology: a decision envelope fails validation unless
 * both of these are false, which makes it the most defensible thing on the page.
 */
export function RunFilmLimits({ onInk = false }: { onInk?: boolean }) {
  return (
    <div
      className={cn(
        "mt-10 border-t pt-6",
        onInk ? "border-white/10" : "border-line",
      )}
    >
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        {runFilmStamps.map((stamp) => (
          <li
            key={stamp.label}
            className={cn(
              "font-mono text-[11px] uppercase tracking-[0.14em]",
              onInk ? "text-ink-300" : "text-ink-600",
            )}
          >
            {stamp.label}
            <span className="ml-2 font-semibold text-brass-deep">{stamp.value}</span>
          </li>
        ))}
      </ul>
      <p
        className={cn(
          "mt-3 max-w-[64ch] text-[13px] leading-[1.6]",
          onInk ? "text-ink-300" : "text-ink-500",
        )}
      >
        {runFilmStampNote}
      </p>
    </div>
  );
}

export function RunFilmStatic({ compact = false, className }: { compact?: boolean; className?: string }) {
  // Freezing the clock at the last act renders every zone in its final state, so
  // the stepped telling reuses the stage rather than duplicating it.
  const act = useMotionValue(LAST_ACT + 0.4);

  return (
    <div className={className} data-run-film="stepped">
      <FilmScreen>
        <RunFilmStage act={act} frozen compact={compact} />
      </FilmScreen>
      <div className="mt-10">
        <ActList compact={compact} />
      </div>
      <RunFilmLimits />
    </div>
  );
}
