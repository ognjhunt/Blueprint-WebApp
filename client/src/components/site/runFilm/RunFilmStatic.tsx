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

import {
  homeClaimThreshold,
  runFilmActs,
  runFilmDecision,
  runFilmRoutes,
  runFilmRungs,
  runFilmStampNote,
  runFilmStamps,
} from "@/data/publicSiteCopy";
import { cn } from "@/lib/utils";

import { verdictMeta } from "../figures";
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
        <Reveal
          as="li"
          key={filmAct.id}
          from="up"
          distance={16}
          delay={index * 0.04}
        >
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
            <span className="ml-2 font-semibold text-brass-deep">
              {stamp.value}
            </span>
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

const pct = (value: number) => `${Math.round(value * 1000) / 10}%`;

/**
 * The claim table, in words.
 *
 * The stage is decorative and `aria-hidden`, so the substance of acts 4 to 7 —
 * which claim, where it was routed, on what basis, what came back, and the
 * verdict — has to exist as real semantic content outside it. The act captions
 * alone do not carry this: they describe what each act *does*, not what this
 * run *found*. Without this table a screen-reader user would get the narration
 * and none of the evidence.
 *
 * Visually hidden rather than duplicated on screen, because sighted readers
 * already have all of it in the stage.
 *
 * The `sr-only` class goes on a wrapping div, not on the table: a table's
 * intrinsic minimum width beats `width: 1px`, so `sr-only` applied directly to
 * a `<table>` leaves it full width and blows out the page's horizontal scroll.
 */
export function ClaimSummary() {
  return (
    <div className="sr-only">
      <table>
        <caption>
          What the run found, claim by claim, for the decision “
          {runFilmDecision.question}” against a threshold of{" "}
          {pct(homeClaimThreshold)} {runFilmDecision.metricLabel}.
        </caption>
        <thead>
          <tr>
            <th scope="col">Claim</th>
            <th scope="col">Routed to</th>
            <th scope="col">Basis</th>
            <th scope="col">What came back</th>
            <th scope="col">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {runFilmRoutes.map((route) => {
            const rung = runFilmRungs[route.rung];
            return (
              <tr key={route.short}>
                <th scope="row">{route.short}</th>
                <td>{rung.label}</td>
                <td>{rung.basis}</td>
                <td>
                  Estimate {pct(route.claim.estimate)}, interval{" "}
                  {pct(route.claim.low)} to {pct(route.claim.high)}.
                </td>
                <td>
                  {verdictMeta[route.claim.verdict].label}.
                  {route.gate
                    ? ` Refused ${runFilmRungs[route.gate.rung].label}: ${route.gate.reason}.`
                    : ""}
                  {route.nextTest !== undefined
                    ? ` Next test that would settle it: ${runFilmRungs[route.nextTest].label}.`
                    : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function RunFilmStatic({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  // Freezing the clock at the last act renders every zone in its final state, so
  // the stepped telling reuses the stage rather than duplicating it.
  const act = useMotionValue(LAST_ACT + 0.4);

  return (
    <div className={className} data-run-film="stepped">
      <FilmScreen>
        <RunFilmStage act={act} frozen compact={compact} />
      </FilmScreen>
      <ClaimSummary />
      <div className="mt-10">
        <ActList compact={compact} />
      </div>
      <RunFilmLimits />
    </div>
  );
}
