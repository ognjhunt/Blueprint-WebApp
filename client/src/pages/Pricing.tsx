import { SEO } from "@/components/SEO";
import {
  CheckCircle2,
  ChevronRight,
  Download,
  Layers,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Star,
  Zap,
  ArrowRight,
  Building2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

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

const tierComparison = [
  { tier: "Twin Asset", cost: 3500, label: "$2K-$5K" },
  { tier: "Adaptation", cost: 10000, label: "$5K-$15K" },
  { tier: "Living Twin", cost: 24000, label: "$1K-$3K/mo" },
];

const tiers = [
  {
    name: "Twin Asset Access",
    price: "$2,000 - $5,000",
    unit: "per site",
    description:
      "Get a 3D digital twin (Gaussian Splat) of a real commercial facility. Download it, render your own training video, and use the included location metadata to ground your model in reality.",
    cta: "Get a Twin",
    ctaHref: "/contact?tier=twin-asset",
    highlighted: false,
    icon: <Download className="h-5 w-5" />,
    features: [
      "Gaussian Splat file (PLY format)",
      "Self-serve download from our portal",
      "Location metadata and floor plan reference",
      "Render your own training video in any engine",
      "Commercial license for model training",
    ],
  },
  {
    name: "Adaptation-as-a-Service",
    price: "$5,000 - $15,000",
    unit: "per cycle",
    badge: "Most Popular",
    description:
      "We handle the hard part. Pick a target facility, and we render training video from its digital twin, fine-tune your world model or robot policy, and deliver ready-to-deploy adapter weights. Just flash them to your robot.",
    cta: "Start an Adaptation",
    ctaHref: "/contact?tier=adaptation",
    highlighted: true,
    icon: <Sparkles className="h-5 w-5" />,
    features: [
      "Training video rendered from your target facility's twin",
      "Fine-tuning for your model (DreamDojo, Cosmos, OpenVLA, GR00T, and more)",
      "LoRA adapter weights delivered ready for OTA deployment",
      "Adaptation report with metrics and validation results",
      "Support for custom model architectures on request",
    ],
  },
  {
    name: "Living Twin",
    price: "$1,000 - $3,000",
    unit: "/month per site",
    description:
      "For facilities that change over time. We periodically re-scan the site, update the digital twin, and deliver fresh adapter weights each cycle so your robot keeps up with the real world.",
    cta: "Subscribe",
    ctaHref: "/contact?tier=living-twin",
    highlighted: false,
    icon: <RefreshCw className="h-5 w-5" />,
    features: [
      "Periodic re-scans of your facility",
      "Updated digital twin after each scan",
      "Fresh adapter weights delivered each cycle",
      "Drift monitoring between twin and reality",
      "Priority support and dedicated account manager",
    ],
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint - Digital Twin Services for Robot Adaptation"
        description="Digital twins of real facilities. Fine-tune your world model or robot policy on site-specific data with adapter weights ready for deployment."
        canonical="/pricing"
      />

      <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="mb-16 space-y-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-zinc-500 shadow-sm">
              <MessageSquare className="h-3 w-3" />
              Digital Twin Services
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
              Adapt your robot to any facility
            </h1>

            <p className="mx-auto max-w-2xl text-lg text-zinc-600">
              We scan real commercial facilities and turn them into digital twins, then
              fine-tune your world model or robot policy against them. You get adapter
              weights ready for deployment -- no simulation expertise required.
            </p>
          </header>

          {/* Pricing Cards */}
          <section className="mb-16">
            <div className="grid gap-6 lg:grid-cols-3">
              {tiers.map((tier) => (
                <div
                  key={tier.name}
                  className={`relative flex flex-col rounded-3xl border p-8 shadow-sm transition ${
                    tier.highlighted
                      ? "border-indigo-300 bg-white ring-2 ring-indigo-500/20"
                      : "border-zinc-200 bg-white"
                  }`}
                >
                  {tier.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white shadow-sm">
                        <Star className="h-3 w-3" />
                        {tier.badge}
                      </span>
                    </div>
                  )}

                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                    {tier.icon}
                  </div>

                  <h3 className="text-lg font-bold text-zinc-900">{tier.name}</h3>

                  <div className="mt-3 space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold tracking-tight text-zinc-900">
                        {tier.price}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500">{tier.unit}</p>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-zinc-600">
                    {tier.description}
                  </p>

                  <ul className="mt-6 space-y-3 flex-1">
                    {tier.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm text-zinc-700"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <a
                    href={tier.ctaHref}
                    className={`mt-8 inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition ${
                      tier.highlighted
                        ? "bg-indigo-600 text-white hover:bg-indigo-700"
                        : "bg-zinc-900 text-white hover:bg-zinc-800"
                    }`}
                  >
                    {tier.cta}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          </section>

          {/* Tier Comparison Chart */}
          <section className="mb-16 rounded-2xl border border-zinc-200 bg-zinc-50 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-zinc-900">
                Investment per adaptation cycle
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                Typical cost range for a single commercial facility
              </p>
            </div>
            <div className="mx-auto max-w-lg">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={tierComparison} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: "#71717a" }}
                    tickFormatter={(v: number) =>
                      v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`
                    }
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="tier"
                    type="category"
                    tick={{ fontSize: 13, fill: "#3f3f46", fontWeight: 500 }}
                    width={100}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toLocaleString()}`, "Midpoint cost"]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e4e4e7",
                      fontSize: "13px",
                    }}
                  />
                  <Bar dataKey="cost" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-center text-xs text-zinc-400 mt-2">
                Chart shows midpoint of each tier's price range (Living Twin shown as annualized)
              </p>
            </div>
          </section>

          {/* How It Works (focused on Mode 2 -- site-specific fine-tuning) */}
          <section className="mb-16 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white p-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-zinc-900 mb-3">
                How site-specific adaptation works
              </h2>
              <p className="text-zinc-600 max-w-2xl mx-auto">
                Your robot was trained on generic data. We make it work in a specific
                building by fine-tuning on that building's digital twin.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  step: "1",
                  title: "Capture",
                  desc: "We scan the target facility and build a Gaussian Splat -- a 3D digital twin of the real space.",
                },
                {
                  step: "2",
                  title: "Render",
                  desc: "We generate training video from the twin: camera paths that show the space as your robot would see it.",
                },
                {
                  step: "3",
                  title: "Fine-tune",
                  desc: "We adapt your world model or vision-language-action policy using the site-specific video data.",
                },
                {
                  step: "4",
                  title: "Deploy",
                  desc: "You receive LoRA adapter weights that bolt onto your base model. Flash them OTA and go.",
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl border border-indigo-100 bg-white p-5 shadow-sm"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                    {item.step}
                  </span>
                  <h3 className="mt-3 font-bold text-zinc-900 text-sm">{item.title}</h3>
                  <p className="mt-1 text-xs text-zinc-600 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Environment Pack Licensing */}
          <section className="mb-16">
            <div className="rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
              <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
                {/* Left: Info */}
                <div className="space-y-6">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-zinc-600 mb-3">
                      <Building2 className="h-3 w-3" />
                      Volume Licensing
                    </div>
                    <h2 className="text-3xl font-bold text-zinc-900">
                      Environment Pack Licensing
                    </h2>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold tracking-tight text-zinc-900">
                        $50K - $500K
                      </span>
                    </div>
                    <p className="text-sm text-zinc-500">
                      Curated collections of digital twins
                    </p>
                  </div>

                  <p className="text-zinc-600">
                    Building a foundation model and need diverse, high-quality 3D environments?
                    License curated packs of digital twins spanning warehouses, retail,
                    healthcare, manufacturing, and more. Volume licensing available across 100+
                    sites.
                  </p>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <a
                      href="/contact?tier=environment-pack"
                      className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
                    >
                      Contact Sales
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </a>
                  </div>
                </div>

                {/* Right: Highlights */}
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">
                    What's Included
                  </p>
                  <ul className="space-y-3">
                    {[
                      "Curated packs organized by facility type (warehouse, retail, hospital, factory, etc.)",
                      "Every twin is a Gaussian Splat built from real-world scans",
                      "Standardized metadata: floor plans, dimensions, lighting profiles",
                      "Volume discounts for 100+ site collections",
                      "Foundation model training license included",
                      "New facility types added quarterly",
                    ].map((highlight) => (
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
                Quality gates every twin passes
              </h2>
              <p className="text-zinc-600 max-w-2xl mx-auto">
                A scan is just data. A calibrated twin is a reliable training signal. Every
                Blueprint digital twin passes quality gates before it reaches your pipeline.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  title: "Geometric fidelity",
                  desc: "Sub-centimeter alignment between the scan and the real facility layout.",
                },
                {
                  title: "Photometric calibration",
                  desc: "Lighting and color consistency checked against on-site reference captures.",
                },
                {
                  title: "Splat quality scoring",
                  desc: "Per-region quality scores so you know which areas of the twin are most reliable.",
                },
                {
                  title: "Metadata standards",
                  desc: "Floor plans, room labels, dimensions, and sensor placement in a consistent schema.",
                },
                {
                  title: "Adaptation validation",
                  desc: "Before-and-after metrics showing how much the adapter improved on site-specific benchmarks.",
                },
                {
                  title: "Versioned releases",
                  desc: "Every twin and adapter set is versioned so you can reproduce results and track changes.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-indigo-100 bg-white p-5 shadow-sm"
                >
                  <h3 className="font-bold text-zinc-900 text-sm mb-2">{item.title}</h3>
                  <p className="text-xs text-zinc-700 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Supported Models */}
          <section className="mb-16 rounded-2xl border border-zinc-200 bg-zinc-900 p-8 text-white">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-300">
                  <Layers className="h-3 w-3" />
                  Model Agnostic
                </div>
                <h2 className="text-2xl font-bold">
                  Works with the models you already use
                </h2>
                <p className="text-zinc-400">
                  We fine-tune adapters for the leading world models and vision-language-action
                  policies. If your architecture supports LoRA-style fine-tuning, we can
                  probably work with it.
                </p>
                <a
                  href="/contact"
                  className="inline-flex items-center text-sm font-semibold text-indigo-300 hover:text-indigo-200"
                >
                  Ask about your model
                  <ChevronRight className="ml-1 h-4 w-4" />
                </a>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  {
                    title: "World Models",
                    desc: "DreamDojo, Cosmos, and other video prediction architectures.",
                  },
                  {
                    title: "VLA Policies",
                    desc: "OpenVLA, RT-2, and other vision-language-action models.",
                  },
                  {
                    title: "Foundation Models",
                    desc: "GR00T, Octo, and emerging generalist robot policies.",
                  },
                  {
                    title: "Custom Architectures",
                    desc: "Bring your own model. If it supports fine-tuning, we can adapt it.",
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

          {/* Why Fine-Tune Section */}
          <section className="mb-16 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-8">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                  <Zap className="h-3 w-3" />
                  Why Adapt?
                </div>
                <h2 className="text-2xl font-bold text-zinc-900">
                  General models struggle in specific buildings
                </h2>
                <p className="text-zinc-600">
                  A robot trained on generic data will hesitate in a new warehouse because the
                  lighting, layout, and obstacles are unfamiliar. Site-specific fine-tuning
                  closes that gap without retraining from scratch.
                </p>
                <ul className="space-y-2 text-sm text-zinc-600">
                  {[
                    "Faster deployment at new facilities",
                    "Fewer failures from unfamiliar environments",
                    "No need to collect on-site robot data for weeks",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="/how-it-works"
                  className="inline-flex items-center text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Learn how adaptation works
                  <ArrowRight className="ml-1 h-4 w-4" />
                </a>
              </div>

              <div className="rounded-xl bg-white p-6 shadow-md border border-emerald-100">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">
                  Typical results after one adaptation cycle
                </p>
                <div className="space-y-4">
                  {[
                    {
                      metric: "Navigation success rate",
                      before: "62%",
                      after: "94%",
                    },
                    {
                      metric: "Object recognition accuracy",
                      before: "71%",
                      after: "96%",
                    },
                    {
                      metric: "Time to production readiness",
                      before: "6-8 weeks",
                      after: "3-5 days",
                    },
                  ].map((item) => (
                    <div key={item.metric} className="space-y-1">
                      <p className="text-sm font-medium text-zinc-700">{item.metric}</p>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-zinc-400 line-through">{item.before}</span>
                        <ArrowRight className="h-3 w-3 text-emerald-500" />
                        <span className="font-bold text-emerald-700">{item.after}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="text-center">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-10">
              <h2 className="text-xl font-bold text-zinc-900">
                Tell us about your model and target facility.
              </h2>
              <p className="mt-3 max-w-xl mx-auto text-zinc-600">
                Tell us about your model and target facility. We will scope an adaptation
                cycle and get you a quote within 48 hours.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <a
                  href="/contact"
                  className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  Talk to Us
                </a>
                <a
                  href="/how-it-works"
                  className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-8 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
                >
                  See How It Works
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
