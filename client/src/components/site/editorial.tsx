import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

type SectionLabelProps = {
  children: string;
  light?: boolean;
  className?: string;
};

type SectionIntroProps = {
  eyebrow: string;
  title: string;
  description?: string;
  light?: boolean;
  className?: string;
};

type MonochromeMediaProps = {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  overlayClassName?: string;
  children?: ReactNode;
  loading?: "eager" | "lazy";
  /** Overlay gradient preset. `bg` top-to-dark · `heroL` left-dark for hero text · `soft` faint. */
  overlay?: "bg" | "heroL" | "soft" | "none";
  /** Border radius preset. Default `md`; use `none` for full-bleed. */
  radius?: "none" | "md" | "lg" | "xl";
};

type MonochromeVideoProps = {
  src: string;
  poster?: string;
  title: string;
  className?: string;
  videoClassName?: string;
  overlayClassName?: string;
  children?: ReactNode;
  overlay?: "bg" | "heroL" | "soft" | "none";
  radius?: "none" | "md" | "lg" | "xl";
};

type ProofChipProps = {
  children: ReactNode;
  light?: boolean;
  className?: string;
};

type MetricItem = {
  label: string;
  detail: string;
};

type MetricStripProps = {
  items: MetricItem[];
  className?: string;
};

type FilmstripFrame = {
  src: string;
  alt: string;
  time?: string;
  title?: string;
};

type FilmstripProps = {
  frames: FilmstripFrame[];
  className?: string;
};

type CtaBandProps = {
  eyebrow: string;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  primaryHref: string;
  primaryLabel: string;
  primaryOnClick?: () => void;
  secondaryHref?: string;
  secondaryLabel?: string;
  secondaryOnClick?: () => void;
  dark?: boolean;
  className?: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

type FaqProps = {
  title?: string;
  description?: string;
  items: FaqItem[];
  className?: string;
};

const radiusClass = {
  none: "rounded-none",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
} as const;

const overlayClass = {
  // top -> dark, for captioned media
  bg: "bg-[linear-gradient(180deg,rgba(13,13,11,0.04),rgba(13,13,11,0.46))]",
  // left -> dark, anchors hero text on the left
  heroL: "bg-[linear-gradient(90deg,rgba(13,13,11,0.78),rgba(13,13,11,0.28)_46%,rgba(13,13,11,0.06))]",
  // faint wash
  soft: "bg-[linear-gradient(180deg,rgba(13,13,11,0.02),rgba(13,13,11,0.16))]",
  none: "",
} as const;

export function EditorialSectionLabel({
  children,
  light = false,
  className,
}: SectionLabelProps) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.24em]",
        light ? "text-[color:var(--text-on-ink)] opacity-70" : "text-ink-500",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function EditorialSectionIntro({
  eyebrow,
  title,
  description,
  light = false,
  className,
}: SectionIntroProps) {
  return (
    <div className={className}>
      <EditorialSectionLabel light={light}>{eyebrow}</EditorialSectionLabel>
      <h2
        className={cn(
          "mt-4 font-display font-medium leading-[1.02] tracking-[-0.03em]",
          "text-[clamp(2rem,3.2vw,3.1rem)]",
          light ? "text-[color:var(--text-on-ink)]" : "text-ink-900",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-4 max-w-[40rem] text-[15px] leading-[1.7]",
            light ? "text-[color:var(--text-on-ink)] opacity-80" : "text-ink-500",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function MonochromeMedia({
  src,
  alt,
  className,
  imageClassName,
  overlayClassName,
  children,
  loading = "lazy",
  overlay = "bg",
  radius = "md",
}: MonochromeMediaProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        radiusClass[radius],
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        loading={loading}
        className={cn(
          "h-full w-full object-cover grayscale contrast-[1.03] brightness-[0.82]",
          imageClassName,
        )}
      />
      {overlay !== "none" ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-0",
            overlayClass[overlay],
            overlayClassName,
          )}
        />
      ) : overlayClassName ? (
        <div className={cn("pointer-events-none absolute inset-0", overlayClassName)} />
      ) : null}
      {children}
    </div>
  );
}

export function MonochromeVideo({
  src,
  poster,
  title,
  className,
  videoClassName,
  overlayClassName,
  children,
  overlay = "bg",
  radius = "md",
}: MonochromeVideoProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-ink",
        radiusClass[radius],
        className,
      )}
    >
      <video
        aria-label={title}
        autoPlay
        muted
        loop
        playsInline
        controls={false}
        poster={poster}
        className={cn(
          "h-full w-full object-cover grayscale contrast-[1.03] brightness-[0.82]",
          videoClassName,
        )}
      >
        <source src={src} type="video/mp4" />
      </video>
      {overlay !== "none" ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-0",
            overlayClass[overlay],
            overlayClassName,
          )}
        />
      ) : overlayClassName ? (
        <div className={cn("pointer-events-none absolute inset-0", overlayClassName)} />
      ) : null}
      {children}
    </div>
  );
}

export function ProofChip({
  children,
  light = false,
  className,
}: ProofChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-sm border px-[0.6rem] py-1 text-[11px] font-semibold uppercase tracking-[0.14em]",
        light
          ? "border-white/15 bg-black/30 text-[color:var(--text-on-ink)]"
          : "border-line-strong bg-white/90 text-ink-600",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="h-[0.4rem] w-[0.4rem] shrink-0 rounded-full bg-brass"
      />
      {children}
    </span>
  );
}

export function EditorialMetricStrip({ items, className }: MetricStripProps) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-md border border-line bg-[#ded7c8] md:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="bg-white px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-400">
            {item.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-ink-600">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * RouteTraceOverlay — the capture-path motif. A brass dashed SVG polyline through
 * ~5 nodes; the stroke-dashoffset animates in over ~2.6s as the signature hero
 * flourish. Falls back to a static fully-drawn line under reduced motion.
 */
export function RouteTraceOverlay({
  className,
  light = true,
}: {
  className?: string;
  light?: boolean;
}) {
  const reactId = useId();
  const gradientId = `bp-route-${reactId}`;
  const pathRef = useRef<SVGPathElement | null>(null);
  const [length, setLength] = useState(0);
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(media.matches);
    const handle = (event: MediaQueryListEvent) => setReduced(event.matches);
    media.addEventListener?.("change", handle);
    return () => media.removeEventListener?.("change", handle);
  }, []);

  useEffect(() => {
    if (pathRef.current) {
      setLength(pathRef.current.getTotalLength());
    }
  }, []);

  const nodes: Array<[number, number]> = [
    [122, 352],
    [318, 268],
    [548, 410],
    [792, 302],
    [972, 356],
  ];

  const linePath =
    "M122 352C223 352 232 268 318 268C423 268 408 410 548 410C672 410 676 302 792 302C880 302 904 348 972 356";

  const stroke = light ? "var(--bp-brass)" : "var(--bp-brass-deep)";
  const nodeFill = light ? "var(--bp-brass-lit)" : "var(--bp-brass-deep)";
  const animate = !reduced && length > 0;

  return (
    <svg
      viewBox="0 0 1200 520"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.95" />
        </linearGradient>
      </defs>
      <path
        ref={pathRef}
        d={linePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="10 9"
        style={
          animate
            ? {
                strokeDashoffset: length,
                animation: "bp-route-trace 2600ms cubic-bezier(0.16,1,0.3,1) forwards",
              }
            : undefined
        }
      />
      {nodes.map(([cx, cy], index) => (
        <g key={`${cx}-${cy}`}>
          <circle cx={cx} cy={cy} r="14" fill={stroke} fillOpacity="0.12" />
          <circle cx={cx} cy={cy} r="5.5" fill={nodeFill} />
          {index === 0 || index === nodes.length - 1 ? (
            <circle
              cx={cx}
              cy={cy}
              r="9"
              fill="none"
              stroke={stroke}
              strokeWidth="1"
              strokeOpacity="0.6"
            />
          ) : null}
        </g>
      ))}
      <style>{`
        @keyframes bp-route-trace { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) {
          svg [style*="bp-route-trace"] { animation: none !important; stroke-dashoffset: 0 !important; }
        }
      `}</style>
    </svg>
  );
}

export function EditorialFilmstrip({ frames, className }: FilmstripProps) {
  const perf =
    "h-1.5 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.18)_0_8px,transparent_8px_20px)]";
  return (
    <div
      className={cn(
        "rounded-lg border border-white/10 bg-ink p-4 shadow-ink",
        className,
      )}
    >
      <div className={cn("mb-3 rounded-xs", perf)} />
      <div className="grid gap-3 md:grid-cols-5">
        {frames.map((frame) => (
          <div
            key={`${frame.src}-${frame.time || frame.title || frame.alt}`}
            className="overflow-hidden rounded-md border border-white/10 bg-black"
          >
            <img
              src={frame.src}
              alt={frame.alt}
              loading="lazy"
              className="aspect-[16/9] w-full object-cover grayscale contrast-[1.03] brightness-[0.82]"
            />
            <div className="flex items-center justify-between px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-white/60">
              <span>{frame.time || frame.title || "Frame"}</span>
              <span>{frame.title || "Review"}</span>
            </div>
          </div>
        ))}
      </div>
      <div className={cn("mt-3 rounded-xs", perf)} />
    </div>
  );
}

export function EditorialCtaBand({
  eyebrow,
  title,
  description,
  imageSrc,
  imageAlt,
  primaryHref,
  primaryLabel,
  primaryOnClick,
  secondaryHref,
  secondaryLabel,
  secondaryOnClick,
  dark = true,
  className,
}: CtaBandProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border px-6 py-8 shadow-lg sm:px-8 lg:px-10 lg:py-10",
        dark ? "border-white/10 bg-ink" : "border-line bg-white",
        className,
      )}
    >
      <div className="absolute inset-y-0 right-0 hidden w-[48%] lg:block">
        <MonochromeMedia
          src={imageSrc}
          alt={imageAlt}
          loading="eager"
          radius="none"
          overlay="none"
          className="h-full"
          imageClassName="h-full"
          overlayClassName={
            dark
              ? "bg-[linear-gradient(90deg,rgba(13,13,11,0.96),rgba(13,13,11,0.55)_42%,rgba(13,13,11,0.12))]"
              : "bg-[linear-gradient(90deg,rgba(245,241,232,0.96),rgba(245,241,232,0.5)_42%,rgba(245,241,232,0.1))]"
          }
        />
      </div>
      <div className="relative max-w-[34rem]">
        <EditorialSectionIntro
          eyebrow={eyebrow}
          title={title}
          description={description}
          light={dark}
        />
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href={primaryHref}
            onClick={primaryOnClick}
            className={cn(
              "inline-flex h-[2.625rem] items-center justify-center gap-2 rounded-sm bg-brass px-[1.125rem] text-sm font-semibold tracking-[-0.01em] text-ink",
              "transition-[background-color,transform] duration-200 ease-standard hover:bg-brass-lit active:translate-y-px",
            )}
          >
            {primaryLabel}
            <ArrowRight className="h-4 w-4" />
          </a>
          {secondaryHref && secondaryLabel ? (
            <a
              href={secondaryHref}
              onClick={secondaryOnClick}
              className={cn(
                "inline-flex h-[2.625rem] items-center justify-center rounded-sm px-[1.125rem] text-sm font-semibold tracking-[-0.01em]",
                "transition-[background-color,transform] duration-200 ease-standard active:translate-y-px",
                dark
                  ? "text-[color:var(--text-on-ink)] hover:bg-white/5"
                  : "text-ink hover:bg-inset",
              )}
            >
              {secondaryLabel}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function EditorialFaq({
  title = "FAQ",
  description,
  items,
  className,
}: FaqProps) {
  return (
    <div
      className={cn(
        "grid gap-6 rounded-lg border border-line bg-white p-6 shadow-md lg:grid-cols-[0.34fr_0.66fr]",
        className,
      )}
    >
      <div>
        <EditorialSectionLabel>{title}</EditorialSectionLabel>
        {description ? (
          <p className="mt-4 text-sm leading-[1.7] text-ink-500">{description}</p>
        ) : null}
      </div>
      <div className="divide-y divide-line-soft">
        {items.map((item, index) => (
          <article key={`${item.question}-${index}`} className="py-4">
            <h3 className="text-left text-base font-medium text-ink-900">
              {item.question}
            </h3>
            <p className="mt-2 text-sm leading-[1.7] text-ink-500">
              {item.answer}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
