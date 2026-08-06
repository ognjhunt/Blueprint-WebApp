import { useRef, useState } from "react";

import {
  ArrowRightIcon,
  CheckIcon,
  CubeTransparentIcon,
  HandRaisedIcon,
} from "@heroicons/react/24/outline";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";

import { cn } from "@/lib/utils";

const runHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=kinetic-home";

const stages = [
  { number: "01", label: "Capture" },
  { number: "02", label: "Simulate" },
  { number: "03", label: "Decide" },
] as const;

/**
 * The homepage's primary product explanation. One scroll gesture advances the
 * same task from source capture to a simulation-ready twin and, finally, to a
 * bounded recommendation. The two media layers are real project assets; the
 * motion only reveals their relationship.
 */
export function KineticBenchmark() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStage, setActiveStage] = useState(0);
  const [manualReveal, setManualReveal] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const nextStage = value < 0.34 ? 0 : value < 0.7 ? 1 : 2;
    setActiveStage((current) => (current === nextStage ? current : nextStage));
  });

  const simClip = useTransform(
    scrollYProgress,
    [0.18, 0.62],
    ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
  );
  const scanLeft = useTransform(scrollYProgress, [0.18, 0.62], ["0%", "100%"]);
  const resultOpacity = useTransform(scrollYProgress, [0.65, 0.8], [0, 1]);
  const resultY = useTransform(scrollYProgress, [0.65, 0.8], [24, 0]);
  const railScale = useTransform(scrollYProgress, [0.06, 0.9], [0.02, 1]);

  const updateManualReveal = (clientX: number, element: HTMLElement) => {
    const bounds = element.getBoundingClientRect();
    const next = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
    setManualReveal(next);
  };

  return (
    <section ref={sectionRef} className="relative bg-kinetic-white">
      <div className="mx-auto grid max-w-[94rem] gap-12 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[minmax(0,1fr)_9rem] lg:gap-14 lg:px-10 lg:pb-24 lg:pt-20">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-kinetic-blue">
            Field-to-sim evaluation
          </p>
          <h1 className="mt-7 max-w-[19ch] text-[clamp(3.15rem,7.1vw,7.4rem)] font-semibold leading-[0.93] tracking-[-0.064em] text-kinetic-graphite">
            Turn one site walkthrough into a robot benchmark by tomorrow.
          </h1>
          <p className="mt-8 max-w-[42rem] text-[clamp(1rem,1.35vw,1.22rem)] leading-[1.65] text-kinetic-muted">
            Capture a prospective pilot location. Blueprint rebuilds the task in
            simulation, runs your checkpoints, and returns a decision-ready report
            in 12–24 hours.
          </p>
          <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a className="kinetic-button-primary" href={runHref}>
              Scope a benchmark
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </a>
            <a className="kinetic-text-link" href="/proof">
              See a sample result
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
          <p className="mt-5 text-sm text-kinetic-faint">Fixed-scope runs from $2,500</p>
        </div>

        <StageRail
          activeStage={activeStage}
          progress={railScale}
          className="hidden lg:block"
        />
      </div>

      <div className="relative lg:h-[178vh]">
        <div className="lg:sticky lg:top-[4.25rem]">
          <div className="mx-auto max-w-[100rem] px-0 lg:px-5">
            <div
              className="group relative isolate min-h-[34rem] cursor-ew-resize touch-pan-y overflow-hidden bg-[#07121d] shadow-[0_34px_90px_-44px_rgba(4,13,25,0.62)] sm:min-h-[42rem] lg:h-[calc(100vh-5.75rem)] lg:min-h-[42rem] lg:max-h-[60rem] lg:rounded-[1.65rem]"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                updateManualReveal(event.clientX, event.currentTarget);
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  updateManualReveal(event.clientX, event.currentTarget);
                }
              }}
              onPointerUp={(event) => {
                event.currentTarget.releasePointerCapture(event.pointerId);
                setManualReveal(null);
              }}
            >
            <img
              src="/redesign/pov/packing-cell.jpg"
              alt="A prospective packing-cell pilot captured from the operator's point of view"
              loading="eager"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(5,12,20,0.22),rgba(5,12,20,0.02)_40%,rgba(5,12,20,0.74))]" />

            <motion.div
              className="absolute inset-0"
              style={{
                clipPath:
                  manualReveal === null
                    ? reduceMotion
                      ? "inset(0 42% 0 0)"
                      : simClip
                    : `inset(0 ${(1 - manualReveal) * 100}% 0 0)`,
              }}
            >
              <img
                src="/kinetic/packing-cell-sim-twin.webp"
                alt="The same packing cell rebuilt as a simulation-ready task environment"
                loading="eager"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,24,60,0.04),rgba(0,16,38,0.42))]" />
            </motion.div>

            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 z-10 w-px bg-white shadow-[0_0_14px_3px_rgba(82,197,255,0.9)]"
              style={{
                left:
                  manualReveal === null
                    ? reduceMotion
                      ? "58%"
                      : scanLeft
                    : `${manualReveal * 100}%`,
              }}
            />

            <div className="pointer-events-none absolute left-5 top-5 z-20 inline-flex items-center gap-3 rounded-full border border-white/20 bg-[#06111d]/55 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.18em] text-white backdrop-blur-xl sm:left-8 sm:top-8">
              <HandRaisedIcon className="h-4 w-4" aria-hidden="true" />
              Drag to inspect
            </div>

            <div className="absolute bottom-5 left-5 right-5 z-20 sm:bottom-8 sm:left-8 sm:right-8">
              <KineticTimeline activeStage={activeStage} />
            </div>

            <motion.div
              className="absolute bottom-28 right-5 z-20 w-[min(22rem,calc(100%-2.5rem))] rounded-xl border border-white/20 bg-[#07121d]/85 p-5 text-white shadow-2xl backdrop-blur-xl sm:bottom-32 sm:right-8 sm:p-6"
              style={
                reduceMotion
                  ? undefined
                  : {
                      opacity: resultOpacity,
                      y: resultY,
                    }
              }
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">
                Illustrative recommendation
              </p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xl font-semibold tracking-[-0.025em]">Checkpoint A</p>
                  <p className="mt-1 text-lg text-kinetic-cyan">Take to site</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-kinetic-blue text-kinetic-cyan">
                  <CheckIcon className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
            </motion.div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[94rem] px-5 pb-20 pt-8 sm:px-8 lg:px-10 lg:pb-28 lg:pt-12">
        <div className="grid border-t border-kinetic-line md:grid-cols-3">
          {[
            {
              number: "01",
              title: "Walk the site",
              body: "Capture the task area with an iPhone Pro or 360 camera.",
            },
            {
              number: "02",
              title: "We build + run",
              body: "We reconstruct the task, vary the conditions, and run your checkpoints.",
            },
            {
              number: "03",
              title: "You get the decision",
              body: "See the ranking, likely failure modes, and what to take into the physical pilot.",
            },
          ].map((step, index) => (
            <article
              key={step.number}
              className={cn(
                "relative py-8 md:min-h-[15rem] md:px-10",
                index === 0 ? "md:pl-0" : "border-t border-kinetic-line md:border-l md:border-t-0",
              )}
            >
              <p className={cn("font-mono text-lg", index === 0 ? "text-kinetic-blue" : "text-kinetic-faint")}>
                {step.number}
              </p>
              <div className={cn("mt-3 h-px w-full", index === 0 ? "bg-kinetic-blue" : "bg-kinetic-line")} />
              <h2 className="mt-6 text-[clamp(1.7rem,2.6vw,2.45rem)] font-semibold leading-none tracking-[-0.045em] text-kinetic-graphite">
                {step.title}
              </h2>
              <p className="mt-4 max-w-[25rem] text-[15px] leading-7 text-kinetic-muted">{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function StageRail({
  activeStage,
  progress,
  className,
}: {
  activeStage: number;
  progress: MotionValue<number>;
  className?: string;
}) {
  return (
    <aside className={cn("relative min-h-[23rem] pl-8", className)} aria-label="Benchmark stages">
      <span aria-hidden="true" className="absolute bottom-0 left-0 top-0 w-px bg-kinetic-line" />
      <motion.span
        aria-hidden="true"
        className="absolute left-0 top-0 h-full w-px origin-top bg-kinetic-blue"
        style={{ scaleY: progress }}
      />
      <div className="flex h-full flex-col justify-between">
        {stages.map((stage, index) => (
          <div key={stage.number} className="relative">
            <span
              aria-hidden="true"
              className={cn(
                "absolute -left-[2.14rem] top-2 h-2 w-2 rounded-full transition-colors duration-500",
                index <= activeStage ? "bg-kinetic-blue" : "bg-kinetic-faint",
              )}
            />
            <p className={cn("font-mono text-base", index === activeStage ? "text-kinetic-blue" : "text-kinetic-faint")}>
              {stage.number}
            </p>
            <p className={cn("mt-1 text-[10px] font-semibold uppercase tracking-[0.14em]", index === activeStage ? "text-kinetic-blue" : "text-kinetic-faint")}>
              {stage.label}
            </p>
          </div>
        ))}
      </div>
    </aside>
  );
}

function KineticTimeline({ activeStage }: { activeStage: number }) {
  return (
    <div className="text-white">
      <div className="flex items-center gap-4">
        <span className="hidden font-mono text-[10px] tabular-nums text-white/75 sm:block">00:00:00</span>
        <div className="relative h-px flex-1 bg-white/35">
          <motion.div
            className="absolute -top-px left-0 h-[3px] bg-gradient-to-r from-kinetic-cyan to-kinetic-blue"
            animate={{ width: `${activeStage === 0 ? 18 : activeStage === 1 ? 63 : 100}%` }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          />
          {[18, 63, 100].map((point, index) => (
            <span
              key={point}
              className={cn(
                "absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border",
                index <= activeStage
                  ? "border-white bg-kinetic-cyan"
                  : "border-white/50 bg-[#07121d]",
              )}
              style={{ left: `${point}%` }}
            />
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 font-mono text-[9px] uppercase tracking-[0.13em] text-white/65 sm:text-[10px]">
        <span>Capture start</span>
        <span className="text-center">Simulation runs</span>
        <span className="text-right">Results ready · 12–24h</span>
      </div>
    </div>
  );
}

export function ResultDecisionPanel() {
  return (
    <section className="overflow-hidden bg-kinetic-dark text-white">
      <div className="mx-auto grid max-w-[94rem] gap-16 px-5 py-20 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:px-10 lg:py-28">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-kinetic-cyan">The output</p>
          <h2 className="mt-6 max-w-[13ch] text-[clamp(2.7rem,5.2vw,5.6rem)] font-semibold leading-[0.96] tracking-[-0.058em]">
            Know what deserves the pilot.
          </h2>
          <p className="mt-7 max-w-[32rem] text-lg leading-8 text-white/62">
            Find likely failure modes while they are still cheap to fix. Then use
            the real site to validate the candidate that earned the trip.
          </p>
          <div className="mt-9 flex items-center gap-3 text-sm text-white/58">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/35">
              <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            Paired physical validation
          </div>
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/[0.025] p-3 sm:p-5">
          <div className="mb-4 flex items-center justify-between px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white/42">
            <span>Illustrative result</span>
            <span>Task / pack-cell-07</span>
          </div>
          {[
            { label: "Checkpoint A", result: "Take to site", selected: true },
            { label: "Checkpoint B", result: "Fix perception first", selected: false },
            { label: "Checkpoint C", result: "Hold", selected: false },
          ].map((candidate) => (
            <div
              key={candidate.label}
              className={cn(
                "mb-3 grid min-h-[5.25rem] grid-cols-[auto_1fr_auto] items-center gap-5 rounded-xl border px-4 sm:px-6",
                candidate.selected
                  ? "border-kinetic-blue bg-kinetic-blue/[0.045]"
                  : "border-white/16 bg-white/[0.015]",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border",
                  candidate.selected
                    ? "border-kinetic-blue bg-kinetic-blue text-white"
                    : "border-white/35 text-white/45",
                )}
              >
                {candidate.selected ? (
                  <CheckIcon className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <span aria-hidden="true" className="h-px w-3 bg-current" />
                )}
              </span>
              <span className="text-lg font-medium tracking-[-0.02em] sm:text-2xl">{candidate.label}</span>
              <span className={cn("text-right text-sm sm:text-lg", candidate.selected ? "text-kinetic-cyan" : "text-white/55")}>
                {candidate.result}
              </span>
            </div>
          ))}
          <div className="mt-5 flex items-center gap-3 px-2 text-xs leading-5 text-white/42">
            <CubeTransparentIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
            Results include uncertainty, failure slices, and an explicit abstention when the evidence cannot separate candidates.
          </div>
        </div>
      </div>
    </section>
  );
}
