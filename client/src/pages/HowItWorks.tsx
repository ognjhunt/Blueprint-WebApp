import { SEO } from "@/components/SEO";
import { ScrollReveal, StaggerGroup } from "@/components/motion";
import { ArrowRight, BarChart3, Database, GitBranch, MapPinned } from "lucide-react";

const loopSteps = [
  {
    title: "Anchor to the exact site",
    description:
      "Blueprint starts from one real facility and one real workflow, so geometry, constraints, and task context are not guesses.",
    icon: MapPinned,
  },
  {
    title: "Branch realistic variations",
    description:
      "Once the site is grounded, teams can change lighting, clutter, start states, and other conditions without losing the real-site anchor.",
    icon: GitBranch,
  },
  {
    title: "Run, score, and compare",
    description:
      "Hosted evaluation gives teams reruns, metrics, failure review, and release comparison on the same site instead of across disconnected demos.",
    icon: BarChart3,
  },
  {
    title: "Export data back into the stack",
    description:
      "The useful output is not the walkthrough alone. It is the rollout data, failure cases, and site-grounded evidence you feed back into training and deployment decisions.",
    icon: Database,
  },
];

const comparisonRows = [
  {
    title: "Generic simulation",
    bestFor: "Broad pretraining and early iteration",
    weakOn: "Customer-specific geometry, task semantics, and failure modes",
  },
  {
    title: "Exact site only",
    bestFor: "Reviewing the real place and checking basic fit",
    weakOn: "Edge-case probing if the environment stays static",
  },
  {
    title: "Exact site plus controlled variation (Blueprint)",
    bestFor: "Policy fine-tuning, site-specific training data, and release comparison before deployment",
    weakOn: "Nothing here replaces final on-site safety validation",
  },
];

const useCaseCards = [
  {
    title: "Pre-deployment evals",
    body:
      "Run the real task on the real site before the first travel-heavy customer week starts.",
  },
  {
    title: "Policy adaptation",
    body:
      "Use site-grounded exports to adjust the stack around the place the robot actually needs to work.",
  },
  {
    title: "Regression checks",
    body:
      "Compare releases on the same site so weak updates show up before they reach the field.",
  },
  {
    title: "Customer readiness",
    body:
      "Show operators, buyers, and internal teams the exact site and the expected robot behavior in the same surface.",
  },
];

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-slate-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern-how"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill="url(#grid-pattern-how)" />
    </svg>
  );
}

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How It Works | Blueprint"
        description="Why site-grounded world models improve robot evaluation: anchor to the exact site, branch controlled variations, and export the results back into the stack."
        canonical="/how-it-works"
      />

      <div className="relative min-h-screen bg-white text-slate-900">
        <DotPattern />

        <section className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(8,145,178,0.08),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,244,245,0.96))] pb-16 pt-14 sm:pb-20 sm:pt-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium uppercase tracking-wider text-slate-600">
                How It Works
              </div>
              <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
                Policies trained on exact sites consistently outperform generic simulation.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                MIT's RialTo showed 50-200% policy improvement when training on reconstructed
                target environments. SGFT and similar sim-to-real work found the same pattern.
                Blueprint starts from one real customer site and adds controlled variation
                around it.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/world-models"
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Explore world models
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href="/contact?persona=robot-team&interest=evaluation-package"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Request hosted evaluation
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-slate-200 bg-slate-50/60 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="mb-10 max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  The operating idea
                </p>
                <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
                  Exact site plus controlled variation is the training loop that works.
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  The exact site is a strong anchor, but the biggest lift comes when teams can
                  rerun the task under realistic variations and feed those results back into
                  their training stack.
                </p>
              </div>
            </ScrollReveal>

            <StaggerGroup className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" stagger={0.08}>
              {loopSteps.map((item) => {
                const Icon = item.icon;

                return (
                  <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-800">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  </article>
                );
              })}
            </StaggerGroup>
          </div>
        </section>

        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Comparison
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  Where Blueprint fits in your training pipeline
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  Generic simulation is still useful. Final on-site validation is still necessary.
                  Blueprint sits in the middle, where one exact site can answer real deployment
                  questions before the expensive part starts.
                </p>
              </div>
            </ScrollReveal>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {comparisonRows.map((row, index) => (
                <article
                  key={row.title}
                  className={`rounded-2xl border p-6 ${
                    index === 2 ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white"
                  }`}
                >
                  <h3 className={`text-2xl font-semibold ${index === 2 ? "text-white" : "text-slate-950"}`}>
                    {row.title}
                  </h3>
                  <div className="mt-5 space-y-4 text-sm leading-7">
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${index === 2 ? "text-slate-300" : "text-slate-500"}`}>
                        Best for
                      </p>
                      <p className={index === 2 ? "text-slate-100" : "text-slate-700"}>{row.bestFor}</p>
                    </div>
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${index === 2 ? "text-slate-300" : "text-slate-500"}`}>
                        Watch-out
                      </p>
                      <p className={index === 2 ? "text-slate-200" : "text-slate-600"}>{row.weakOn}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-slate-50/60 py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Common jobs
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  What teams train and ship with this
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  These are the practical jobs that matter once a robotics team starts working
                  against one specific customer site.
                </p>
              </div>
            </ScrollReveal>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {useCaseCards.map((item) => (
                <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <ScrollReveal as="section" className="mx-auto max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-slate-950 p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Start with one real site and one deployment question.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
              That is enough to decide whether you need the package, hosted evaluation, or a custom
              engagement. The rest of the workflow gets much cleaner once the site is grounded.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href="/world-models"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Explore world models
              </a>
              <a
                href="/sample-deliverables"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                See sample deliverables
              </a>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </>
  );
}
