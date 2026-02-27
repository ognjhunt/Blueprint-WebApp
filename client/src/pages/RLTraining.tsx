import { SEO } from "@/components/SEO";
import {
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Clock,
  Database,
  Layers,
  LineChart,
  RefreshCw,
  Server,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

// --- Data ---

const whatWeDeliver = [
  {
    title: "LoRA adapter weights",
    desc: "Ready for over-the-air deployment. Drop these into your model and it knows the target facility.",
    icon: <Brain className="h-6 w-6" />,
    color: "indigo",
  },
  {
    title: "Adaptation report",
    desc: "Full fine-tuning metrics, loss curves, and confidence scores showing how well the model learned the new site.",
    icon: <LineChart className="h-6 w-6" />,
    color: "emerald",
  },
  {
    title: "Pre-deploy benchmark",
    desc: "Video-prediction evaluation against the target digital twin, so you know how the adapted model performs before deploying.",
    icon: <BarChart3 className="h-6 w-6" />,
    color: "amber",
  },
  {
    title: "Transfer indicators",
    desc: "Gap analysis comparing adapted vs. unadapted model performance on the target site.",
    icon: <Target className="h-6 w-6" />,
    color: "rose",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Pick a target facility",
    desc: "Choose a location from the Blueprint twin library, or we scan your facility and build a new digital twin for you.",
    icon: <Layers className="h-6 w-6" />,
  },
  {
    step: "02",
    title: "We render training video",
    desc: "Our pipeline generates synthetic video from the digital twin, capturing the exact layout, lighting, and objects of the target site.",
    icon: <Server className="h-6 w-6" />,
  },
  {
    step: "03",
    title: "Fine-tune your model",
    desc: "We run fine-tuning on your chosen world model or VLA against the rendered site data.",
    icon: <RefreshCw className="h-6 w-6" />,
  },
  {
    step: "04",
    title: "Receive LoRA weights",
    desc: "Download your LoRA adapter weights. Plug them into your base model and it knows the target site.",
    icon: <CheckCircle2 className="h-6 w-6" />,
  },
];

const whyFineTuning = [
  {
    title: "Your specific site",
    desc: "A general model knows about warehouses. A fine-tuned model knows YOUR warehouse -- every aisle, shelf, and loading dock.",
    stat: "Your",
    statLabel: "Specific site",
  },
  {
    title: "No on-site data collection",
    desc: "Instead of weeks of on-site recording, we render training video from the digital twin. No disruption to operations.",
    stat: "0",
    statLabel: "Days on-site",
  },
  {
    title: "Any world model",
    desc: "Bring your preferred foundation model. We support DreamDojo, Cosmos, OpenVLA, GR00T, and others.",
    stat: "4+",
    statLabel: "Models supported",
  },
  {
    title: "Measured improvement",
    desc: "Every job includes before-and-after benchmarks so you can see how much the adaptation improved performance at the target site.",
    stat: "100%",
    statLabel: "Benchmarked",
  },
];

const pricingTiers = [
  {
    name: "Starter",
    price: "$5,000",
    desc: "Adapt one model to one facility and see the results",
    features: [
      "1 site, 1 model",
      "Single adaptation cycle",
      "LoRA weights delivery",
      "Basic adaptation report",
    ],
    highlight: false,
  },
  {
    name: "Professional",
    price: "$15,000",
    desc: "Multi-site adaptation with comprehensive benchmarking",
    features: [
      "Up to 5 sites, 3 models",
      "Full benchmark report included",
      "Priority queue access",
      "Transfer indicators & gap analysis",
      "Dedicated support channel",
    ],
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    desc: "Continuous adaptation at scale with dedicated infrastructure",
    features: [
      "Unlimited sites",
      "Custom model support",
      "Dedicated fine-tuning infrastructure",
      "Living twin subscription",
      "Ongoing re-adaptation as sites change",
      "Direct engineering support",
    ],
    highlight: false,
  },
];

// --- Visual Helpers ---

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern-rl"
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
        fill="url(#grid-pattern-rl)"
      />
    </svg>
  );
}

// --- Main Component ---

export default function RLTraining() {
  return (
    <>
      <SEO
        title="Model Fine-Tuning | Fine-Tuning as a Service"
        description="Fine-tune world models and VLAs against digital twins of specific facilities. Blueprint renders training video from your target site and delivers LoRA adapter weights. Coming Q2 2026."
        canonical="/rl-training"
      />
      <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-violet-100 selection:text-violet-900">
        <DotPattern />

        <div className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
          {/* --- Hero Section --- */}
          <header className="mb-20 grid gap-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-8">
              <div className="space-y-6">
                {/* Coming Soon Badge */}
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-violet-700 backdrop-blur-sm">
                    <Sparkles className="h-3 w-3" />
                    Model Fine-Tuning as a Service
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-700">
                    <Clock className="h-3 w-3" />
                    Coming Q2 2026
                  </div>
                </div>
                <h1 className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
                  Fine-tune your model on any facility.
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-zinc-600">
                  Blueprint fine-tunes world models and VLAs against digital twins of specific
                  facilities. You pick a target location from our twin library, we render
                  training video and run fine-tuning, and you receive LoRA adapter weights
                  ready for deployment.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <a
                  href="/contact?service=rl-training"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-700"
                >
                  Join the Waitlist
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="/evals"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                >
                  Learn About Evals First
                </a>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-6 pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-violet-600">4+</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Models Supported</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-600">LoRA</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Adapter Weights</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-amber-600">Any</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Facility Type</p>
                </div>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-violet-500/10 blur-3xl filter" />
              <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
                {/* Terminal Header */}
                <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-red-400" />
                      <div className="h-3 w-3 rounded-full bg-amber-400" />
                      <div className="h-3 w-3 rounded-full bg-emerald-400" />
                    </div>
                    <span className="ml-2 font-mono text-xs text-zinc-500">
                      fine_tuning_dashboard.py
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {/* Training Progress */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-900">Fine-Tuning Progress</span>
                      <span className="font-mono text-violet-600">87%</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400"
                        style={{ width: "87%" }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Epoch 13 / 15</span>
                      <span>ETA: 23 min</span>
                    </div>
                  </div>

                  {/* Live Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-100">
                      <p className="text-xs text-emerald-600 font-medium">Adaptation Score</p>
                      <p className="text-xl font-bold text-emerald-700">92.1%</p>
                    </div>
                    <div className="rounded-lg bg-violet-50 p-3 ring-1 ring-violet-100">
                      <p className="text-xs text-violet-600 font-medium">Loss</p>
                      <p className="text-xl font-bold text-violet-700">0.0034</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-100">
                      <p className="text-xs text-amber-600 font-medium">Video Frames</p>
                      <p className="text-xl font-bold text-amber-700">48,000</p>
                    </div>
                    <div className="rounded-lg bg-zinc-50 p-3 ring-1 ring-zinc-200">
                      <p className="text-xs text-zinc-500 font-medium">LoRA Rank</p>
                      <p className="text-xl font-bold text-zinc-700">64</p>
                    </div>
                  </div>

                  {/* Task Info */}
                  <div className="rounded-lg bg-zinc-900 p-4 font-mono text-xs text-zinc-300">
                    <p className="text-zinc-500"># Current fine-tuning job</p>
                    <p><span className="text-violet-400">scene:</span> warehouse_seattle_42</p>
                    <p><span className="text-violet-400">task:</span> site_adaptation</p>
                    <p><span className="text-violet-400">model:</span> dreamdojo_v2</p>
                    <p><span className="text-emerald-400">status:</span> fine-tuning...</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="space-y-24">
            {/* --- What is Model Fine-Tuning Section --- */}
            <section className="relative overflow-hidden rounded-[2.5rem] border border-violet-100 bg-gradient-to-br from-violet-50/50 to-white p-8 sm:p-12 lg:p-16">
              <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-violet-100/60 blur-3xl" />

              <div className="relative z-10 grid gap-12 lg:grid-cols-2 lg:items-center">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-md bg-violet-100 px-2 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
                    <Brain className="h-3 w-3" /> What is Model Fine-Tuning?
                  </div>
                  <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
                    Making a general model an expert at your specific site.
                  </h2>
                  <p className="text-zinc-600 leading-relaxed">
                    A <strong>world model</strong> (like DreamDojo or Cosmos) learns general knowledge
                    from large amounts of video -- it understands how objects move, how rooms look,
                    and how physics works. But to work well at <em>your</em> specific warehouse,
                    kitchen, or store, it needs to see that exact place. That is where fine-tuning
                    comes in.
                  </p>
                  <ul className="space-y-3 text-sm text-zinc-700">
                    {[
                      "A world model learns general knowledge from lots of video",
                      "But it needs to see YOUR specific facility to work well there",
                      "We scan the facility, create a digital twin, and render training video from it",
                      "We fine-tune the model on that video -- the result is LoRA adapter weights that make it a site expert",
                    ].map((item, i) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
                          {i + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Visual: Fine-Tuning Flow Diagram */}
                <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
                  <p className="mb-4 text-xs font-bold uppercase tracking-widest text-violet-600">
                    The Fine-Tuning Pipeline
                  </p>
                  <div className="space-y-4">
                    <div className="relative flex items-center justify-center py-8">
                      {/* Flow visualization */}
                      <div className="relative h-48 w-48">
                        <div className="absolute inset-0 rounded-full border-2 border-dashed border-violet-200" />

                        {/* Nodes */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-lg bg-violet-100 px-3 py-2 text-center">
                          <p className="text-xs font-bold text-violet-700">Scan</p>
                        </div>
                        <div className="absolute top-1/2 -right-3 -translate-y-1/2 rounded-lg bg-emerald-100 px-3 py-2 text-center">
                          <p className="text-xs font-bold text-emerald-700">Render</p>
                        </div>
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-lg bg-amber-100 px-3 py-2 text-center">
                          <p className="text-xs font-bold text-amber-700">Fine-Tune</p>
                        </div>
                        <div className="absolute top-1/2 -left-3 -translate-y-1/2 rounded-lg bg-rose-100 px-3 py-2 text-center">
                          <p className="text-xs font-bold text-rose-700">Deploy</p>
                        </div>

                        {/* Center */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900">
                          <Brain className="h-6 w-6 text-white" />
                        </div>

                        {/* Arrows */}
                        <RefreshCw className="absolute top-6 right-6 h-4 w-4 text-violet-400" />
                      </div>
                    </div>

                    <div className="rounded-lg bg-zinc-50 p-4 text-xs text-zinc-600">
                      <p className="font-semibold text-zinc-900">The key insight:</p>
                      <p className="mt-1">
                        Instead of collecting real video at the site, we render <strong>training
                        data from the digital twin</strong> -- no disruption to your operations,
                        no data-collection crews.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* --- Why Fine-Tuning Section --- */}
            <section className="relative">
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/50 px-4 py-1 text-xs font-bold uppercase tracking-wider text-emerald-600">
                  <Zap className="h-3 w-3" />
                  Why Fine-Tuning?
                </div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  What fine-tuning on a digital twin gets you
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-zinc-600">
                  General models work broadly but struggle in specific buildings. Fine-tuning against a
                  digital twin of your facility fixes that, with no on-site data collection required.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {whyFineTuning.map((item) => (
                  <div
                    key={item.title}
                    className="group rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:shadow-lg hover:border-emerald-200"
                  >
                    <div className="mb-4 text-center">
                      <p className="text-4xl font-bold text-emerald-600">{item.stat}</p>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider">{item.statLabel}</p>
                    </div>
                    <h3 className="font-bold text-zinc-900 text-center">{item.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600 text-center">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* --- How It Works Section --- */}
            <section className="relative overflow-hidden rounded-[2.5rem] bg-zinc-900 p-8 text-zinc-300 sm:p-12 lg:p-16 shadow-2xl">
              <div className="absolute top-0 left-0 h-full w-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
              <div className="absolute bottom-0 right-0 -mb-32 -mr-32 h-96 w-96 rounded-full bg-violet-900/20 blur-3xl" />

              <div className="relative z-10 space-y-12">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white sm:text-4xl">
                    How it works
                  </h2>
                  <p className="mt-4 max-w-2xl mx-auto text-zinc-400">
                    From target facility to deployed LoRA weights in four steps.
                    No ML infrastructure required on your end.
                  </p>
                </div>

                {/* Pipeline Steps */}
                <div className="grid gap-6 lg:grid-cols-4">
                  {howItWorks.map((step, i) => (
                    <div key={step.step} className="relative">
                      <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 h-full">
                        <div className="mb-4 flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-violet-400">
                            {step.step}
                          </span>
                          <div className="text-zinc-500">{step.icon}</div>
                        </div>
                        <h3 className="text-lg font-bold text-white">{step.title}</h3>
                        <p className="mt-2 text-sm text-zinc-400">{step.desc}</p>
                      </div>
                      {i < 3 && (
                        <div className="absolute -right-3 top-1/2 -translate-y-1/2 hidden lg:block">
                          <ArrowRight className="h-6 w-6 text-zinc-700" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* --- What We Deliver Section --- */}
            <section className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                  What you receive
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-zinc-600">
                  Every fine-tuning job delivers a complete package: LoRA adapter weights
                  for deployment, an adaptation report with metrics, a pre-deploy benchmark
                  against the target twin, and transfer indicators showing the improvement.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {whatWeDeliver.map((item) => (
                  <div
                    key={item.title}
                    className={`group rounded-2xl border p-6 transition-all hover:shadow-md ${
                      item.color === "indigo" ? "border-indigo-100 hover:border-indigo-200 bg-white" :
                      item.color === "emerald" ? "border-emerald-100 hover:border-emerald-200 bg-white" :
                      item.color === "amber" ? "border-amber-100 hover:border-amber-200 bg-white" :
                      "border-rose-100 hover:border-rose-200 bg-white"
                    }`}
                  >
                    <div className={`mb-4 inline-flex rounded-lg p-2 ${
                      item.color === "indigo" ? "bg-indigo-100 text-indigo-600" :
                      item.color === "emerald" ? "bg-emerald-100 text-emerald-600" :
                      item.color === "amber" ? "bg-amber-100 text-amber-600" :
                      "bg-rose-100 text-rose-600"
                    }`}>
                      {item.icon}
                    </div>
                    <h3 className="font-bold text-zinc-900">{item.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{item.desc}</p>
                  </div>
                ))}
              </div>

              {/* Deliverables Detail */}
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 space-y-6">
                <div>
                  <div className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
                    Core deliverable files
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { file: "lora_weights.safetensors", desc: "LoRA adapter weights" },
                      { file: "adaptation_report.json", desc: "Fine-tuning metrics & scores" },
                      { file: "benchmark_results.json", desc: "Pre-deploy evaluation" },
                      { file: "transfer_analysis.json", desc: "Gap analysis & indicators" },
                    ].map((item) => (
                      <div key={item.file} className="rounded-xl bg-white p-4 ring-1 ring-zinc-200">
                        <p className="font-mono text-sm font-bold text-violet-600">{item.file}</p>
                        <p className="mt-1 text-xs text-zinc-500">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-zinc-200 pt-6">
                  <div className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
                    Reports included
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      { title: "Loss Curves & Convergence", desc: "Epoch-by-epoch training loss, validation metrics, and convergence analysis" },
                      { title: "Confidence Scores", desc: "Per-scene confidence showing how well the model adapted to different areas of the facility" },
                      { title: "Video Prediction Quality", desc: "Frame-level comparison of predicted vs. ground-truth video from the target twin" },
                      { title: "Transfer Gap Analysis", desc: "Quantified performance difference between the base model and the adapted model on the target site" },
                      { title: "Site Coverage Map", desc: "Which areas of the facility the model has strongest and weakest adaptation for" },
                      { title: "Deployment Readiness", desc: "Pre-flight checks and recommendations for deploying the LoRA weights in production" },
                    ].map((item) => (
                      <div key={item.title} className="rounded-xl bg-white p-4 ring-1 ring-emerald-100">
                        <p className="font-semibold text-zinc-900">{item.title}</p>
                        <p className="mt-1 text-xs text-zinc-600">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-zinc-200 pt-6 bg-white rounded-xl p-4 ring-1 ring-violet-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-violet-700 mb-2">Included by default</p>
                  <p className="text-sm text-zinc-700">
                    Every fine-tuning job ships with the diagnostics you need to deploy confidently:
                    adaptation metrics, benchmark evaluations, and transfer analysis.
                  </p>
                </div>
              </div>
            </section>

            {/* --- Pricing Section --- */}
            <section className="space-y-8">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-1 text-xs font-bold uppercase tracking-wider text-zinc-600">
                  <TrendingUp className="h-3 w-3" />
                  Pricing Preview
                </div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900">
                  Fine-tuning packages
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-zinc-600">
                  From a single-site proof of concept to enterprise-wide continuous adaptation.
                  Final pricing will be announced at launch.
                </p>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                {pricingTiers.map((tier) => (
                  <div
                    key={tier.name}
                    className={`relative rounded-2xl border p-6 ${
                      tier.highlight
                        ? "border-violet-200 bg-gradient-to-br from-violet-50 to-white ring-2 ring-violet-200"
                        : "border-zinc-200 bg-white"
                    }`}
                  >
                    {tier.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="rounded-full bg-violet-600 px-3 py-1 text-xs font-bold text-white">
                          Most Popular
                        </span>
                      </div>
                    )}

                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-zinc-900">{tier.name}</h3>
                      <p className="mt-1 text-sm text-zinc-500">{tier.desc}</p>
                      <p className="mt-4">
                        <span className="text-4xl font-bold text-zinc-900">{tier.price}</span>
                        {tier.price !== "Custom" && <span className="text-zinc-500">/job</span>}
                      </p>
                    </div>

                    <ul className="space-y-3 mb-6">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-zinc-600">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <a
                      href="/contact?service=rl-training"
                      className={`block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition ${
                        tier.highlight
                          ? "bg-violet-600 text-white hover:bg-violet-700"
                          : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                      }`}
                    >
                      Join Waitlist
                    </a>
                  </div>
                ))}
              </div>
            </section>

            {/* --- Integration with Blueprint Section --- */}
            <section className="relative overflow-hidden rounded-[2.5rem] border border-indigo-100 bg-white p-8 shadow-sm sm:p-12 lg:p-16">
              <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-100/60 blur-3xl" />

              <div className="relative z-10 grid gap-12 lg:grid-cols-2 lg:items-center">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-md bg-indigo-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
                    <Database className="h-3 w-3" /> Blueprint Integration
                  </div>
                  <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
                    Built on the Blueprint twin library
                  </h2>
                  <p className="text-zinc-600 leading-relaxed">
                    Our scan-to-weights pipeline connects directly to the Blueprint digital twin
                    library. Choose an existing twin or have us scan your facility, and the pipeline
                    handles rendering, fine-tuning, and weight delivery. We support leading world
                    models including DreamDojo, Cosmos, OpenVLA, and GR00T.
                  </p>
                  <ul className="space-y-3 text-sm text-zinc-700">
                    {[
                      "Choose from the Blueprint twin library or bring your own scan",
                      "Scan-to-weights pipeline: facility scan to LoRA delivery",
                      "World model support: DreamDojo, Cosmos, OpenVLA, GR00T",
                      "Continuous re-adaptation as your facility changes over time",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-indigo-500 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6 shadow-sm">
                  <p className="mb-4 text-xs font-bold uppercase tracking-widest text-indigo-600">
                    The scan-to-weights pipeline
                  </p>
                  <div className="space-y-3">
                    {[
                      { step: "1", label: "Twin Library", desc: "Pick a facility or scan yours", color: "bg-zinc-100 text-zinc-700" },
                      { step: "2", label: "Render Video", desc: "Synthetic training data from the twin", color: "bg-indigo-100 text-indigo-700" },
                      { step: "3", label: "Fine-Tune", desc: "Adapt your world model or VLA", color: "bg-emerald-100 text-emerald-700" },
                      { step: "4", label: "LoRA Delivery", desc: "Adapter weights ready for deployment", color: "bg-violet-100 text-violet-700" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-4">
                        <div className={`rounded-lg px-3 py-2 text-sm font-bold ${item.color}`}>
                          {item.label}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-zinc-600">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* --- CTA Section --- */}
            <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-violet-600 to-violet-800 p-8 sm:p-12 lg:p-16 shadow-2xl">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-violet-400/20 blur-3xl" />

              <div className="relative z-10 text-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-sm mb-6">
                  <Clock className="h-3 w-3" />
                  Coming Q2 2026
                </div>
                <h2 className="text-3xl font-bold text-white sm:text-4xl">
                  Be first in line for model fine-tuning.
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-violet-100">
                  Join the waitlist to get early access when fine-tuning launches. We'll notify
                  you as soon as the service is available, with priority access for early sign-ups.
                </p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
                  <a
                    href="/contact?service=rl-training"
                    className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-sm font-semibold text-violet-600 shadow-lg transition hover:bg-violet-50"
                  >
                    Join the Waitlist
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="/marketplace"
                    className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/10 px-8 py-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                  >
                    Explore Twin Library
                  </a>
                </div>

                {/* Partner logos */}
                <div className="mt-12 flex items-center justify-center gap-8 opacity-60">
                  <div className="text-xs font-bold text-white/80 uppercase tracking-wider">
                    Models supported
                  </div>
                  <div className="text-white/80 font-semibold">DreamDojo</div>
                  <div className="text-white/80 font-semibold">Cosmos</div>
                  <div className="text-white/80 font-semibold">OpenVLA</div>
                  <div className="text-white/80 font-semibold">GR00T</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
