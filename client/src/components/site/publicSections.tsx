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

import { ArrowRightIcon } from "@heroicons/react/24/outline";

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
        size === "default" && "max-w-[94rem]",
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
    <section className="relative overflow-hidden bg-kinetic-white">
      <div className="mx-auto max-w-[100rem] px-5 pb-16 pt-14 sm:px-8 lg:px-10 lg:pb-24 lg:pt-20">
        <div className="grid gap-9 lg:grid-cols-[minmax(0,1.28fr)_minmax(20rem,0.72fr)] lg:items-end lg:gap-20">
          <div>
            <Reveal from="up" distance={14}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] leading-none text-kinetic-blue">
                {eyebrow}
              </p>
            </Reveal>

            <Reveal from="up" distance={20} delay={0.06}>
              <h1 className="mt-7 max-w-[18ch] font-display text-[clamp(3rem,6.5vw,6.6rem)] font-semibold leading-[0.93] tracking-[-0.062em] text-kinetic-graphite">
                {title}
              </h1>
            </Reveal>
          </div>

          <div className="lg:pb-2">
            <Reveal from="up" distance={18} delay={0.14}>
              <p className="max-w-[46ch] text-[1.06rem] leading-[1.75] text-kinetic-muted">
                {body}
              </p>
            </Reveal>

          <Reveal from="up" distance={16} delay={0.22}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild variant="action" size="lg" className="rounded-lg px-6 shadow-[0_12px_30px_-16px_rgba(21,84,255,0.78)]">
                <a href={ctaHref}>
                  {ctaLabel} <ArrowRightIcon className="h-4 w-4" />
                </a>
              </Button>
              {secondaryHref && secondaryLabel ? (
                <Button asChild variant="ghost" size="lg" className="rounded-lg text-kinetic-graphite">
                  <a href={secondaryHref}>{secondaryLabel}</a>
                </Button>
              ) : null}
            </div>
          </Reveal>

            {chips && chips.length > 0 ? (
              <Reveal from="up" distance={14} delay={0.3}>
                <div className="mt-7 flex flex-wrap gap-2">
                  {chips.map((chip) => (
                    <ProofChip key={chip}>{chip}</ProofChip>
                  ))}
                </div>
              </Reveal>
            ) : null}
          </div>
        </div>

        <Reveal from="up" distance={26} delay={0.1} className="relative mt-14 lg:mt-20">
          <ParallaxMedia
            shift={22}
            className="relative h-[64vw] max-h-[50rem] min-h-[22rem] overflow-hidden rounded-2xl bg-kinetic-dark lg:h-[68vh] lg:min-h-[36rem]"
          >
            <MonochromeMedia
              src={imageSrc}
              alt={imageAlt}
              loading="eager"
              radius="none"
              overlay="soft"
              className="h-[calc(100%+3rem)] w-full"
              imageClassName="h-full"
            >
              {routeTrace ? <RouteTraceOverlay /> : null}
            </MonochromeMedia>
          </ParallaxMedia>
          {imageCaption ? (
            <span className="pointer-events-none absolute bottom-5 left-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-[#06111d]/55 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white backdrop-blur-xl sm:bottom-7 sm:left-7">
              <span aria-hidden="true" className="h-[0.35rem] w-[0.35rem] rounded-full bg-kinetic-cyan" />
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
    <Reveal className={cn("grid gap-x-16 gap-y-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]", className)}>
      <div>
        <div className="flex items-baseline gap-4">
          {index ? (
            <span
              className={cn(
                "font-mono text-[11px] tracking-[0.2em]",
                onInk ? "text-kinetic-cyan" : "text-kinetic-blue",
              )}
            >
              {index}
            </span>
          ) : null}
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.2em]",
              onInk ? "text-white/48" : "text-kinetic-faint",
            )}
          >
            {eyebrow}
          </p>
        </div>
        <h2
          className={cn(
            "mt-5 max-w-[23ch] font-display text-[clamp(2.35rem,4.6vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.052em]",
            onInk ? "text-white" : "text-kinetic-graphite",
          )}
        >
          {title}
        </h2>
      </div>
      {lede ? (
        <p
          className={cn(
            "max-w-[46ch] self-end text-[16px] leading-[1.75]",
            onInk ? "text-white/58" : "text-kinetic-muted",
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
        "grid items-center gap-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-20",
        className,
      )}
    >
      <Reveal
        from={flip ? "left" : "right"}
        distance={24}
        className={cn("relative", flip ? "lg:order-first" : "lg:order-last")}
      >
        <ParallaxMedia shift={22} className="rounded-2xl bg-kinetic-dark">
          <MonochromeMedia
            src={imageSrc}
            alt={imageAlt}
            radius="xl"
            overlay="soft"
            className="aspect-[4/5] w-full border border-line sm:aspect-[16/12] lg:aspect-[4/5]"
            imageClassName="h-[calc(100%+2.75rem)]"
          />
        </ParallaxMedia>
        {imageCaption ? (
          <span className="pointer-events-none absolute bottom-5 left-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-[#06111d]/55 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white backdrop-blur-xl">
            <span aria-hidden="true" className="h-[0.35rem] w-[0.35rem] rounded-full bg-kinetic-cyan" />
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
    <section className={cn("relative isolate overflow-hidden bg-kinetic-dark", className)}>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-kinetic-cyan">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-5 font-display text-[clamp(2.5rem,5vw,5rem)] font-semibold leading-[0.98] tracking-[-0.052em] text-white">
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
    <section className="relative isolate overflow-hidden bg-kinetic-blue">
      <div className="absolute inset-y-0 right-0 hidden w-[46%] lg:block">
        <MonochromeMedia
          src={imageSrc}
          alt={imageAlt}
          radius="none"
          overlay="none"
          className="h-full w-full"
          imageClassName="h-full"
          overlayClassName="bg-[linear-gradient(90deg,rgba(21,84,255,1),rgba(21,84,255,0.88)_44%,rgba(21,84,255,0.3))] opacity-80"
        />
      </div>
      <Inner className="relative py-20 lg:py-28">
        <Reveal className="max-w-[38rem]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">{eyebrow}</p>
          <h2 className="mt-5 font-display text-[clamp(2.7rem,5.2vw,5.3rem)] font-semibold leading-[0.96] tracking-[-0.058em] text-white">
            {title}
          </h2>
          <p className="mt-5 max-w-[44ch] text-[15.5px] leading-[1.75] text-[color:var(--text-on-ink)] opacity-80">
            {body}
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild variant="secondary" size="lg" className="rounded-lg border-white bg-white text-kinetic-graphite hover:bg-kinetic-white">
              <a href={primaryHref}>
                {primaryLabel} <ArrowRightIcon className="h-4 w-4" />
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
