import { CTAButtons } from "@/components/site/CTAButtons";
import { SEO } from "@/components/SEO";
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Smartphone,
  Ruler,
  Video,
  BrainCircuit,
  Send,
} from "lucide-react";

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
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

const painPoints = [
  {
    title: "A raw scan is not enough",
    description:
      "A scan gives geometry. Teams still need task scope, evaluation context, and a clear read on where the site is likely to break the rollout.",
    icon: <Ruler className="h-6 w-6" />,
  },
  {
    title: "Readiness comes before adaptation",
    description:
      "The first job is deciding whether the task and site are ready. Managed model updates only matter after that foundation is in place.",
    icon: <BrainCircuit className="h-6 w-6" />,
  },
  {
    title: "The same twin should keep paying off",
    description:
      "Once Blueprint owns the hosted twin, it can support readiness reviews, eval packs, adaptation data, and later drift refreshes when the site changes.",
    icon: <Smartphone className="h-6 w-6" />,
  },
];

const pipelineSteps = [
  {
    step: "01",
    title: "Scope the workflow and workcell",
    icon: <Smartphone className="h-5 w-5" />,
    description:
      "We start with the actual task, route, handoff points, and constraints that matter. The capture plan is built around the work your team needs to prove, not around generic footage.",
  },
  {
    step: "02",
    title: "Capture and reconstruct the site",
    icon: <Ruler className="h-5 w-5" />,
    description:
      "Blueprint coordinates the walkthrough, reconstructs the environment, and hosts a reusable site twin with the location metadata and review context needed for deployment planning.",
  },
  {
    step: "03",
    title: "Build the readiness and evaluation layer",
    icon: <Video className="h-5 w-5" />,
    description:
      "From the hosted twin, we generate the default artifact set: task/workcell scope, readiness review, scorecards, risk map, and the eval context teams need before a live pilot.",
  },
  {
    step: "04",
    title: "Optionally generate adaptation data",
    icon: <BrainCircuit className="h-5 w-5" />,
    description:
      "Teams that need more can buy task-scoped render packs, evaluation scenarios, and site-conditioned training artifacts derived from the twin. This is the main upsell on top of the base readiness product.",
  },
  {
    step: "05",
    title: "Run managed adaptation when the stack supports it",
    icon: <Send className="h-5 w-5" />,
    description:
      "Managed fine-tuning or post-training is available for supported stacks only, after the interface, data rights, and offline evaluation path are defined. It is a premium path, not the default dependency.",
  },
];

const deliverables = [
  "Hosted site twin with licensed access for review and planning",
  "Task/workcell scoping plus location metadata and quality report",
  "Readiness pack with scorecards, risk map, and go / adapt / wait recommendation",
  "Task-scoped eval and training artifacts when adaptation data is requested",
  "Optional managed adaptation and offline evaluation for supported stacks",
];

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How It Works | Blueprint"
        description="How Blueprint checks a site and task before a robot team commits to a pilot."
        canonical="/how-it-works"
      />

      <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        {/* Hero */}
        <section className="relative overflow-hidden pb-20 pt-16 sm:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-8">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600">
                    <Sparkles className="h-3 w-3" />
                    Site Qualification
                  </div>
                  <h1 className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
                    We check the site before the pilot starts.
                  </h1>
                  <p className="max-w-xl text-lg leading-relaxed text-zinc-600">
                    Blueprint reviews the site, the task, and the main constraints first. If the
                    site is a fit, teams can move into deeper evaluation and site-specific work.
                  </p>
                </div>

                <CTAButtons
                  primaryHref="/contact"
                  primaryLabel="Request site qualification"
                  secondaryHref="/qualified-opportunities"
                  secondaryLabel="View qualified opportunities"
                />
              </div>

              <div className="relative">
                <div className="absolute -inset-6 rounded-full bg-indigo-500/15 blur-3xl filter" />
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-xl backdrop-blur-md">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800">
                      <Send className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                        What you get
                      </p>
                      <p className="text-sm text-zinc-600">
                        A clear read on the site first, then optional deeper work only when the
                        next step makes sense.
                      </p>
                      <a
                        href="/contact"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-900 hover:text-indigo-600"
                      >
                        Get started <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why The Artifact Layer Matters */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                Why this comes first
              </h2>
              <p className="mt-4 text-zinc-600">
                The goal is simple: understand the site before the team burns time and money in the building.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {painPoints.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                    {item.icon}
                  </div>
                  <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pipeline Steps */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                From site walkthrough to the right deployment artifact
              </h2>
              <p className="mt-4 text-lg text-zinc-600">
                Five steps take you from a raw site walkthrough to the twin, the readiness layer,
                and the optional adaptation path. The point is to get the right outputs without
                forcing your team to build the whole pipeline internally.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pipelineSteps.map((step) => (
                <div
                  key={step.step}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-mono font-bold text-indigo-600">{step.step}</p>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                      {step.icon}
                    </div>
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-zinc-900">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Evaluation Approach */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
              <div className="space-y-5">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  How we evaluate VLA performance
                </h2>
                <p className="text-zinc-600">
                  Our primary evaluation method is world-model-based: we feed video of the target
                  environment to the model, ask it to predict what happens next in pixels, and
                  measure how well those predictions match reality. No physics engine is required --
                  the evaluation runs entirely on rendered video.
                </p>
                <p className="text-zinc-600">
                  This approach is fast, scalable, and directly tied to the site-conditioned
                  artifacts we generate from the twin. It tells you how the model handles the
                  specific facility before anyone commits to a live rollout.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Evaluation methods
                </p>
                <ul className="mt-5 space-y-4">
                  <li className="flex items-start gap-3 text-sm text-zinc-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>
                      <span className="font-semibold">Video prediction (primary):</span> Feed
                      rendered site video to the model, predict outcomes in pixels, and score
                      accuracy. Works today with any world model or VLA.
                    </span>
                  </li>
                  <li className="flex items-start gap-3 text-sm text-zinc-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                    <span>
                      <span className="font-semibold">Physics-based sim eval (future):</span>{" "}
                      Traditional simulation with SimReady USD assets, articulated objects, and
                      contact dynamics. A planned capability for tasks where physics accuracy is
                      critical, such as precision manipulation or load-bearing assessment.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Deliverables */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div className="space-y-5">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  What you receive
                </h2>
                <p className="text-zinc-600">
                  Every engagement starts with the hosted twin and the default readiness layer.
                  If your team wants more, Blueprint can add adaptation artifacts and, for
                  supported stacks, managed adaptation with offline evaluation.
                </p>
                <a
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
                >
                  Request site qualification
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Product ladder
                </p>
                <ul className="mt-5 space-y-3">
                  {deliverables.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-zinc-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
                  <p className="text-sm font-semibold text-zinc-900">Managed adaptation is conditional.</p>
                  <p className="mt-2 text-sm text-zinc-600">
                    We only run fine-tuning or post-training when the stack is supported, the
                    policy interface is clear, data rights are agreed, and there is an offline
                    evaluation path before redeploy.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-zinc-900 p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Start with the site twin. Add the right artifact pack after that.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              Tell us the site and the workflow. We&apos;ll scope the hosted twin, the readiness
              pack, and the right adaptation path before the pilot starts.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href="/contact"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Schedule a scan
              </a>
              <a
                href="/qualified-opportunities"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                View qualified opportunities
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
