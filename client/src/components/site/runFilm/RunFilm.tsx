/**
 * "The Run Film" — the orchestrator.
 *
 * One scroll-driven motion graphic that shows a Task Evaluation Run end to end:
 * a real place is captured, the capture becomes a testbed we keep, a decision is
 * bound against it, the decision splits into claims, each claim climbs the cost
 * ladder to the cheapest evidence qualified to carry it, results come back with
 * their uncertainty, and the envelope states what holds — including the two
 * things it never grants.
 *
 * Which telling a reader gets is decided in `useRunFilmMode`:
 *
 *   - **stepped** — server render, first paint, every phone, and reduced motion.
 *     Nothing pins, nothing is behind a gesture. See `RunFilmStatic`.
 *   - **scrub** — wide viewport with motion allowed: the stage pins and the acts
 *     are driven by scroll position, with a stepper for readers who would rather
 *     jump than scrub.
 *
 * The swap happens in a layout effect, before the browser paints, so it is never
 * visible as a flash and never moves the scroll position out from under anyone.
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";

import { runFilmActs } from "@/data/publicSiteCopy";
import { cn } from "@/lib/utils";

import { RunFilmStage } from "./acts";
import { FilmScreen } from "./FilmScreen";
import { ActList, ClaimSummary, RunFilmLimits, RunFilmStatic } from "./RunFilmStatic";
import { LAST_ACT, useActProgress, useRunFilmMode } from "./useActProgress";

export interface RunFilmProps {
  /**
   * `full` is the /how-it-works cut: the whole film, with per-act detail.
   * `compact` is the Home cut: the same seven acts, tighter and quicker.
   */
  variant?: "full" | "compact";
  className?: string;
}

/**
 * The act stepper: where the film is, how much is left, and a way to jump.
 * Every control has an accessible name, and `aria-current` marks the act on
 * screen — the stepper is a real control, not a decorative progress bar.
 */
function ActStepper({
  active,
  onSeek,
}: {
  active: number;
  onSeek: (index: number) => void;
}) {
  return (
    <nav aria-label="Acts of the run" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
        {runFilmActs.map((filmAct, index) => {
          const isActive = index === active;
          return (
            <li key={filmAct.id} className="min-w-0">
              <button
                type="button"
                onClick={() => onSeek(index)}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xs px-1.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass",
                  isActive
                    ? "text-[color:var(--text-on-ink)]"
                    : "text-ink-400 hover:text-ink-200",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                    isActive
                      ? "bg-[color:var(--text-on-ink)]"
                      : index < active
                        ? "bg-runway-line-strong"
                        : "bg-white/15",
                  )}
                />
                <span className="truncate">
                  {/* The number is the accessible name's anchor; the label is
                      what a sighted reader scans. */}
                  <span className="sr-only">Act {index + 1}: </span>
                  {filmAct.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** The pinned, scroll-driven telling. Only ever mounted on a wide viewport. */
function RunFilmScrub({ compact, className }: { compact: boolean; className?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const { act, active } = useActProgress(trackRef);

  /**
   * Seeks the page to where a given act plays. The track maps its own scroll
   * range onto act-space, so seeking is the inverse of that mapping — which
   * keeps the stepper and the scrub in agreement instead of animating a
   * separate clock that could drift from the scroll position.
   */
  const seek = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track || typeof window === "undefined") return;
    const scrollable = track.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return;
    // Inverse of `useActProgress`: act = lerp([0.03, 0.9] -> [0, LAST + 0.4]).
    const progress = 0.03 + (index / (LAST_ACT + 0.4)) * (0.9 - 0.03);
    window.scrollTo({
      top: track.offsetTop + scrollable * progress,
      behavior: "smooth",
    });
  }, []);

  return (
    <div
      ref={trackRef}
      className={cn("relative", compact ? "h-[340vh]" : "h-[560vh]", className)}
      data-run-film="scrub"
    >
      {/* `top-0` with generous top padding: the site header is sticky at z-40,
          so the stage clears it rather than pinning beneath it. */}
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center pb-4 pt-[4.75rem] sm:pb-6 sm:pt-[5.5rem]">
        <FilmScreen className="shrink-0">
          <RunFilmStage act={act} compact={compact} />

          <div className="shrink-0 border-t border-white/10 px-4 py-3 sm:px-5">
            <div className="flex items-start justify-between gap-x-5 gap-y-2">
              <ActStepper active={active} onSeek={seek} />
              <button
                type="button"
                onClick={() => seek(0)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xs border border-white/15 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-300 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Replay
              </button>
            </div>

            {/* All seven captions are stacked and cross-faded, so the block never
                changes height mid-scroll. */}
            <div
              aria-hidden="true"
              className={cn(
                "relative mt-3",
                compact ? "min-h-[3.25rem] sm:min-h-[3.5rem]" : "min-h-[3.25rem] sm:min-h-[3.75rem]",
              )}
            >
              {runFilmActs.map((filmAct, index) => (
                <motion.p
                  key={filmAct.id}
                  className={cn(
                    "absolute inset-0 max-w-[68ch] font-display uppercase font-semibold leading-[1.2] tracking-[0.005em] text-[color:var(--text-on-ink)]",
                    compact ? "text-[0.95rem]" : "text-[0.95rem] sm:text-[1.1rem]",
                  )}
                  initial={false}
                  animate={{ opacity: index === active ? 1 : 0 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                >
                  {filmAct.caption}
                </motion.p>
              ))}
            </div>
          </div>
        </FilmScreen>
      </div>

      {/* The film in words, for assistive technology and anyone who does not
          scrub. Never hidden from either. */}
      <div className="sr-only">
        <ActList />
      </div>
      <ClaimSummary />
    </div>
  );
}

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Keeps the reader where they were when the telling changes.
 *
 * The two tellings are wildly different heights — a 560vh scroll track versus a
 * page-flow block — so a reader who resizes across the mode boundary (or toggles
 * reduced motion) part-way through the film would otherwise be dumped into an
 * unrelated section, because the browser holds `scrollY` while the document
 * shrinks underneath it.
 *
 * Rather than freezing the mode after mount, which would mean ignoring a
 * `prefers-reduced-motion` change, this records how far through the film the
 * reader is and restores that position after the swap. It only acts when the
 * film was actually on screen: someone reading the footer when they resize
 * should stay at the footer, not get yanked back up.
 */
function useFilmScrollAnchor(mode: string) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const wasOnScreenRef = useRef(false);
  const lastModeRef = useRef(mode);

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node || typeof window === "undefined") return;

    const record = () => {
      const rect = node.getBoundingClientRect();
      wasOnScreenRef.current = rect.top < window.innerHeight && rect.bottom > 0;
      const scrollable = node.offsetHeight - window.innerHeight;
      progressRef.current =
        scrollable > 0
          ? Math.min(1, Math.max(0, (window.scrollY - node.offsetTop) / scrollable))
          : 0;
    };

    record();
    window.addEventListener("scroll", record, { passive: true });
    return () => window.removeEventListener("scroll", record);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (lastModeRef.current === mode) return;
    lastModeRef.current = mode;

    const node = wrapperRef.current;
    if (!node || !wasOnScreenRef.current || typeof window === "undefined") return;
    const scrollable = node.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return;
    // Jump, never smooth-scroll: this is a correction for a layout change the
    // reader did not ask for, so it should be invisible rather than animated.
    window.scrollTo({ top: node.offsetTop + scrollable * progressRef.current });
  }, [mode]);

  return wrapperRef;
}

export function RunFilm({ variant = "full", className }: RunFilmProps) {
  const mode = useRunFilmMode();
  const wrapperRef = useFilmScrollAnchor(mode);
  const compact = variant === "compact";

  return (
    <div ref={wrapperRef} className={className}>
      {mode === "stepped" ? (
        <RunFilmStatic compact={compact} />
      ) : (
        <>
          <RunFilmScrub compact={compact} />
          {/* Stated at page level in both tellings, with room to be read, rather
              than as a footnote inside a stage that has to fit one screen. */}
          <RunFilmLimits />
        </>
      )}
    </div>
  );
}
