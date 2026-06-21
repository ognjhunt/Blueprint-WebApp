import { SEO } from "@/components/SEO";
import { wamPolicyEvalAssets } from "@/lib/editorialGeneratedAssets";
import { ArrowRight, CheckCircle2, Play, Trophy } from "lucide-react";

const startHref =
  "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&episodeCount=500&source=home";

const policies = [
  ["Policy B", "82%", "winner"],
  ["Policy A", "61%", ""],
  ["Policy C", "32%", ""],
];

const steps = [
  ["Capture site", "A real task pack."],
  ["Run policies", "100 or 500 episodes."],
  ["Pick winner", "Know what to test next."],
];

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Test Robot Policies Before Field Time"
        description="Blueprint helps robot teams test and rank 1-3 policies on captured real-site task packs before field time."
        canonical="/"
        image={`https://tryblueprint.io${wamPolicyEvalAssets.hero}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Blueprint Robot Policy Evaluation",
          description:
            "Capture-backed policy evaluation for ranking robot policies before field time.",
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
                Use captured real-site tasks to see what works.
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
                    Policy score
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                    Winner
                  </span>
                </div>
                <div className="mt-3 grid gap-2">
                  {policies.map(([label, score, state]) => (
                    <div key={label} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-3 text-sm">
                      <span className="font-semibold">{label}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <span
                          className={`block h-full rounded-full ${state ? "bg-blue-600" : "bg-slate-400"}`}
                          style={{ width: score }}
                        />
                      </span>
                      <span className="text-right font-semibold">{score}</span>
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
              Same task. Same robot. Clear winner.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
              Compare 1-3 policies on one captured task pack before using robot
              time.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
              {["100 episodes", "500 episodes", "1-3 policies"].map((item) => (
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
              ["Next test", "Where to try?"],
            ].map(([title, body]) => (
              <div key={title} className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                <CheckCircle2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
                <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-950 text-white">
          <div className="mx-auto grid max-w-[88rem] gap-6 px-5 py-10 md:grid-cols-[1fr_auto] md:items-center md:px-8">
            <div>
              <h2 className="text-3xl font-semibold">See the clips.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Generated clips help review results. They are not real-world
                proof.
              </p>
            </div>
            <a
              href="/for-robot-teams"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-slate-950 hover:bg-slate-100"
            >
              Evaluate
              <Play className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 md:px-8">
          <p className="max-w-4xl text-sm font-semibold leading-6 text-slate-700">
            Boundary: virtual results guide what to test next. They do not
            approve deployment, safety, or guaranteed real-world success.
          </p>
        </section>
      </main>
    </>
  );
}
