/**
 * Timing and mode for "The Run Film".
 *
 * The film has two tellings and picks between them at mount:
 *
 *   - **scrub** — the pinned stage whose acts are driven by scroll position.
 *     Only offered on a wide viewport with motion allowed.
 *   - **stepped** — the whole story as stacked, fully-resolved sections with no
 *     pinning and no scroll-jacking. This is what the server prerenders, what a
 *     phone gets, and what `prefers-reduced-motion: reduce` gets.
 *
 * `stepped` is the initial state in every environment, so the prerendered HTML
 * and the first client paint agree, and no reader is ever handed a pinned stage
 * with six of seven acts hidden inside it.
 */
import { useEffect, useLayoutEffect, useState } from "react";

import {
  useMotionValueEvent,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";

import { runFilmActs } from "@/data/publicSiteCopy";

export type RunFilmMode = "scrub" | "stepped";

/** Act indices by name, so timing is written against names, not magic numbers. */
export const ACT = {
  capture: 0,
  testbed: 1,
  decision: 2,
  claims: 3,
  routing: 4,
  measurement: 5,
  envelope: 6,
} as const;

export const LAST_ACT = runFilmActs.length - 1;

/**
 * The pinned telling is only offered where the whole machine fits on one screen.
 *
 * Below 1024px the stage has no second column and scroll-jacking a phone is not
 * acceptable either way. The height bound is measured, not guessed: the pinned
 * stage needs 661px plus 112px of padding to clear the sticky site header, so
 * anything shorter would silently clip a caption. Under that, stepping is not a
 * degraded experience — it is the correct one.
 */
const SCRUB_QUERY = "(min-width: 1024px) and (min-height: 780px)";

/**
 * Runs before paint on the client and is a no-op during prerender, so choosing
 * the mode never flashes and never moves the scroll position out from under the
 * reader.
 */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * useRunFilmMode — `stepped` until the client can prove otherwise, then whichever
 * telling this viewport and this reader's motion preference should get. Tracks
 * both signals live, so a resize or an OS preference change re-decides.
 */
export function useRunFilmMode(): RunFilmMode {
  const shouldReduce = useReducedMotion();
  const [roomy, setRoomy] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(SCRUB_QUERY);
    const sync = () => setRoomy(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return roomy && !shouldReduce ? "scrub" : "stepped";
}

export interface ActProgress {
  /** Continuous position in act-space, 0 through LAST_ACT (and a little past). */
  act: MotionValue<number>;
  /** The act currently on screen, as an integer, for the caption and stepper. */
  active: number;
}

/**
 * useActProgress — maps a scroll track's progress onto act-space.
 *
 * The timeline deliberately runs a little past `LAST_ACT`: elements on the final
 * act are staggered, so the value has to clear `LAST_ACT + stagger` for the last
 * of them to finish. `active` stays clamped to a real act index.
 */
export function useActProgress(trackRef: React.RefObject<HTMLElement>): ActProgress {
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });
  // Dead space at each end so the first and last acts can be read without the
  // film immediately moving on.
  const act = useTransform(scrollYProgress, [0.03, 0.9], [0, LAST_ACT + 0.4]);
  const [active, setActive] = useState(0);

  useMotionValueEvent(act, "change", (value) => {
    const next = Math.min(LAST_ACT, Math.max(0, Math.round(value)));
    setActive((current) => (current === next ? current : next));
  });

  return { act, active };
}
