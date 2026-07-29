// Public-site figure library.
//
// These are the explanatory graphics for one product: a Task Evaluation Run.
// Two hard rules govern everything in this file:
//
// 1. No fabricated operational state. Nothing here reports supply, throughput,
//    customer counts, accuracy, or a measured result. Figures either show the
//    *shape* of a returned envelope or a *conceptual ordering* (e.g. relative
//    cost of evidence methods), and every one of them says so on its face via
//    FigureFrame's `kind` tag.
// 2. Motion is additive. Bars, strokes, and pulses animate only under
//    `html.bp-motion` (see index.css) and collapse to the finished state under
//    `prefers-reduced-motion: reduce`, so prerendered and no-JS output is
//    complete.

import { useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { useInViewRef } from "./motion";

/* ---------------------------------------------------------------- frame ---- */

type FigureKind = "schematic" | "structure" | "concept";

const kindLabel: Record<FigureKind, string> = {
  // What the reader is looking at, stated plainly so no figure can be mistaken
  // for measured Blueprint output.
  schematic: "Schematic",
  structure: "Result structure · illustrative",
  concept: "Conceptual ordering",
};

type FigureFrameProps = {
  eyebrow: string;
  title: string;
  /** Footnote under the graphic — use it to bound the claim. */
  note?: string;
  kind?: FigureKind;
  onInk?: boolean;
  className?: string;
  children: ReactNode;
};

export function FigureFrame({
  eyebrow,
  title,
  note,
  kind = "schematic",
  onInk = false,
  className,
  children,
}: FigureFrameProps) {
  const ref = useInViewRef<HTMLElement>({ amount: 0.12 });

  return (
    <figure
      ref={ref}
      className={cn(
        "bp-figure relative overflow-hidden border",
        onInk ? "border-white/12 bg-graphite" : "border-line bg-white",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b px-5 py-4 sm:px-7",
          onInk ? "border-white/10" : "border-line-soft",
        )}
      >
        <div className="min-w-0">
          <p
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.24em]",
              onInk ? "text-brass" : "text-brass-deep",
            )}
          >
            {eyebrow}
          </p>
          <h3
            className={cn(
              "mt-2 font-display text-[1.35rem] font-medium leading-tight tracking-[-0.02em]",
              onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
            )}
          >
            {title}
          </h3>
        </div>
        <span
          className={cn(
            "shrink-0 border px-2 py-1 font-mono text-[9.5px] uppercase tracking-[0.2em]",
            onInk ? "border-white/15 text-white/55" : "border-line text-ink-400",
          )}
        >
          {kindLabel[kind]}
        </span>
      </div>

      <div className="px-5 py-6 sm:px-7 sm:py-8">{children}</div>

      {note ? (
        <figcaption
          className={cn(
            "border-t px-5 py-3.5 text-[12.5px] leading-6 sm:px-7",
            onInk ? "border-white/10 text-white/55" : "border-line-soft bg-canvas text-ink-500",
          )}
        >
          {note}
        </figcaption>
      ) : null}
    </figure>
  );
}

/* --------------------------------------------------------- outcome chips --- */

export type OutcomeTone = "supported" | "rejected" | "unresolved" | "abstained" | "pending";

const outcomeToneClass: Record<OutcomeTone, string> = {
  supported: "border-proof-bd bg-proof-bg text-proof-fg",
  rejected: "border-block-bd bg-block-bg text-block-fg",
  unresolved: "border-warn-bd bg-warn-bg text-warn-fg",
  abstained: "border-info-bd bg-info-bg text-info-fg",
  pending: "border-line bg-inset text-ink-500",
};

const outcomeBarClass: Record<OutcomeTone, string> = {
  supported: "bg-proof-600",
  rejected: "bg-block-600",
  unresolved: "bg-warn-600",
  abstained: "bg-info-600",
  pending: "bg-ink-300",
};

export function OutcomeChip({
  tone,
  children,
  className,
}: {
  tone: OutcomeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]",
        outcomeToneClass[tone],
        className,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", outcomeBarClass[tone])} />
      {children}
    </span>
  );
}

/* -------------------------------------------------------- evidence ladder -- */

export type LadderRung = {
  name: string;
  /** What this rung is good at answering, in one line. */
  answers: string;
  /** Relative cost/time, 0–100. Conceptual ordering only. */
  cost: number;
  /** Strength of claim the rung can support, 0–100. Conceptual ordering only. */
  strength: number;
};

export const evidenceLadder: LadderRung[] = [
  { name: "Fixture data", answers: "Is the task even described well enough to test?", cost: 6, strength: 14 },
  { name: "Site geometry", answers: "Does the robot fit, reach, and clear the space?", cost: 18, strength: 30 },
  { name: "Real observations", answers: "What actually happens here — traffic, clutter, light, timing?", cost: 34, strength: 52 },
  { name: "Traditional simulation", answers: "How does the motion hold up across scripted variation?", cost: 52, strength: 64 },
  { name: "World models", answers: "How does behaviour hold up across generated variation?", cost: 68, strength: 72 },
  { name: "Provider tools", answers: "What does a specialist method add for this one claim?", cost: 80, strength: 80 },
  { name: "Physical evidence", answers: "What happens when a real robot does it on site?", cost: 100, strength: 100 },
];

/**
 * EvidenceLadderFigure — the router story. A decorative staircase spark plus an
 * accessible per-rung readout of relative cost against the strength of claim
 * the rung can carry. Hovering or focusing a rung highlights it.
 */
export function EvidenceLadderFigure({
  rungs = evidenceLadder,
  onInk = false,
}: {
  rungs?: LadderRung[];
  onInk?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div>
      {/* Decorative staircase: cost rises left to right, each tread a rung. */}
      <svg
        viewBox="0 0 700 150"
        aria-hidden
        preserveAspectRatio="none"
        className="mb-7 h-[104px] w-full"
      >
        <defs>
          <linearGradient id="bp-ladder-fill" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--bp-brass)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--bp-brass)" stopOpacity="0.34" />
          </linearGradient>
        </defs>
        {rungs.map((rung, index) => {
          const width = 700 / rungs.length;
          const height = (rung.strength / 100) * 132;
          return (
            <rect
              key={rung.name}
              x={index * width + 2}
              y={150 - height}
              width={width - 4}
              height={height}
              fill="url(#bp-ladder-fill)"
              stroke={active === index ? "var(--bp-brass)" : "transparent"}
              strokeWidth="1"
            />
          );
        })}
        <path
          d={rungs
            .map((rung, index) => {
              const width = 700 / rungs.length;
              const x0 = index * width;
              const y = 150 - (rung.strength / 100) * 132;
              return `${index === 0 ? "M" : "L"}${x0} ${y}L${x0 + width} ${y}`;
            })
            .join("")}
          className="bp-draw"
          pathLength={1}
          fill="none"
          stroke="var(--bp-brass)"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <ol className="space-y-px">
        {rungs.map((rung, index) => {
          const isActive = active === index;
          return (
            <li
              key={rung.name}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              tabIndex={0}
              className={cn(
                "grid grid-cols-[2.25rem_1fr] items-baseline gap-x-3 gap-y-2 border-l-2 px-3 py-3 outline-none transition-colors duration-200 sm:grid-cols-[2.25rem_minmax(0,1.05fr)_minmax(0,1fr)] sm:gap-x-5",
                isActive
                  ? onInk ? "border-brass bg-white/[0.04]" : "border-brass bg-canvas"
                  : "border-transparent",
              )}
            >
              <span
                className={cn(
                  "font-mono text-[11px] tabular-nums",
                  onInk ? "text-white/40" : "text-ink-400",
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>

              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[15px] font-semibold tracking-[-0.01em]",
                    onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
                  )}
                >
                  {rung.name}
                </p>
                <p
                  className={cn(
                    "mt-1 text-[13px] leading-6",
                    onInk ? "text-white/55" : "text-ink-500",
                  )}
                >
                  {rung.answers}
                </p>
              </div>

              <div className="col-span-2 space-y-2 sm:col-span-1 sm:pt-1">
                <LadderTrack
                  label="Cost / time"
                  value={rung.cost}
                  delay={index * 70}
                  tone="brass"
                  onInk={onInk}
                />
                <LadderTrack
                  label="Claim strength"
                  value={rung.strength}
                  delay={index * 70 + 120}
                  tone="ink"
                  onInk={onInk}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function LadderTrack({
  label,
  value,
  delay,
  tone,
  onInk,
}: {
  label: string;
  value: number;
  delay: number;
  tone: "brass" | "ink";
  onInk: boolean;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-3">
      <span
        className={cn(
          "font-mono text-[9.5px] uppercase tracking-[0.16em]",
          onInk ? "text-white/40" : "text-ink-400",
        )}
      >
        {label}
      </span>
      <span
        className={cn("h-[5px] w-full overflow-hidden", onInk ? "bg-white/10" : "bg-sunken")}
      >
        <span
          className={cn(
            "bp-bar-fill block h-full",
            tone === "brass" ? "bg-brass-deep" : onInk ? "bg-white/70" : "bg-ink-700",
          )}
          style={{ "--bp-bar": `${value}%`, "--bp-bar-delay": `${delay}ms` } as CSSProperties}
        />
      </span>
    </div>
  );
}

/* ------------------------------------------------------------- run flow ---- */

export type FlowStage = {
  title: string;
  body: string;
};

export const runFlowStages: FlowStage[] = [
  { title: "Describe the decision", body: "The question, the claims under it, thresholds, what a false-safe would cost, budget, deadline." },
  { title: "Pin the testbed", body: "The request names an exact captured site-task version and digest. Nothing floats." },
  { title: "Plan the evidence", body: "Pipeline picks the cheapest qualified method for each claim, separately." },
  { title: "Measure", body: "Each method reports what it measured, where it is valid, and how uncertain it is." },
  { title: "Decide or abstain", body: "Per-claim outcomes, the envelope they hold inside, and the strongest claim allowed." },
  { title: "Name the next test", body: "If the answer isn't strong enough, the cheapest stronger experiment is named." },
];

/**
 * RunFlowFigure — the six stages of a run on a rail, with an evidence pulse
 * traveling the rail and stages lighting up in sequence.
 */
export function RunFlowFigure({
  stages = runFlowStages,
  onInk = true,
}: {
  stages?: FlowStage[];
  onInk?: boolean;
}) {
  const ref = useInViewRef<HTMLDivElement>({ amount: 0.15 });

  return (
    <div ref={ref} className="bp-figure relative">
      {/* Rail: horizontal from md up, vertical on phones. */}
      <div
        aria-hidden
        className={cn(
          "absolute left-[1.05rem] top-2 bottom-2 w-px md:left-0 md:right-0 md:top-[1.05rem] md:h-px md:w-auto md:bottom-auto",
          onInk ? "bg-white/15" : "bg-line",
        )}
      >
        <span
          className={cn(
            "bp-pulse absolute hidden h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full md:block",
            "bg-brass shadow-[0_0_0_4px_rgba(199,167,117,0.18)]",
          )}
          style={{ top: "50%" }}
        />
      </div>

      <ol className="relative grid gap-7 md:grid-cols-3 md:gap-x-8 md:gap-y-10 lg:grid-cols-6 lg:gap-x-5">
        {stages.map((stage, index) => (
          <li key={stage.title} className="relative pl-11 md:pl-0">
            <span
              className={cn(
                "absolute left-0 top-0 flex h-[2.1rem] w-[2.1rem] items-center justify-center rounded-full border font-mono text-[11px] tabular-nums md:relative md:mb-5",
                onInk
                  ? "border-white/20 bg-ink text-brass"
                  : "border-line-strong bg-white text-brass-deep",
              )}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <h4
              className={cn(
                "text-[15px] font-semibold leading-snug tracking-[-0.01em]",
                onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
              )}
            >
              {stage.title}
            </h4>
            <p
              className={cn(
                "mt-2 text-[13px] leading-6",
                onInk ? "text-white/55" : "text-ink-500",
              )}
            >
              {stage.body}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------------------------------------------------------- claim board ---- */

export type ClaimRow = {
  claim: string;
  method: string;
  tone: OutcomeTone;
  outcome: string;
  /** Measured band as [low, high] percentages of the axis. Illustrative shape. */
  band?: [number, number];
  /** Threshold marker position, 0–100. */
  threshold?: number;
};

export const claimBoardRows: ClaimRow[] = [
  {
    claim: "The candidate can reach the fixture from the marked stop.",
    method: "Site geometry",
    tone: "supported",
    outcome: "Supported",
    band: [78, 92],
    threshold: 70,
  },
  {
    claim: "Aisle clearance holds during the day shift.",
    method: "Real observations",
    tone: "supported",
    outcome: "Supported",
    band: [62, 81],
    threshold: 55,
  },
  {
    claim: "The tote pick survives the clutter seen at peak.",
    method: "Simulation + world models",
    tone: "unresolved",
    outcome: "Unresolved",
    band: [38, 72],
    threshold: 65,
  },
  {
    claim: "Candidate A outperforms candidate B on this site.",
    method: "No qualified method at this strength",
    tone: "abstained",
    outcome: "Abstained",
  },
  {
    claim: "The reach is safe next to the conveyor guard.",
    method: "Physical evidence required",
    tone: "rejected",
    outcome: "Physical needed",
  },
];

/**
 * ClaimBoardFigure — what actually comes back from a run: one row per claim,
 * the method that answered it, the outcome, and where the measured band sat
 * relative to the threshold. Rows without a band are the honest ones: no
 * qualified method, so no number is drawn.
 */
export function ClaimBoardFigure({ rows = claimBoardRows }: { rows?: ClaimRow[] }) {
  const ref = useInViewRef<HTMLDivElement>({ amount: 0.12 });

  return (
    <div ref={ref} className="bp-figure">
      <div className="hidden grid-cols-[minmax(0,1.45fr)_minmax(0,0.8fr)_12.5rem_minmax(0,1fr)] gap-4 border-b border-line-soft pb-3 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-400 lg:grid">
        <span>Decision-relevant claim</span>
        <span>Method selected</span>
        <span>Outcome</span>
        <span>Measured band vs threshold</span>
      </div>

      <ol className="divide-y divide-line-soft">
        {rows.map((row, index) => (
          <li
            key={row.claim}
            className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,0.8fr)_12.5rem_minmax(0,1fr)] lg:items-center lg:gap-4"
          >
            <p className="text-[14px] leading-6 text-ink-900">{row.claim}</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-500">
              {row.method}
            </p>
            <div>
              <OutcomeChip tone={row.tone}>{row.outcome}</OutcomeChip>
            </div>
            {row.band ? (
              <div className="relative h-8">
                <span aria-hidden className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-sunken" />
                <span
                  className={cn(
                    "bp-bar-fill absolute top-1/2 h-[3px] -translate-y-1/2",
                    outcomeBarClass[row.tone],
                  )}
                  style={{
                    left: `${row.band[0]}%`,
                    "--bp-bar": `${row.band[1] - row.band[0]}%`,
                    "--bp-bar-delay": `${index * 90}ms`,
                  } as CSSProperties}
                />
                {typeof row.threshold === "number" ? (
                  <span
                    className="absolute top-1 h-6 border-l border-dashed border-ink-700"
                    style={{ left: `${row.threshold}%` }}
                  >
                    <span className="absolute -top-0.5 left-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-500">
                      thr
                    </span>
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-400">
                No number drawn
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ----------------------------------------------------------- outcome fan --- */

export type FanOutcome = {
  label: string;
  body: string;
  tone: OutcomeTone;
};

export const fanOutcomes: FanOutcome[] = [
  { label: "Yes, inside these limits", body: "The action is supported, and the limits are printed next to it.", tone: "supported" },
  { label: "No, inside these limits", body: "The evidence supports rejecting the option in this scope.", tone: "rejected" },
  { label: "Partly", body: "Some claims resolved; the rest are named as still open.", tone: "unresolved" },
  { label: "We abstain", body: "Nothing qualified is strong enough. No winner is inferred from raw scores.", tone: "abstained" },
  { label: "Here is the next test", body: "The cheapest stronger experiment, and whether it has to be physical.", tone: "pending" },
];

/**
 * OutcomeFanFigure — one request brackets out into five honest endings.
 * Deliberately shows no frequencies: the point is that all five are valid
 * deliveries, not how often each occurs.
 */
export function OutcomeFanFigure({ outcomes = fanOutcomes }: { outcomes?: FanOutcome[] }) {
  const ref = useInViewRef<HTMLDivElement>({ amount: 0.12 });

  return (
    <div ref={ref} className="bp-figure grid gap-6 lg:grid-cols-[14rem_1fr] lg:gap-10">
      <div className="lg:flex lg:items-center">
        <div className="relative w-full border border-line bg-canvas px-4 py-4">
          <span
            aria-hidden
            className="absolute -right-px top-1/2 hidden h-px w-4 -translate-y-1/2 bg-brass/60 lg:block"
          />
          <div className="flex items-center gap-3">
            <span aria-hidden className="h-2 w-2 rounded-full bg-brass" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-600">
              One run request
            </span>
          </div>
          <p className="mt-3 text-[13px] leading-6 text-ink-500">
            One decision, several claims, one scoped evidence plan.
          </p>
        </div>
      </div>

      {/* Bracket rail: a single vertical line with a tick into every ending. */}
      <ol className="relative border-l border-line pl-6 lg:pl-8">
        <span
          aria-hidden
          className="absolute left-[-1px] top-0 hidden h-full w-px bg-brass/40 lg:block"
        />
        {outcomes.map((outcome, index) => (
          <li
            key={outcome.label}
            className="relative border-b border-line-soft py-4 last:border-b-0"
          >
            <span
              aria-hidden
              className="absolute left-[-1.5rem] top-[1.55rem] h-px w-[1.5rem] bg-line-strong lg:left-[-2rem] lg:w-[2rem]"
              style={{ "--bp-bar-delay": `${index * 80}ms` } as CSSProperties}
            />
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <OutcomeChip tone={outcome.tone}>{outcome.label}</OutcomeChip>
              <p className="min-w-[16rem] flex-1 text-[13.5px] leading-6 text-ink-500">
                {outcome.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* -------------------------------------------------------- candidate grid --- */

export type MatrixCell = { tone: OutcomeTone; short: string };

export const candidateMatrix: {
  claims: string[];
  candidates: string[];
  cells: MatrixCell[][];
} = {
  claims: ["Reach the fixture", "Clear the aisle", "Pick under clutter", "Beat the other candidate"],
  candidates: ["Ckpt A", "Ckpt B", "Ckpt C"],
  cells: [
    [
      { tone: "supported", short: "OK" },
      { tone: "supported", short: "OK" },
      { tone: "rejected", short: "No" },
    ],
    [
      { tone: "supported", short: "OK" },
      { tone: "unresolved", short: "Open" },
      { tone: "supported", short: "OK" },
    ],
    [
      { tone: "unresolved", short: "Open" },
      { tone: "unresolved", short: "Open" },
      { tone: "rejected", short: "No" },
    ],
    [
      { tone: "abstained", short: "Abst." },
      { tone: "abstained", short: "Abst." },
      { tone: "abstained", short: "Abst." },
    ],
  ],
};

/**
 * CandidateMatrixFigure — claims down, candidates across. An eliminated
 * candidate is a real result; the bottom row shows the comparison claim itself
 * abstaining, which is what stops a ranking from being invented.
 */
export function CandidateMatrixFigure({ data = candidateMatrix }: { data?: typeof candidateMatrix }) {
  const ref = useInViewRef<HTMLDivElement>({ amount: 0.12 });

  return (
    <div ref={ref} className="bp-figure -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[30rem] border-collapse text-left">
        <thead>
          <tr>
            <th scope="col" className="w-[42%] pb-3 font-mono text-[9.5px] font-normal uppercase tracking-[0.18em] text-ink-400">
              Claim
            </th>
            {data.candidates.map((candidate) => (
              <th
                key={candidate}
                scope="col"
                className="pb-3 font-mono text-[9.5px] font-normal uppercase tracking-[0.18em] text-ink-400"
              >
                {candidate}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {data.claims.map((claim, rowIndex) => (
            <tr key={claim}>
              <th scope="row" className="py-3.5 pr-4 text-[14px] font-medium leading-6 text-ink-900">
                {claim}
              </th>
              {data.cells[rowIndex].map((cell, cellIndex) => (
                <td key={`${claim}-${cellIndex}`} className="py-3.5 pr-3">
                  <OutcomeChip tone={cell.tone}>{cell.short}</OutcomeChip>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------- evidence gap ---- */

export type GapRow = {
  area: string;
  /** Share of the claim area the current capture can already carry, 0–100. */
  covered: number;
  gapNeeds: string;
};

export const evidenceGapRows: GapRow[] = [
  { area: "Fit, reach, clearance", covered: 88, gapNeeds: "Recapture only if the layout moves" },
  { area: "Route and traffic conditions", covered: 74, gapNeeds: "A second capture window at peak" },
  { area: "Rigid pick and place", covered: 61, gapNeeds: "Scenario variation, then review" },
  { area: "Contact-rich handling", covered: 32, gapNeeds: "Physical evidence on site" },
  { area: "Safety-critical proximity", covered: 12, gapNeeds: "Physical evidence and your safety process" },
];

/**
 * EvidenceGapFigure — for site operators: what today's capture can already
 * carry per claim area, and what the remainder would take. The hatched
 * remainder is the honest half of the graphic.
 */
export function EvidenceGapFigure({ rows = evidenceGapRows }: { rows?: GapRow[] }) {
  const ref = useInViewRef<HTMLDivElement>({ amount: 0.12 });

  return (
    <div ref={ref} className="bp-figure">
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-400">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-2 w-5 bg-ink-800" />
          Carried by capture today
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-5 bg-[repeating-linear-gradient(45deg,var(--bp-line-strong)_0_3px,transparent_3px_6px)]"
          />
          Needs stronger evidence
        </span>
      </div>

      <ol className="space-y-4">
        {rows.map((row, index) => (
          <li key={row.area} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center sm:gap-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-medium text-ink-900">{row.area}</span>
              <span className="font-mono text-[11px] tabular-nums text-ink-400">{row.covered}</span>
            </div>
            <div>
              <span className="relative flex h-[10px] w-full overflow-hidden bg-[repeating-linear-gradient(45deg,var(--bp-line-strong)_0_3px,transparent_3px_6px)]">
                <span
                  className="bp-bar-fill block h-full bg-ink-800"
                  style={{ "--bp-bar": `${row.covered}%`, "--bp-bar-delay": `${index * 80}ms` } as CSSProperties}
                />
              </span>
              <p className="mt-1.5 text-[12.5px] leading-5 text-ink-500">{row.gapNeeds}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* -------------------------------------------------------- scope drivers ---- */

export type ScopeDriver = {
  factor: string;
  low: string;
  high: string;
  /**
   * Marker position for one illustrative scoping, 0–100. Not a distribution of
   * completed runs — there is no operational record behind these positions.
   */
  marker: number;
};

export const scopeDrivers: ScopeDriver[] = [
  { factor: "Strength the decision demands", low: "Screening", high: "Safety-adjacent", marker: 38 },
  { factor: "Claims under the decision", low: "One", high: "A dozen", marker: 30 },
  { factor: "Candidates compared", low: "None", high: "Many checkpoints", marker: 34 },
  { factor: "Evidence you already have", low: "Captured and rights-cleared", high: "Nothing yet", marker: 46 },
  { factor: "Scenario and compute breadth", low: "Narrow", high: "Wide sweep", marker: 42 },
  { factor: "Deadline pressure", low: "Normal queue", high: "Compressed", marker: 26 },
  { factor: "Physical work required", low: "None", high: "On-site robot time", marker: 20 },
];

/**
 * ScopeDriverFigure — what moves a quote, without inventing a price. Each row
 * is a range with a marker showing one illustrative scoping along it. The
 * markers are not a claim about where completed runs have landed.
 */
export function ScopeDriverFigure({ drivers = scopeDrivers }: { drivers?: ScopeDriver[] }) {
  const ref = useInViewRef<HTMLDivElement>({ amount: 0.12 });

  return (
    <div ref={ref} className="bp-figure space-y-5">
      {drivers.map((driver, index) => (
        <div key={driver.factor}>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[14px] font-medium text-ink-900">{driver.factor}</span>
          </div>
          <div className="relative mt-2 h-[26px]">
            <span aria-hidden className="absolute inset-x-0 top-[7px] h-[3px] bg-sunken" />
            <span
              className="bp-bar-fill absolute top-[7px] h-[3px] bg-brass-deep"
              style={{ "--bp-bar": `${driver.marker}%`, "--bp-bar-delay": `${index * 70}ms` } as CSSProperties}
            />
            <span
              aria-hidden
              className="absolute top-[2px] h-[13px] w-[13px] -translate-x-1/2 rounded-full border border-brass-deep bg-white"
              style={{ left: `${driver.marker}%` }}
            />
            <span className="absolute left-0 top-[18px] font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-400">
              {driver.low}
            </span>
            <span className="absolute right-0 top-[18px] font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-400">
              {driver.high}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------ provenance chain --- */

export type ChainLink = {
  label: string;
  token: string;
  body: string;
};

export const provenanceChain: ChainLink[] = [
  { label: "Raw capture", token: "capture · timestamps · poses · device", body: "Immutable, provenance-linked, and authoritative." },
  { label: "Rights record", token: "consent · privacy · permitted use", body: "What may be used, by whom, for what." },
  { label: "Testbed version", token: "testbed-id · version · sha256:…", body: "The exact substrate the run was pinned to." },
  { label: "Evidence result", token: "method profile · envelope · uncertainty", body: "What was measured, and where it is valid." },
  { label: "Decision envelope", token: "per-claim outcomes · claim ceiling", body: "The answer, with everything it rests on attached." },
];

/**
 * ProvenanceChainFigure — the chain every number in a result can be walked
 * back along. Field names, not a real run.
 */
export function ProvenanceChainFigure({
  links = provenanceChain,
  onInk = false,
}: {
  links?: ChainLink[];
  onInk?: boolean;
}) {
  const ref = useInViewRef<HTMLDivElement>({ amount: 0.12 });

  return (
    <div ref={ref} className="bp-figure relative">
      <ol className="grid gap-px bg-line md:grid-cols-5">
        {links.map((link, index) => (
          <li
            key={link.label}
            className={cn("relative p-5", onInk ? "bg-graphite" : "bg-white")}
          >
            <span
              className={cn(
                "font-mono text-[9.5px] uppercase tracking-[0.2em]",
                onInk ? "text-brass" : "text-brass-deep",
              )}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <h4
              className={cn(
                "mt-2 text-[15px] font-semibold tracking-[-0.01em]",
                onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
              )}
            >
              {link.label}
            </h4>
            <p
              className={cn(
                "mt-2 break-words font-mono text-[10.5px] leading-5",
                onInk ? "text-white/45" : "text-ink-400",
              )}
            >
              {link.token}
            </p>
            <p
              className={cn(
                "mt-3 text-[13px] leading-6",
                onInk ? "text-white/55" : "text-ink-500",
              )}
            >
              {link.body}
            </p>
          </li>
        ))}
      </ol>
      <span
        aria-hidden
        className="bp-scan pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(180deg,transparent,rgba(199,167,117,0.14),transparent)]"
      />
    </div>
  );
}

/* -------------------------------------------------------- claim ceiling ---- */

export type CeilingBand = {
  label: string;
  body: string;
  supported: boolean;
};

export const claimCeilingBands: CeilingBand[] = [
  { label: "Safety approval", body: "Never ours to give. It stays with your process and your regulators.", supported: false },
  { label: "Guaranteed field success", body: "No virtual evidence promises what a real robot will do on the day.", supported: false },
  { label: "A ranking on demand", body: "Only when the comparison claim itself is supported. Otherwise we abstain.", supported: false },
  { label: "Bounded decisions on stated claims", body: "Supported, rejected, partial — each printed with the conditions it holds inside.", supported: true },
  { label: "Failure and incompatibility findings", body: "Reach, embodiment, observation, action, and environment mismatches.", supported: true },
  { label: "The next cheapest experiment", body: "What to run next, and whether it has to happen physically.", supported: true },
];

/**
 * ClaimCeilingFigure — a literal ceiling. Below the line is what a run can
 * carry; above it, hatched, is what it never claims.
 */
export function ClaimCeilingFigure({ bands = claimCeilingBands }: { bands?: CeilingBand[] }) {
  const ref = useInViewRef<HTMLDivElement>({ amount: 0.12 });
  const above = bands.filter((band) => !band.supported);
  const below = bands.filter((band) => band.supported);

  return (
    <div ref={ref} className="bp-figure">
      <ul className="space-y-px">
        {above.map((band) => (
          <li
            key={band.label}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 bg-[repeating-linear-gradient(45deg,rgba(155,48,39,0.07)_0_6px,transparent_6px_12px)] px-4 py-3.5"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-block-fg">
              Above the ceiling
            </span>
            <span className="text-[14px] font-semibold text-ink-900">{band.label}</span>
            <span className="basis-full text-[13px] leading-6 text-ink-500">{band.body}</span>
          </li>
        ))}
      </ul>

      <div className="relative my-5 flex items-center gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-deep">
          Claim ceiling
        </span>
        <svg viewBox="0 0 600 2" preserveAspectRatio="none" aria-hidden className="h-[2px] flex-1">
          <path
            d="M0 1H600"
            className="bp-draw"
            pathLength={1}
            stroke="var(--bp-brass-deep)"
            strokeWidth="2"
            strokeDasharray="1"
          />
        </svg>
      </div>

      <ul className="space-y-px">
        {below.map((band) => (
          <li key={band.label} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 bg-proof-bg px-4 py-3.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-proof-fg">
              Inside the envelope
            </span>
            <span className="text-[14px] font-semibold text-ink-900">{band.label}</span>
            <span className="basis-full text-[13px] leading-6 text-ink-600">{band.body}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------ control boundary --- */

export type ControlItem = { label: string; body: string };

export const operatorControls: ControlItem[] = [
  { label: "Capture windows", body: "When anyone is on site, and for how long." },
  { label: "Restricted areas", body: "What is never captured, and what is redacted after." },
  { label: "Permitted evidence use", body: "Whether a qualifying artifact may be used for evaluation, and whether post-training use is allowed at all." },
  { label: "Physical access", body: "Whether a robot may ever run here, under whose supervision." },
  { label: "Safety approval", body: "Yours and your regulator's. Never ours, and never implied by a result." },
];

export const blueprintDuties: ControlItem[] = [
  { label: "Capture integrity", body: "Immutable raw capture with timestamps, poses, device metadata, and provenance." },
  { label: "The maintained testbed", body: "An exact versioned substrate, kept usable for this run and the next one." },
  { label: "Evidence routing", body: "The cheapest qualified method per claim, escalated only when required." },
  { label: "The honest answer", body: "Per-claim outcomes, the envelope, the claim ceiling, and the next cheapest experiment." },
  { label: "Access and redaction", body: "Who can see which artifact, and in what form." },
];

/**
 * ControlBoundaryFigure — a hard line down the middle: what the site operator
 * decides, and what Blueprint is accountable for. Nothing crosses the line
 * implicitly.
 */
export function ControlBoundaryFigure({
  operator = operatorControls,
  blueprint = blueprintDuties,
}: {
  operator?: ControlItem[];
  blueprint?: ControlItem[];
}) {
  const ref = useInViewRef<HTMLDivElement>({ amount: 0.12 });

  return (
    <div ref={ref} className="bp-figure relative grid gap-px bg-line md:grid-cols-2">
      {[
        { heading: "You decide", items: operator, tone: "operator" as const },
        { heading: "We are accountable for", items: blueprint, tone: "blueprint" as const },
      ].map((column) => (
        <div key={column.heading} className="bg-white p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className={cn(
                "h-2 w-2",
                column.tone === "operator" ? "bg-brass-deep" : "bg-ink-800",
              )}
            />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">
              {column.heading}
            </p>
          </div>
          <ul className="mt-5 divide-y divide-line-soft">
            {column.items.map((item) => (
              <li key={item.label} className="py-3.5">
                <p className="text-[14px] font-semibold text-ink-900">{item.label}</p>
                <p className="mt-1 text-[13px] leading-6 text-ink-500">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-brass/40 md:block"
      />
    </div>
  );
}

/* ------------------------------------------------------------ run ticket --- */

/**
 * RunTicketFigure — the compact "live run" card used as hero furniture. Shows
 * request → planning → per-claim results as labelled UI structure, not a real
 * run's data.
 */
export function RunTicketFigure({ className }: { className?: string }) {
  const ref = useInViewRef<HTMLDivElement>({ amount: 0.1 });

  return (
    <div
      ref={ref}
      className={cn(
        "bp-figure relative overflow-hidden border border-white/12 bg-graphite/95 backdrop-blur-[2px]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-brass">
          Task Evaluation Run
        </span>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/40">
          Structure · illustrative
        </span>
      </div>

      <dl className="divide-y divide-white/8">
        {[
          ["Decision", "Does candidate A deserve field time here?"],
          ["Testbed", "site-task · v2026-07 · sha256:…"],
          ["Claims", "5 stated · 2 supported · 1 open · 1 abstained"],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-3">
            <dt className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/40">
              {label}
            </dt>
            <dd className="mt-1.5 text-[13px] leading-6 text-[color:var(--text-on-ink)]">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-2.5 border-t border-white/10 px-4 py-4">
        {[
          { label: "Reach the fixture", tone: "supported" as OutcomeTone, value: 86 },
          { label: "Aisle clearance at peak", tone: "unresolved" as OutcomeTone, value: 54 },
          { label: "Beats candidate B", tone: "abstained" as OutcomeTone, value: 0 },
        ].map((row, index) => (
          <div key={row.label} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5">
            <span className="truncate text-[12.5px] text-white/75">{row.label}</span>
            <OutcomeChip tone={row.tone} className="border-white/15 bg-white/5 text-white/80">
              {row.tone === "supported" ? "Supported" : row.tone === "unresolved" ? "Open" : "Abstained"}
            </OutcomeChip>
            <span className="col-span-2 h-[3px] w-full overflow-hidden bg-white/10">
              <span
                className={cn("bp-bar-fill block h-full", outcomeBarClass[row.tone])}
                style={{ "--bp-bar": `${row.value}%`, "--bp-bar-delay": `${240 + index * 120}ms` } as CSSProperties}
              />
            </span>
          </div>
        ))}
      </div>

      <p className="border-t border-white/10 px-4 py-3 text-[12px] leading-5 text-white/45">
        An abstained claim never becomes a winner. The next cheapest experiment ships with the result.
      </p>
    </div>
  );
}
