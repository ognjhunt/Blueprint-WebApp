import { SEO } from "@/components/SEO";
import {
  CheckCircle2,
  FileCheck2,
  Gauge,
  GitBranchPlus,
  Play,
  Share2,
  Sparkles,
} from "lucide-react";

const requiredInputs = [
  "Target site and task: what you want checked",
  "Robot setup: embodiment, sensors, payload, and operating limits",
  "Success bar: what counts as pass, fail, or needs more evidence",
  "Buying path: package only, hosted session, or deeper support later",
];

const workflowSteps = [
  {
    title: "1. Pick the site and the task",
    description:
      "Start with one real site and one real workflow, not a vague pilot idea.",
  },
  {
    title: "2. Open the world model",
    description:
      "Review the package or stream the hosted version so your team can work on the exact site.",
  },
  {
    title: "3. Run tests, variations, and exports",
    description:
      "Reset the same site, change scenarios, compare releases, and export the outputs you need.",
  },
  {
    title: "4. Decide what happens next",
    description:
      "Use the results to say pass, fix, gather more data, or schedule the real visit with fewer surprises.",
  },
];

const useCaseCards = [
  {
    title: "Test before travel",
    description:
      "See if the robot can localize, move, see the task, and finish the job before anyone spends time on site.",
    icon: <Gauge className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Make site-specific data",
    description:
      "Render runs from the exact site, vary scenarios, and export outputs for training, debugging, or review.",
    icon: <FileCheck2 className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Compare releases",
    description:
      "Run the same site and task after each autonomy update so your team can catch regressions early.",
    icon: <GitBranchPlus className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Train operators",
    description:
      "Give operators or teleop teams the exact site view before the first live deployment or support shift.",
    icon: <Play className="h-5 w-5 text-slate-700" />,
  },
  {
    title: "Share one hosted environment",
    description:
      "Let the robot team, customer, and support team work from the same site model instead of passing big files around.",
    icon: <Share2 className="h-5 w-5 text-slate-700" />,
  },
];

const terminologyCards = [
  {
    title: "Site-specific world model",
    description: "The current term robot teams already recognize.",
  },
  {
    title: "Robot-ready site twin",
    description: "Plain-English translation for buyers who are new to the term.",
  },
  {
    title: "Hosted validation and data layer",
    description: "What teams actually do with it once they have access.",
  },
];

const boundaryItems = [
  "Good for validation, site-specific data generation, remote demos, and operator rehearsal.",
  "Not final deployment signoff by itself.",
  "Not a full contact-accurate manipulation simulator for every task.",
  "Use a higher-fidelity action layer later when the touch zone needs sim-ready contact behavior.",
];

export default function ForRobotIntegrators() {
  return (
    <>
      <SEO
        title="For Robot Teams | Blueprint"
        description="Use site-specific world models to test before travel, make site-specific data, compare releases, train operators, and share one hosted environment."
        canonical="/for-robot-integrators"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-700">
              For Robot Teams
            </span>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Use a site-specific world model before you commit field time.
            </h1>
            <p className="max-w-3xl text-lg leading-relaxed text-slate-600">
              Blueprint gives robot teams a hosted version of a real site. Use it to test fit,
              make site-specific data, compare releases, train operators, and share the same site
              with the customer before the real visit.
            </p>
          </div>

          <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="max-w-3xl">
              <div className="mb-4 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-slate-700" />
                <h2 className="text-xl font-bold text-slate-900">What teams can do with it</h2>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                This is useful when your team needs to answer a real deployment question about one
                real place, not just browse a model.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {useCaseCards.map((item) => (
                <article key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="inline-flex rounded-lg bg-white p-2">{item.icon}</div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-xl bg-slate-900 p-5 text-white">
              <p className="text-sm font-semibold">How to talk about it</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                Say <span className="font-semibold">site-specific world model</span> when you are
                talking to robot teams. Say <span className="font-semibold">robot-ready site twin</span>{" "}
                when you want plain English. In both cases, sell the outcome: validation, data,
                and rehearsal on the exact site.
              </p>
            </div>
          </section>

          <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Gauge className="h-5 w-5 text-slate-700" />
              <h2 className="text-xl font-bold text-slate-900">Simple positioning</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {terminologyCards.map((item) => (
                <article key={item.title} className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                </article>
              ))}
            </div>
          </section>

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
              <CheckCircle2 className="h-5 w-5 text-slate-700" />
              <h2 className="text-xl font-bold text-slate-900">Clear boundaries</h2>
            </div>
            <ul className="space-y-2 text-sm text-slate-600">
              {boundaryItems.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-10 flex flex-wrap gap-3">
            <a
              href="/site-worlds"
              className="inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Browse site worlds
            </a>
            <a
              href="/contact?interest=evaluation-package"
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
