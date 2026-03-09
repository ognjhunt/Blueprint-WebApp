import { SEO } from "@/components/SEO";
import { CheckCircle2, Cpu, FileCheck2, Gauge, GitBranchPlus, Truck } from "lucide-react";

const requiredInputs = [
  "Deployment objective: target site, task/workcell, and what a pass actually means",
  "Runtime contract: model/version, policy interface, and operating assumptions",
  "Constraints: kinematics, payload limits, sensor stack, and safety envelope",
  "Rights and next step: review only, adaptation data, or managed adaptation for a supported stack",
];

const workflowSteps = [
  {
    title: "1. Submit deployment objective",
    description:
      "Define the site, the workflow, and the decision your team needs before any physical rollout.",
  },
  {
    title: "2. Twin license and readiness layer",
    description:
      "Use an existing hosted twin or request a new capture; Blueprint prepares the facility context and default readiness pack first.",
  },
  {
    title: "3. Add artifact depth only if needed",
    description:
      "Buy the adaptation data pack when your team needs task-scoped eval or training artifacts on top of the twin.",
  },
  {
    title: "4. Use managed adaptation selectively",
    description:
      "Run managed adaptation only on supported stacks with a clear interface and an offline evaluation path before redeploy.",
  },
];

const logisticsItems = [
  "Versioned submissions so each artifact bundle is traceable",
  "Hosted twin by default, with scoped access and usage rights",
  "Clear separation between readiness pack, adaptation data, and managed adaptation",
  "Drift refresh path once the site changes after the first deployment cycle",
];

export default function ForRobotIntegrators() {
  return (
    <>
      <SEO
        title="For Humanoid Integrators & Teams | Blueprint"
        description="Guide for robot teams using Blueprint for hosted site twins, readiness packs, adaptation data, and managed adaptation on supported stacks."
        canonical="/for-robot-integrators"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-700">
              For Humanoid Integrators & Teams
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Pre-deployment guide for humanoid teams
            </h1>
            <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
              If your team deploys humanoid policies into customer facilities, this page outlines
              the practical inputs, product ladder, and logistics for both cases: when you already
              know the target site, and when an operator-side brief comes through Blueprint.
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
                <p className="mt-1 text-sm text-slate-600">Known-site or operator-matched twin plus readiness pack first.</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Gauge className="h-4 w-4" />
                  Core upsell
                </p>
                <p className="mt-1 text-sm text-slate-600">Adaptation data pack for eval and training artifacts.</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <GitBranchPlus className="h-4 w-4" />
                  Recurring layer
                </p>
                <p className="mt-1 text-sm text-slate-600">Drift refresh when the site changes after deployment prep.</p>
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
              Share your humanoid deployment brief
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
