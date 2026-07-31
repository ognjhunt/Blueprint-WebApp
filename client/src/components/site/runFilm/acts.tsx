/**
 * The seven acts of "The Run Film".
 *
 * The film is one continuously-visible object rather than seven slides: the
 * site-task is on screen from the first frame to the last, and each act adds to
 * it instead of replacing it. So the acts here are layers over one stage, and
 * they accumulate — once a claim row has appeared it stays, and later acts add
 * columns to it. That is what keeps a viewer from ever wondering what they are
 * looking at.
 *
 * Every act takes the same `act` motion value (continuous position in act-space)
 * and derives its own timing from it, so there is exactly one clock. Freezing
 * that clock at the last act renders the whole machine in its final state, which
 * is how the stepped telling reuses this file rather than duplicating it.
 *
 * Colour follows `figures.tsx`: one accent against a de-emphasis warm gray for
 * magnitude, the reserved status scale for outcomes, and brass never used as a
 * data colour. Every status mark ships an icon and a text label, because the
 * status hues collide under protanopia and colour is never the only channel.
 *
 * All copy comes from `publicSiteCopy.ts`. There are no hardcoded words here.
 */
import { CircleSlash } from "lucide-react";
import { motion, useTransform, type MotionValue } from "framer-motion";

import {
  homeClaimThreshold,
  runFilmDecision,
  runFilmRoutes,
  runFilmRungs,
  runFilmStamps,
  type RunFilmRoute,
} from "@/data/publicSiteCopy";
import { cn } from "@/lib/utils";

import { accentFor, mutedFor, surfaceFor, verdictMeta } from "../figures";
import { ACT } from "./useActProgress";

/* ------------------------------------------------------------------ tokens */

/* The film always plays on a dark screen inset into its host band, so only the
   on-ink form of each token is used. */
const ACCENT = accentFor(true);
const MUTED = mutedFor(true);
const SURFACE = surfaceFor(true);
const HAIRLINE = "rgba(255,255,255,0.14)";
const HAIRLINE_SOFT = "rgba(255,255,255,0.07)";
/** Reserved warn tone, reused for the rung a claim is refused. */
const GATE = verdictMeta.unresolved.fgOnInk;

const THRESHOLD = homeClaimThreshold;
const pct = (value: number) => `${Math.round(value * 1000) / 10}%`;

/* ------------------------------------------------------------- act timing */

/** Ramps 0 → 1 as the film arrives at act `at`, then holds. */
function useEnter(act: MotionValue<number>, at: number, span = 0.5) {
  return useTransform(act, [at - span - 0.06, at - 0.06], [0, 1]);
}

/** Opacity plus a short lift, for an element belonging to act `at`. */
function useEnterLift(act: MotionValue<number>, at: number, lift = 10) {
  const opacity = useEnter(act, at);
  const y = useTransform(opacity, [0, 1], [lift, 0]);
  return { opacity, y };
}

/** Fades an earlier zone back once the film has moved past it, never to zero. */
function useRecede(act: MotionValue<number>, from: number, to = 0.45) {
  return useTransform(act, [from - 0.7, from], [1, to]);
}

export interface ActProps {
  act: MotionValue<number>;
  /** Final-frame render: nothing mid-flight, no sweep caught halfway across. */
  frozen?: boolean;
  compact?: boolean;
}

/* ------------------------------------------------------- act 1 — capture */

/** One capture point, revealed as the sweep passes over it. */
function CapturePoint({ act, cx, cy, at }: { act: MotionValue<number>; cx: number; cy: number; at: number }) {
  const opacity = useTransform(act, [at, at + 0.1], [0, 1]);
  return <motion.circle cx={cx} cy={cy} r="2.4" fill={ACCENT} style={{ opacity }} />;
}

const CAPTURE_POINTS: readonly { cx: number; cy: number }[] = [
  { cx: 34, cy: 122 }, { cx: 62, cy: 96 }, { cx: 58, cy: 44 },
  { cx: 92, cy: 74 }, { cx: 104, cy: 118 }, { cx: 134, cy: 70 },
  { cx: 158, cy: 116 }, { cx: 186, cy: 66 }, { cx: 206, cy: 96 },
];

/**
 * CaptureAct — the real place, and the walk through it that records it. The
 * plan is drawn from the first frame, because there is a place before there is
 * a capture; the sweep and its points are what this act adds.
 */
export function CaptureAct({ act, frozen = false }: ActProps) {
  const sweepX = useTransform(act, [0, 0.72], [8, 232]);
  const sweepOpacity = useTransform(act, [0.42, 0.78], [1, 0]);

  return (
    <>
      {/* The site: walls, the dock door, the approach lane, the fixture the
          task happens at, and the clutter that is always there. */}
      <rect
        x="6" y="6" width="228" height="144" rx="3"
        fill="rgba(255,255,255,0.03)" stroke={HAIRLINE} strokeWidth="1"
      />
      <line x1="234" y1="58" x2="234" y2="100" stroke={MUTED} strokeWidth="3" strokeLinecap="round" />
      <path
        d="M26 132 C 72 132, 78 76, 128 76 S 176 62, 196 62"
        fill="none" stroke={HAIRLINE} strokeWidth="1.5" strokeDasharray="4 5"
      />
      <rect x="188" y="50" width="30" height="24" rx="2" fill="none" stroke={MUTED} strokeWidth="1.5" />
      <rect x="48" y="34" width="16" height="13" rx="1.5" fill={HAIRLINE_SOFT} stroke={HAIRLINE} />
      <rect x="94" y="112" width="14" height="11" rx="1.5" fill={HAIRLINE_SOFT} stroke={HAIRLINE} />
      <rect x="150" y="120" width="18" height="11" rx="1.5" fill={HAIRLINE_SOFT} stroke={HAIRLINE} />

      {CAPTURE_POINTS.map((point, index) => (
        <CapturePoint
          key={`${point.cx}-${point.cy}`}
          act={act}
          cx={point.cx}
          cy={point.cy}
          at={0.04 + index * 0.075}
        />
      ))}
      {frozen ? null : (
        <motion.g style={{ x: sweepX, opacity: sweepOpacity }}>
          <line x1="0" y1="8" x2="0" y2="148" stroke={ACCENT} strokeWidth="1.5" />
          <circle cx="0" cy="8" r="2.5" fill={ACCENT} />
        </motion.g>
      )}
    </>
  );
}

/* ------------------------------------------------------- act 2 — testbed */

/**
 * TestbedAct — the same capture, framed and kept. The frame is drawn *around*
 * the capture rather than replacing it: raw capture stays visibly the thing the
 * testbed is made of, so nothing derived can be read as having been promoted.
 */
export function TestbedAct({ act }: ActProps) {
  const kept = useEnter(act, ACT.testbed);
  return (
    <motion.rect
      x="2" y="2" width="236" height="152" rx="4"
      fill="none" stroke={ACCENT} strokeWidth="1.5"
      style={{ pathLength: kept, opacity: kept }}
    />
  );
}

/** The pin that says the testbed is versioned and kept, not a one-off scene. */
export function TestbedPin({ act }: ActProps) {
  const pin = useEnterLift(act, ACT.testbed, 8);
  return (
    // Deliberately not a fabricated version string or digest: the point is that
    // a real run pins both, not that this illustration invents values.
    <motion.p
      style={{ ...pin, borderColor: HAIRLINE }}
      className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xs border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-300 lg:mt-3"
    >
      Testbed kept
      <span className="text-ink-400">·</span>
      version and digest pinned
    </motion.p>
  );
}

/* ------------------------------------------------------ act 3 — decision */

/** DecisionAct — the call the buyer is about to make, and the line it turns on. */
export function DecisionAct({ act, compact = false }: ActProps) {
  const enter = useEnterLift(act, ACT.decision);
  const recede = useRecede(act, ACT.routing, 0.6);

  return (
    <motion.div style={{ opacity: enter.opacity, y: enter.y }}>
      <motion.div
        style={{ opacity: recede, borderColor: HAIRLINE }}
        className="rounded-sm border px-3 py-2 sm:px-4 sm:py-2.5"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">
          The decision
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p
            className={cn(
              "min-w-0 font-medium leading-snug text-[color:var(--text-on-ink)]",
              compact ? "text-[14px]" : "text-[14px] sm:text-[15.5px]",
            )}
          >
            {runFilmDecision.question}
          </p>
          <p className="shrink-0 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-300">
            Threshold · {pct(THRESHOLD)} {runFilmDecision.metricLabel}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------- act 5 — routing (centrepiece) */

/** One rung of the ladder, lit as the claim climbs onto it. */
function Rung({
  act,
  index,
  climbed,
  gated,
}: {
  act: MotionValue<number>;
  index: number;
  climbed: boolean;
  gated: boolean;
}) {
  // Rungs light left to right, so routing reads as a climb rather than a jump.
  const lit = useTransform(act, [ACT.routing - 0.5 + index * 0.09, ACT.routing - 0.34 + index * 0.09], [0, 1]);
  const background = gated ? GATE : climbed ? ACCENT : HAIRLINE;

  return (
    <motion.span
      style={{ opacity: climbed || gated ? lit : 1, background }}
      className={cn("h-1 rounded-full", gated ? "w-2" : "w-3")}
    />
  );
}

/**
 * RoutingAct — where one claim's evidence came from, and what it was refused.
 *
 * This is the act the whole film is for. Each claim climbs the cost ladder on
 * its own and stops at the cheapest rung strong enough to carry it — the three
 * claims stop in three different places, which is the thing prose cannot show.
 * The third claim is refused a rung it could have reached cheaply, because a
 * method is only used where it is qualified for that kind of claim. Cost order
 * is not authority order.
 */
export function RoutingAct({ act, route }: ActProps & { route: RunFilmRoute }) {
  const routed = useEnter(act, ACT.routing);
  const gateEnter = useEnter(act, ACT.routing + 0.25);
  const rung = runFilmRungs[route.rung];

  return (
    <motion.div style={{ opacity: routed }} className="mt-1 sm:mt-1.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
          {runFilmRungs.map((ladderRung, index) => (
            <Rung
              key={ladderRung.label}
              act={act}
              index={index}
              climbed={index <= route.rung}
              gated={route.gate?.rung === index}
            />
          ))}
        </span>
        <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-ink-300">
          {rung.label}
        </span>
        {/* The basis tag, so a cheaper rung is never read as a weaker standard
            of proof — position on the ladder is cost, not authority. */}
        <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-400">
          {rung.basis}
        </span>
      </div>

      {route.gate ? (
        <motion.p
          style={{ opacity: gateEnter, color: GATE }}
          className="mt-1 flex items-start gap-1.5 text-[10.5px] leading-snug"
        >
          <CircleSlash className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
          <span>
            Refused · {runFilmRungs[route.gate.rung].label} — {route.gate.reason}
          </span>
        </motion.p>
      ) : null}
    </motion.div>
  );
}

/* --------------------------------------------------- act 6 — measurement */

/**
 * MeasurementAct — what came back for one claim: a point estimate inside its
 * uncertainty interval. Same scale and the same marks as the claim-threshold
 * chart, so the film and that figure agree on sight.
 */
export function MeasurementAct({ act, route }: ActProps & { route: RunFilmRoute }) {
  const measured = useEnter(act, ACT.measurement);
  const resolved = useEnter(act, ACT.envelope);

  return (
    <div className="relative mt-1.5 h-5 sm:mt-2 sm:h-6">
      <div className="absolute inset-x-0 top-1/2 h-px" style={{ background: HAIRLINE_SOFT }} />
      {/* The threshold arrives with the envelope: measurement is the number,
          the envelope is what the number is read against. */}
      <motion.div
        aria-hidden="true"
        style={{ opacity: resolved, background: "rgba(243,239,230,0.75)", left: `${THRESHOLD * 100}%` }}
        className="absolute top-0 h-full w-px"
      />
      <motion.div style={{ opacity: measured }} className="absolute inset-0" aria-hidden="true">
        <motion.div
          style={{
            scaleX: measured,
            transformOrigin: "left center",
            left: `${route.claim.low * 100}%`,
            width: `${(route.claim.high - route.claim.low) * 100}%`,
            background: MUTED,
          }}
          className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full"
        />
        <div
          className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${route.claim.estimate * 100}%`,
            background: MUTED,
            boxShadow: `0 0 0 2px ${SURFACE}`,
          }}
        />
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------- act 4 — claims */

/**
 * ClaimsAct — the decision, broken into claims that can each be tested and each
 * be wrong on their own.
 *
 * The rows are the film's spine from here on: act 5 adds a routing cell to each
 * one, act 6 adds a measurement, and act 7 adds a verdict. The verdict chip
 * lives here rather than in `EnvelopeAct` because it is a cell of this row, but
 * it is timed to the envelope act — nothing is called before the answer.
 */
export function ClaimsAct({ act, compact = false }: ActProps) {
  return (
    <ol className={cn(compact ? "space-y-2.5" : "space-y-2.5 sm:space-y-3")}>
      {runFilmRoutes.map((route, index) => (
        <ClaimRow key={route.short} act={act} route={route} index={index} compact={compact} />
      ))}
    </ol>
  );
}

function ClaimRow({
  act,
  route,
  index,
  compact,
}: {
  act: MotionValue<number>;
  route: RunFilmRoute;
  index: number;
  compact: boolean;
}) {
  // Rows arrive in reading order, an act-fraction apart. No two entrances land
  // at the same moment.
  const appear = useEnterLift(act, ACT.claims + index * 0.08);
  const resolved = useEnter(act, ACT.envelope + index * 0.08);
  const meta = verdictMeta[route.claim.verdict];
  const VerdictIcon = meta.icon;

  return (
    <motion.li style={{ opacity: appear.opacity, y: appear.y }} className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p
          className={cn(
            "min-w-0 font-medium leading-snug text-[color:var(--text-on-ink)]",
            compact ? "text-[13px]" : "text-[13px] sm:text-[14.5px]",
          )}
        >
          {route.short}
        </p>
        {/* Verdict is icon plus word. Never colour alone. */}
        <motion.span
          style={{ opacity: resolved, color: meta.fgOnInk }}
          className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold sm:text-[12px]"
        >
          <VerdictIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {meta.label}
        </motion.span>
      </div>

      <RoutingAct act={act} route={route} />
      <MeasurementAct act={act} route={route} />

      {/* An unresolved claim is a result, not a gap — so it carries the next
          test that would settle it rather than trailing off. */}
      {route.nextTest !== undefined ? (
        <motion.p
          style={{ opacity: resolved }}
          className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-400"
        >
          Next test · {runFilmRungs[route.nextTest].label}
        </motion.p>
      ) : null}
    </motion.li>
  );
}

/* ----------------------------------------------------- act 7 — envelope */

/**
 * EnvelopeAct — the answer with its edges drawn, and the two things it is not.
 *
 * The frame is four scaling hairlines rather than a border transition, so it
 * reads as being drawn around the result. The stamps under it are the load
 * bearing part of the whole film: a decision envelope fails validation unless
 * both deployment approval and safety certification are false, so this is a
 * contract-level guarantee rather than a promise.
 */
export function EnvelopeAct({ act }: ActProps) {
  const envelope = useEnter(act, ACT.envelope + 0.16);

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute -inset-x-3 -inset-y-3">
        <motion.span
          style={{ scaleX: envelope, transformOrigin: "left center", background: ACCENT }}
          className="absolute inset-x-0 top-0 h-px"
        />
        <motion.span
          style={{ scaleX: envelope, transformOrigin: "right center", background: ACCENT }}
          className="absolute inset-x-0 bottom-0 h-px"
        />
        <motion.span
          style={{ scaleY: envelope, transformOrigin: "top center", background: ACCENT }}
          className="absolute inset-y-0 left-0 w-px"
        />
        <motion.span
          style={{ scaleY: envelope, transformOrigin: "bottom center", background: ACCENT }}
          className="absolute inset-y-0 right-0 w-px"
        />
      </div>
    </>
  );
}

/**
 * The two stamps a run never grants. These stay inside the frame because act 7
 * is the whole argument in one image — three verdicts, one of them not yet, and
 * two things this explicitly is not. The sentence explaining why they can be
 * trusted lives in `RunFilmLimits` at page level, where it has room.
 */
export function EnvelopeStamps({ act }: ActProps) {
  const stamps = useEnterLift(act, ACT.envelope + 0.3, 8);

  return (
    <motion.div
      style={{ opacity: stamps.opacity, y: stamps.y }}
      className="mt-3 flex flex-wrap items-center gap-2"
    >
      {runFilmStamps.map((stamp) => (
        <span
          key={stamp.label}
          style={{ borderColor: HAIRLINE }}
          className="inline-flex items-center gap-1.5 rounded-xs border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-300"
        >
          <CircleSlash className="h-3 w-3 shrink-0" style={{ color: GATE }} aria-hidden="true" />
          {stamp.label}
          <span className="font-semibold text-[color:var(--text-on-ink)]">{stamp.value}</span>
        </span>
      ))}
    </motion.div>
  );
}

/* ------------------------------------------------------------- the stage */

/** The scale every measurement is read against. */
function ScaleReference({ act }: ActProps) {
  const scale = useEnter(act, ACT.measurement);
  return (
    <motion.div style={{ opacity: scale }} className="relative mt-2 h-3.5" aria-hidden="true">
      <span className="absolute inset-x-0 top-0 block h-px" style={{ background: HAIRLINE_SOFT }} />
      <span
        className="absolute top-0 block h-1.5 w-px"
        style={{ background: HAIRLINE, left: `${THRESHOLD * 100}%` }}
      />
      <span className="absolute left-0 top-1 font-mono text-[9.5px] text-ink-400">0%</span>
      <span className="absolute right-0 top-1 font-mono text-[9.5px] text-ink-400">100%</span>
    </motion.div>
  );
}

/**
 * RunFilmStage — the seven acts composed onto one stage.
 *
 * Decorative in full: every word drawn here is repeated in the act list, which
 * is what assistive technology and no-JS readers get.
 */
export function RunFilmStage({
  act,
  frozen = false,
  compact = false,
  className,
}: ActProps & { className?: string }) {
  const placeRecede = useRecede(act, ACT.decision);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid min-w-0 gap-5 px-4 py-4 sm:px-5 sm:py-3.5 lg:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] lg:gap-8",
        className,
      )}
    >
      <motion.div style={{ opacity: placeRecede }} className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-400">The place</p>
        {/* Side by side while the stage is narrow, stacked once there is a
            column to stack in. */}
        <div className="mt-2.5 flex items-center gap-4 lg:mt-3 lg:block">
          <svg
            viewBox="0 0 240 156"
            className={cn(
              "w-full shrink-0",
              compact ? "max-w-[7rem] lg:max-w-[13rem]" : "max-w-[7.5rem] lg:max-w-[14rem]",
            )}
            aria-hidden="true"
          >
            <CaptureAct act={act} frozen={frozen} />
            <TestbedAct act={act} />
          </svg>
          <TestbedPin act={act} />
        </div>
      </motion.div>

      <div className="flex min-w-0 flex-col gap-4">
        <DecisionAct act={act} compact={compact} />
        <div>
          {/* The envelope is drawn around the claims and their scale and stops
              there — its stamps sit outside the frame, under it. */}
          <div className="relative">
            <ClaimsAct act={act} compact={compact} />
            <ScaleReference act={act} />
            <EnvelopeAct act={act} />
          </div>
          <EnvelopeStamps act={act} />
        </div>
      </div>
    </div>
  );
}
