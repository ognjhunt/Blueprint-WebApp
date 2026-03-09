import { SEO } from "@/components/SEO";
import { CheckCircle2, ClipboardList, Clock3, Handshake, ShieldCheck } from "lucide-react";

const intakeChecklist = [
  "Site profile: facility type, square footage, operating hours, and known constraints",
  "Task list: which humanoid workflows you want evaluated before any live pilot",
  "Access plan: escort policy, restricted zones, and capture windows",
  "Safety and legal: NDA, site permissions, and any customer privacy rules",
];

const processSteps = [
  {
    title: "1. Intake and scope alignment",
    description:
      "We define the operational outcomes you care about, the pilot timeline, and which tasks should be qualified pre-deployment.",
  },
  {
    title: "2. Capture and reconstruction",
    description:
      "Blueprint coordinates local walkthrough capture and turns the recording into a site-specific digital twin with structured metadata.",
  },
  {
    title: "3. Pre-deployment evaluation exchange",
    description:
      "Qualified humanoid teams run simulation evaluations against your twin. You get standardized scorecards instead of one-off claims.",
  },
  {
    title: "4. Handoff and pilot readiness",
    description:
      "You review scorecards, select candidates, and move forward with the teams that meet your thresholds for on-site readiness.",
  },
];

const logisticsDetails = [
  "Scheduling: capture windows outside peak operations when needed",
  "Data governance: scope-limited twin access and approved evaluators only",
  "Commercial model: one exchange workflow for capture, evaluation, and renewals",
  "Refresh cadence: optional re-capture when layout or workflow changes",
];

export default function ForSiteOperators() {
  return (
    <>
      <SEO
        title="For Site Operators | Blueprint"
        description="Guide for site operators running pre-deployment humanoid qualification with Blueprint: intake, capture, exchange evaluation, and pilot-readiness handoff."
        canonical="/for-site-operators"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-700">
              For Site Operators
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Pre-deployment qualification guide for deployment sites
            </h1>
            <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
              If you operate a warehouse, store, factory, or lab and want higher-confidence
              humanoid launches, this page outlines what Blueprint needs from your team and how the
              exchange workflow moves from capture to pilot-ready decisions.
            </p>
          </div>

          <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-slate-700" />
              <h2 className="text-xl font-bold text-slate-900">What we need from your team</h2>
            </div>
            <ul className="space-y-3">
              {intakeChecklist.map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="text-2xl font-bold text-slate-900">Typical process</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {processSteps.map((step) => (
                <article key={step.title} className="rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-10 rounded-2xl border border-slate-200 p-6">
            <div className="mb-3 flex items-center gap-2">
              <Handshake className="h-5 w-5 text-slate-700" />
              <h2 className="text-xl font-bold text-slate-900">Exchange and logistics</h2>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              {logisticsDetails.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Clock3 className="h-4 w-4" />
                  Typical capture kickoff
                </p>
                <p className="mt-1 text-sm text-slate-600">1-2 weeks after scope and approvals.</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShieldCheck className="h-4 w-4" />
                  Evaluation scope
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Pre-deployment simulation qualification, not live-site operations.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-10 flex flex-wrap gap-3">
            <a
              href="/contact?interest=site-operator-guide"
              className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Plan a deployment-site brief
            </a>
            <a
              href="/deployment-marketplace"
              className="inline-flex items-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Open Deployment Marketplace
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
