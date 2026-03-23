import { SEO } from "@/components/SEO";
import { InteractiveCard, ScrollReveal, StaggerGroup } from "@/components/motion";
import {
  ArrowRight,
  Camera,
  FileSearch,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const buyerSteps = [
  {
    step: "01",
    title: "Choose the site",
    description:
      "Start with a world model that matches the workflow, environment, and constraints your robot actually needs to handle.",
    icon: FileSearch,
  },
  {
    step: "02",
    title: "Inspect the deliverables",
    description:
      "Review package contents, hosted evaluation availability, outputs, and stated limitations before your team commits time.",
    icon: ShieldCheck,
  },
  {
    step: "03",
    title: "Request the right path",
    description:
      "Ask for the scene package or a hosted evaluation with the site, task, and robot context already attached.",
    icon: Play,
  },
  {
    step: "04",
    title: "Use one site across the workflow",
    description:
      "Run the same site for tuning, release checks, demos, and internal review instead of rebuilding context for every step.",
    icon: Sparkles,
  },
];

const behindScenes = [
  {
    title: "Real indoor capture upstream",
    body:
      "Blueprint starts with walkthrough data from real facilities. That capture work exists to support the buyer path, not compete with it.",
  },
  {
    title: "Packaging and rights stay visible",
    body:
      "Each listing carries deliverables, pricing, and usage constraints so the commercial surface stays concrete.",
  },
  {
    title: "Capturer pages stay separate",
    body:
      "Capturers only need a short explainer and the mobile handoff. The main site stays focused on robot teams.",
  },
];

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

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How It Works | Blueprint"
        description="How Blueprint helps robot teams choose a real site, inspect concrete deliverables, and request the right evaluation path."
        canonical="/how-it-works"
      />

      <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        <section className="relative overflow-hidden pb-16 pt-14 sm:pb-20 sm:pt-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600">
                  <Sparkles className="h-3 w-3" />
                  How It Works
                </div>
                <h1 className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
                  One buyer path from site selection to hosted evaluation.
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-zinc-600">
                  Blueprint should be easy to explain: choose the exact site, inspect what your
                  team gets, and request the right next step. Capture stays upstream. The buyer
                  journey stays front and center.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <a
                    href="/world-models"
                    className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
                  >
                    Browse world models
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="/contact?persona=robot-team&interest=evaluation-package"
                    className="inline-flex items-center justify-center rounded-lg border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
                  >
                    Request hosted eval
                  </a>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  What this page should answer
                </p>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-zinc-600">
                  <li className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-400" />
                    <span>What a robot team can buy or request.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-400" />
                    <span>How the catalog, deliverables, and hosted path fit together.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-zinc-400" />
                    <span>Where capturers fit without crowding the main buyer story.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-zinc-100 bg-zinc-50/50 py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="mb-10 max-w-2xl">
                <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                  The robot-team workflow
                </h2>
                <p className="mt-4 text-zinc-600">
                  Four steps are enough. If the buyer still needs a marketplace explainer after
                  this page, the site is doing too much.
                </p>
              </div>
            </ScrollReveal>

            <StaggerGroup className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" stagger={0.1}>
              {buyerSteps.map((item) => {
                const Icon = item.icon;

                return (
                  <InteractiveCard key={item.step} accent="indigo" className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                        {item.step}
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-zinc-700">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-zinc-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-zinc-600">{item.description}</p>
                  </InteractiveCard>
                );
              })}
            </StaggerGroup>
          </div>
        </section>

        <section className="py-14 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Upstream
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  What happens behind the scenes
                </h2>
                <p className="mt-4 text-lg text-zinc-600">
                  Capture, packaging, and governance are real parts of the system. They just should
                  not dominate the public buying path.
                </p>
              </div>
            </ScrollReveal>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {behindScenes.map((item, index) => (
                <article
                  key={item.title}
                  className={`rounded-3xl border p-6 ${
                    index === 0 ? "border-zinc-200 bg-white" : "border-zinc-200 bg-zinc-50"
                  }`}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                    {index === 0 ? <Camera className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-zinc-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-zinc-600">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <ScrollReveal as="section" className="mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-zinc-900 p-8 sm:p-10">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Keep the site simple and let the catalog do the selling.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300">
              Robot teams should move from homepage to world model to contact without getting pulled
              into side stories. Capturers still have a clear handoff when they need it.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <a
                href="/world-models"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
              >
                Browse world models
              </a>
              <a
                href="/capture-app"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Capturer handoff
              </a>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </>
  );
}
