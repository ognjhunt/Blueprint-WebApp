/**
 * Layout pieces for the redesigned public pages.
 *
 * The previous public site was built almost entirely from one device — a
 * hairline grid of equal white tiles — which flattened every section into the
 * same rhythm. These pieces exist to give the pages a shape: a hero whose media
 * runs to the edge of the viewport, alternating ink and paper bands, numbered
 * section headers at a real display size, and editorial splits that are
 * deliberately asymmetric.
 *
 * Media stays large on purpose. Every image here is sized in viewport units or
 * wide aspect ratios rather than being boxed into a card.
 */
import type { ReactNode } from "react";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/blueprint";
import { cn } from "@/lib/utils";

import { MonochromeMedia, ProofChip, RouteTraceOverlay } from "./editorial";
import { ParallaxMedia, Reveal } from "./motion";

/* ------------------------------------------------------------------- bands */

type Tone = "canvas" | "paper" | "ink" | "white";

const toneClass: Record<Tone, string> = {
  canvas: "bg-canvas",
  paper: "bg-paper",
  ink: "bg-ink",
  white: "bg-white",
};

/**
 * Band — a full-width page section. `tone` alternates the page rhythm; `rule`
 * adds the hairline that separates two light bands.
 */
export function Band({
  children,
  tone = "canvas",
  rule = false,
  className,
  id,
}: {
  children: ReactNode;
  tone?: Tone;
  rule?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        toneClass[tone],
        rule && tone !== "ink" && "border-y border-line",
        tone === "ink" && "border-y border-white/10",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Inner — the shared 88rem measure and page gutters. */
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
        "mx-auto px-5 sm:px-8 lg:px-10",
        size === "default" && "max-w-[88rem]",
        size === "narrow" && "max-w-[72rem]",
        size === "prose" && "max-w-[58rem]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------- hero */

export interface PageHeroProps {
  eyebrow: string;
  title: string;
  body: string;
  chips?: readonly string[];
  ctaHref: string;
  ctaLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  imageSrc: string;
  imageAlt: string;
  /** Caption chip rendered over the media. */
  imageCaption?: string;
  /** Draws the brass capture-route motif over the media. */
  routeTrace?: boolean;
}

/**
 * PageHero — headline left, large media right, running to the right edge of the
 * viewport on desktop rather than sitting inside a card. The media is the
 * biggest thing on the page by a wide margin, which is the point.
 */
export function PageHero({
  eyebrow,
  title,
  body,
  chips,
  ctaHref,
  ctaLabel,
  secondaryHref,
  secondaryLabel,
  imageSrc,
  imageAlt,
  imageCaption,
  routeTrace = false,
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-canvas">
      <div className="mx-auto grid max-w-[110rem] items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-14">
        <div className="px-5 pb-4 pt-14 sm:px-8 lg:py-28 lg:pl-[max(2.5rem,calc((100vw-88rem)/2+2.5rem))] lg:pr-0">
          <Reveal from="up" distance={14}>
            <p className="inline-flex items-center gap-[0.6rem] text-[11px] font-semibold uppercase tracking-[0.2em] leading-none text-brass-deep">
              <span aria-hidden="true" className="h-px w-6 shrink-0 bg-current opacity-50" />
              {eyebrow}
            </p>
          </Reveal>

          <Reveal from="up" distance={20} delay={0.06}>
            <h1 className="mt-6 max-w-[18ch] font-display text-[clamp(2.9rem,6.2vw,5.6rem)] font-medium leading-[0.95] tracking-[-0.05em] text-ink-900">
              {title}
            </h1>
          </Reveal>

          <Reveal from="up" distance={18} delay={0.14}>
            <p className="mt-7 max-w-[46ch] text-[1.06rem] leading-[1.75] text-ink-600">
              {body}
            </p>
          </Reveal>

          <Reveal from="up" distance={16} delay={0.22}>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild variant="brass" size="lg">
                <a href={ctaHref}>
                  {ctaLabel} <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              {secondaryHref && secondaryLabel ? (
                <Button asChild variant="ghost" size="lg">
                  <a href={secondaryHref}>{secondaryLabel}</a>
                </Button>
              ) : null}
            </div>
          </Reveal>

          {chips && chips.length > 0 ? (
            <Reveal from="up" distance={14} delay={0.3}>
              <div className="mt-8 flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <ProofChip key={chip}>{chip}</ProofChip>
                ))}
              </div>
            </Reveal>
          ) : null}
        </div>

        <Reveal from="right" distance={28} delay={0.1} className="relative">
          <ParallaxMedia
            shift={26}
            className="relative h-[58vw] max-h-[42rem] min-h-[20rem] lg:h-[80vh] lg:max-h-[52rem] lg:rounded-l-xl"
          >
            <MonochromeMedia
              src={imageSrc}
              alt={imageAlt}
              loading="eager"
              radius="none"
              overlay="soft"
              className="h-[calc(100%+3.5rem)] w-full"
              imageClassName="h-full"
            >
              {routeTrace ? <RouteTraceOverlay /> : null}
            </MonochromeMedia>
          </ParallaxMedia>
          {imageCaption ? (
            <span className="pointer-events-none absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-xs border border-white/15 bg-black/40 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-on-ink)] backdrop-blur-sm">
              <span aria-hidden="true" className="h-[0.35rem] w-[0.35rem] rounded-full bg-brass" />
              {imageCaption}
            </span>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- section headers */

/**
 * SectionHeader — numbered, at a real display size, with the lede set beside
 * the heading rather than under it so long sections do not open with a wall.
 */
export function SectionHeader({
  index,
  eyebrow,
  title,
  lede,
  onInk = false,
  className,
}: {
  /** Two-digit section index, e.g. "02". Omit for unnumbered sections. */
  index?: string;
  eyebrow: string;
  title: string;
  lede?: string;
  onInk?: boolean;
  className?: string;
}) {
  return (
    <Reveal className={cn("grid gap-x-12 gap-y-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]", className)}>
      <div>
        <div className="flex items-baseline gap-4">
          {index ? (
            <span
              className={cn(
                "font-mono text-[11px] tracking-[0.2em]",
                onInk ? "text-brass" : "text-brass-deep",
              )}
            >
              {index}
            </span>
          ) : null}
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.2em]",
              onInk ? "text-ink-300" : "text-ink-500",
            )}
          >
            {eyebrow}
          </p>
        </div>
        <h2
          className={cn(
            "mt-5 max-w-[26ch] font-display text-[clamp(2.1rem,3.8vw,3.5rem)] font-medium leading-[1.02] tracking-[-0.035em]",
            onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
          )}
        >
          {title}
        </h2>
      </div>
      {lede ? (
        <p
          className={cn(
            "max-w-[46ch] self-end text-[15.5px] leading-[1.75]",
            onInk ? "text-ink-300" : "text-ink-500",
          )}
        >
          {lede}
        </p>
      ) : null}
    </Reveal>
  );
}

/* ------------------------------------------------------------ media split */

/**
 * MediaSplit — a tall image beside a block of content, with the image allowed to
 * be the dominant element. `flip` puts the media on the left.
 */
export function MediaSplit({
  imageSrc,
  imageAlt,
  imageCaption,
  children,
  flip = false,
  className,
}: {
  imageSrc: string;
  imageAlt: string;
  imageCaption?: string;
  children: ReactNode;
  flip?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16",
        className,
      )}
    >
      <Reveal
        from={flip ? "left" : "right"}
        distance={24}
        className={cn("relative", flip ? "lg:order-first" : "lg:order-last")}
      >
        <ParallaxMedia shift={22} className="rounded-lg">
          <MonochromeMedia
            src={imageSrc}
            alt={imageAlt}
            radius="lg"
            overlay="soft"
            className="aspect-[4/5] w-full border border-line sm:aspect-[16/12] lg:aspect-[4/5]"
            imageClassName="h-[calc(100%+2.75rem)]"
          />
        </ParallaxMedia>
        {imageCaption ? (
          <span className="pointer-events-none absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-xs border border-white/15 bg-black/40 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--text-on-ink)]">
            <span aria-hidden="true" className="h-[0.35rem] w-[0.35rem] rounded-full bg-brass" />
            {imageCaption}
          </span>
        ) : null}
      </Reveal>
      <Reveal from={flip ? "right" : "left"} distance={20}>
        {children}
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------ full bleed */

/**
 * FullBleedMedia — an edge-to-edge image band with an overlaid line of copy.
 * Used to break up long pages with something other than another card grid.
 */
export function FullBleedMedia({
  src,
  alt,
  eyebrow,
  title,
  body,
  className,
}: {
  src: string;
  alt: string;
  eyebrow?: string;
  title: string;
  body?: string;
  className?: string;
}) {
  return (
    <section className={cn("relative isolate overflow-hidden bg-ink", className)}>
      <ParallaxMedia shift={34} className="absolute inset-0">
        <MonochromeMedia
          src={src}
          alt={alt}
          radius="none"
          overlay="heroL"
          className="h-[calc(100%+4.25rem)] w-full"
          imageClassName="h-full"
        />
      </ParallaxMedia>
      <Inner className="relative py-24 lg:py-36">
        <Reveal className="max-w-[34rem]">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-5 font-display text-[clamp(2rem,3.6vw,3.2rem)] font-medium leading-[1.04] tracking-[-0.035em] text-[color:var(--text-on-ink)]">
            {title}
          </h2>
          {body ? (
            <p className="mt-5 text-[15.5px] leading-[1.75] text-[color:var(--text-on-ink)] opacity-80">
              {body}
            </p>
          ) : null}
        </Reveal>
      </Inner>
    </section>
  );
}

/* ------------------------------------------------------------- note cards */

/**
 * NoteCards — the honest-limits device. Deliberately plain: ink-on-paper cards
 * with a brass rule, rather than four amber warning boxes in a row, which read
 * as apology instead of precision.
 */
export function NoteCards({
  items,
  onInk = false,
  className,
}: {
  items: readonly { title: string; body: string }[];
  onInk?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-x-10 gap-y-8 sm:grid-cols-2", className)}>
      {items.map((item, index) => (
        <Reveal key={item.title} delay={index * 0.06}>
          <div
            className={cn(
              "border-t pt-5",
              onInk ? "border-white/15" : "border-line-strong",
            )}
          >
            <h3
              className={cn(
                "text-[15px] font-semibold tracking-[-0.01em]",
                onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
              )}
            >
              {item.title}
            </h3>
            <p
              className={cn(
                "mt-2.5 max-w-[44ch] text-[14px] leading-[1.7]",
                onInk ? "text-ink-300" : "text-ink-500",
              )}
            >
              {item.body}
            </p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- closing */

/**
 * ClosingCta — the end-of-page call to action. Ink panel, large media on the
 * right, single primary action.
 */
export function ClosingCta({
  eyebrow,
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  imageSrc,
  imageAlt,
}: {
  eyebrow: string;
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  imageSrc: string;
  imageAlt: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-ink">
      <div className="absolute inset-y-0 right-0 hidden w-[46%] lg:block">
        <MonochromeMedia
          src={imageSrc}
          alt={imageAlt}
          radius="none"
          overlay="none"
          className="h-full w-full"
          imageClassName="h-full"
          overlayClassName="bg-[linear-gradient(90deg,rgba(13,13,11,0.98),rgba(13,13,11,0.6)_44%,rgba(13,13,11,0.15))]"
        />
      </div>
      <Inner className="relative py-20 lg:py-28">
        <Reveal className="max-w-[38rem]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">{eyebrow}</p>
          <h2 className="mt-5 font-display text-[clamp(2.2rem,4vw,3.6rem)] font-medium leading-[1.02] tracking-[-0.04em] text-[color:var(--text-on-ink)]">
            {title}
          </h2>
          <p className="mt-5 max-w-[44ch] text-[15.5px] leading-[1.75] text-[color:var(--text-on-ink)] opacity-80">
            {body}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild variant="brass" size="lg">
              <a href={primaryHref}>
                {primaryLabel} <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            {secondaryHref && secondaryLabel ? (
              <a
                href={secondaryHref}
                className="inline-flex h-[3.25rem] items-center justify-center rounded-sm px-5 text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--text-on-ink)] transition-colors hover:bg-white/5"
              >
                {secondaryLabel}
              </a>
            ) : null}
          </div>
        </Reveal>
      </Inner>
    </section>
  );
}
