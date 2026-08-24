/**
 * Runway shell — the layout grammar of the public deployment surface.
 *
 * Three rules hold everywhere in this file, and they are what make the pages
 * read as instrumentation rather than as marketing:
 *
 *   1. A section states one measured thing. The heading is the finding; the
 *      figure is the evidence. There is no third paragraph explaining both.
 *   2. Every figure carries its source in the frame, at the same weight as the
 *      figure's own labels. A chart whose provenance is a footnote is a chart
 *      the reader has to take on trust.
 *   3. Numbers are set in mono with tabular figures. Columns of quantities
 *      line up or they are not quantities, they are decoration.
 */
import type { ReactNode } from "react";

import { ArrowUpRight } from "lucide-react";

import type { EvidenceBasis, MarketSource } from "@/data/deploymentMarket";
import { cn } from "@/lib/utils";

import { Reveal } from "../motion";

/* ------------------------------------------------------------------ bands */

type BandTone = "black" | "deep" | "panel" | "paper";

const bandToneClass: Record<BandTone, string> = {
  black: "bg-runway-black text-runway-text",
  deep: "bg-runway-deep text-runway-text",
  panel: "bg-runway-panel text-runway-text",
  paper: "bg-runway-paper text-runway-black",
};

export function Band({
  children,
  tone = "black",
  grid = false,
  rule = false,
  className,
  id,
}: {
  children: ReactNode;
  tone?: BandTone;
  /** Overlays the faint measurement grid. */
  grid?: boolean;
  /** Hairline above the band, for two adjacent bands of the same tone. */
  rule?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative",
        bandToneClass[tone],
        grid && "runway-grid",
        rule && (tone === "paper" ? "border-t border-runway-paper-line" : "border-t border-runway-line"),
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Inner({
  children,
  className,
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  size?: "default" | "narrow" | "prose";
}) {
  return (
    <div
      className={cn(
        "relative mx-auto px-5 sm:px-8 lg:px-10",
        size === "default" && "max-w-[92rem]",
        size === "narrow" && "max-w-[76rem]",
        size === "prose" && "max-w-[56rem]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* --------------------------------------------------------- section header */

/**
 * SectionHead — index, eyebrow, finding. The `lede` is optional and capped
 * short on purpose: if a section needs a paragraph to land, the figure under it
 * is not doing its job.
 */
export function SectionHead({
  index,
  eyebrow,
  title,
  lede,
  onLight = false,
  className,
}: {
  index?: string;
  eyebrow: string;
  title: ReactNode;
  lede?: string;
  onLight?: boolean;
  className?: string;
}) {
  return (
    <Reveal className={cn("grid gap-x-14 gap-y-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]", className)}>
      <div>
        <div className="flex items-baseline gap-4">
          {index ? (
            <span className="runway-num text-[11px] tracking-[0.2em] text-runway-signal">{index}</span>
          ) : null}
          <p
            className={cn(
              "font-mono text-[11px] font-medium uppercase tracking-[0.24em]",
              onLight ? "text-runway-faint" : "text-runway-faint",
            )}
          >
            {eyebrow}
          </p>
        </div>
        <h2
          className={cn(
            "mt-5 max-w-[20ch] text-[clamp(2.2rem,4.4vw,4.1rem)] font-semibold leading-[1.0] tracking-[-0.045em]",
            onLight ? "text-runway-black" : "text-runway-text",
          )}
        >
          {title}
        </h2>
      </div>
      {lede ? (
        <p
          className={cn(
            "max-w-[40ch] self-end text-[15px] leading-[1.7]",
            onLight ? "text-[#4a5462]" : "text-runway-mute",
          )}
        >
          {lede}
        </p>
      ) : null}
    </Reveal>
  );
}

/* ------------------------------------------------------------ figure frame */

const basisLabel: Record<EvidenceBasis, string> = {
  published: "Published figure",
  illustrative: "Illustrative model",
};

const basisTone: Record<EvidenceBasis, string> = {
  published: "border-runway-green/40 text-runway-green",
  illustrative: "border-runway-amber/40 text-runway-amber",
};

/**
 * FigureFrame — the instrument housing. Title bar carries the evidence grade,
 * footer carries the sources. Both are structural, not decorative: a figure
 * that cannot fill them should not ship.
 */
export function FigureFrame({
  label,
  title,
  basis,
  sources,
  caveat,
  children,
  className,
  onLight = false,
}: {
  /** Short mono label, e.g. "Fig. 01". */
  label?: string;
  title: string;
  basis?: EvidenceBasis;
  sources?: readonly MarketSource[];
  caveat?: string;
  children: ReactNode;
  className?: string;
  onLight?: boolean;
}) {
  return (
    <figure
      className={cn(
        "overflow-hidden rounded-md border",
        onLight
          ? "border-runway-paper-line bg-white"
          : "border-runway-line bg-runway-panel",
        className,
      )}
    >
      <figcaption
        className={cn(
          "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b px-5 py-4 sm:px-7",
          onLight ? "border-runway-paper-line" : "border-runway-line",
        )}
      >
        <div className="flex items-baseline gap-3">
          {label ? <span className="runway-meta">{label}</span> : null}
          <h3
            className={cn(
              "text-[15px] font-semibold tracking-[-0.015em]",
              onLight ? "text-runway-black" : "text-runway-text",
            )}
          >
            {title}
          </h3>
        </div>
        {basis ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]",
              basisTone[basis],
            )}
          >
            {basisLabel[basis]}
          </span>
        ) : null}
      </figcaption>

      <div className="px-5 py-7 sm:px-7 sm:py-9">{children}</div>

      {sources?.length || caveat ? (
        <div
          className={cn(
            "flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7",
            onLight
              ? "border-runway-paper-line bg-runway-paper"
              : "border-runway-line bg-runway-deep",
          )}
        >
          {caveat ? (
            <p className={cn("max-w-[52ch] text-[12.5px] leading-6", onLight ? "text-[#5a6472]" : "text-runway-mute")}>
              {caveat}
            </p>
          ) : (
            <span />
          )}
          {sources?.length ? (
            <span className="flex flex-wrap gap-x-5 gap-y-2">
              {sources.map((source) => (
                <SourceLink key={source.href} source={source} onLight={onLight} />
              ))}
            </span>
          ) : null}
        </div>
      ) : null}
    </figure>
  );
}

export function SourceLink({
  source,
  onLight = false,
}: {
  source: MarketSource;
  onLight?: boolean;
}) {
  return (
    <a
      href={source.href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.12em] underline-offset-4 transition-colors hover:underline",
        onLight
          ? "text-[#5a6472] hover:text-runway-black"
          : "text-runway-faint hover:text-runway-signal",
      )}
    >
      {source.label}
      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}

/* ---------------------------------------------------------------- metrics */

export interface RunwayMetric {
  value: string;
  unit?: string;
  label: string;
  /** Optional source shown under the metric. */
  source?: MarketSource;
  tone?: "signal" | "cyan" | "text" | "red";
}

const metricTone: Record<NonNullable<RunwayMetric["tone"]>, string> = {
  signal: "text-runway-signal",
  cyan: "text-runway-cyan",
  text: "text-runway-text",
  red: "text-runway-red",
};

/**
 * MetricStrip — the number row. Four is the ceiling: a fifth turns a claim
 * into a dashboard, and a dashboard is something the reader skims past.
 */
export function MetricStrip({
  metrics,
  className,
}: {
  metrics: readonly RunwayMetric[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "grid gap-px overflow-hidden border border-runway-line bg-runway-line sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {metrics.map((metric, index) => (
        <Reveal
          key={metric.label}
          delay={index * 0.06}
          className="bg-runway-black px-5 py-7 sm:px-6"
        >
          <div>
            <dd
              className={cn(
                "runway-num text-[clamp(2rem,3.4vw,2.9rem)] font-medium leading-none tracking-[-0.03em]",
                metricTone[metric.tone ?? "text"],
              )}
            >
              {metric.value}
              {metric.unit ? (
                <span className="ml-1.5 text-[0.42em] uppercase tracking-[0.14em] text-runway-faint">
                  {metric.unit}
                </span>
              ) : null}
            </dd>
            <dt className="mt-4 max-w-[24ch] text-[13px] leading-6 text-runway-mute">
              {metric.label}
            </dt>
            {metric.source ? (
              <p className="mt-3">
                <SourceLink source={metric.source} />
              </p>
            ) : null}
          </div>
        </Reveal>
      ))}
    </dl>
  );
}

/* -------------------------------------------------------------- callouts */

/** A single sentence the page needs the reader to leave with. */
export function Pullquote({
  children,
  attribution,
  className,
}: {
  children: ReactNode;
  attribution?: ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={cn("border-l-2 border-runway-signal pl-6 sm:pl-8", className)}>
      <p className="max-w-[30ch] text-[clamp(1.5rem,2.8vw,2.4rem)] font-medium leading-[1.18] tracking-[-0.035em] text-runway-text">
        {children}
      </p>
      {attribution ? (
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.16em] text-runway-faint">
          {attribution}
        </p>
      ) : null}
    </Reveal>
  );
}

/* ---------------------------------------------------------------- closing */

/**
 * RunwayCta — the end-of-page action. Signal-filled, because it is the only
 * element on any page allowed to be that colour at full bleed; everything else
 * uses signal as an accent, so this reads as the page's one exit.
 */
export function RunwayCta({
  eyebrow,
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <section className="relative overflow-hidden bg-runway-signal">
      <div aria-hidden="true" className="runway-grid absolute inset-0 opacity-25" />
      <Inner className="relative py-16 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-end">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-runway-black/65">
              {eyebrow}
            </p>
            <h2 className="mt-5 max-w-[16ch] text-[clamp(2.3rem,4.8vw,4.4rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-runway-black">
              {title}
            </h2>
          </div>
          <div>
            {body ? (
              <p className="max-w-[42ch] text-[15px] leading-[1.7] text-runway-black/75">{body}</p>
            ) : null}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={primaryHref}
                className="inline-flex min-h-[3.25rem] items-center justify-center gap-3 rounded-sm bg-runway-black px-6 text-[15px] font-semibold tracking-[-0.01em] text-runway-text transition-colors hover:bg-runway-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-runway-black focus-visible:ring-offset-2 focus-visible:ring-offset-runway-signal"
              >
                {primaryLabel}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              {secondaryHref && secondaryLabel ? (
                <a
                  href={secondaryHref}
                  className="inline-flex min-h-[3.25rem] items-center justify-center rounded-sm border border-runway-black/35 px-6 text-[15px] font-semibold tracking-[-0.01em] text-runway-black transition-colors hover:border-runway-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-runway-black focus-visible:ring-offset-2 focus-visible:ring-offset-runway-signal"
                >
                  {secondaryLabel}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </Inner>
    </section>
  );
}

/* --------------------------------------------------------------- boundary */

/**
 * BoundaryPanel — what Blueprint is not. Given a whole band rather than a
 * footnote because a preparation company that lets a reader believe it deploys
 * robots has mis-sold itself, and the correction always arrives later and worse.
 */
export function BoundaryPanel({
  items,
}: {
  items: readonly { title: string; body: string; kind: "does" | "does-not" }[];
}) {
  return (
    <div className="grid gap-px border border-runway-line bg-runway-line lg:grid-cols-3">
      {items.map((item, index) => (
        <Reveal key={item.title} delay={index * 0.06} className="bg-runway-black p-7">
          <div>
            <span
              className={cn(
                "inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em]",
                item.kind === "does" ? "text-runway-signal" : "text-runway-faint",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  item.kind === "does" ? "bg-runway-signal" : "bg-runway-faint",
                )}
              />
              {item.kind === "does" ? "In scope" : "Not ours"}
            </span>
            <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.025em] text-runway-text">
              {item.title}
            </h3>
            <p className="mt-3 text-[13.5px] leading-6 text-runway-mute">{item.body}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
