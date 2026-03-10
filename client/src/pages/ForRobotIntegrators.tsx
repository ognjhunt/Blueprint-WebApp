import { SEO } from "@/components/SEO";
import { CheckCircle2, Cpu, FileCheck2, Gauge, GitBranchPlus, Truck } from "lucide-react";

const requiredInputs = [
  "Target site and task: what you want checked",
  "Runtime contract: model/version, interface, and operating assumptions",
  "Constraints: payload, sensor stack, and safety envelope",
  "Next step: review only, site data, or managed tuning on a supported stack",
];

const workflowSteps = [
  {
    title: "1. Submit deployment objective",
    description:
      "Define the site, the workflow, and the decision your team needs before any physical rollout.",
  },
  {
    title: "2. Review the qualified site",
    description:
      "Use an existing site brief or request a new one; Blueprint prepares the site context and readiness call first.",
  },
  {
    title: "3. Buy deeper checks only if needed",
    description:
      "Buy site data only when your team needs more proof for that exact site.",
  },
  {
    title: "4. Use managed tuning selectively",
    description:
      "Run managed tuning only on supported stacks with a clear interface and offline evaluation path.",
  },
];

const logisticsItems = [
  "Versioned submissions so each package is traceable",
  "Scoped access to the site brief and related materials",
  "Clear separation between readiness, site data, and managed tuning",
  "A refresh path if the site changes later",
];

export default function ForRobotIntegrators() {
  return (
    <>
      <SEO
        title="For Humanoid Integrators & Teams | Blueprint"
        description="Guide for robot teams using Blueprint to evaluate on qualified sites with a clear task brief, pass criteria, and next steps."
        canonical="/for-robot-integrators"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-700">
              For Humanoid Integrators & Teams
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Evaluate on qualified sites, not cold leads.
            </h1>
            <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
              Blueprint gives robot teams a clear site brief, task thresholds, and next steps so
              you can review, evaluate, and move faster toward a real pilot.
            </p>
          </div>

          <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="mb-4 flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-slate-700" />
              <h2 className="text-xl font-bold text-slate-900">What to prepare</h2>
            </div>
            <ul className="space-y-3">
              {requiredInputs.map((item) => (
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
              {workflowSteps.map((step) => (
                <article key={step.title} className="rounded-xl border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-10 rounded-2xl border border-slate-200 p-6">
            <div className="mb-3 flex items-center gap-2">
              <Truck className="h-5 w-5 text-slate-700" />
              <h2 className="text-xl font-bold text-slate-900">Exchange and logistics</h2>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              {logisticsItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Cpu className="h-4 w-4" />
                  Default motion
                </p>
                <p className="mt-1 text-sm text-slate-600">Start with the qualified site and readiness pack.</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Gauge className="h-4 w-4" />
                  Core upsell
                </p>
                <p className="mt-1 text-sm text-slate-600">Add site data if the team needs a deeper pass.</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <GitBranchPlus className="h-4 w-4" />
                  Recurring layer
                </p>
                <p className="mt-1 text-sm text-slate-600">Refresh the brief if the site changes later.</p>
              </div>
            </div>
          </section>

          <section className="mt-10 flex flex-wrap gap-3">
            <a
              href="/qualified-opportunities"
              className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              View qualified opportunities
            </a>
            <a
              href="/contact?interest=deeper-evaluation"
              className="inline-flex items-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Share your target site
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
