import { CTAButtons } from "@/components/site/CTAButtons";
import { LogoWall } from "@/components/site/LogoWall";
import { SEO } from "@/components/SEO";
import {
  ArrowRight,
  BarChart3,
  Box,
  CheckCircle2,
  Database,
  LayoutGrid,
  Sparkles,
  Terminal,
} from "lucide-react";

// --- Simplified Data ---

const offeringCards = [
  {
    title: "Benchmark Packs",
    badge: "Evaluation",
    description:
      "Runnable benchmark suites with SimReady scenes, tasks, and evaluation harness.",
    bullets: [
      "Standardized metrics: success rate, collisions, path efficiency",
      "GPU-parallel evaluation in Isaac Lab-Arena format",
    ],
    ctaLabel: "Browse benchmarks",
    ctaHref: "/evals",
    icon: <BarChart3 className="h-8 w-8 text-zinc-900" />,
  },
  {
    title: "Scene Library",
    badge: "Assets",
    description:
      "Physics-accurate SimReady scenes for training and custom benchmark assembly.",
    bullets: [
      "Sub-mm tolerances with full articulation metadata",
      "Compatible with Isaac Sim, MuJoCo, and more",
    ],
    ctaLabel: "Browse scenes",
    ctaHref: "/marketplace/scenes",
    icon: <LayoutGrid className="h-8 w-8 text-zinc-900" />,
  },
  {
    title: "Dataset Packs",
    badge: "Training Data",
    description:
      "Pre-generated trajectories for offline training in LeRobot format.",
    bullets: [
      "Thousands of expert episodes per scene",
      "Multi-sensor: RGB-D, proprioception, end-effector poses",
    ],
    ctaLabel: "Browse datasets",
    ctaHref: "/marketplace/datasets",
    icon: <Database className="h-8 w-8 text-zinc-900" />,
  },
];

const whySimReady = [
  {
    title: "Physics-accurate geometry",
    description:
      "Sub-millimeter tolerances for reliable policy transfer to real robots.",
  },
  {
    title: "Full articulation metadata",
    description:
      "Validated joints, friction, mass, and inertia ready for manipulation tasks.",
  },
  {
    title: "Simulation-ready",
    description:
      "Domain randomization configs and physics validation for Isaac Sim and MuJoCo.",
  },
];

const labBullets = [
  "Articulated containers with physics constraints",
  "Sim2real-validated packages",
  "Semantic annotations for perception",
];

const artistBullets = [
  "Ship scenes to leading robotics labs",
  "Project-based pay with articulation bonuses",
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
        title="Blueprint | The Complete Data Platform for Robotic AI"
        description="SimReady scenes, expert trajectories, and standardized benchmarks for robotics. Train, evaluate, and deploy policies that transfer to real robots."
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
                    SimReady Environment Network
                  </div>
                  <h1 className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
                    The complete data platform for robotic AI.
                  </h1>
                  <p className="max-w-xl text-lg leading-relaxed text-zinc-600">
                    SimReady scenes, expert trajectories, and standardized benchmarks.
                    Everything you need to train and deploy robotic policies that
                    transfer to the real world.
                  </p>
                </div>

                <CTAButtons
                  primaryHref="/marketplace"
                  primaryLabel="Browse Marketplace"
                  secondaryHref="/contact"
                  secondaryLabel="Submit a request"
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
                      alt="SimReady scene"
                      className="h-48 w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                      <Terminal className="h-4 w-4" />
                      Supported Archetypes
                    </div>
                    <p className="text-sm text-zinc-600">
                      Kitchens, groceries, warehouses, labs, offices, retail, and utility environments.
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

        {/* --- Why SimReady --- */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10">
              <h2 className="text-2xl font-bold text-zinc-900">Why SimReady?</h2>
              <p className="mt-2 text-zinc-600">
                Physics-accurate assets for perception and manipulation, not just visual fidelity.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {whySimReady.map((item) => (
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
            {/* Lab Persona */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-8">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                For Robotics Labs
              </p>
              <h3 className="mt-2 text-xl font-bold text-zinc-900">
                Open. Slide. Pick. Repeat.
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

            {/* Artist Persona */}
            <div className="rounded-2xl bg-zinc-900 p-8 text-white">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                For 3D Artists
              </p>
              <h3 className="mt-2 text-xl font-bold text-white">
                Build the worlds robots learn in.
              </h3>
              <ul className="mt-4 space-y-2">
                {artistBullets.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-zinc-300">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="/careers"
                className="mt-6 inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Apply to network
              </a>
            </div>
          </div>
        </section>

        {/* --- Feature Highlights (Teasers) --- */}
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Premium Analytics Teaser */}
            <a
              href="/pricing"
              className="group rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <Box className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">$320K+ in Premium Analytics</p>
                  <p className="text-sm text-zinc-500">Included with every bundle</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>

            {/* Isaac Lab-Arena Teaser */}
            <a
              href="/evals"
              className="group rounded-xl border border-zinc-200 bg-white p-6 transition-all hover:border-emerald-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">Isaac Lab-Arena Integration</p>
                  <p className="text-sm text-zinc-500">GPU-parallel policy evaluation</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-zinc-400 transition-transform group-hover:translate-x-1" />
              </div>
            </a>

            {/* Coming Soon Teaser */}
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-violet-50 p-2 text-violet-600">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-zinc-900">Coming Soon</p>
                  <p className="text-sm text-zinc-500">Egocentric video datasets</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- Final CTA --- */}
        <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-zinc-900 p-8 text-center sm:p-12">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Ready to accelerate your robotics AI?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              Browse our marketplace for SimReady scenes and datasets, or contact
              us to discuss your specific requirements.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href="/marketplace"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Browse Marketplace
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
