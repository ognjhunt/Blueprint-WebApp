import { SEO } from "@/components/SEO";
import { CTAButtons } from "@/components/site/CTAButtons";
import { ArrowRight, CheckCircle2, FileText, Map, ScanLine, ShieldCheck } from "lucide-react";

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-slate-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
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
    title: "Site twin capture",
    body:
      "A capture-backed view of the work area, route, transfer points, restricted zones, lighting, occlusion, and access limits.",
    icon: <Map className="h-5 w-5" />,
  },
  {
    title: "Task suite and thresholds",
    body:
      "The exact task being checked, required success rate, cycle time, intervention rate, safety threshold, and scenario variations.",
    icon: <ScanLine className="h-5 w-5" />,
  },
  {
    title: "Readiness report",
    body:
      "A pre-pilot readiness estimate with evidence quality, open blockers, failure modes, site modifications, data needs, and next proof moves.",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    title: "Pilot protocol",
    body:
      "A short-pilot protocol for what to test in the facility next, plus vendor comparison when multiple robots are in scope.",
    icon: <ShieldCheck className="h-5 w-5" />,
  },
];

const reportSections = [
  "Site and task scope: facility area, workflow lane, start/end states, and restricted zones",
  "Robot profile: embodiment, sensors, autonomy stack, payload, speed, and integration assumptions",
  "Thresholds: required success rate, cycle time, intervention rate, and safety threshold",
  "Scenario variations: lighting, clutter, traffic, route blockage, object state, and schedule changes",
  "Evidence quality: capture provenance, package state, held-out validation, simulator/action/robot-trial gaps",
  "Failure-mode report: where the robot is likely to miss the bar and why",
  "Recommendations: site modifications, training or post-training data needs, and short-pilot protocol",
];

export default function ReadinessPack() {
  return (
    <>
      <SEO
        title="Robot Deployment Readiness | Blueprint"
        description="Blueprint produces request-scoped site/task readiness reports for robot teams evaluating success rate, cycle time, intervention rate, and safety thresholds before an on-site pilot."
        canonical="/readiness"
      />

      <div className="relative min-h-screen bg-white font-sans text-slate-900 selection:bg-slate-100 selection:text-slate-900">
        <DotPattern />

        <section className="relative overflow-hidden pb-16 pt-16 sm:pb-20 sm:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium uppercase tracking-wider text-slate-600">
                  <FileText className="h-3 w-3" />
                  Site/task readiness report
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                  Estimate robot deployment readiness before the expensive pilot.
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-slate-600">
                  Blueprint helps a robot vendor, site operator, or integrator answer the pre-pilot
                  question: how likely is this robot to meet the required success rate, cycle time,
                  intervention rate, and safety threshold on this actual facility task? The answer is
                  advisory and request-scoped until simulator traces, action logs, robot trials,
                  safety review, rights clearance, and hosted runtime proof support a stronger claim.
                </p>

                <CTAButtons
                  primaryHref="/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=readiness-hero"
                  primaryLabel="Request readiness evaluation"
                  secondaryHref="/proof"
                  secondaryLabel="Inspect proof boundaries"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  Sample advisory frame
                </p>
                <h2 className="mt-3 text-2xl font-bold text-slate-950">Pre-pilot estimate with two blockers</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  The route and transfer point look reviewable from current capture evidence. The
                  current blockers are a narrow dock turn and incomplete evidence around restricted
                  storage-aisle access. This sample does not claim the robot is ready to deploy.
                </p>
                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">Next step</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Confirm aisle access rules, gather action or simulator traces for the named
                    task, then run a short pilot protocol only after safety and operator review.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-100 bg-slate-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                The deliverable is a readiness packet
              </h2>
              <p className="mt-4 text-slate-600">
                You are not buying a generic digital twin or an unsupported deployment verdict. You
                are getting a concrete site/task packet that shows what the robot must prove, what
                evidence already exists, and what still blocks a stronger operational claim.
              </p>
            </div>

            <div className="mobile-snap-row mt-8 md:grid md:grid-cols-2 md:gap-6">
              {sampleSections.map((section) => (
                <article
                  key={section.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                    {section.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{section.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{section.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div className="space-y-5">
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  What the report covers
                </h2>
                <p className="text-slate-600">
                  Use this when a robot vendor, site operator, integrator, or internal deployment
                  lead needs a tighter review before approving deeper work in warehouses, factories,
                  material-handling flows, industrial inspection routes, or equipment-state checks.
                </p>
                <a
                  href="/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=readiness-report"
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Request readiness evaluation
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <ul className="space-y-3">
                  {reportSections.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
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
