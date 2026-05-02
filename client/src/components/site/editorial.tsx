import type { ReactNode } from "react";

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
};

type MonochromeVideoProps = {
  src: string;
  poster?: string;
  title: string;
  className?: string;
  videoClassName?: string;
  overlayClassName?: string;
  children?: ReactNode;
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

export function EditorialSectionLabel({
  children,
  light = false,
  className,
}: SectionLabelProps) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.24em]",
        light ? "text-white opacity-70" : "text-slate-500",
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
          "font-editorial mt-4 text-4xl tracking-[-0.05em] sm:text-[3.35rem]",
          light ? "text-white" : "text-slate-950",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "mt-4 max-w-2xl text-sm leading-7",
            light ? "text-white opacity-80" : "text-slate-600",
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
}: MonochromeMediaProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-[2rem]", className)}>
      <img
        src={src}
        alt={alt}
        loading={loading}
        className={cn(
          "h-full w-full object-cover grayscale contrast-[1.02] brightness-[0.82]",
          imageClassName,
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.45))]",
          overlayClassName,
        )}
      />
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
}: MonochromeVideoProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-[2rem] bg-slate-950", className)}>
      <video
        aria-label={title}
        autoPlay
        muted
        loop
        playsInline
        controls={false}
        poster={poster}
        className={cn(
          "h-full w-full object-cover grayscale contrast-[1.02] brightness-[0.82]",
          videoClassName,
        )}
      >
        <source src={src} type="video/mp4" />
      </video>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.45))]",
          overlayClassName,
        )}
      />
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
        "inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
        light
          ? "border-white/[0.26] bg-black/[0.32] text-white"
          : "border-black/10 bg-white/[0.88] text-slate-600",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EditorialMetricStrip({
  items,
  className,
}: MetricStripProps) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-[1.9rem] border border-black/10 bg-black/10 md:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="bg-white px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {item.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{item.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function RouteTraceOverlay({
  className,
  light = true,
}: {
  className?: string;
  light?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 1200 520"
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    >
      <path
        d="M122 352C223 352 232 268 318 268C423 268 408 410 548 410C672 410 676 302 792 302C910 302 930 392 1084 392"
        fill="none"
        stroke={light ? "rgba(255,255,255,0.84)" : "rgba(15,23,42,0.88)"}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[122, 318, 548, 792, 972].map((cx, index) => (
        <g key={cx}>
          <circle
            cx={cx}
            cy={[352, 268, 410, 302, 356][index]}
            r="9"
            fill={light ? "rgba(255,255,255,0.92)" : "rgba(15,23,42,0.92)"}
          />
          <circle
            cx={cx}
            cy={[352, 268, 410, 302, 356][index]}
            r="22"
            fill={light ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.12)"}
          />
        </g>
      ))}
    </svg>
  );
}

export function EditorialFilmstrip({
  frames,
  className,
}: FilmstripProps) {
  return (
    <div
      className={cn(
        "rounded-[1.8rem] border border-white/10 bg-black/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        className,
      )}
    >
      <div className="mb-3 h-2 rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.16)_0_8px,transparent_8px_20px)] bg-[length:20px_100%]" />
      <div className="grid gap-3 md:grid-cols-5">
        {frames.map((frame) => (
          <div
            key={`${frame.src}-${frame.time || frame.title || frame.alt}`}
            className="overflow-hidden rounded-[1.1rem] border border-white/10 bg-black"
          >
            <img
              src={frame.src}
              alt={frame.alt}
              loading="lazy"
              className="aspect-[16/9] w-full object-cover grayscale"
            />
            <div className="flex items-center justify-between px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-white/60">
              <span>{frame.time || frame.title || "Frame"}</span>
              <span>{frame.title || "Review"}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 h-2 rounded-full bg-[linear-gradient(90deg,rgba(255,255,255,0.16)_0_8px,transparent_8px_20px)] bg-[length:20px_100%]" />
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
  const textTone = dark ? "text-white" : "text-slate-950";
  const bodyTone = dark ? "text-white/75" : "text-slate-600";

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[2.2rem] border border-black/10 px-6 py-8 shadow-[0_26px_70px_-52px_rgba(15,23,42,0.48)] sm:px-8 lg:px-10 lg:py-10",
        dark ? "bg-slate-950" : "bg-white",
        className,
      )}
    >
      <div className="absolute inset-y-0 right-0 hidden w-[48%] lg:block">
        <MonochromeMedia
          src={imageSrc}
          alt={imageAlt}
          className="h-full rounded-none"
          imageClassName="h-full"
          overlayClassName={dark ? "bg-[linear-gradient(90deg,rgba(15,23,42,0.85),rgba(15,23,42,0.14))]" : "bg-[linear-gradient(90deg,rgba(255,255,255,0.82),rgba(255,255,255,0.12))]"}
        />
      </div>
      <div className="relative max-w-[34rem]">
        <EditorialSectionLabel light={dark}>{eyebrow}</EditorialSectionLabel>
        <h2 className={cn("font-editorial mt-4 text-4xl tracking-[-0.05em] sm:text-[3rem]", textTone)}>
          {title}
        </h2>
        <p className={cn("mt-4 text-sm leading-7", bodyTone)}>{description}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <a
            href={primaryHref}
            onClick={primaryOnClick}
            className={cn(
              "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition",
              dark
                ? "bg-white text-slate-950 hover:bg-slate-100"
                : "bg-slate-950 text-white hover:bg-slate-800",
            )}
          >
            {primaryLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
          {secondaryHref && secondaryLabel ? (
            <a
              href={secondaryHref}
              onClick={secondaryOnClick}
              className={cn(
                "inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition",
                dark
                  ? "border-white/15 text-white hover:bg-white/5"
                  : "border-black/10 text-slate-950 hover:bg-slate-50",
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
        "grid gap-6 rounded-[2rem] border border-black/10 bg-white p-6 shadow-[0_20px_60px_-42px_rgba(15,23,42,0.22)] lg:grid-cols-[0.34fr_0.66fr]",
        className,
      )}
    >
      <div>
        <EditorialSectionLabel>{title}</EditorialSectionLabel>
        {description ? (
          <p className="mt-4 text-sm leading-7 text-slate-600">{description}</p>
        ) : null}
      </div>
      <div className="divide-y divide-black/10">
        {items.map((item, index) => (
          <article key={`${item.question}-${index}`} className="py-4">
            <h3 className="text-left text-base font-medium text-slate-900">
              {item.question}
            </h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              {item.answer}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
