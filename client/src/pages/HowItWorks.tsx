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

const whyQualificationFirst = [
  {
    title: "Qualification is the first product",
    description:
      "We start with a scoped site and task, then produce a readiness decision before offering deeper technical work.",
    icon: <MapPinned className="h-6 w-6" />,
  },
  {
    title: "Qualified opportunities come next",
    description:
      "Robot teams should review qualified site briefs, not random inbound leads or generic scene listings.",
    icon: <ScanLine className="h-6 w-6" />,
  },
  {
    title: "The heavy work is selective",
    description:
      "Deeper evaluation, deployment prep, and managed tuning only happen when both sides are serious.",
    icon: <Bot className="h-6 w-6" />,
  },
];

const pipelineSteps = [
  {
    step: "01",
    title: "Scope the site and task",
    icon: <ScanLine className="h-5 w-5" />,
    description:
      "We start with the actual workflow, work area, handoff points, constraints, and success bar.",
  },
  {
    step: "02",
    title: "Capture and qualify the site",
    icon: <MapPinned className="h-5 w-5" />,
    description:
      "Blueprint captures the evidence and turns it into a readiness pack with blockers, gaps, and a recommendation.",
  },
  {
    step: "03",
    title: "Open the qualified opportunity",
    icon: <FileText className="h-5 w-5" />,
    description:
      "If the site is worth pursuing, the handoff becomes a better brief for robot teams and integrators.",
  },
  {
    step: "04",
    title: "Add deeper work only when needed",
    icon: <Bot className="h-5 w-5" />,
    description:
      "Only selected sites move into technical evaluation, deployment prep, managed tuning, or later licensing work.",
  },
];

const deliverables = [
  "A qualification record tied to the site and workflow",
  "A scoped workflow and work area",
  "A readiness pack with blockers and next steps",
  "A qualified opportunity brief for robot-team review",
];

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How It Works | Blueprint"
        description="How Blueprint moves from site intake to qualification, then into qualified opportunities, deeper evaluation, and later deployment work."
        canonical="/how-it-works"
      />

      <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        <section className="relative overflow-hidden pb-16 pt-14 sm:pb-20 sm:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-8">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600">
                    <Sparkles className="h-3 w-3" />
                    Qualification First
                  </div>
                  <h1 className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
                    We start with qualification, not a generic marketplace.
                  </h1>
                  <p className="max-w-2xl text-lg leading-relaxed text-zinc-600">
                    Blueprint scopes the site, captures the evidence, returns a readiness decision,
                    and only then opens qualified opportunities, deeper evaluation, and later
                    deployment work.
                  </p>
                </div>

                <CTAButtons
                  primaryHref="/contact?interest=site-qualification"
                  primaryLabel="Request qualification"
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
                        A readiness pack first, a qualified handoff second, and premium technical
                        work only when the site earns it.
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

        <section className="border-y border-zinc-100 bg-zinc-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">Why start with qualification</h2>
              <p className="mt-4 text-zinc-600">
                The ladder is simple: qualify first, open good sites to the right teams, then sell
                the deeper technical work only when it matters.
              </p>
            </div>

            <div className="mobile-snap-row md:grid md:grid-cols-3 md:gap-6">
              {whyQualificationFirst.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
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

        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-3xl">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                The process is simple
              </h2>
              <p className="mt-4 text-lg text-zinc-600">
                Start with the real site and task. Return the readiness decision. Then let the
                right teams decide whether to go deeper.
              </p>
            </div>

            <div className="mobile-snap-row md:grid md:grid-cols-2 md:gap-6">
              {pipelineSteps.map((step) => (
                <div
                  key={step.step}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
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

        <section className="border-y border-zinc-100 bg-zinc-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div className="space-y-5">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  What you receive
                </h2>
                <p className="text-zinc-600">
                  The report matters because it routes the next commercial step. Qualification is
                  the product center. Exchange, evaluation, and tuning sit on top of it.
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
              Start with the site. We&apos;ll tell you whether it is worth taking further.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              Share the site and workflow. Blueprint will qualify it, show what is feasible, and
              route the next step with less guesswork.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href="/contact?interest=site-qualification"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Request qualification
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
