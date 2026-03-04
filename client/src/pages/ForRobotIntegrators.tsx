import { SEO } from "@/components/SEO";
import { CheckCircle2, Cpu, FileCheck2, Gauge, GitBranchPlus, Truck } from "lucide-react";

const requiredInputs = [
  "Policy package: model/version, runtime assumptions, and task policy interface",
  "Task definitions: success criteria, abort conditions, and priority workflows",
  "Constraints: kinematics, payload limits, sensor stack, and operating envelopes",
  "Evaluation target: specific deployment site or facility profile to match",
];

const workflowSteps = [
  {
    title: "1. Submit deployment objective",
    description:
      "Define the site, tasks, and confidence targets you need before any physical rollout.",
  },
  {
    title: "2. Twin match and scene prep",
    description:
      "Use an existing twin or request a new capture; Blueprint prepares render-ready views for training and evaluation.",
  },
  {
    title: "3. Adaptation and scorecard run",
    description:
      "Run site-specific adaptation cycles and evaluate policies in the exchange workflow with standardized reporting.",
  },
  {
    title: "4. Go/no-go package",
    description:
      "Receive performance deltas, failure clusters, and a readiness summary to support pilot planning.",
  },
];

const logisticsItems = [
  "Versioned submissions so each evaluation run is traceable",
  "Standard artifact bundle: metrics, clips, and reproducible run configuration",
  "Contracting path for recurring evaluation and re-adaptation cycles",
  "Optional handoff package for customer site and safety review teams",
];

export default function ForRobotIntegrators() {
  return (
    <>
      <SEO
        title="For Robot Integrators & Teams | Blueprint"
        description="Guide for robot integrators and autonomy teams using Blueprint for site-specific adaptation, exchange evaluation, and pre-deployment readiness."
        canonical="/for-robot-integrators"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-700">
              For Robot Integrators & Teams
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Pre-deployment guide for robotics teams
            </h1>
            <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
              If your team deploys robot policies into customer facilities, this page outlines the
              practical inputs, exchange workflow, and logistics needed to qualify readiness before
              going live on site.
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
                  Adaptation target
                </p>
                <p className="mt-1 text-sm text-slate-600">Site-specific world model or VLA tuning.</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Gauge className="h-4 w-4" />
                  Qualification output
                </p>
                <p className="mt-1 text-sm text-slate-600">Standardized pre-deployment scorecards.</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <GitBranchPlus className="h-4 w-4" />
                  Ongoing cycles
                </p>
                <p className="mt-1 text-sm text-slate-600">Re-adaptation when site conditions drift.</p>
              </div>
            </div>
          </section>

          <section className="mt-10 flex flex-wrap gap-3">
            <a
              href="/deployment-marketplace"
              className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Start evaluation workflow
            </a>
            <a
              href="/contact?interest=robot-team-brief"
              className="inline-flex items-center rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Share your deployment brief
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
