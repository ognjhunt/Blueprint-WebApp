import { useEffect, useState } from "react";
import { SEO } from "@/components/SEO";
import { ScrollReveal, StaggerGroup } from "@/components/motion";
import { illustrativeLabel } from "@/data/marketingDefinitions";
import { caseStudies } from "@/data/content";
import { analyticsEvents } from "@/lib/analytics";
import { resolveExperimentVariant } from "@/lib/experiments";
import { proofReferenceImageSrc, proofReelPosterSrc, publicDemoHref } from "@/lib/marketingProof";
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
      "Teams can rerun policies, inspect failures, compare checkpoints, and decide what to export back into training on the same exact environment.",
    icon: BarChart3,
  },
  {
    title: "Export data back into the stack",
    description:
      "The walkthrough alone is not the useful output. The rollout data, failure cases, and site-grounded evidence are what you feed back into training and deployment decisions.",
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
    bestFor: "Grounding to the real geometry and checking basic fit",
    weakOn: "Fine-tuning and edge-case probing if the environment stays static",
  },
  {
    title: "Exact site plus controlled variation (Blueprint)",
    bestFor: "Policy fine-tuning, site-specific training data, and release comparison before deployment",
    weakOn: "Still requires final on-site safety validation",
  },
];

const useCaseCards = [
  {
    title: "Pre-deployment training",
    body:
      "Use the real site as the training anchor before the first travel-heavy customer week starts.",
  },
  {
    title: "Policy fine-tuning",
    body:
      "Adapt the stack around the place the robot actually needs to work instead of tuning against a generic scene.",
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

const proofChain = [
  {
    title: "Real site capture",
    body: "Start from the actual facility and workflow lane instead of an abstract scene.",
  },
  {
    title: "Sample package manifest",
    body: "Show the site package contract, freshness, rights class, and export set before a buyer commits.",
  },
  {
    title: "Hosted run review",
    body: "Use the same exact site for run review, failure analysis, checkpoint comparison, and buyer-visible iteration.",
  },
  {
    title: "Export bundle",
    body: "Move from run review into representative export objects tied to the same listing.",
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

/** Inline SVG diagram showing the 4-step loop visually */
function LoopDiagram() {
  return (
    <div className="mx-auto mt-10 max-w-3xl">
      <svg viewBox="0 0 800 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" aria-label="Four-step loop: Anchor, Branch, Run/Score, Export">
        {/* Step circles */}
        {[
          { cx: 100, label: "Anchor", color: "#0e7490" },
          { cx: 300, label: "Branch", color: "#0e7490" },
          { cx: 500, label: "Run / Score", color: "#0e7490" },
          { cx: 700, label: "Export", color: "#0e7490" },
        ].map((step, i) => (
          <g key={step.label}>
            {/* Connector line */}
            {i < 3 && (
              <line
                x1={step.cx + 36}
                y1={50}
                x2={step.cx + 164}
                y2={50}
                stroke="#cbd5e1"
                strokeWidth={2}
                strokeDasharray="6 4"
              />
            )}
            {/* Circle */}
            <circle cx={step.cx} cy={50} r={36} fill={step.color} opacity={0.08} />
            <circle cx={step.cx} cy={50} r={36} stroke={step.color} strokeWidth={2} fill="none" opacity={0.3} />
            {/* Step number */}
            <text x={step.cx} y={46} textAnchor="middle" fill={step.color} fontSize={16} fontWeight={700}>
              {i + 1}
            </text>
            {/* Label */}
            <text x={step.cx} y={106} textAnchor="middle" fill="#334155" fontSize={13} fontWeight={600}>
              {step.label}
            </text>
          </g>
        ))}
        {/* Return arrow from Export back to Anchor */}
        <path
          d="M 700 18 Q 700 -10 400 -10 Q 100 -10 100 14"
          stroke="#0e7490"
          strokeWidth={1.5}
          fill="none"
          strokeDasharray="4 3"
          opacity={0.35}
        />
        <polygon points="100,14 96,6 104,6" fill="#0e7490" opacity={0.35} />
      </svg>
    </div>
  );
}

export default function HowItWorks() {
  const [formatVariant, setFormatVariant] = useState<"steps" | "video">("steps");

  useEffect(() => {
    let cancelled = false;

    void resolveExperimentVariant("how_it_works_format", ["steps", "video"]).then((variant) => {
      if (cancelled) {
        return;
      }
      const resolved = variant === "video" ? "video" : "steps";
      setFormatVariant(resolved);
      analyticsEvents.experimentExposure("how_it_works_format", resolved, "page_load");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const stepSection = formatVariant === "video" ? (
    <>
      <ScrollReveal>
        <div className="mb-10 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            The operating idea
          </p>
          <h2 className="mt-3 text-3xl font-bold text-slate-950 sm:text-4xl">
            See the exact-site workflow first, then inspect the training loop.
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Blueprint keeps the site anchor truthful, then layers the hosted-review story and
            controlled variation on top of the same facility.
          </p>
        </div>
      </ScrollReveal>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-sm">
        <video
          src="/proof/blueprint-proof-reel.mp4"
          poster="/proof/blueprint-proof-reel-poster.jpg"
          controls
          playsInline
          className="w-full"
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
      </div>
    </>
  ) : (
    <>
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

      <ScrollReveal>
        <LoopDiagram />
      </ScrollReveal>

      <StaggerGroup className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4" stagger={0.08}>
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
    </>
  );

  return (
    <>
      <SEO
        title="How It Works | Blueprint"
        description="Why site-grounded world models improve robot training: anchor to the exact site, branch controlled variations, and export the results back into the stack."
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
                Exact-site world models beat generic simulation when deployment gets specific.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
                Blueprint starts from one real customer site and adds controlled variation around
                it for fine-tuning, exact-site data generation, and checkpoint comparison. Research
                like{" "}
                <a
                  href="https://arxiv.org/abs/2308.14711"
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4"
                >
                  MIT's RialTo
                </a>{" "}
                helps explain why that matters: target-environment training tends to beat generic
                scenes when the deployment question depends on one exact facility.
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
                  href="/exact-site-hosted-review"
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
            {stepSection}
          </div>
        </section>

        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Proof chain
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  Proof chain, not just product philosophy.
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  The buyer path should move from real site evidence to package contract to hosted run review to export artifacts. The proof chain matters more than any abstract positioning claim.
                </p>
              </div>
            </ScrollReveal>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.05fr]">
              <article className="rounded-3xl border border-slate-200 bg-white p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <img
                      src={proofReelPosterSrc}
                      alt="Real site capture"
                      className="aspect-[16/10] w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <img
                      src={proofReferenceImageSrc}
                      alt="Hosted run review"
                      className="aspect-[16/10] w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {proofChain.map((item) => (
                    <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-white">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Proof path
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight">
                  Exact-site proof vs adjacent-site proof
                </h2>
                <div className="mt-5 grid gap-4">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
                    <p className="text-sm font-semibold text-white">Exact-site proof</p>
                    <p className="mt-2 text-sm leading-7 text-slate-300">
                      The package or hosted session is tied to the actual facility the buyer cares about. This is the path for stronger deployment-specific decisions.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5">
                    <p className="text-sm font-semibold text-white">Adjacent-site proof</p>
                    <p className="mt-2 text-sm leading-7 text-slate-300">
                      A clearly labeled nearby or similar site can answer an earlier question, but it should never be blurred into exact-site claims.
                    </p>
                  </div>
                </div>
                <a
                  href={publicDemoHref}
                  className="mt-6 inline-flex items-center text-sm font-semibold text-white underline-offset-4 hover:underline"
                >
                  Inspect the sample listing
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </article>
            </div>
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
                  Once a team has one specific customer site, these are the jobs they actually
                  run against it.
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

        {/* Proof stories — adapted from anonymized commercial narratives */}
        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Proof stories
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  How this looks once a buyer has one real deployment question
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  These are anonymized proof stories tied to the same commercial workflow. They are more useful than generic industry examples because they show the decision path a serious buyer actually follows.
                </p>
              </div>
            </ScrollReveal>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {caseStudies.map((study) => (
                <article
                  key={study.slug}
                  className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-slate-50">
                    <img
                      src={study.hero}
                      alt={study.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {illustrativeLabel}
                      </p>
                      <h3 className="mt-1.5 text-lg font-semibold text-slate-900">
                        {study.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{study.summary}</p>
                    </div>
                    <ul className="space-y-1.5 text-sm text-slate-600">
                      {study.outcomes.map((outcome) => (
                        <li key={outcome} className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span>{outcome}</span>
                        </li>
                      ))}
                    </ul>
                    <a
                      href={publicDemoHref}
                      className="mt-auto text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
                    >
                      Inspect the sample listing
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <ScrollReveal as="section" className="mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
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
                See deliverables
              </a>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </>
  );
}
