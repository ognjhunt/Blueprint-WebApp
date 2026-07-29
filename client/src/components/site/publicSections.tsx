// Layout furniture for the public site.
//
// The 2026-07 redesign moves away from "white card tiles on paper" toward a
// numbered editorial spread: alternating paper/ink bands, a mono section index,
// serif display headlines with an accent clause, and pictures that are allowed
// to take the whole width. These are the shared pieces every public page uses
// so the rhythm stays identical across routes.

import type { CSSProperties, ReactNode } from "react";

import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { CinematicMedia, Reveal } from "./motion";

type SectionTone = "canvas" | "paper" | "white" | "ink" | "graphite";

const sectionToneClass: Record<SectionTone, string> = {
  canvas: "bg-canvas text-ink-900",
  paper: "bg-paper text-ink-900",
  white: "bg-white text-ink-900",
  ink: "bg-ink text-[color:var(--text-on-ink)]",
  graphite: "bg-graphite text-[color:var(--text-on-ink)]",
};

export function Section({
  tone = "canvas",
  divider = true,
  bleed = false,
  className,
  innerClassName,
  children,
  id,
}: {
  tone?: SectionTone;
  /** Hairline top/bottom rules. */
  divider?: boolean;
  /** Skip the max-width container — the child manages its own width. */
  bleed?: boolean;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
  id?: string;
}) {
  const dark = tone === "ink" || tone === "graphite";

  return (
    <section
      id={id}
      className={cn(
        sectionToneClass[tone],
        divider && (dark ? "border-y border-white/10" : "border-y border-line"),
        className,
      )}
    >
      {bleed ? (
        children
      ) : (
        <div
          className={cn(
            "mx-auto w-full max-w-[88rem] px-5 py-20 sm:px-8 lg:px-10 lg:py-28",
            innerClassName,
          )}
        >
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * SectionHead — mono index + brass rule, serif headline, single lede.
 * `title` takes a node so pages can italicise the clause that carries the idea.
 */
export function SectionHead({
  index,
  eyebrow,
  title,
  lede,
  onInk = false,
  align = "left",
  className,
}: {
  /** Two-digit section counter, e.g. "02". */
  index?: string;
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  onInk?: boolean;
  align?: "left" | "wide";
  className?: string;
}) {
  return (
    <Reveal className={cn(align === "wide" ? "max-w-[60rem]" : "max-w-[46rem]", className)}>
      <div className="flex items-center gap-4">
        {index ? (
          <span
            className={cn(
              "font-mono text-[11px] tabular-nums",
              onInk ? "text-brass" : "text-brass-deep",
            )}
          >
            {index}
          </span>
        ) : null}
        <span
          aria-hidden
          className={cn("h-px w-8", onInk ? "bg-brass/60" : "bg-brass-deep/50")}
        />
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.24em]",
            onInk ? "text-white/60" : "text-ink-500",
          )}
        >
          {eyebrow}
        </span>
      </div>

      <h2
        className={cn(
          "mt-6 font-display font-medium leading-[1.04] tracking-[-0.03em]",
          "text-[clamp(2.1rem,3.6vw,3.4rem)]",
          onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
        )}
      >
        {title}
      </h2>

      {lede ? (
        <p
          className={cn(
            "mt-5 text-[1.0625rem] leading-[1.75]",
            onInk ? "text-white/65" : "text-ink-500",
          )}
        >
          {lede}
        </p>
      ) : null}
    </Reveal>
  );
}

/** The italic accent clause used inside display headlines. */
export function Accent({ children, onInk = false }: { children: ReactNode; onInk?: boolean }) {
  return (
    <em className={cn("italic", onInk ? "text-brass" : "text-brass-deep")}>{children}</em>
  );
}

/** Mono kicker + short line, used to caption figures and columns. */
export function MonoNote({
  label,
  children,
  onInk = false,
  className,
}: {
  label: string;
  children: ReactNode;
  onInk?: boolean;
  className?: string;
}) {
  return (
    <p className={cn("text-[13.5px] leading-6", onInk ? "text-white/60" : "text-ink-500", className)}>
      <span
        className={cn(
          "mr-2 font-mono text-[10px] uppercase tracking-[0.18em]",
          onInk ? "text-brass" : "text-brass-deep",
        )}
      >
        {label}
      </span>
      {children}
    </p>
  );
}

/**
 * StatementList — numbered editorial rows. Replaces the old uniform card grid:
 * hairline rows, large mono numerals, generous leading.
 */
export function StatementList({
  items,
  onInk = false,
  className,
}: {
  items: Array<{ title: string; body: string }>;
  onInk?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("divide-y", onInk ? "divide-white/10" : "divide-line", className)}>
      {items.map((item, index) => (
        <li
          key={item.title}
          className="grid gap-2 py-6 md:grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1.15fr)] md:items-baseline md:gap-8"
        >
          <span
            className={cn(
              "font-mono text-[12px] tabular-nums",
              onInk ? "text-white/35" : "text-ink-400",
            )}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3
            className={cn(
              "font-display text-[1.375rem] font-medium leading-tight tracking-[-0.02em]",
              onInk ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
            )}
          >
            {item.title}
          </h3>
          <p className={cn("text-[14.5px] leading-7", onInk ? "text-white/60" : "text-ink-500")}>
            {item.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

/**
 * PictureCard — a large picture with the copy sitting under it, for persona and
 * use-case entry points. The image is the dominant element by design.
 */
export function PictureCard({
  href,
  imageSrc,
  imageAlt,
  caption,
  meta,
  eyebrow,
  title,
  body,
  linkLabel,
  aspect = "aspect-[4/3]",
}: {
  href: string;
  imageSrc: string;
  imageAlt: string;
  caption?: string;
  meta?: string;
  eyebrow: string;
  title: string;
  body: string;
  linkLabel: string;
  aspect?: string;
}) {
  return (
    <a
      href={href}
      className="group flex flex-col border border-line bg-white transition-colors duration-300 hover:border-line-strong"
    >
      <CinematicMedia
        src={imageSrc}
        alt={imageAlt}
        caption={caption}
        meta={meta}
        frame={false}
        wash="soft"
        className={cn("w-full border-0", aspect)}
      />
      <div className="flex flex-1 flex-col p-6 sm:p-8">
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-brass-deep">
          {eyebrow}
        </span>
        <h3 className="mt-4 font-display text-[1.75rem] font-medium leading-[1.1] tracking-[-0.025em] text-ink-900">
          {title}
        </h3>
        <p className="mt-4 flex-1 text-[14.5px] leading-7 text-ink-500">{body}</p>
        <span className="mt-6 inline-flex items-center gap-2 text-[13px] font-semibold text-ink-900">
          {linkLabel}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>
    </a>
  );
}

/**
 * BigCta — full-bleed picture, dark wash, one primary action. The closing
 * frame on every public page.
 */
export function BigCta({
  eyebrow,
  title,
  body,
  imageSrc,
  imageAlt,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  footnote,
}: {
  eyebrow: string;
  title: ReactNode;
  body: string;
  imageSrc: string;
  imageAlt: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  footnote?: string;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-ink">
      <img
        src={imageSrc}
        alt={imageAlt}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover grayscale brightness-[0.68]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(105deg,rgba(13,13,11,0.95),rgba(13,13,11,0.72)_44%,rgba(13,13,11,0.26))]"
      />
      <div
        aria-hidden
        className="bp-evidence-grid absolute inset-0 opacity-[0.16]"
        style={{ maskImage: "linear-gradient(180deg,rgba(0,0,0,0.5),transparent)" } as CSSProperties}
      />

      <div className="relative mx-auto max-w-[88rem] px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <Reveal className="max-w-[46rem]">
          <div className="flex items-center gap-4">
            <span aria-hidden className="h-px w-8 bg-brass/70" />
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-brass">
              {eyebrow}
            </span>
          </div>
          <h2 className="mt-6 font-display text-[clamp(2.3rem,4.2vw,3.9rem)] font-medium leading-[1.02] tracking-[-0.035em] text-[color:var(--text-on-ink)]">
            {title}
          </h2>
          <p className="mt-5 max-w-[38rem] text-[1.0625rem] leading-[1.75] text-white/70">{body}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={primaryHref}
              className="inline-flex h-12 items-center justify-center gap-2 bg-brass px-6 text-sm font-semibold tracking-[-0.01em] text-ink transition-colors duration-200 hover:bg-brass-lit"
            >
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </a>
            {secondaryHref && secondaryLabel ? (
              <a
                href={secondaryHref}
                className="inline-flex h-12 items-center justify-center border border-white/25 px-6 text-sm font-semibold tracking-[-0.01em] text-[color:var(--text-on-ink)] transition-colors duration-200 hover:border-white/50 hover:bg-white/5"
              >
                {secondaryLabel}
              </a>
            ) : null}
          </div>

          {footnote ? (
            <p className="mt-7 max-w-[36rem] text-[12.5px] leading-6 text-white/45">{footnote}</p>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}
