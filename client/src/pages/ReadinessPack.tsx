import { SEO } from "@/components/SEO";
import { CTAButtons } from "@/components/site/CTAButtons";
import { ArrowRight, CheckCircle2, FileText, Map, ScanLine, ShieldCheck } from "lucide-react";

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern-readiness-pack"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill="url(#grid-pattern-readiness-pack)" />
    </svg>
  );
}

const sampleSections = [
  {
    title: "Site twin overview",
    body:
      "A clean view of the work area, route, handoff points, and restricted zones so everyone starts from the same picture.",
    icon: <Map className="h-5 w-5" />,
  },
  {
    title: "Scoped workflow",
    body:
      "The exact task being checked, what success looks like, and where the workflow is likely to break down.",
    icon: <ScanLine className="h-5 w-5" />,
  },
  {
    title: "Readiness pack",
    body:
      "A short report with blockers, evidence quality notes, a risk map, and a clear recommendation on what to do next.",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    title: "Robot-team evaluation path",
    body:
      "A simple handoff that lets robot teams evaluate against the twin before anyone burns field time or pilot budget.",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
];

const reportSections = [
  "Scope: site, workflow, and work area",
  "Constraints: access rules, restricted zones, and operating limits",
  "Evidence quality: what is clear and what still needs more proof",
  "Risk map: where the site is likely to block rollout",
  "Pass / fail criteria: what a team needs to prove next",
  "Readiness verdict: ready, risky, or not ready yet",
  "Recommended next step: fix blockers, gather more evidence, or start team evaluation",
];

export default function ReadinessPack() {
  return (
    <>
      <SEO
        title="Readiness Pack | Blueprint"
        description="See the default Blueprint product: a readiness pack that scopes the site, surfaces blockers, and tells the team what to do next."
        canonical="/readiness-pack"
      />

      <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        <section className="relative overflow-hidden pb-16 pt-16 sm:pb-20 sm:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600">
                  <FileText className="h-3 w-3" />
                  Default Product
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
                  The Readiness Pack is the first thing we sell.
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-zinc-600">
                  The goal is simple: turn a real site and task into a clear readiness decision.
                  If the site is promising, that pack becomes the handoff into qualified
                  opportunities and later technical work.
                </p>

                <CTAButtons
                  primaryHref="/contact?interest=site-qualification"
                  primaryLabel="Request a site twin"
                  secondaryHref="/how-it-works"
                  secondaryLabel="How it works"
                />
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  Sample verdict
                </p>
                <h2 className="mt-3 text-2xl font-bold text-zinc-950">Ready with two blockers</h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                  The route is workable and the handoff is clear. The current gaps are a narrow dock
                  turn and incomplete evidence around a restricted storage aisle.
                </p>
                <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-sm font-semibold text-zinc-900">Next step</p>
                  <p className="mt-2 text-sm text-zinc-600">
                    Fix the dock turn, confirm aisle access rules, then open the qualified brief
                    for robot-team review.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-zinc-100 bg-zinc-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                The deliverable is simple
              </h2>
              <p className="mt-4 text-zinc-600">
                You are not buying a pile of files. You are buying a qualification decision and a
                better next step.
              </p>
            </div>

            <div className="mobile-snap-row mt-8 md:grid md:grid-cols-2 md:gap-6">
              {sampleSections.map((section) => (
                <article
                  key={section.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                    {section.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-900">{section.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">{section.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div className="space-y-5">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  What the pack covers
                </h2>
                <p className="text-zinc-600">
                  Site operators use this to understand whether the site is worth pursuing. Robot
                  teams use it to decide whether the site deserves deeper evaluation.
                </p>
                <a
                  href="/contact?interest=site-qualification"
                  className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
                >
                  Request a site twin
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <ul className="space-y-3">
                  {reportSections.map((item) => (
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
      </div>
    </>
  );
}
