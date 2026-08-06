import {
  ArrowRightIcon,
  CameraIcon,
  ChartBarSquareIcon,
  CubeTransparentIcon,
} from "@heroicons/react/24/outline";

import { SEO } from "@/components/SEO";
import {
  KineticBenchmark,
  ResultDecisionPanel,
} from "@/components/site/KineticBenchmark";
import { Reveal } from "@/components/site/motion";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const runHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=home";

const artifacts = [
  {
    number: "01",
    eyebrow: "Captured task",
    title: "The real site stays the reference.",
    body: "Geometry, task objects, access boundaries, and the conditions that matter to the decision.",
    image: "/redesign/pov/packing-cell.jpg",
    alt: "A packing cell captured from the operator point of view",
    Icon: CameraIcon,
  },
  {
    number: "02",
    eyebrow: "Simulation-ready twin",
    title: "The task becomes testable.",
    body: "SimReady objects, calibrated variation, lighting, and scenarios built around the job—not a generic scene.",
    image: "/kinetic/packing-cell-sim-twin.webp",
    alt: "A simulation-ready reconstruction of the same packing cell",
    Icon: CubeTransparentIcon,
  },
  {
    number: "03",
    eyebrow: "Decision packet",
    title: "The evidence becomes actionable.",
    body: "Ranking, uncertainty, failure slices, and what each checkpoint needs before the physical pilot.",
    image: "/generated/wam-policy-eval-2026-06-21/figure03-style-rollout-strip.png",
    alt: "An illustrative strip of robot policy evaluation rollouts",
    Icon: ChartBarSquareIcon,
  },
] as const;

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Turn a site walkthrough into a robot benchmark"
        description="Blueprint captures a prospective pilot site, rebuilds the task in simulation, runs your checkpoints, and returns a decision-ready evaluation before field time."
        canonical="/"
        jsonLd={[
          webPageJsonLd({
            path: "/",
            name: "Blueprint field-to-sim robot benchmarks",
            description:
              "A fixed-scope Task Evaluation Run that turns a real site walkthrough into a simulation-ready benchmark and bounded robot-policy decision.",
          }),
        ]}
      />

      <KineticBenchmark />

      <section className="bg-white">
        <div className="mx-auto max-w-[94rem] px-5 py-20 sm:px-8 lg:px-10 lg:py-32">
          <Reveal>
            <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
              <div>
                <p className="kinetic-eyebrow">What gets built</p>
                <h2 className="mt-6 max-w-[13ch] text-[clamp(2.8rem,5.6vw,6.2rem)] font-semibold leading-[0.94] tracking-[-0.06em] text-kinetic-graphite">
                  One walk. Three decision artifacts.
                </h2>
              </div>
              <p className="max-w-[38rem] pb-2 text-lg leading-8 text-kinetic-muted lg:justify-self-end">
                You bring the site-task and the checkpoints. Blueprint handles the
                reconstruction, simulation design, evaluation runs, and report.
              </p>
            </div>
          </Reveal>

          <div className="mt-16 grid gap-7 lg:grid-cols-3">
            {artifacts.map((artifact, index) => (
              <Reveal key={artifact.number} delay={index * 0.07}>
                <article className="group">
                  <div className="relative overflow-hidden rounded-2xl bg-kinetic-dark">
                    <img
                      src={artifact.image}
                      alt={artifact.alt}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover transition duration-700 ease-out group-hover:scale-[1.025]"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08111d]/55 via-transparent to-transparent" />
                    <span className="absolute left-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[#06111d]/50 text-white backdrop-blur-xl">
                      <artifact.Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="absolute bottom-5 left-5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/78">
                      {artifact.number} · {artifact.eyebrow}
                    </span>
                  </div>
                  <h3 className="mt-7 max-w-[15ch] text-[clamp(1.65rem,2.5vw,2.35rem)] font-semibold leading-[1.02] tracking-[-0.045em] text-kinetic-graphite">
                    {artifact.title}
                  </h3>
                  <p className="mt-4 max-w-[29rem] text-[15px] leading-7 text-kinetic-muted">
                    {artifact.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <ResultDecisionPanel />

      <section className="bg-kinetic-white">
        <div className="mx-auto max-w-[94rem] px-5 py-20 sm:px-8 lg:px-10 lg:py-32">
          <Reveal>
            <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div className="relative overflow-hidden rounded-2xl bg-kinetic-dark shadow-[0_30px_80px_-46px_rgba(9,18,29,0.65)]">
                <img
                  src="/generated/wam-policy-eval-2026-06-21/figure03-style-hero.png"
                  alt="An illustrative humanoid robot evaluation environment"
                  loading="lazy"
                  className="aspect-[16/11] w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-[#06111d]/85 to-transparent px-6 pb-6 pt-20 text-white">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/55">Evidence envelope</p>
                    <p className="mt-2 text-lg font-medium">Simulation + paired site check</p>
                  </div>
                  <span className="rounded-full border border-white/25 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.13em] text-white/72">
                    Illustrative
                  </span>
                </div>
              </div>

              <div>
                <p className="kinetic-eyebrow">Built for a decision</p>
                <h2 className="mt-6 max-w-[14ch] text-[clamp(2.7rem,5vw,5.25rem)] font-semibold leading-[0.96] tracking-[-0.058em] text-kinetic-graphite">
                  More signal before anyone books the robot.
                </h2>
                <p className="mt-7 max-w-[36rem] text-lg leading-8 text-kinetic-muted">
                  A run is not a synthetic demo or a claim that simulation replaces
                  reality. It is a faster way to eliminate weak candidates, expose
                  uncertainty, and arrive at pilot day with a sharper question.
                </p>
                <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-kinetic-line bg-kinetic-line">
                  {[
                    ["12–24h", "Target turnaround"],
                    ["$2,500+", "Fixed-scope starting point"],
                    ["1 task", "One decision boundary"],
                    ["Explicit", "Uncertainty or abstention"],
                  ].map(([value, label]) => (
                    <div key={label} className="bg-white p-5 sm:p-6">
                      <dt className="text-[clamp(1.45rem,2.3vw,2.2rem)] font-semibold tracking-[-0.04em] text-kinetic-graphite">{value}</dt>
                      <dd className="mt-2 text-xs leading-5 text-kinetic-muted">{label}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="relative isolate overflow-hidden bg-kinetic-blue text-white">
        <img
          src="/kinetic/packing-cell-sim-twin.webp"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover opacity-[0.14] mix-blend-screen"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-kinetic-blue via-kinetic-blue/95 to-[#003dff]/75" />
        <div className="relative mx-auto grid max-w-[94rem] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10 lg:py-24">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">The next pilot</p>
            <h2 className="mt-5 max-w-[18ch] text-[clamp(2.65rem,5vw,5.25rem)] font-semibold leading-[0.96] tracking-[-0.058em]">
              Use pilot day to validate—not to discover.
            </h2>
          </div>
          <a
            href={runHref}
            className="inline-flex min-h-14 items-center justify-center gap-5 rounded-lg bg-white px-7 text-[15px] font-semibold text-kinetic-graphite shadow-xl transition duration-300 hover:-translate-y-0.5 hover:bg-kinetic-white"
          >
            Plan your first benchmark
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>
    </>
  );
}
