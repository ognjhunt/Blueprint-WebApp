import { SEO } from "@/components/SEO";
import { humanoidReadinessAssets } from "@/lib/editorialGeneratedAssets";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const requestHref =
  "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&path=policy-evaluation-run&requestedOutputs=Policy%20Evaluation%20Run&episodeCount=500&source=home";

const steps = [
  ["Capture", "Use a real-site task pack."],
  ["Evaluate", "Run 100 / 500 virtual episodes."],
  ["Validate", "Pick the smallest useful field test."],
];

const outputs = [
  "Policy ranking, failures, OOD flags",
  "Generated rollout clips",
  "Validation targets for robot time",
];

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Robot Policy Evaluation"
        description="Blueprint runs WAM/VLA policy evaluations on captured real-site task packs before robot teams spend field time."
        canonical="/"
        image={`https://tryblueprint.io${humanoidReadinessAssets.warehouseHero}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Blueprint Robot Policy Evaluation",
          description:
            "WAM/VLA policy evaluation on captured real-site task packs before field time.",
          url: "https://tryblueprint.io/",
        }}
      />

      <main className="bg-white text-slate-950">
        <section className="border-b border-slate-200" data-home-section="hero">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 md:grid-cols-[1fr_0.9fr] md:items-center md:px-8 md:py-20">
            <div>
              <p className="text-sm font-semibold text-amber-700">Blueprint</p>
              <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight tracking-normal md:text-6xl">
                Evaluate robot policies before field time.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                Blueprint runs WAM/VLA policy evaluations on captured real-site
                task packs for robot teams comparing 1-3 policies or
                checkpoints.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/for-robot-teams"
                  className="inline-flex min-h-12 items-center justify-center gap-2 bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Create evaluation run
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href={requestHref}
                  className="inline-flex min-h-12 items-center justify-center border border-slate-300 px-5 text-sm font-semibold text-slate-950 hover:bg-slate-50"
                >
                  Request review
                </a>
              </div>
            </div>

            <figure className="overflow-hidden border border-slate-200 bg-slate-50">
              <img
                src={humanoidReadinessAssets.warehouseHero}
                alt="Humanoid robot carrying a tote in a warehouse evaluation task"
                className="aspect-[4/3] w-full object-cover"
              />
            </figure>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-7xl gap-4 px-5 py-10 md:grid-cols-3 md:px-8">
            {steps.map(([title, body]) => (
              <article key={title} className="border border-slate-200 bg-white p-5">
                <h2 className="text-xl font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[0.9fr_1.1fr] md:px-8">
          <div>
            <p className="text-sm font-semibold text-amber-700">Product</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight">
              Policy Evaluation Run
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              One site package, one task pack, one robot embodiment, and 100 or
              500 virtual episodes.
            </p>
          </div>

          <div className="grid gap-3">
            {outputs.map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 border border-slate-200 bg-white p-4"
              >
                <CheckCircle2
                  className="h-5 w-5 flex-none text-emerald-600"
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold text-slate-800">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-950 text-white">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 md:grid-cols-[1fr_auto] md:items-center md:px-8">
            <div>
              <h2 className="text-3xl font-semibold">Sites enter free.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Operators submit facilities and task ideas. Blueprint reviews
                rights, privacy, and evaluation fit before robot-team use.
              </p>
            </div>
            <a
              href="/contact/site-operator?source=home"
              className="inline-flex min-h-12 items-center justify-center bg-white px-5 text-sm font-semibold text-slate-950 hover:bg-slate-100"
            >
              Submit site free
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-12 md:px-8">
          <p className="mb-5 max-w-3xl text-sm font-semibold leading-6 text-slate-800">
            Robot teams pay for Policy Evaluation Runs, Validated Evaluation
            Packs, and Policy Improvement Runs. Site operators submit sites
            free.
          </p>
          <h2 className="text-3xl font-semibold">Precise boundaries.</h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            Virtual WAM/VLA results rank policies and reveal failure modes. They
            do not prove safety, deployment readiness, universal SRCC, or
            real-world success without paired validation.
          </p>
        </section>
      </main>
    </>
  );
}
