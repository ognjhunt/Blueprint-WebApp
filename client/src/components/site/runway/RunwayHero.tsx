/**
 * The homepage hero.
 *
 * Two jobs, in order. First, state the thesis in one line a robotics executive
 * can agree or disagree with — not a benefit, a claim. Second, show the product
 * doing the one thing it does, which is turning a real place into something a
 * robot can be tested against.
 *
 * The comparator below the headline is the second job. A reader drags across a
 * real captured workcell and the same workcell rebuilt as a testbed. That is
 * the entire months 0–2 transformation in one gesture, and it needs no copy,
 * which is the point: the previous version of this page explained the product
 * in three paragraphs that the image makes redundant.
 *
 * Both media layers are real project assets. The motion reveals their
 * relationship; it does not invent one.
 */
import { useRef, useState } from "react";

import { ArrowRight, MoveHorizontal } from "lucide-react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";

import { cn } from "@/lib/utils";

export interface RunwayHeroReadout {
  value: string;
  label: string;
  tone?: "signal" | "cyan" | "red" | "text";
}

const readoutTone: Record<NonNullable<RunwayHeroReadout["tone"]>, string> = {
  signal: "text-runway-signal",
  cyan: "text-runway-cyan",
  red: "text-runway-red",
  text: "text-runway-text",
};

export function RunwayHero({
  eyebrow,
  title,
  titleLines,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  readouts,
  boundaryNote,
}: {
  eyebrow: string;
  title: string;
  /**
   * Optional authored line breaks for `title`. Greedy wrapping puts the break
   * wherever the box runs out, which strands the second half of a two-sentence
   * headline mid-line. When supplied, these render as blocks instead — joined
   * with a real space so the accessible name still equals `title` exactly.
   */
  titleLines?: readonly string[];
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  readouts: readonly RunwayHeroReadout[];
  boundaryNote: string;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [manualReveal, setManualReveal] = useState<number | null>(null);
  const [stage, setStage] = useState(0);
  const reduceMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 80%", "end 30%"],
  });

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const next = value < 0.4 ? 0 : value < 0.75 ? 1 : 2;
    setStage((current) => (current === next ? current : next));
  });

  const autoClip = useTransform(
    scrollYProgress,
    [0, 0.75],
    ["inset(0 62% 0 0)", "inset(0 8% 0 0)"],
  );
  const autoLine = useTransform(scrollYProgress, [0, 0.75], ["38%", "92%"]);

  const trackPointer = (clientX: number, element: HTMLElement) => {
    const bounds = element.getBoundingClientRect();
    setManualReveal(Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width)));
  };

  return (
    <section className="relative overflow-hidden bg-runway-black">
      <div aria-hidden="true" className="runway-grid absolute inset-0 opacity-70" />
      <div
        aria-hidden="true"
        className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-runway-signal/[0.07] blur-[120px]"
      />

      <div className="relative mx-auto max-w-[92rem] px-5 pb-14 pt-16 sm:px-8 lg:px-10 lg:pb-20 lg:pt-24">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)] lg:items-end lg:gap-16">
          <div>
            <p className="flex items-center gap-3 font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-runway-signal">
              <span
                aria-hidden="true"
                className="runway-pulse h-1.5 w-1.5 rounded-full bg-runway-signal"
              />
              {eyebrow}
            </p>
            <h1 className="mt-8 max-w-[24ch] text-[clamp(2.7rem,6vw,6rem)] font-semibold leading-[0.94] tracking-[-0.055em] text-runway-text">
              {titleLines && titleLines.length > 0
                ? titleLines.map((line, index) => (
                    <span key={line} className="block">
                      {line}
                      {index < titleLines.length - 1 ? " " : null}
                    </span>
                  ))
                : title}
            </h1>
          </div>

          <div className="lg:pb-3">
            <p className="max-w-[46ch] text-[clamp(1rem,1.2vw,1.15rem)] leading-[1.7] text-runway-mute">
              {body}
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a className="runway-cta" href={primaryHref}>
                {primaryLabel}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a className="runway-cta-ghost" href={secondaryHref}>
                {secondaryLabel}
              </a>
            </div>
            <p className="mt-6 max-w-[44ch] text-[13px] leading-6 text-runway-mute">
              {boundaryNote}
            </p>
          </div>
        </div>

        {/* Readout strip — the four numbers the rest of the page proves. */}
        <dl className="mt-14 grid gap-px border-y border-runway-line bg-runway-line sm:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {readouts.map((readout) => (
            <div key={readout.label} className="bg-runway-black px-1 py-6 sm:px-5">
              <dd
                className={cn(
                  "runway-num text-[clamp(1.8rem,3vw,2.6rem)] font-medium leading-none tracking-[-0.03em]",
                  readoutTone[readout.tone ?? "text"],
                )}
              >
                {readout.value}
              </dd>
              <dt className="mt-3.5 max-w-[26ch] text-[12.5px] leading-5 text-runway-mute">
                {readout.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>

      {/* The transformation, shown rather than described. */}
      <div ref={sectionRef} className="relative mx-auto max-w-[100rem] px-0 pb-16 sm:px-5 lg:px-8 lg:pb-24">
        <div
          className="group relative isolate min-h-[24rem] cursor-ew-resize touch-pan-y overflow-hidden bg-runway-deep sm:min-h-[32rem] sm:rounded-lg lg:min-h-[40rem]"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            trackPointer(event.clientX, event.currentTarget);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              trackPointer(event.clientX, event.currentTarget);
            }
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            setManualReveal(null);
          }}
        >
          <img
            src="/redesign/pov/packing-cell.jpg"
            alt="A packing workcell captured on site, from the operator's point of view"
            loading="eager"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,8,11,0.5),rgba(7,8,11,0.05)_38%,rgba(7,8,11,0.86))]"
          />

          <motion.div
            className="absolute inset-0"
            style={{
              clipPath:
                manualReveal === null
                  ? reduceMotion
                    ? "inset(0 45% 0 0)"
                    : autoClip
                  : `inset(0 ${(1 - manualReveal) * 100}% 0 0)`,
            }}
          >
            <img
              src="/kinetic/packing-cell-sim-twin.webp"
              alt="The same packing workcell rebuilt as a simulation-ready testbed"
              loading="eager"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,92,36,0.07),rgba(7,8,11,0.62))]"
            />
          </motion.div>

          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 z-10 w-px bg-runway-signal shadow-[0_0_16px_3px_rgba(255,92,36,0.65)]"
            style={{
              left:
                manualReveal === null
                  ? reduceMotion
                    ? "55%"
                    : autoLine
                  : `${manualReveal * 100}%`,
            }}
          />

          {/* Layer labels sit on the layer they name. */}
          <span className="pointer-events-none absolute left-4 top-4 z-20 rounded-sm border border-white/15 bg-runway-black/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-runway-text backdrop-blur-md sm:left-7 sm:top-7">
            Captured site
          </span>
          <span className="pointer-events-none absolute right-4 top-4 z-20 rounded-sm border border-runway-signal/40 bg-runway-black/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-runway-signal backdrop-blur-md sm:right-7 sm:top-7">
            Testbed
          </span>

          <span className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/15 bg-runway-black/60 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-runway-text opacity-90 backdrop-blur-md transition-opacity group-hover:opacity-0">
            <MoveHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Drag to inspect
          </span>

          <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-5 sm:px-7 sm:pb-7">
            <HeroProgress stage={stage} />
          </div>
        </div>
      </div>
    </section>
  );
}

const heroStages = ["Capture", "Recreate", "Evaluate"] as const;

/** The three-step rail under the comparator. Position is the label. */
function HeroProgress({ stage }: { stage: number }) {
  return (
    <div>
      <div className="relative h-px w-full bg-white/20">
        <motion.div
          className="absolute -top-px h-[2px] bg-runway-signal"
          animate={{ width: `${stage === 0 ? 20 : stage === 1 ? 62 : 100}%` }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <ol className="mt-4 grid grid-cols-3">
        {heroStages.map((label, index) => (
          <li
            key={label}
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.16em]",
              index === 1 && "text-center",
              index === 2 && "text-right",
              index <= stage ? "text-runway-signal" : "text-white/45",
            )}
          >
            <span className="runway-num mr-2">{`0${index + 1}`}</span>
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}
