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
  TrendingUp,
  Clock,
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
    title: "Unlimited Scenes",
    description: "Access to 1,000+ scenes library with new drops added continuously",
    icon: <Database className="h-5 w-5" />,
  },
  {
    title: "Unlimited Episodes",
    description: "Generate as many training episodes as your models need",
    icon: <Infinity className="h-5 w-5" />,
  },
  {
    title: "Streaming Dataset Delivery",
    description: "Real-time data pipeline for continuous model training",
    icon: <Zap className="h-5 w-5" />,
  },
  {
    title: "Exclusive Scene Commissions",
    description: "Custom scenes built to your exact specifications",
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    title: "Custom Embodiment Retargeting",
    description: "Adapt training data to your specific robot embodiments",
    icon: <Layers className="h-5 w-5" />,
  },
  {
    title: "Priority Data Pipeline",
    description: "Dedicated infrastructure for your training workflows",
    icon: <CheckCircle2 className="h-5 w-5" />,
  },
];

const foundationHighlights = [
  "All VLA fine-tuning configs (OpenVLA, Pi0, SmolVLA, GR00T)",
  "Premium analytics ($320k+ value)",
  "Sim2Real fidelity matrices & transfer confidence scoring",
  "Multi-robot embodiment compatibility analysis",
  "Per-step telemetry (rewards, collisions, grasps, forces)",
  "Grasp quality analytics with force profiles",
  "Failure analysis & breakdown",
  "Trajectory optimality metrics",
  "Policy leaderboards with statistical significance",
  "Tactile sensor simulation",
  "Language annotations for VLA training",
  "Contact-rich task episodes",
  "Dedicated Slack channel",
  "Custom robot embodiment support",
  "1-year support with dedicated account team",
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint - Foundation Model Training Data"
        description="Platform license for foundation model teams. Unlimited scenes, streaming access, and custom data pipelines for robotics AI at scale."
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
              Foundation Model Licensing
            </h1>

            <p className="mx-auto max-w-2xl text-lg text-zinc-600">
              Simulation data that complements your real-world capture. Research shows
              teams that mix sim + real data see up to 38% better performance than
              real-only approaches.
            </p>
          </header>

          {/* Individual Scene/Bundle Info */}
          <section className="mb-16 rounded-2xl border border-zinc-200 bg-zinc-50 p-8">
            <div className="text-center">
              <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Looking for individual scenes or bundles?
              </p>
              <p className="text-zinc-600 mb-4">
                Browse our marketplace for per-scene pricing starting at $5,499.
                Each listing includes pricing, variations, and episode counts.
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
                    Platform license for foundation model teams. Unlimited scenes,
                    streaming access, and custom data pipelines designed for
                    training robotics AI at scale.
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

          {/* Premium Analytics Breakdown */}
          <section className="mb-16 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white p-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-zinc-900 mb-3">
                $320k-$585k in Premium Features
              </h2>
              <p className="text-zinc-600 max-w-2xl mx-auto">
                Your Foundation Tier license includes ALL these premium robotics capabilities. They're built into every scene, evaluation, and training job.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  category: "Tier 1: Essential Features ($40k-$75k)",
                  features: [
                    "Sim2Real Fidelity Matrix ($20k-$50k) - Physics/visual/sensor/robot fidelity scoring",
                    "Embodiment Transfer Analysis ($20k-$100k) - Cross-robot compatibility matrices",
                  ]
                },
                {
                  category: "Tier 2: Optimization ($30k-$65k)",
                  features: [
                    "Trajectory Optimality ($10k-$25k) - Path efficiency, jerk, energy analysis",
                    "Policy Leaderboards ($20k-$40k) - Statistical significance testing",
                    "Generalization Analyzer ($15k-$35k) - Learning curves, curriculum recommendations",
                  ]
                },
                {
                  category: "Tier 3: Premium ($25k-$60k)",
                  features: [
                    "Tactile Sensor Sim ($15k-$30k) - GelSight/DIGIT simulation",
                    "Language Annotations ($10k-$25k) - VLA training instructions",
                  ]
                },
                {
                  category: "Core Analytics ($115k-$260k)",
                  features: [
                    "Per-Step Telemetry - Rewards, collisions, grasps, forces at every step",
                    "Failure Analysis - Timeout/collision breakdown, phase-level tracking",
                    "Grasp Analytics - Event timeline, force profiles, contact tracking",
                    "Evaluation Throughput Metrics - GPU utilization, throughput, statistical variance",
                  ]
                },
              ].map((tier) => (
                <div key={tier.category} className="rounded-xl border border-emerald-100 bg-white p-5 shadow-sm">
                  <h3 className="font-bold text-zinc-900 text-sm mb-3">{tier.category}</h3>
                  <ul className="space-y-2">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-xs text-zinc-700">
                        <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-lg bg-white p-4 border border-emerald-100 text-center">
              <p className="text-sm text-zinc-700">
                <strong>All included in your Foundation Tier license.</strong> No additional costs for any premium features. You get complete robotics research infrastructure.
              </p>
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

          {/* Sim2Real Section */}
          <section className="mb-16 rounded-2xl border border-zinc-200 bg-zinc-900 p-8 text-white">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Sim2Real Validated
                </div>
                <h2 className="text-2xl font-bold">
                  85%+ real-world transfer rates
                </h2>
                <p className="text-zinc-400">
                  Our sim2real validation service ensures your trained policies
                  transfer to real hardware. Based on research showing proper
                  domain randomization improves transfer from 5% to 87%.
                </p>
                <a
                  href="/contact?interest=sim2real"
                  className="inline-flex items-center text-sm font-semibold text-emerald-400 hover:text-emerald-300"
                >
                  Learn about Sim2Real Validation
                  <ChevronRight className="ml-1 h-4 w-4" />
                </a>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-white/10 p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-400">50%</p>
                  <p className="mt-1 text-xs text-zinc-400">Basic</p>
                </div>
                <div className="rounded-xl bg-white/10 p-4 text-center ring-1 ring-emerald-500/50">
                  <p className="text-2xl font-bold text-emerald-400">70%</p>
                  <p className="mt-1 text-xs text-zinc-400">Standard</p>
                </div>
                <div className="rounded-xl bg-white/10 p-4 text-center">
                  <p className="text-2xl font-bold text-emerald-400">85%+</p>
                  <p className="mt-1 text-xs text-zinc-400">Premium</p>
                </div>
              </div>
            </div>
          </section>

          {/* Complement Section */}
          <section className="mb-16 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-8">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                  <TrendingUp className="h-3 w-3" />
                  Research-Backed
                </div>
                <h2 className="text-2xl font-bold text-zinc-900">
                  Already collecting real-world data?
                </h2>
                <p className="text-zinc-600">
                  Simulation doesn't replace your real-world capture; it amplifies it.
                  Research shows teams that combine simulation with even small amounts
                  of real data see significantly better real-world performance.
                </p>
                <ul className="space-y-2 text-sm text-zinc-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                    <span><strong>38% average boost</strong> vs real-only training</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                    <span><strong>27x faster</strong> data generation than teleop</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                    <span><strong>10,000+ variations</strong> impossible to stage in real life</span>
                  </li>
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
                  Typical Training Mix
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-3 flex-1 rounded-full bg-zinc-100 overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: "99%" }} />
                    </div>
                    <span className="text-sm font-semibold text-emerald-600 w-12">99%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>Simulation (scale + diversity)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-3 flex-1 rounded-full bg-zinc-100 overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: "1%" }} />
                    </div>
                    <span className="text-sm font-semibold text-indigo-600 w-12">1%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>Real-world (reality anchoring)</span>
                  </div>
                </div>
                <p className="mt-4 text-xs text-zinc-400 text-center">
                  Research shows ~99% sim / ~1% real often achieves optimal performance
                </p>
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
