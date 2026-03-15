import { SEO } from "@/components/SEO";
import { FileCheck2, Gauge, GitBranchPlus, Play, Share2 } from "lucide-react";

const useCaseCards = [
  {
    title: "Test before travel",
    description:
      "Check whether your robot can move through the site, see the task, and finish the job before anyone gets on a plane.",
    icon: <Gauge className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Make site-specific data",
    description:
      "Render runs from the exact site, vary scenarios, and export outputs for training, debugging, and internal review.",
    icon: <FileCheck2 className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Compare releases",
    description:
      "Run the same site and task after each autonomy update so regressions show up early.",
    icon: <GitBranchPlus className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Train operators",
    description:
      "Give operators, teleop teams, and support teams the exact site view before the first live shift.",
    icon: <Play className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Share one environment",
    description:
      "Let your team and the customer look at the same hosted site instead of passing files back and forth.",
    icon: <Share2 className="h-5 w-5 text-slate-700" />,
  },
];

const includedItems = [
  "A hosted world model of a real site and workflow",
  "Resettable runs on the same site so results are easier to compare",
  "Scenario changes and rollout exports for debugging or data work",
  "A simple browser path for remote review and customer demos",
];

export default function ForRobotIntegrators() {
  return (
    <>
      <SEO
        title="For Robot Teams | Blueprint"
        description="Blueprint turns real sites into hosted world models for robot testing, site-specific data, release checks, and remote demos."
        canonical="/for-robot-teams"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div className="space-y-5">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-700">
                For Robot Teams
              </span>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Train on the exact site you're deploying to.
              </h1>
              <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
                Site-specific world models dramatically outperform generalized simulations.
                Blueprint's capture network maps real indoor spaces -- grocery stores, warehouses,
                offices, clinics -- and every world model is qualification-verified.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/world-models"
                  className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Browse world models
                </a>
                <a
                  href="/contact?interest=evaluation-package"
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Talk to us
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-semibold text-slate-900">What this is</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                A site-specific world model you can buy as a package or run as a hosted session.
              </p>
              <p className="mt-5 text-sm font-semibold text-slate-900">What it helps with</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>Validation before the site visit</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>Site-specific synthetic data</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>Release checks and customer demos</span>
                </li>
              </ul>
            </div>
          </div>

          <section className="mt-12">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                What robot teams use it for.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                The point is simple: answer the deployment question before the expensive part
                starts.
              </p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {useCaseCards.map((item) => (
                <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="inline-flex rounded-lg bg-white p-2">{item.icon}</div>
                  <h3 className="mt-3 text-base font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-12 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-6">
              <h2 className="text-2xl font-bold text-slate-900">What you get</h2>
              <ul className="mt-5 space-y-3">
                {includedItems.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-slate-700">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-slate-900 p-6 text-white">
              <h2 className="text-2xl font-bold">What to expect</h2>
              <p className="mt-4 text-sm leading-7 text-white">
                This is strong for validation, site-specific data generation, operator rehearsal,
                and remote demos. It is not the final signoff for deployment, and it is not a
                contact-perfect manipulation simulator for every task.
              </p>
            </article>
          </section>
        </div>
      </div>
    </>
  );
}
