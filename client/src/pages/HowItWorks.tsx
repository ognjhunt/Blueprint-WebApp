import { CTAButtons } from "@/components/site/CTAButtons";
import { SEO } from "@/components/SEO";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  FileText,
  MapPinned,
  ScanLine,
  Sparkles,
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

const whyTwinFirst = [
  {
    title: "The twin is the core product",
    description:
      "Blueprint starts by building a site-specific digital twin. Everything else comes out of that.",
    icon: <MapPinned className="h-6 w-6" />,
  },
  {
    title: "Operators get a clearer feasibility read",
    description:
      "The twin shows what is possible, what is blocked, and what still needs more proof.",
    icon: <ScanLine className="h-6 w-6" />,
  },
  {
    title: "Robot teams get a better evaluation path",
    description:
      "Teams can review the same twin before they spend money and time on a pilot.",
    icon: <Bot className="h-6 w-6" />,
  },
];

const pipelineSteps = [
  {
    step: "01",
    title: "Scope the site and task",
    icon: <ScanLine className="h-5 w-5" />,
    description:
      "We start with the actual workflow, work area, handoff points, and constraints that matter.",
  },
  {
    step: "02",
    title: "Build the digital twin",
    icon: <MapPinned className="h-5 w-5" />,
    description:
      "Blueprint captures the site and turns it into a digital twin the team can review and use.",
  },
  {
    step: "03",
    title: "Show feasibility and readiness",
    icon: <FileText className="h-5 w-5" />,
    description:
      "The twin becomes a clear report on blockers, readiness, and what needs to change or be checked next.",
  },
  {
    step: "04",
    title: "Let robot teams evaluate",
    icon: <Bot className="h-5 w-5" />,
    description:
      "If the site makes sense, robot teams use the twin to evaluate before anyone burns pilot budget.",
  },
];

const deliverables = [
  "A site-specific digital twin",
  "A scoped workflow and work area",
  "A simple readiness pack with blockers and next steps",
  "A better handoff for robot-team evaluation",
];

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How It Works | Blueprint"
        description="How Blueprint turns a real site into a digital twin, shows feasibility, and helps robot teams evaluate before a pilot."
        canonical="/how-it-works"
      />

      <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        <section className="relative overflow-hidden pb-20 pt-16 sm:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-8">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600">
                    <Sparkles className="h-3 w-3" />
                    Digital Twin For Deployment Readiness
                  </div>
                  <h1 className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
                    We turn a real site into a digital twin your team can use.
                  </h1>
                  <p className="max-w-2xl text-lg leading-relaxed text-zinc-600">
                    Blueprint builds the twin first, uses it to show what is and is not feasible,
                    and gives robot teams a way to evaluate before a pilot.
                  </p>
                </div>

                <CTAButtons
                  primaryHref="/contact?interest=site-qualification"
                  primaryLabel="Request a site twin"
                  secondaryHref="/readiness-pack"
                  secondaryLabel="See the Readiness Pack"
                />
              </div>

              <div className="relative">
                <div className="absolute -inset-6 rounded-full bg-indigo-500/15 blur-3xl filter" />
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-xl backdrop-blur-md">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800">
                      <MapPinned className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                        What you get
                      </p>
                      <p className="text-sm text-zinc-600">
                        A reusable site twin, a clear report back, and a better way for robot teams
                        to evaluate before field work starts.
                      </p>
                      <a
                        href="/readiness-pack"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-900 hover:text-indigo-600"
                      >
                        See the deliverable <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-zinc-100 bg-zinc-50/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Why start with the twin</h2>
              <p className="mt-4 text-zinc-600">
                The twin gives operators and robot teams the same view of the site before the pilot
                gets expensive.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {whyTwinFirst.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                    {item.icon}
                  </div>
                  <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-3xl">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                The process is simple
              </h2>
              <p className="mt-4 text-lg text-zinc-600">
                Start with the real site. Build the twin. Use it to understand feasibility. Then let
                the right teams evaluate before the pilot.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
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
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-zinc-100 bg-zinc-50/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div className="space-y-5">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  What you receive
                </h2>
                <p className="text-zinc-600">
                  The report matters, but it is not the whole product. The real asset is the site
                  twin and the clearer decisions that come from it.
                </p>
                <a
                  href="/readiness-pack"
                  className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
                >
                  See the Readiness Pack
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <ul className="space-y-3">
                  {deliverables.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-zinc-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-zinc-900 p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Start with the site. We&apos;ll build the twin from there.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              Share the site and workflow. Blueprint will turn it into a digital twin, show what is
              feasible, and help the right robot teams evaluate before the pilot starts.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href="/contact?interest=site-qualification"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Request a site twin
              </a>
              <a
                href="/readiness-pack"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                See the Readiness Pack
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
