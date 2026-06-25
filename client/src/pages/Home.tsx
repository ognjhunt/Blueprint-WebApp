import { SEO } from "@/components/SEO";
import {
  robotPolicyComparisonUseCases,
  robotPolicyEvaluationBoundary,
  robotPolicyResearchSignals,
} from "@/data/robotPolicyEvaluationClaims";
import { wamPolicyEvalAssets } from "@/lib/editorialGeneratedAssets";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Play,
  Trophy,
} from "lucide-react";

const startHref =
  "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&episodeCount=500&source=home";

const policies: Array<{
  label: string;
  rank: string;
  barWidth: string;
  state?: "winner";
}> = [
  { label: "Vendor B", rank: "1st", barWidth: "88%", state: "winner" },
  { label: "Team v4", rank: "2nd", barWidth: "66%" },
  { label: "Team v3", rank: "3rd", barWidth: "38%" },
];

const steps = [
  ["Capture site", "A real task pack."],
  ["Compare policies", "Your team, vendors, or checkpoints."],
  ["Pick next test", "Pilot, tune, recapture, or hold."],
];

const povClipTileClasses = [
  "lg:col-span-2 lg:row-span-2",
  "lg:col-span-1 lg:row-span-1",
  "lg:col-span-2 lg:row-span-1",
  "lg:col-span-1 lg:row-span-2",
  "lg:col-span-1 lg:row-span-1",
  "lg:col-span-2 lg:row-span-1",
  "lg:col-span-1 lg:row-span-1",
  "lg:col-span-1 lg:row-span-1",
  "lg:col-span-1 lg:row-span-1",
  "lg:col-span-1 lg:row-span-1",
  "lg:col-span-2 lg:row-span-1",
] as const;

function PovClipMosaic({
  className,
  decorative = false,
}: {
  className?: string;
  decorative?: boolean;
}) {
  return (
    <div
      aria-hidden={decorative ? "true" : undefined}
      className={`grid ${className ?? ""}`}
    >
      {wamPolicyEvalAssets.povClips.map((clip, index) => (
        <figure
          key={clip.src}
          className={`overflow-hidden rounded-md border border-white/10 bg-slate-900 shadow-[0_22px_60px_-44px_rgba(15,23,42,0.85)] ${
            povClipTileClasses[index] ?? ""
          }`}
        >
          <img
            src={clip.src}
            alt={decorative ? "" : clip.alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </figure>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Test Robot Policies Before Field Time"
        description="Blueprint helps robot teams and site operators compare policies on captured real-site task packs before field time without claiming deployment approval."
        canonical="/"
        image={`https://tryblueprint.io${wamPolicyEvalAssets.hero}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Blueprint Robot Policy Evaluation",
          description:
            "Capture-backed policy evaluation for comparing robot policies before field time.",
          url: "https://tryblueprint.io/",
        }}
      />

      <main className="bg-white text-slate-950">
        <section className="border-b border-slate-200" data-home-section="hero">
          <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-12 md:grid-cols-[0.82fr_1.18fr] md:items-center md:px-8 md:py-16">
            <div>
              <h1 className="max-w-[11ch] text-5xl font-semibold leading-[0.95] tracking-normal sm:text-6xl lg:text-7xl">
                Test robot policies before field time.
              </h1>
              <p className="mt-5 max-w-md text-lg leading-8 text-slate-600">
                Compare your policy against earlier checkpoints, another team,
                or a vendor runner on the same captured task pack.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={startHref}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Start
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href="/pricing"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-950 hover:bg-slate-50"
                >
                  See pricing
                </a>
              </div>
            </div>

            <figure className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.6)]">
              <img
                src={wamPolicyEvalAssets.hero}
                alt="Realistic humanoid robot moving a tote in a captured facility task"
                className="aspect-[16/9] w-full object-cover"
              />
              <figcaption className="absolute bottom-4 left-4 right-4 max-w-sm rounded-lg border border-white/45 bg-white/92 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-950">
                    Policy rank
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                    Winner
                  </span>
                </div>
                <div className="mt-3 grid gap-2">
                  {policies.map((policy) => (
                    <div key={policy.label} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-3 text-sm">
                      <span className="font-semibold">{policy.label}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <span
                          className={`block h-full rounded-full ${policy.state ? "bg-blue-600" : "bg-slate-400"}`}
                          style={{ width: policy.barWidth }}
                        />
                      </span>
                      <span className="text-right font-semibold">{policy.rank}</span>
                    </div>
                  ))}
                </div>
              </figcaption>
            </figure>
          </div>
        </section>

        <section id="how-it-works" className="border-b border-slate-200 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-4 px-5 py-8 md:grid-cols-3 md:px-8">
            {steps.map(([title, body], index) => (
              <article key={title} className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-sm font-semibold text-blue-700">
                  {index + 1}
                </div>
                <h2 className="mt-4 text-2xl font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-[88rem] gap-8 px-5 py-12 md:grid-cols-[0.82fr_1.18fr] md:items-center md:px-8">
          <div>
            <h2 className="max-w-xl text-4xl font-semibold leading-tight">
              Same task. Same robot. Clear comparison.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Compare your own policy versions or policies submitted by other
              teams under one captured site/task envelope before using robot
              time.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
              {["100 episodes", "500 episodes", "own or vendor policies"].map((item) => (
                <span key={item} className="rounded-lg border border-slate-200 px-3 py-2">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Failure", "What broke?"],
              ["OOD", "What changed?"],
              ["Site ops", "Who gets field time?"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <CheckCircle2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
                <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-[88rem] gap-4 px-5 py-10 md:grid-cols-3 md:px-8">
            {robotPolicyComparisonUseCases.map((item) => (
              <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-5">
                <h2 className="text-2xl font-semibold">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="relative overflow-hidden border-y border-slate-900 bg-slate-950 text-white"
          data-home-section="clips"
        >
          <div
            className="pointer-events-none absolute inset-y-0 right-0 hidden w-[72%] lg:block"
            aria-hidden="true"
          >
            <div className="absolute inset-0 z-10 bg-gradient-to-r from-slate-950 via-slate-950/65 to-slate-950/10" />
            <div
              className="absolute inset-0 opacity-85"
              style={{
                maskImage:
                  "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.35) 22%, black 46%, black 100%)",
                WebkitMaskImage:
                  "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.35) 22%, black 46%, black 100%)",
              }}
            >
              <PovClipMosaic
                decorative
                className="h-full grid-cols-5 auto-rows-fr gap-2 p-3"
              />
            </div>
          </div>

          <div className="relative z-20 mx-auto grid max-w-[88rem] gap-10 px-5 py-14 md:px-8 lg:min-h-[38rem] lg:grid-cols-[0.42fr_0.58fr] lg:items-center lg:py-20">
            <div className="max-w-xl">
              <h2 className="text-4xl font-semibold leading-tight sm:text-5xl">
                See the clips.
              </h2>
              <p className="mt-5 text-base leading-8 text-slate-300">
                Generated first-person POV clips make policy failures easier to
                review across factory, warehouse, industrial, and home-task
                variants. They are review media, not real-world proof.
              </p>
              <a
                href="/for-robot-teams"
                className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-slate-950 hover:bg-slate-100"
              >
                Evaluate
                <Play className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <PovClipMosaic className="grid-cols-2 auto-rows-[7.5rem] gap-2 sm:grid-cols-3 sm:auto-rows-[9rem] lg:hidden" />
          </div>
        </section>

        <section className="mx-auto grid max-w-[88rem] gap-4 px-5 py-10 md:grid-cols-[0.38fr_0.62fr] md:px-8">
          <div>
            <h2 className="text-3xl font-semibold">Why now.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Recent world-model evaluation work makes the ranking workflow
              credible enough to use as a decision aid, while the proof boundary
              still matters.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {robotPolicyResearchSignals.map((signal) => (
              <a
                key={signal.label}
                href={signal.href}
                className="rounded-lg border border-slate-200 bg-white p-5 hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-xl font-semibold">{signal.label}</h3>
                  <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-semibold text-blue-700">{signal.stat}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{signal.body}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 md:px-8">
          <p className="max-w-4xl text-sm font-semibold leading-6 text-slate-700">
            Boundary: {robotPolicyEvaluationBoundary}
          </p>
        </section>
      </main>
    </>
  );
}
