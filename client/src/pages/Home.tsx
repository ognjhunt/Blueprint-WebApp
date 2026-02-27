import { CTAButtons } from "@/components/site/CTAButtons";
import { LogoWall } from "@/components/site/LogoWall";
import SceneSmithExplainerMedia from "@/components/sections/SceneSmithExplainerMedia";
import { SEO } from "@/components/SEO";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Globe2,
  Layers,
  MapPin,
  ScanLine,
  Shield,
  Sparkles,
  Terminal,
  Zap,
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

// --- Data ---

const offeringCards = [
  {
    title: "Twin Asset Access",
    badge: "Digital Twins",
    description:
      "Gaussian Splat twins of real warehouses, kitchens, retail stores, and factories. One scan produces hours of training data for any world model.",
    bullets: [
      "Thousands of real commercial locations, with more added weekly",
      "PLY files ready for DreamDojo, Cosmos, or Isaac Sim",
    ],
    ctaLabel: "Browse locations",
    ctaHref: "/marketplace/scenes",
    icon: <MapPin className="h-8 w-8 text-zinc-900" />,
  },
  {
    title: "Site-Specific Fine-Tuning",
    badge: "Core Service",
    description:
      "We render training video from your target facility's twin, then fine-tune your world model or VLA policy against it. You get LoRA adapter weights, ready to deploy.",
    bullets: [
      "Works with DreamDojo, Cosmos, OpenVLA, GR00T, and others",
      "LoRA weights sent over the air before your robot arrives on-site",
    ],
    ctaLabel: "Learn how it works",
    ctaHref: "/how-it-works",
    icon: <Zap className="h-8 w-8 text-zinc-900" />,
  },
  {
    title: "Policy Benchmarks",
    badge: "Evaluation",
    description:
      "Test your fine-tuned policy against reserved twin scenes. Get success rates, failure analysis, and confidence scores before real-world deployment.",
    bullets: [
      "Reserved benchmark twins not used for training (no overfitting)",
      "Standardized metrics: success rate, collisions, completion time",
    ],
    ctaLabel: "Explore benchmarks",
    ctaHref: "/evals",
    icon: <BarChart3 className="h-8 w-8 text-zinc-900" />,
  },
];

const whyBlueprint = [
  {
    title: "One scan, hundreds of hours of training data",
    description:
      "A 15-minute iPhone scan becomes a Gaussian Splat that renders 100+ hours of training video from different viewpoints. That's a 400:1 data multiplier from a single walk-through.",
  },
  {
    title: "General models still struggle in specific buildings",
    description:
      "DreamDojo and Cosmos are powerful out of the box, but they make mistakes in unfamiliar facilities. Fine-tuning on your exact site fixes that. It's what we do.",
  },
  {
    title: "Weights arrive before the robot does",
    description:
      "LoRA adapter weights are small enough to send over the air. Your robot loads them in transit and shows up already familiar with the building.",
  },
];

const dataMultiplierChart = [
  { name: "iPhone Scan", minutes: 15 },
  { name: "Gaussian Splat", minutes: 30 },
  { name: "Rendered Video", minutes: 6000 },
  { name: "Fine-Tune Cycles", minutes: 12000 },
];

const labBullets = [
  "Access digital twins of real commercial locations",
  "Fine-tune DreamDojo, Cosmos, or your own world model per site",
  "Receive LoRA adapter weights ready for OTA deployment",
];

const providerBullets = [
  "List your facilities to attract robotics pilots",
  "Revenue share on every adaptation cycle your location enables",
];

// --- Component ---

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill="url(#grid-pattern)" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Digital Twins for Robot Learning"
        description="Digital twins of real commercial locations. Fine-tune any world model or VLA policy for site-specific deployment. One scan, hundreds of hours of training data."
        canonical="/"
        image="https://tryblueprint.io/images/og-home.png"
      />
      <div className="relative min-h-screen overflow-hidden bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        {/* --- Hero Section --- */}
        <div className="relative pb-20 pt-16 sm:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              {/* Hero Content */}
              <div className="space-y-8">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600">
                    <Sparkles className="h-3 w-3" />
                    Digital Twins for Robots
                  </div>
                  <h1 className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
                    Fine-tune any world model to your exact facility.
                  </h1>
                  <p className="max-w-xl text-lg leading-relaxed text-zinc-600">
                    We scan real warehouses, kitchens, stores, and factories, then turn those
                    scans into digital twins your model can learn from. Pick a site, and we
                    fine-tune your model against it and ship adapter weights your robot can
                    load before it arrives.
                  </p>
                </div>

                <CTAButtons
                  primaryHref="/solutions"
                  primaryLabel="See how it works"
                  secondaryHref="/contact"
                  secondaryLabel="Get a twin"
                />

                <div className="pt-4 opacity-80 grayscale transition-all duration-500 hover:opacity-100 hover:grayscale-0">
                  <LogoWall />
                </div>
              </div>

              {/* Hero Visual */}
              <div className="relative">
                <div className="absolute -inset-4 rounded-full bg-indigo-500/20 blur-3xl filter" />
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-xl backdrop-blur-md">
                  <div className="overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50">
                    <img
                      src="/images/Gemini_Hero.png"
                      alt="Digital twin of a commercial facility"
                      className="h-48 w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                      <Terminal className="h-4 w-4" />
                      Facility Types
                    </div>
                    <p className="text-sm text-zinc-600">
                      Warehouses, kitchens, retail stores, factories, offices, and labs.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- Offering Cards --- */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {offeringCards.map((offering) => (
              <article
                key={offering.title}
                className="group flex h-full flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-indigo-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-xl bg-zinc-100 p-3 text-zinc-900 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
                    {offering.icon}
                  </div>
                  <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    {offering.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-zinc-900">{offering.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{offering.description}</p>
                </div>

                <ul className="space-y-2 text-sm text-zinc-600">
                  {offering.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-2">
                  <a
                    href={offering.ctaHref}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-900 hover:text-indigo-600"
                  >
                    {offering.ctaLabel}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* --- Data Multiplier Chart --- */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 mb-4">
                  <ScanLine className="h-3 w-3" />
                  The Data Multiplier
                </div>
                <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                  15 minutes of scanning. 100+ hours of training video.
                </h2>
                <p className="mt-4 text-zinc-600">
                  An iPhone scan of a facility produces a Gaussian Splat you can render from
                  any viewpoint. World models like DreamDojo and Cosmos consume this video
                  directly for fine-tuning. No 3D conversion, no physics engine.
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-white p-4 ring-1 ring-zinc-200">
                    <p className="text-2xl font-bold text-emerald-600">15 min</p>
                    <p className="text-xs text-zinc-500">iPhone scan time</p>
                  </div>
                  <div className="rounded-lg bg-white p-4 ring-1 ring-zinc-200">
                    <p className="text-2xl font-bold text-emerald-600">100+ hrs</p>
                    <p className="text-xs text-zinc-500">Rendered training video</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Data Output by Pipeline Stage (minutes)
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dataMultiplierChart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "#94a3b8" }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={110}
                      tick={{ fontSize: 12, fill: "#64748b" }}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value.toLocaleString()} min`, "Output"]}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
                    />
                    <Bar dataKey="minutes" fill="#10b981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        <SceneSmithExplainerMedia />

        {/* --- Why Blueprint --- */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-zinc-900">Why bother with site-specific fine-tuning?</h2>
              <p className="mt-2 text-zinc-600">
                General-purpose world models are good, but they still make mistakes in
                buildings they haven't seen. A quick fine-tuning pass on your facility
                fixes most of those errors.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {whyBlueprint.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200"
                >
                  <h3 className="font-bold text-zinc-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* --- Personas --- */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Robotics Team Persona */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                For Robotics Teams
              </p>
              <h3 className="mt-2 text-xl font-bold text-zinc-900">
                Fine-tune your model. Deploy on-site.
              </h3>
              <ul className="mt-4 space-y-2">
                {labBullets.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-zinc-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Facility Provider Persona */}
            <div className="rounded-2xl bg-zinc-900 p-8 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                For Facility Owners
              </p>
              <h3 className="mt-2 text-xl font-bold text-white">
                Your building is worth something to robotics teams.
              </h3>
              <ul className="mt-4 space-y-2">
                {providerBullets.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-zinc-300">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="/pilot-exchange"
                className="mt-6 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Join the Pilot Exchange
              </a>
            </div>
          </div>
        </section>

        {/* --- Feature Highlights (Teasers) --- */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            <a
              href="/how-it-works"
              className="group rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <ScanLine className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">Scan to adapt pipeline</p>
                  <p className="text-sm text-zinc-500">iPhone scan to LoRA weights in days</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>

            <a
              href="/evals"
              className="group rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">Pre-deploy benchmarks</p>
                  <p className="text-sm text-zinc-500">Test before you ship to site</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>

            <a
              href="/pilot-exchange"
              className="group rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
                  <Globe2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">Pilot Exchange</p>
                  <p className="text-sm text-zinc-500">Match robots to real facilities</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>
          </div>
        </section>

        {/* --- Final CTA --- */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-zinc-900 p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Tell us the building. We'll adapt the model.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              Share your target location and the model you're using. We'll scope
              how fast we can get adapted weights to your robot.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href="/solutions"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                See Solutions
              </a>
              <a
                href="/contact"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
