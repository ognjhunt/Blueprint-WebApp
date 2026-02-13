import { CTAButtons } from "@/components/site/CTAButtons";
import SceneSmithExplainerMedia from "@/components/sections/SceneSmithExplainerMedia";
import { SEO } from "@/components/SEO";
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  ShieldCheck,
  Sparkles,
  Server,
  Package,
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

const painPoints = [
  {
    title: "The infrastructure is brutal",
    description:
      "Running a data factory means standing up GPU-heavy generation, model servers, sim orchestration, and constant debugging. Most teams would rather spend those GPUs on training.",
    icon: <Server className="h-6 w-6" />,
  },
  {
    title: "Raw simulation isn't trustworthy data",
    description:
      "Generation is easy. Trust is hard. Without physics gates and episode QC you can get clipping, inconsistent dynamics, and sim-only successes that fail on hardware.",
    icon: <ShieldCheck className="h-6 w-6" />,
  },
  {
    title: "Customers need provenance, filters, and repeatability",
    description:
      "Teams need to know what they trained on: where assets came from, which parameters were used, and how to filter to only high-quality episodes.",
    icon: <FileSearch className="h-6 w-6" />,
  },
];

const pipelineSteps = [
  {
    step: "01",
    title: "Define the dataset spec",
    description:
      "You tell us the task, robot, sensors, success criteria, and delivery format. We translate it into a runnable generation + QA plan.",
  },
  {
    step: "02",
    title: "Build or tailor the environment",
    description:
      "We start from the catalog or create new scenes and assets, then author colliders, articulation, and physics materials for manipulation.",
  },
  {
    step: "03",
    title: "Run physics certification gates",
    description:
      "We validate stability, non-penetration, collision quality, and dynamics bounds so the scene behaves consistently under contact.",
  },
  {
    step: "04",
    title: "Generate and normalize episodes",
    description:
      "We generate trajectories, normalize control signals, and enforce a consistent schema so you can train and debug without data surprises.",
  },
  {
    step: "05",
    title: "Score quality and deliver",
    description:
      "You get tiered subsets, quality distributions, and provenance metadata so you can filter to high-trust episodes or target specific failure modes.",
  },
];

const deliverables = [
  "SimReady scenes with validated colliders and articulation",
  "Episode-level metadata (task, robot, sensors, parameters, versioning)",
  "Quality scores and recommended filters (tiered subsets when needed)",
  "Certification report: gates run, known limits, and reproducibility notes",
];

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How We Certify | Blueprint"
        description="How Blueprint turns raw simulation into certified robotics datasets: physics gates, episode QC, quality scoring, and provenance metadata."
        canonical="/how-it-works"
      />

      <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        {/* Hero */}
        <section className="relative overflow-hidden pb-20 pt-16 sm:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-8">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600">
                    <Sparkles className="h-3 w-3" />
                    How We Certify
                  </div>
                  <h1 className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
                    From raw simulation to certified datasets.
                  </h1>
                  <p className="max-w-xl text-lg leading-relaxed text-zinc-600">
                    Open tools can generate data. Blueprint ships data you can trust: physics
                    certification, episode QC, quality scoring, and provenance metadata in every
                    delivery.
                  </p>
                </div>

                <CTAButtons
                  primaryHref="/marketplace"
                  primaryLabel="Browse the catalog"
                  secondaryHref="/contact"
                  secondaryLabel="Request a dataset"
                />
              </div>

              <div className="relative">
                <div className="absolute -inset-6 rounded-full bg-indigo-500/15 blur-3xl filter" />
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-xl backdrop-blur-md">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800">
                      <Package className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                        What we ship
                      </p>
                      <p className="text-sm text-zinc-600">
                        Scene + dataset + certification outputs, packaged with metadata so your
                        training stack can ingest, filter, and reproduce results.
                      </p>
                      <a
                        href="/marketplace"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-900 hover:text-indigo-600"
                      >
                        See the catalog <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why Certification */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                Why certification exists
              </h2>
              <p className="mt-4 text-zinc-600">
                Most teams don&apos;t need another generator. They need a reliable supply of
                simulation data they can defend internally, iterate on quickly, and trust when it
                matters.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {painPoints.map((item) => (
                <div
                  key={item.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                    {item.icon}
                  </div>
                  <h3 className="font-semibold text-zinc-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pipeline Steps */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                The Blueprint certification pipeline
              </h2>
              <p className="mt-4 text-lg text-zinc-600">
                Generation is only the first step. Certification is what turns trajectories into a
                dataset you can train on with confidence.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pipelineSteps.map((step) => (
                <div
                  key={step.step}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                  <p className="text-sm font-mono font-bold text-indigo-600">{step.step}</p>
                  <h3 className="mt-2 text-lg font-bold text-zinc-900">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <SceneSmithExplainerMedia id="howItWorksSceneSmithMedia" />

        {/* Deliverables */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div className="space-y-5">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  What you receive
                </h2>
                <p className="text-zinc-600">
                  Deliverables are designed for teams that need more than a ZIP file. You get the
                  artifacts required to reproduce results, filter to high-trust subsets, and keep
                  training stable over time.
                </p>
                <a
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
                >
                  Request a dataset
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Included in every delivery
                </p>
                <ul className="mt-5 space-y-3">
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

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-zinc-900 p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Tell us what you need. We&apos;ll ship certified data.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              Share your robot, task, and target formats. We&apos;ll recommend the fastest path:
              off-the-shelf packs or a custom certified dataset run.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href="/marketplace"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Browse the catalog
              </a>
              <a
                href="/contact"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Contact sales
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

