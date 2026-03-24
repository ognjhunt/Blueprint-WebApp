import { proofReelPosterSrc } from "@/lib/marketingProof";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Database,
  GitBranch,
  MapPinned,
} from "lucide-react";

const jobCards = [
  {
    title: "Run evals on the customer site",
    body: "Hold the geometry and task context steady so checkpoint comparisons mean something.",
    icon: BarChart3,
  },
  {
    title: "Generate site-grounded data",
    body: "Export rollouts, observations, and failures from the same place you plan to deploy.",
    icon: Database,
  },
  {
    title: "Branch controlled variations",
    body: "Change lighting, clutter, start states, and obstacles without losing the real-site anchor.",
    icon: GitBranch,
  },
];

const variationTags = [
  "Lighting shift",
  "Clutter spike",
  "Start-state change",
  "Obstacle injection",
];

export function SiteGroundedLoopGraphic() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(241,245,249,0.96))] p-5 shadow-[0_28px_90px_-54px_rgba(15,23,42,0.4)] sm:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,116,144,0.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_40%)]" />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Exact site to policy loop
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
              One real site becomes a reusable eval and data surface.
            </h2>
          </div>
          <div className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Exact site + controlled variation
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr_0.72fr_1.05fr] lg:items-center">
          <motion.article
            initial={shouldReduceMotion ? undefined : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-950 p-4 text-white"
          >
            <img
              src={proofReelPosterSrc}
              alt="Reference site view"
              className="absolute inset-0 h-full w-full object-cover opacity-35"
            />
            <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(15,23,42,0.35),rgba(15,23,42,0.88))]" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-100">
                <MapPinned className="h-3.5 w-3.5" />
                Exact customer site
              </div>
              <p className="mt-4 text-2xl font-semibold leading-tight">
                Real geometry, task lane, occlusions, and constraints.
              </p>
              <p className="mt-3 max-w-sm text-sm leading-7 text-slate-200">
                Start from the place the robot will actually face instead of a generic stand-in.
              </p>
            </div>
          </motion.article>

          <motion.div
            initial={shouldReduceMotion ? undefined : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="relative flex items-center justify-center py-2"
          >
            <div className="absolute inset-x-8 top-1/2 hidden h-px -translate-y-1/2 bg-[linear-gradient(90deg,rgba(15,23,42,0.15),rgba(15,23,42,0.55),rgba(15,23,42,0.15))] lg:block" />
            <div className="absolute top-1/2 hidden h-2 w-2 -translate-y-1/2 rounded-full bg-sky-500 lg:left-7 lg:block" />
            <div className="absolute top-1/2 hidden h-2 w-2 -translate-y-1/2 rounded-full bg-emerald-500 lg:right-7 lg:block" />

            <div className="relative flex h-44 w-44 items-center justify-center rounded-full border border-slate-200 bg-white shadow-[0_18px_60px_-40px_rgba(15,23,42,0.45)]">
              <div className="absolute inset-3 rounded-full border border-slate-200 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_56%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.12),transparent_54%)]" />
              <motion.div
                animate={
                  shouldReduceMotion
                    ? undefined
                    : {
                        rotate: 360,
                      }
                }
                transition={
                  shouldReduceMotion
                    ? undefined
                    : {
                        duration: 12,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "linear",
                      }
                }
                className="absolute inset-2 rounded-full border border-dashed border-slate-300"
              />
              <div className="relative flex flex-col items-center text-center">
                <div className="rounded-full bg-slate-950 p-3 text-white">
                  <BrainCircuit className="h-7 w-7" />
                </div>
                <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Site-grounded
                </p>
                <p className="mt-1 px-6 text-lg font-semibold leading-tight text-slate-950">
                  World model
                </p>
              </div>
            </div>
          </motion.div>

          <div className="grid gap-3">
            {jobCards.map((card, index) => {
              const Icon = card.icon;

              return (
                <motion.article
                  key={card.title}
                  initial={shouldReduceMotion ? undefined : { opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.12 + index * 0.08 }}
                  className="rounded-[1.5rem] border border-slate-200 bg-white/85 p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.45)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-2xl bg-slate-100 p-2.5 text-slate-800">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{card.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{card.body}</p>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>

        <motion.div
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.28 }}
          className="mt-5 rounded-[1.6rem] border border-slate-200 bg-white/85 p-4"
        >
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
            <span className="mr-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Variation layer
            </span>
            {variationTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span className="font-semibold text-slate-900">Exports back into the stack</span>
            <ArrowRight className="h-4 w-4 text-slate-400" />
            <span>rollout video</span>
            <span className="text-slate-300">/</span>
            <span>metrics</span>
            <span className="text-slate-300">/</span>
            <span>failure review</span>
            <span className="text-slate-300">/</span>
            <span>RLDS-style data</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
