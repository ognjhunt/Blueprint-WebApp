/**
 * Public-site figures: the diagrams and charts that carry the Task Evaluation
 * Run story visually.
 *
 * Two hard rules run through this file.
 *
 * 1. Numbers shown here are schematic. Nothing in this file reads live run
 *    data, so every figure that renders a figure-like value is wrapped in
 *    `<Figure illustrative>`, which prints a visible "Illustrative" marker.
 *    That keeps the public site from implying an operational state it cannot
 *    prove.
 *
 * 2. Colour follows the job, not the brand accent.
 *    - Magnitude / "which rung did we stop at" uses the **emphasis** form: one
 *      accent (action blue #2563a6 on paper, #3a79c2 on ink) against a
 *      de-emphasis warm gray (#817e72 on paper, #a8a496 on ink). That pair is
 *      validated for CVD separation (worst adjacent ΔE 12.9 tritan) and clears
 *      3:1 against both surfaces. Brass is brand chrome and is deliberately not
 *      used as a data colour — against the warm neutral ramp it lands at ΔE 8.1
 *      normal-vision, which is not separable.
 *    - Claim outcomes use the reserved status scale (proof / warn / block /
 *      info). Those hues sit close together under protanopia (green↔amber
 *      ΔE 8.3), so every status mark ships with an icon **and** a text label.
 *      Status is never the only channel.
 */
import { useId, useState, type ReactNode } from "react";

import {
  ArrowRight,
  CircleSlash,
  Info,
  MinusCircle,
  Table2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { DrawIn, GrowIn, Reveal, RevealStagger } from "./motion";

/* ------------------------------------------------------------------ tokens */

/** Emphasis accent — the one rung/claim the figure is about. */
const ACCENT = "#2563a6";
const ACCENT_ON_INK = "#3a79c2";
/** De-emphasis gray — context marks. Intentionally low-chroma. */
const MUTED = "#817e72";
const MUTED_ON_INK = "#a8a496";

const surfaceFor = (onInk: boolean) => (onInk ? "#0d0d0b" : "#ffffff");
const accentFor = (onInk: boolean) => (onInk ? ACCENT_ON_INK : ACCENT);
const mutedFor = (onInk: boolean) => (onInk ? MUTED_ON_INK : MUTED);

/* ------------------------------------------------------------------ shell */

export interface FigureProps {
  /** Short title, rendered as the figure's caption heading. */
  title: string;
  /** One line saying what the reader should take away. */
  subtitle?: string;
  children: ReactNode;
  /** Prints the visible "Illustrative" marker. Required for any figure with numbers. */
  illustrative?: boolean;
  /** Renders on ink chrome. */
  onInk?: boolean;
  className?: string;
  /** Optional table-view node, revealed by the built-in toggle. */
  tableView?: ReactNode;
}

/**
 * Figure — shared frame for every diagram and chart: caption, the illustrative
 * marker, and the optional table-view toggle that keeps values reachable
 * without relying on colour or hover.
 */
export function Figure({
  title,
  subtitle,
  children,
  illustrative = false,
  onInk = false,
  className,
  tableView,
}: FigureProps) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  return (
    <figure
      className={cn(
        "overflow-hidden rounded-lg border",
        onInk ? "border-white/10 bg-ink" : "border-line bg-white",
        className,
      )}
    >
      <figcaption
        className={cn(
          "flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4",
          onInk ? "border-white/10" : "border-line-soft",
        )}
      >
        <div className="min-w-0">
          <h3
            className={cn(
              "text-[15px] font-semibold tracking-[-0.01em]",
              onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
            )}
          >
            {title}
          </h3>
          {subtitle ? (
            <p
              className={cn(
                "mt-1 max-w-[52ch] text-[13px] leading-[1.6]",
                onInk ? "text-ink-300" : "text-ink-500",
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {illustrative ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xs border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em]",
                onInk
                  ? "border-white/15 text-ink-300"
                  : "border-line-strong text-ink-500",
              )}
            >
              <Info className="h-3 w-3" aria-hidden="true" />
              Illustrative
            </span>
          ) : null}
          {tableView ? (
            <button
              type="button"
              onClick={() => setShowTable((value) => !value)}
              aria-expanded={showTable}
              aria-controls={tableId}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xs border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors",
                onInk
                  ? "border-white/15 text-ink-300 hover:bg-white/5"
                  : "border-line-strong text-ink-500 hover:bg-inset",
              )}
            >
              <Table2 className="h-3 w-3" aria-hidden="true" />
              {showTable ? "Hide values" : "Values"}
            </button>
          ) : null}
        </div>
      </figcaption>

      <div className="px-5 py-6">{children}</div>

      {tableView ? (
        <div
          id={tableId}
          hidden={!showTable}
          className={cn(
            "border-t px-5 py-4",
            onInk ? "border-white/10" : "border-line-soft",
          )}
        >
          {tableView}
        </div>
      ) : null}
    </figure>
  );
}

/* --------------------------------------------------- 1. lifecycle diagram */

export interface LifecycleStage {
  label: string;
  detail: string;
}

/**
 * RunLifecycleRail — the five moves of a run, as a drawn path through five
 * nodes. A diagram, not a chart: no value is encoded, so no palette applies.
 * The connector draws itself on scroll and the nodes arrive in reading order.
 */
export function RunLifecycleRail({
  stages,
  onInk = false,
  className,
}: {
  stages: readonly LifecycleStage[];
  onInk?: boolean;
  className?: string;
}) {
  const nodeCount = stages.length;
  const surface = surfaceFor(onInk);

  return (
    <div className={cn("relative", className)}>
      {/* Desktop: horizontal drawn rail behind the node row. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 1000 24"
        preserveAspectRatio="none"
        className="pointer-events-none absolute left-0 top-[1.35rem] hidden h-6 w-full lg:block"
      >
        <line
          x1="0"
          y1="12"
          x2="1000"
          y2="12"
          stroke={onInk ? "rgba(255,255,255,0.12)" : "#ded7c8"}
          strokeWidth="1"
        />
        <DrawIn
          d="M0 12 L1000 12"
          fill="none"
          stroke={accentFor(onInk)}
          strokeWidth="2"
          strokeLinecap="round"
          duration={1.6}
        />
      </svg>

      <RevealStagger
        as="ol"
        childAs="li"
        step={0.09}
        className="relative grid gap-8 lg:grid-cols-5 lg:gap-5"
      >
        {stages.map((stage, index) => (
          <div key={stage.label} className="relative">
            <div className="flex items-center gap-3 lg:block">
              <span
                className={cn(
                  "relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-semibold",
                  onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
                )}
                style={{
                  background: surface,
                  // 2px surface ring keeps the node legible where it crosses the rail.
                  boxShadow: `0 0 0 2px ${surface}, inset 0 0 0 1px ${
                    index === 0 ? accentFor(onInk) : onInk ? "rgba(255,255,255,0.22)" : "#c8bfac"
                  }`,
                }}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3
                className={cn(
                  "text-[15px] font-semibold leading-snug tracking-[-0.01em] lg:mt-5",
                  onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
                )}
              >
                {stage.label}
              </h3>
            </div>
            <p
              className={cn(
                "mt-2 text-[13px] leading-[1.65] lg:pr-3",
                onInk ? "text-ink-300" : "text-ink-500",
              )}
            >
              {stage.detail}
            </p>
            <span className="sr-only">
              Stage {index + 1} of {nodeCount}
            </span>
          </div>
        ))}
      </RevealStagger>
    </div>
  );
}

/* ------------------------------------------------ 2. evidence ladder chart */

export interface EvidenceRung {
  label: string;
  /** Relative cost/effort, 0–1. Encodes bar length only — never authority. */
  cost: number;
  /** What this method can actually establish. */
  answers: string;
  /**
   * Where the method's evidence comes from. Rendered as a visible tag so the
   * cost ordering is never read as a ranking of authority: real capture and
   * physical outcomes are the source of truth regardless of what a derived
   * method costs.
   */
  basis: "Real capture" | "Computed from capture" | "Derived" | "Real world";
  /** Marks the method the illustrative run stopped at. */
  stopped?: boolean;
}

const basisTone: Record<EvidenceRung["basis"], { fg: string; fgOnInk: string }> = {
  "Real capture": { fg: "#1f6b4f", fgOnInk: "#3a9170" },
  "Real world": { fg: "#1f6b4f", fgOnInk: "#3a9170" },
  "Computed from capture": { fg: "#45443d", fgOnInk: "#a8a496" },
  Derived: { fg: "#9a6a16", fgOnInk: "#d09a2c" },
};

/**
 * EvidenceLadderChart — evidence methods ordered by **relative cost only**.
 *
 * Form: horizontal bars, one measure, one axis. Colour job is **emphasis** —
 * the method the run stopped at wears the accent, every other one wears the
 * de-emphasis gray. Bar length already encodes cost, so a ramp across the rows
 * would double-encode length as hue; it is deliberately not used.
 *
 * Important framing constraint: this is **not** a proof hierarchy. Cost order
 * is not authority order. A costlier derived method (simulation, generated or
 * model-based evidence) does not outrank cheaper real capture, and nothing here
 * may imply that it does — capture-first is repo doctrine, and simulated or
 * generated output is never ground truth. Each row therefore carries a visible
 * basis tag, and methods are qualified per claim rather than ranked.
 */
export function EvidenceLadderChart({
  rungs,
  onInk = false,
}: {
  rungs: readonly EvidenceRung[];
  onInk?: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const accent = accentFor(onInk);
  const muted = mutedFor(onInk);

  return (
    <Figure
      title="We buy the cheapest evidence that is actually good enough"
      subtitle="Ordered by what each method costs to run — not by how much it proves. A run uses the cheapest method qualified for the claim in front of it and stops there."
      illustrative
      onInk={onInk}
      tableView={
        <table className="w-full text-left text-[13px]">
          <caption className="sr-only">
            Evidence methods by relative cost, what each can establish, and where
            its evidence comes from. Cost order is not authority order.
          </caption>
          <thead>
            <tr className={onInk ? "text-ink-300" : "text-ink-500"}>
              <th scope="col" className="py-1 pr-4 font-semibold">Method</th>
              <th scope="col" className="py-1 pr-4 font-semibold">Basis</th>
              <th scope="col" className="py-1 pr-4 font-semibold">Relative cost</th>
              <th scope="col" className="py-1 font-semibold">What it can establish</th>
            </tr>
          </thead>
          <tbody className={onInk ? "text-ink-200" : "text-ink-700"}>
            {rungs.map((rung) => (
              <tr key={rung.label} className={onInk ? "border-t border-white/10" : "border-t border-line-soft"}>
                <th scope="row" className="py-2 pr-4 font-medium">
                  {rung.label}
                  {rung.stopped ? " (run stopped here)" : ""}
                </th>
                <td className="py-2 pr-4">{rung.basis}</td>
                <td className="py-2 pr-4 font-mono">{Math.round(rung.cost * 100)}</td>
                <td className="py-2">{rung.answers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="flex flex-col gap-4">
        {rungs.map((rung, index) => {
          const isStopped = Boolean(rung.stopped);
          const isHovered = hovered === rung.label;
          return (
            <div
              key={rung.label}
              className="group relative grid gap-x-4 gap-y-1 [grid-template-columns:1fr] sm:[grid-template-columns:minmax(9rem,13rem)_1fr]"
              onMouseEnter={() => setHovered(rung.label)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(rung.label)}
              onBlur={() => setHovered(null)}
              tabIndex={0}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 sm:block">
                <p
                  className={cn(
                    "text-[13px] font-semibold leading-snug",
                    onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
                  )}
                >
                  {rung.label}
                </p>
                {/* Basis tag: keeps real capture distinguishable from derived
                    methods so the cost ordering cannot read as a proof ranking. */}
                <p
                  className="font-mono text-[10px] uppercase tracking-[0.12em] sm:mt-1"
                  style={{ color: onInk ? basisTone[rung.basis].fgOnInk : basisTone[rung.basis].fg }}
                >
                  {rung.basis}
                </p>
                {isStopped ? (
                  <p
                    className="font-mono text-[10px] uppercase tracking-[0.14em] sm:mt-0.5"
                    style={{ color: accent }}
                  >
                    Stopped here
                  </p>
                ) : null}
              </div>

              <div className="min-w-0">
                <div
                  className={cn(
                    "relative h-3 w-full overflow-hidden rounded-xs",
                    onInk ? "bg-white/5" : "bg-inset",
                  )}
                >
                  <GrowIn
                    origin="left"
                    delay={index * 0.08}
                    className="h-full"
                    style={{ width: `${Math.round(rung.cost * 100)}%` }}
                  >
                    <div
                      className="h-full rounded-r-[4px] transition-opacity duration-200"
                      style={{
                        background: isStopped ? accent : muted,
                        opacity: isStopped || isHovered ? 1 : 0.72,
                      }}
                    />
                  </GrowIn>
                </div>
                <p
                  className={cn(
                    "mt-1.5 text-[12.5px] leading-[1.6]",
                    onInk ? "text-ink-300" : "text-ink-500",
                  )}
                >
                  {rung.answers}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={cn(
          "mt-6 space-y-2 border-t pt-4 text-[12.5px] leading-[1.65]",
          onInk ? "border-white/10 text-ink-300" : "border-line-soft text-ink-500",
        )}
      >
        <p>
          Bar length is relative cost only. Which method a claim actually needs is
          decided per run — you never pick it.
        </p>
        <p>
          Cost is not authority. Real capture is the source of truth, and a
          costlier derived method never outranks it: simulated, generated, and
          model-based evidence is support that has to be qualified for the
          specific claim, and it is not ground truth at any price.
        </p>
      </div>
    </Figure>
  );
}

/* --------------------------------------------- 3. claim vs threshold chart */

export type ClaimVerdict = "supported" | "rejected" | "unresolved";

export interface ClaimInterval {
  claim: string;
  /** Point estimate, 0–1. */
  estimate: number;
  /** Lower bound of the uncertainty interval, 0–1. */
  low: number;
  /** Upper bound of the uncertainty interval, 0–1. */
  high: number;
  verdict: ClaimVerdict;
}

const verdictMeta: Record<
  ClaimVerdict,
  { label: string; icon: LucideIcon; fg: string; fgOnInk: string }
> = {
  supported: { label: "Supported", icon: CheckCircle2, fg: "#1f6b4f", fgOnInk: "#3a9170" },
  rejected: { label: "Rejected", icon: XCircle, fg: "#9b3027", fgOnInk: "#cf5247" },
  unresolved: { label: "Unresolved", icon: MinusCircle, fg: "#9a6a16", fgOnInk: "#d09a2c" },
};

/**
 * ClaimThresholdChart — the figure that explains abstention.
 *
 * Each row is one claim: a 2px uncertainty interval with an 8px point-estimate
 * marker, read against a single threshold rule. When the interval straddles the
 * threshold the claim cannot be called, and the run says so instead of rounding
 * the point estimate into a verdict.
 *
 * One measure, one axis. The interval marks use the emphasis pair (accent for
 * the claim under the cursor, de-emphasis gray otherwise) so the plot never
 * relies on the status hues, which are too close under CVD to separate three
 * ways. Verdict identity is carried by an icon + text label per row.
 */
export function ClaimThresholdChart({
  claims,
  threshold,
  metricLabel,
  onInk = false,
}: {
  claims: readonly ClaimInterval[];
  /** Threshold value, 0–1. */
  threshold: number;
  metricLabel: string;
  onInk?: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const accent = accentFor(onInk);
  const muted = mutedFor(onInk);
  const surface = surfaceFor(onInk);
  const pct = (value: number) => `${Math.round(value * 1000) / 10}%`;

  return (
    <Figure
      title="Why a run can decline to pick a winner"
      subtitle={`Each claim is read against the threshold you set. When the uncertainty interval crosses the line, the claim stays open — the point estimate is not rounded into a verdict.`}
      illustrative
      onInk={onInk}
      tableView={
        <table className="w-full text-left text-[13px]">
          <caption className="sr-only">
            Per-claim estimate, uncertainty interval, and verdict against the
            threshold of {pct(threshold)} {metricLabel}
          </caption>
          <thead>
            <tr className={onInk ? "text-ink-300" : "text-ink-500"}>
              <th scope="col" className="py-1 pr-4 font-semibold">Claim</th>
              <th scope="col" className="py-1 pr-4 font-semibold">Estimate</th>
              <th scope="col" className="py-1 pr-4 font-semibold">Interval</th>
              <th scope="col" className="py-1 font-semibold">Verdict</th>
            </tr>
          </thead>
          <tbody className={onInk ? "text-ink-200" : "text-ink-700"}>
            {claims.map((claim) => (
              <tr key={claim.claim} className={onInk ? "border-t border-white/10" : "border-t border-line-soft"}>
                <th scope="row" className="py-2 pr-4 font-medium">{claim.claim}</th>
                <td className="py-2 pr-4 font-mono">{pct(claim.estimate)}</td>
                <td className="py-2 pr-4 font-mono">
                  {pct(claim.low)}–{pct(claim.high)}
                </td>
                <td className="py-2">{verdictMeta[claim.verdict].label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      {/* Threshold legend — two marks, so identity is never colour-alone. */}
      <div
        className={cn(
          "mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px]",
          onInk ? "text-ink-300" : "text-ink-500",
        )}
      >
        <span className="inline-flex items-center gap-2">
          <svg width="18" height="8" aria-hidden="true">
            <line x1="0" y1="4" x2="18" y2="4" stroke={muted} strokeWidth="2" strokeLinecap="round" />
            <circle cx="9" cy="4" r="4" fill={muted} stroke={surface} strokeWidth="2" />
          </svg>
          Estimate and uncertainty interval
        </span>
        <span className="inline-flex items-center gap-2">
          <svg width="18" height="10" aria-hidden="true">
            <line
              x1="9"
              y1="0"
              x2="9"
              y2="10"
              stroke={onInk ? "#f3efe6" : "#0d0d0b"}
              strokeWidth="1.5"
            />
          </svg>
          Threshold · {pct(threshold)} {metricLabel}
        </span>
      </div>

      {/* Scale reference. Ticks carry the values that are not directly labelled. */}
      <div className="relative mb-1 h-4" aria-hidden="true">
        {[0, 0.5, 1].map((tick) => (
          <span
            key={tick}
            className={cn(
              "absolute top-0 font-mono text-[10px]",
              onInk ? "text-ink-400" : "text-ink-400",
            )}
            style={{
              left: `${tick * 100}%`,
              transform:
                tick === 0 ? "none" : tick === 1 ? "translateX(-100%)" : "translateX(-50%)",
            }}
          >
            {pct(tick)}
          </span>
        ))}
        <span
          className={cn(
            "absolute top-0 font-mono text-[10px] font-semibold",
            onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
          )}
          style={{ left: `${threshold * 100}%`, transform: "translateX(-50%)" }}
        >
          {pct(threshold)}
        </span>
      </div>

      <div className="flex flex-col gap-5">
        {claims.map((claim, index) => {
          const meta = verdictMeta[claim.verdict];
          const VerdictIcon = meta.icon;
          const isHovered = hovered === claim.claim;
          const markColor = isHovered ? accent : muted;

          return (
            <div
              key={claim.claim}
              tabIndex={0}
              onMouseEnter={() => setHovered(claim.claim)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(claim.claim)}
              onBlur={() => setHovered(null)}
              className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p
                  className={cn(
                    "max-w-[46ch] text-[13px] font-medium leading-snug",
                    onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
                  )}
                >
                  {claim.claim}
                </p>
                {/* Verdict: icon + text, never colour alone. */}
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold"
                  style={{ color: onInk ? meta.fgOnInk : meta.fg }}
                >
                  <VerdictIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  {meta.label}
                </span>
              </div>

              <div className="relative mt-2.5 h-9">
                {/* Hairline solid baseline. */}
                <div
                  className="absolute inset-x-0 top-1/2 h-px"
                  style={{ background: onInk ? "rgba(255,255,255,0.12)" : "#ebe4d7" }}
                  aria-hidden="true"
                />
                {/* Threshold rule. */}
                <div
                  className="absolute top-0 h-full w-px"
                  style={{
                    left: `${threshold * 100}%`,
                    background: onInk ? "rgba(243,239,230,0.75)" : "rgba(13,13,11,0.75)",
                  }}
                  aria-hidden="true"
                />
                {/* Uncertainty interval — 2px line, round caps. */}
                <GrowIn origin="left" delay={index * 0.08} className="absolute inset-0">
                  <div
                    className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full transition-colors duration-200"
                    style={{
                      left: `${claim.low * 100}%`,
                      width: `${(claim.high - claim.low) * 100}%`,
                      background: markColor,
                    }}
                    aria-hidden="true"
                  />
                  {/* Point estimate — 8px marker with a 2px surface ring. */}
                  <div
                    className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-200"
                    style={{
                      left: `${claim.estimate * 100}%`,
                      background: markColor,
                      boxShadow: `0 0 0 2px ${surface}`,
                    }}
                    aria-hidden="true"
                  />
                </GrowIn>

                {/* Direct label on the hovered row only — never a number on every mark. */}
                <span
                  className={cn(
                    "pointer-events-none absolute top-0 font-mono text-[11px] transition-opacity duration-150",
                    isHovered ? "opacity-100" : "opacity-0",
                  )}
                  style={{
                    left: `${claim.estimate * 100}%`,
                    transform: "translateX(-50%)",
                    color: onInk ? "#f3efe6" : "#0d0d0b",
                  }}
                >
                  {pct(claim.estimate)}
                </span>
              </div>

              <p className="sr-only">
                Estimate {pct(claim.estimate)}, interval {pct(claim.low)} to{" "}
                {pct(claim.high)}, threshold {pct(threshold)}. {meta.label}.
              </p>
            </div>
          );
        })}
      </div>

      <p
        className={cn(
          "mt-6 flex gap-2 border-t pt-4 text-[12.5px] leading-[1.65]",
          onInk ? "border-white/10 text-ink-300" : "border-line-soft text-ink-500",
        )}
      >
        <CircleSlash
          className="mt-0.5 h-4 w-4 shrink-0"
          style={{ color: onInk ? verdictMeta.unresolved.fgOnInk : verdictMeta.unresolved.fg }}
          aria-hidden="true"
        />
        <span>
          An unresolved claim is a result, not a gap in the report. It comes with
          the reason, and the cheapest next test that would settle it.
        </span>
      </p>
    </Figure>
  );
}

/* ------------------------------------------------- 4. outcome spectrum */

export interface OutcomeBand {
  label: string;
  body: string;
  tone: "supported" | "rejected" | "partial" | "abstained" | "next";
}

const bandMeta: Record<
  OutcomeBand["tone"],
  { icon: LucideIcon; fg: string; bg: string; bd: string }
> = {
  supported: { icon: CheckCircle2, fg: "#1f6b4f", bg: "#eef5f1", bd: "#dcebe3" },
  rejected: { icon: XCircle, fg: "#9b3027", bg: "#faeae7", bd: "#f1d9d5" },
  partial: { icon: MinusCircle, fg: "#9a6a16", bg: "#faf3e2", bd: "#f3e7cb" },
  abstained: { icon: CircleSlash, fg: "#45443d", bg: "#f0ece1", bd: "#ded7c8" },
  next: { icon: Info, fg: "#1f4f8f", bg: "#eaf1f9", bd: "#d7e4f2" },
};

/**
 * OutcomeSpectrum — the five shapes a result can take, as labelled cards.
 *
 * A diagram: no value is encoded, so the status hues here are pure state
 * signalling and each card carries its own icon and written label.
 */
export function OutcomeSpectrum({ bands }: { bands: readonly OutcomeBand[] }) {
  return (
    <RevealStagger
      as="ul"
      childAs="li"
      step={0.06}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
    >
      {bands.map((band) => {
        const meta = bandMeta[band.tone];
        const Icon = meta.icon;
        return (
          <div
            key={band.label}
            className="flex h-full flex-col rounded-md border p-4"
            style={{ background: meta.bg, borderColor: meta.bd }}
          >
            <Icon
              className="h-[1.15rem] w-[1.15rem]"
              style={{ color: meta.fg }}
              strokeWidth={1.9}
              aria-hidden="true"
            />
            <h3 className="mt-3 text-[14px] font-semibold leading-snug text-ink-900">
              {band.label}
            </h3>
            <p className="mt-2 text-[12.5px] leading-[1.6] text-ink-600">{band.body}</p>
          </div>
        );
      })}
    </RevealStagger>
  );
}

/* --------------------------------------------------- 5. coverage meter */

/**
 * CoverageMeter — a single ratio against a limit. Fill and track are steps of
 * the same ramp so the state reads across the whole bar, per the meter spec.
 */
export function CoverageMeter({
  label,
  value,
  caption,
  onInk = false,
}: {
  label: string;
  /** 0–1. */
  value: number;
  caption?: string;
  onInk?: boolean;
}) {
  const percent = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p
          className={cn(
            "text-[12px] font-semibold uppercase tracking-[0.14em]",
            onInk ? "text-ink-300" : "text-ink-400",
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "font-mono text-[15px]",
            onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
          )}
        >
          {percent}%
        </p>
      </div>
      <div
        className={cn("mt-2 h-2 w-full overflow-hidden rounded-xs", onInk ? "bg-white/10" : "bg-inset")}
        role="meter"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <GrowIn origin="left" className="h-full" style={{ width: `${percent}%` }}>
          <div className="h-full rounded-r-[4px]" style={{ background: accentFor(onInk) }} />
        </GrowIn>
      </div>
      {caption ? (
        <p className={cn("mt-2 text-[12.5px] leading-[1.6]", onInk ? "text-ink-300" : "text-ink-500")}>
          {caption}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------- 6. before/after compare */

export interface DecisionCostRow {
  label: string;
  beforeLabel: string;
  afterLabel: string;
}

/**
 * DecisionShiftCompare — what changes when a run happens first.
 *
 * Deliberately **not** a chart. The pairs here are qualitative statements about
 * when information arrives, and there is no measured quantity behind them.
 * Plotting them on an axis would invent precision that does not exist and would
 * detach each label from the mark it describes, so this is a two-column
 * comparison: the "with a run" side is emphasised, and the arrow carries the
 * direction that a dumbbell's axis would have.
 */
export function DecisionShiftCompare({
  rows,
  onInk = false,
}: {
  rows: readonly DecisionCostRow[];
  onInk?: boolean;
}) {
  const accent = accentFor(onInk);

  return (
    <Figure
      title="What a run moves"
      subtitle="The point is not that evaluation is free. It is that the expensive step happens once you already know what it will tell you."
      onInk={onInk}
    >
      <div
        className={cn(
          "grid gap-x-8 border-b pb-3 text-[11px] font-semibold uppercase tracking-[0.16em] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)]",
          onInk ? "border-white/10 text-ink-400" : "border-line-soft text-ink-400",
        )}
      >
        <span className="hidden lg:block">What changes</span>
        <span className="hidden lg:block">Without a run</span>
        <span className="hidden items-center gap-2 lg:flex" style={{ color: accent }}>
          With a run
        </span>
      </div>

      <div className={cn("divide-y", onInk ? "divide-white/10" : "divide-line-soft")}>
        {rows.map((row, index) => (
          <Reveal key={row.label} delay={index * 0.07}>
            <div className="grid gap-x-8 gap-y-3 py-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <p
                className={cn(
                  "text-[13.5px] font-semibold leading-snug",
                  onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
                )}
              >
                {row.label}
              </p>

              <p
                className={cn(
                  "flex items-start gap-2.5 text-[13.5px] leading-[1.65]",
                  onInk ? "text-ink-400" : "text-ink-400",
                )}
              >
                <span className="lg:hidden text-[11px] font-semibold uppercase tracking-[0.14em]">
                  Without
                </span>
                <span className="line-through decoration-1 decoration-ink-300">{row.beforeLabel}</span>
              </p>

              <p
                className={cn(
                  "flex items-start gap-2.5 text-[13.5px] font-medium leading-[1.65]",
                  onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
                )}
              >
                <ArrowRight
                  className="mt-[0.3rem] h-3.5 w-3.5 shrink-0"
                  style={{ color: accent }}
                  aria-hidden="true"
                />
                {row.afterLabel}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </Figure>
  );
}

/* ------------------------------------------------------- 7. big stat row */

export interface StatTile {
  label: string;
  value: string;
  detail: string;
}

/**
 * StatRow — a KPI row of stat tiles. Values here are definitional (what a run
 * returns), not measured outcomes, so they carry no chart and no ramp.
 */
export function StatRow({ tiles, onInk = false }: { tiles: readonly StatTile[]; onInk?: boolean }) {
  return (
    <RevealStagger as="ul" childAs="li" step={0.07} className="grid gap-px sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={cn(
            "flex h-full flex-col justify-between gap-5 p-5",
            onInk ? "bg-ink" : "bg-white",
          )}
        >
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.2em]",
              onInk ? "text-ink-300" : "text-ink-400",
            )}
          >
            {tile.label}
          </p>
          <div>
            <p
              className={cn(
                "font-display text-[2.6rem] font-medium leading-none tracking-[-0.04em]",
                onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
              )}
            >
              {tile.value}
            </p>
            <p className={cn("mt-2 text-[13px] leading-[1.6]", onInk ? "text-ink-300" : "text-ink-500")}>
              {tile.detail}
            </p>
          </div>
        </div>
      ))}
    </RevealStagger>
  );
}
