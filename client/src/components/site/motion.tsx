// Public-site motion primitives.
//
// The rule for this layer: prerendered HTML is the finished state. Every
// entrance style lives behind `html.bp-motion` (see index.css), a class this
// module adds on the client, so static output, no-JS visitors, and the QA
// sweep never see a blank or half-drawn page. `prefers-reduced-motion: reduce`
// short-circuits to the same finished state.

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

if (typeof document !== "undefined") {
  document.documentElement.classList.add("bp-motion");
}

type RevealTag = "div" | "section" | "article" | "li" | "ol" | "ul" | "span" | "figure" | "header";

type InViewOptions = {
  /** Stop observing after the first entrance. Default true. */
  once?: boolean;
  /** Visible fraction that counts as "in view". Default 0.18. */
  amount?: number;
  rootMargin?: string;
};

/**
 * Adds the `bp-in` class to the referenced element once it scrolls into view.
 * Falls back to the finished state when IntersectionObserver is unavailable.
 */
export function useInViewRef<T extends HTMLElement>({
  once = true,
  amount = 0.18,
  rootMargin = "0px 0px -10% 0px",
}: InViewOptions = {}) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      node.classList.add("bp-in");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("bp-in");
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            entry.target.classList.remove("bp-in");
          }
        }
      },
      { threshold: amount, rootMargin },
    );

    observer.observe(node);
    // Elements already past the fold on load (deep links, restored scroll)
    // still need the class even if no intersection event fires immediately.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      node.classList.add("bp-in");
      if (once) observer.unobserve(node);
    }

    return () => observer.disconnect();
  }, [once, amount, rootMargin]);

  return ref;
}

type RevealProps = {
  children: ReactNode;
  as?: RevealTag;
  className?: string;
  /** Entrance delay in ms. */
  delay?: number;
  /** Rise distance, any CSS length. Default 1.5rem. */
  y?: string;
  amount?: number;
  style?: CSSProperties;
};

/** Single element that rises into place when it enters the viewport. */
export function Reveal({
  children,
  as: Tag = "div",
  className,
  delay = 0,
  y,
  amount,
  style,
}: RevealProps) {
  const ref = useInViewRef<HTMLElement>({ amount });

  return (
    <Tag
      ref={ref as never}
      data-bp-reveal=""
      className={className}
      style={{
        ...style,
        "--bp-reveal-delay": `${delay}ms`,
        ...(y ? { "--bp-reveal-y": y } : null),
      } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

type StaggerProps = {
  children: ReactNode;
  as?: RevealTag;
  className?: string;
  /** Per-child delay step in ms. Default 80. */
  step?: number;
  y?: string;
  amount?: number;
  style?: CSSProperties;
};

/** Container whose direct children enter one after another. */
export function Stagger({
  children,
  as: Tag = "div",
  className,
  step = 80,
  y,
  amount,
  style,
}: StaggerProps) {
  const ref = useInViewRef<HTMLElement>({ amount });

  return (
    <Tag
      ref={ref as never}
      data-bp-stagger=""
      className={className}
      style={{
        ...style,
        "--bp-stagger": `${step}ms`,
        ...(y ? { "--bp-reveal-y": y } : null),
      } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

type CinematicMediaProps = {
  src: string;
  alt: string;
  /** Mono strip printed across the bottom of the frame. */
  caption?: string;
  /** Right-hand mono token in the caption strip. */
  meta?: string;
  className?: string;
  imageClassName?: string;
  /** Corner registration marks + hairline frame. Default true. */
  frame?: boolean;
  priority?: boolean;
  /** Dark wash strength over the image. */
  wash?: "none" | "soft" | "deep";
  children?: ReactNode;
};

const washClass = {
  none: "",
  soft: "bg-[linear-gradient(180deg,rgba(13,13,11,0.04),rgba(13,13,11,0.34))]",
  deep: "bg-[linear-gradient(180deg,rgba(13,13,11,0.12),rgba(13,13,11,0.72))]",
} as const;

/**
 * CinematicMedia — the large picture treatment for the public site: a full
 * hairline frame, corner registration marks, a mono caption rail, and a slow
 * settle from a 7% over-scale on entrance.
 */
export function CinematicMedia({
  src,
  alt,
  caption,
  meta,
  className,
  imageClassName,
  frame = true,
  priority = false,
  wash = "soft",
  children,
}: CinematicMediaProps) {
  const ref = useInViewRef<HTMLDivElement>({ amount: 0.05 });

  return (
    <div
      ref={ref}
      className={cn(
        "relative isolate overflow-hidden bg-ink",
        frame && "border border-line-strong/70",
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        data-bp-media-zoom=""
        className={cn(
          "h-full w-full object-cover grayscale contrast-[1.06] brightness-[0.86]",
          imageClassName,
        )}
      />
      {wash !== "none" ? (
        <div aria-hidden className={cn("pointer-events-none absolute inset-0", washClass[wash])} />
      ) : null}

      {frame ? (
        <>
          <span aria-hidden className="pointer-events-none absolute left-3 top-3 h-4 w-4 border-l border-t border-brass/80" />
          <span aria-hidden className="pointer-events-none absolute right-3 top-3 h-4 w-4 border-r border-t border-brass/80" />
          <span aria-hidden className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 border-b border-l border-brass/80" />
          <span aria-hidden className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 border-b border-r border-brass/80" />
        </>
      ) : null}

      {caption || meta ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-4 border-t border-white/12 bg-ink/70 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-white/70 backdrop-blur-[2px]">
          <span className="truncate">{caption}</span>
          {meta ? <span className="shrink-0 text-brass">{meta}</span> : null}
        </div>
      ) : null}

      {children}
    </div>
  );
}

type MarqueeItem = {
  src: string;
  alt: string;
  label: string;
};

/**
 * CapturedSitesMarquee — a continuously scrolling rail of large captured-site
 * stills. Pauses on hover/focus; static under reduced motion.
 */
export function CapturedSitesMarquee({
  items,
  className,
  durationSeconds = 68,
}: {
  items: MarqueeItem[];
  className?: string;
  durationSeconds?: number;
}) {
  const doubled = [...items, ...items];

  return (
    <div
      className={cn("bp-marquee relative overflow-hidden", className)}
      role="group"
      aria-label="Captured real-site task environments"
    >
      <div
        className="bp-marquee-track flex w-max gap-4"
        style={{ "--bp-marquee-dur": `${durationSeconds}s` } as CSSProperties}
      >
        {doubled.map((item, index) => (
          <figure
            key={`${item.src}-${index}`}
            className="relative w-[19rem] shrink-0 overflow-hidden border border-white/10 bg-ink sm:w-[26rem] lg:w-[32rem]"
            aria-hidden={index >= items.length}
          >
            <img
              src={item.src}
              alt={index >= items.length ? "" : item.alt}
              loading="lazy"
              className="aspect-[16/10] w-full object-cover grayscale contrast-[1.05] brightness-[0.8]"
            />
            <figcaption className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-ink/75 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/70">
              {item.label}
            </figcaption>
          </figure>
        ))}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-[linear-gradient(90deg,var(--bp-ink),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-[linear-gradient(270deg,var(--bp-ink),transparent)]" />
    </div>
  );
}
