import { SEO } from "@/components/SEO";
import {
  CheckCircle2,
  ChevronRight,
  Database,
  Infinity,
  Layers,
  MessageSquare,
  Sparkles,
  Zap,
  ArrowRight,
} from "lucide-react";

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern-pricing"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        strokeWidth={0}
        fill="url(#grid-pattern-pricing)"
      />
    </svg>
  );
}

const foundationFeatures = [
  {
    title: "Catalog Access",
    description: "Access to a growing library of certified scenes and dataset packs",
    icon: <Database className="h-5 w-5" />,
  },
  {
    title: "On-Demand Generation",
    description: "Request new episodes and variations without standing up infrastructure",
    icon: <Infinity className="h-5 w-5" />,
  },
  {
    title: "Continuous Delivery",
    description: "Recurring drops of quality-scored data aligned to your training cadence",
    icon: <Zap className="h-5 w-5" />,
  },
  {
    title: "Exclusive Scene Commissions",
    description: "Custom scenes and environment variants built to your deployment context",
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    title: "Custom Embodiment Retargeting",
    description: "Adapt tasks and data formats to your robot embodiment and sensors",
    icon: <Layers className="h-5 w-5" />,
  },
  {
    title: "Dedicated Throughput",
    description: "Reserved generation capacity and a tight iteration loop with our team",
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
];

const foundationHighlights = [
  "Physics certification gates (colliders, articulation, stability, non-penetration)",
  "Episode QC + normalization for consistent schema across runs",
  "Quality scores and tiered dataset subsets for filtering",
  "Provenance metadata and versioned releases",
  "Custom tasks, robots, and sensor schemas on request",
  "Dedicated support channel and integration help",
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint - Certified Simulation Data"
        description="Platform license for teams training at scale. Catalog access, custom certified dataset runs, and continuous delivery for robotics AI."
        canonical="/pricing"
      />

      <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="mb-16 space-y-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-zinc-500 shadow-sm">
              <MessageSquare className="h-3 w-3" />
              Enterprise Pricing
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
              Platform Licensing
            </h1>

            <p className="mx-auto max-w-2xl text-lg text-zinc-600">
              A managed data factory for teams training at scale. Access the catalog, request
              custom certified runs, and keep a steady stream of quality-scored data without
              operating the underlying generation infrastructure.
            </p>
          </header>

          {/* Individual Scene/Bundle Info */}
          <section className="mb-16 rounded-2xl border border-zinc-200 bg-zinc-50 p-8">
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Looking for individual scenes or bundles?
              </p>
              <p className="text-zinc-600 mb-4">
                Browse the catalog for per-pack pricing, variations, and episode counts.
              </p>
              <a
                href="/marketplace/scenes"
                className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 hover:text-zinc-700"
              >
                Browse Marketplace
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </section>

          {/* Foundation Tier Card */}
          <section className="mb-16">
            <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
              <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
                {/* Left: Pricing Info */}
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Foundation Tier
                    </p>
                    <h2 className="mt-2 text-3xl font-bold text-zinc-900">
                      Platform License
                    </h2>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold tracking-tight text-zinc-900">
                        $500K–$2M+
                      </span>
                      <span className="text-sm text-zinc-500">/year</span>
                    </div>
                    <p className="text-sm text-zinc-500">
                      Custom pricing based on scale and requirements
                    </p>
                  </div>

                  <p className="text-zinc-600">
                    Platform license for teams that need a dependable supply of simulation data.
                    We combine generation with certification, quality scoring, and provenance so
                    your training pipeline can scale without surprises.
                  </p>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <a
                      href="/contact?tier=foundation"
                      className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
                    >
                      Contact Sales
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </a>
                    <a
                      href="/marketplace/scenes"
                      className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
                    >
                      Browse Scenes
                    </a>
                  </div>
                </div>

                {/* Right: Highlights */}
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">
                    What's Included
                  </p>
                  <ul className="space-y-3">
                    {foundationHighlights.map((highlight) => (
                      <li
                        key={highlight}
                        className="flex items-start gap-3 text-sm text-zinc-700"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* Certification & QA */}
          <section className="mb-16 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white p-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-zinc-900 mb-3">
                Certification & QA are included
              </h2>
              <p className="text-zinc-600 max-w-2xl mx-auto">
                A generator produces trajectories. A product ships trust. Every Blueprint delivery
                includes the artifacts teams use to audit, filter, and reproduce results.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Physics gates",
                  desc: "Collider QA, articulation checks, stability and non-penetration validation.",
                },
                {
                  title: "Episode QC",
                  desc: "Normalization and schema enforcement so datasets stay consistent across versions.",
                },
                {
                  title: "Quality scoring",
                  desc: "Per-episode scores and tiering so you can filter to high-trust subsets.",
                },
                {
                  title: "Provenance",
                  desc: "Versioned metadata for assets, parameters, and release notes.",
                },
                {
                  title: "Delivery formats",
                  desc: "USD-first for Isaac Sim plus dataset exports that slot into training stacks.",
                },
                {
                  title: "Support loop",
                  desc: "A feedback loop to target data at your model's current failure modes.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-indigo-100 bg-white p-5 shadow-sm"
                >
                  <h3 className="font-bold text-zinc-900 text-sm mb-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-zinc-700 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Features Grid */}
          <section className="mb-16">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-zinc-900">
                Platform capabilities
              </h2>
              <p className="mt-2 text-zinc-600">
                What's included with your Foundation Tier license
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {foundationFeatures.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-zinc-200 bg-white p-6"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold text-zinc-900">{feature.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Transfer Section */}
          <section className="mb-16 rounded-2xl border border-zinc-200 bg-zinc-900 p-8 text-white">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Transfer-Focused
                </div>
                <h2 className="text-2xl font-bold">
                  Reduce sim-to-real risk with certification
                </h2>
                <p className="text-zinc-400">
                  We don&apos;t promise transfer rates. We ship the gates, QC outputs, and metadata
                  teams use to de-risk deployment, then you validate on your hardware with fewer
                  surprises.
                </p>
                <a
                  href="/how-it-works"
                  className="inline-flex items-center text-sm font-semibold text-emerald-400 hover:text-emerald-300"
                >
                  See how we certify
                  <ChevronRight className="ml-1 h-4 w-4" />
                </a>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    title: "Physics gates",
                    desc: "Colliders, articulation, stability, non-penetration.",
                  },
                  {
                    title: "Episode QC",
                    desc: "Normalization, schema consistency, quality scoring.",
                  },
                  {
                    title: "Provenance",
                    desc: "Versioned assets, parameters, and release notes.",
                  },
                  {
                    title: "Benchmarks",
                    desc: "Standard tasks and evaluation harnesses (optional).",
                  },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl bg-white/10 p-4">
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                    <p className="mt-1 text-xs text-zinc-300">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Complement Section */}
          <section className="mb-16 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-8">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                  <Sparkles className="h-3 w-3" />
                  Works With Real Data
                </div>
                <h2 className="text-2xl font-bold text-zinc-900">
                  Simulation amplifies real-world capture
                </h2>
                <p className="text-zinc-600">
                  Simulation helps you scale coverage and iterate fast. Real-world data anchors
                  validation. The right mix depends on your robot, task, and deployment context.
                </p>
                <ul className="space-y-2 text-sm text-zinc-600">
                  {[
                    "Faster iteration cycles with repeatable environments",
                    "Safer exploration of failure modes without hardware risk",
                    "Long-tail coverage through controlled variations",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="/why-simulation"
                  className="inline-flex items-center text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Learn how simulation complements real data
                  <ArrowRight className="ml-1 h-4 w-4" />
                </a>
              </div>

              <div className="rounded-xl bg-white p-6 shadow-md border border-emerald-100">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">
                  Typical workflow
                </p>
                <ol className="space-y-3 text-sm text-zinc-600">
                  {[
                    "Start with catalog packs for quick baselines",
                    "Filter by quality scores and run benchmarks",
                    "Validate transfer on your hardware with a small real dataset",
                    "Request targeted new simulated data as failures appear",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="text-center">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-10">
              <h2 className="text-xl font-bold text-zinc-900">
                Ready to scale your training data?
              </h2>
              <p className="mt-3 max-w-xl mx-auto text-zinc-600">
                Let's discuss your requirements. We work with teams of all sizes,
                from research labs to foundation model companies.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <a
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  Talk to Sales
                </a>
                <a
                  href="/marketplace/scenes"
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-8 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
                >
                  Browse Marketplace
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
