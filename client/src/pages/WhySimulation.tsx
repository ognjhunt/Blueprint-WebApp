import { SEO } from "@/components/SEO";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Database,
  Layers,
  RefreshCw,
  Scale,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

// Visual comparison data
const comparisonData = {
  realWorld: {
    label: "Real-World Data",
    color: "indigo",
    strengths: [
      "True physics (friction, slip, compliance)",
      "Real sensor noise and calibration",
      "Actual controller behavior",
      "Ground truth for final validation",
    ],
    challenges: [
      "Expensive to collect ($$$)",
      "Slow: ~1.7 demos per minute",
      "Safety risks during collection",
      "Limited variation coverage",
    ],
  },
  simulation: {
    label: "Simulation Data",
    color: "emerald",
    strengths: [
      "27x faster generation (51 demos/min)",
      "Infinite edge case coverage",
      "Zero hardware risk",
      "Perfect ground truth labels",
    ],
    challenges: [
      "Physics approximations",
      "Sensor model gaps",
      "Contact dynamics mismatch",
      "Visual domain shift",
    ],
  },
};

// Research-backed statistics
const researchStats = [
  {
    stat: "38%",
    label: "Performance Boost",
    description: "Average improvement when combining sim + real data vs real-only training",
    source: "Sim-and-Real Co-Training, 2025",
    icon: <TrendingUp className="h-6 w-6" />,
  },
  {
    stat: "27x",
    label: "Faster Generation",
    description: "Simulation generates demos at 51/min vs 1.7/min for human teleop",
    source: "Real2Render2Real, 2025",
    icon: <Zap className="h-6 w-6" />,
  },
  {
    stat: "85%+",
    label: "Transfer Rate",
    description: "Achievable sim-to-real success with proper domain randomization",
    source: "Industry benchmark standard",
    icon: <Target className="h-6 w-6" />,
  },
  {
    stat: "10,000x",
    label: "More Scenarios",
    description: "Edge cases and variations impossible to stage in real life",
    source: "Domain randomization research",
    icon: <Layers className="h-6 w-6" />,
  },
];

// How the complementary relationship works
const complementarySteps = [
  {
    step: "01",
    title: "Simulation Provides Scale",
    description:
      "Generate thousands to millions of training episodes cheaply. Cover edge cases, lighting variations, object placements, and clutter that would take months to stage in the real world.",
    icon: <Database className="h-6 w-6" />,
    color: "emerald",
  },
  {
    step: "02",
    title: "Real Data Anchors Reality",
    description:
      "A small set of real-world demonstrations (20-400 episodes) captures the true sensor noise, contact physics, and controller nuances that simulation approximates but can't perfectly replicate.",
    icon: <Target className="h-6 w-6" />,
    color: "indigo",
  },
  {
    step: "03",
    title: "Co-Training Maximizes Both",
    description:
      "Train on a mixture of sim and real data in each batch. Research shows ~99% sim / ~1% real often works best—your real data anchors the policy while sim provides robustness.",
    icon: <RefreshCw className="h-6 w-6" />,
    color: "amber",
  },
];

// Why simulation is valuable even for real-data-first teams
const valueProps = [
  {
    icon: <Clock className="h-8 w-8" />,
    title: "Speed Up Iteration",
    description:
      "Test model changes in hours, not weeks. Catch regressions before expensive real-world validation. Run thousands of trials while you sleep.",
    stat: "1000x faster iteration cycles",
  },
  {
    icon: <Shield className="h-8 w-8" />,
    title: "Train Safely",
    description:
      "Let robots fail catastrophically in simulation. Explore dangerous edge cases without risking hardware, operators, or facilities.",
    stat: "Zero hardware damage risk",
  },
  {
    icon: <Scale className="h-8 w-8" />,
    title: "Cover the Long Tail",
    description:
      "Your real dataset probably doesn't include the rare scenarios that cause production failures. Simulation can generate the weird cases your robots will eventually encounter.",
    stat: "10,000+ variation coverage",
  },
  {
    icon: <BarChart3 className="h-8 w-8" />,
    title: "Benchmark Consistently",
    description:
      "Repeatable evaluation environments let you compare model versions fairly. Deterministic seeds mean reproducible science and engineering.",
    stat: "100% reproducible evals",
  },
];

// Common objections addressed
const objections = [
  {
    objection: "We only trust real-world data",
    response:
      "That's smart for final validation. But simulation accelerates your path there. Teams that mix sim + real reach deployment-ready policies faster than real-only approaches, with better generalization to unseen scenarios.",
  },
  {
    objection: "Sim-to-real transfer doesn't work",
    response:
      "Transfer fails when simulation quality is low. With physics-accurate assets, proper domain randomization, and camera-aligned viewpoints, studies show 85%+ real-world transfer rates. Blueprint scenes are specifically engineered for sim-to-real success.",
  },
  {
    objection: "We already have enough real data",
    response:
      "Your real data is invaluable—but is it diverse enough? Simulation lets you stress-test your policy against variations you haven't collected yet: different lighting, clutter, object positions, and failure modes. It's insurance against the scenarios you haven't seen.",
  },
  {
    objection: "Simulation is too expensive to set up",
    response:
      "Building simulation infrastructure from scratch is expensive. That's exactly what Blueprint solves: we deliver physics-accurate SimReady scenes with domain randomization already configured. You get the benefits without the setup cost.",
  },
];

export default function WhySimulation() {
  return (
    <>
      <SEO
        title="Why Simulation Data? | Blueprint"
        description="Simulation data complements real-world capture to accelerate robotics AI training. Learn how combining sim + real data improves performance by 38% while reducing costs and iteration time."
        canonical="/why-simulation"
      />

      <div className="relative min-h-screen bg-white font-sans text-zinc-900">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-white py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-1.5 text-sm font-medium text-emerald-700">
                <Sparkles className="h-4 w-4" />
                The Complement Strategy
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl lg:text-6xl">
                Simulation + Real Data =
                <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent"> Better Robots</span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-zinc-600 sm:text-xl">
                The world's best robotics teams don't choose between simulation and real-world data.
                They use simulation to <strong>complement</strong> their real-world capture—and their
                models perform better because of it.
              </p>
              <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
                <a
                  href="/environments"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  <Database className="h-4 w-4" />
                  Browse Simulation Data
                </a>
                <a
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50"
                >
                  Talk to Our Team
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* The Big Insight - Visual */}
        <section className="py-20 border-y border-zinc-100 bg-zinc-50/50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                The Complement Model
              </h2>
              <p className="mt-4 max-w-2xl mx-auto text-lg text-zinc-600">
                Real-world data is irreplaceable—but it's also slow and expensive.
                Simulation fills the gaps that real capture can't cover economically.
              </p>
            </div>

            {/* Visual Diagram: The Complementary Relationship */}
            <div className="relative max-w-4xl mx-auto">
              {/* Connection line */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-gradient-to-br from-indigo-100 to-emerald-100 flex items-center justify-center z-10 border-4 border-white shadow-lg">
                <div className="text-center">
                  <p className="text-2xl font-bold text-zinc-900">+38%</p>
                  <p className="text-xs text-zinc-500">Combined</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Real World Column */}
                <div className="rounded-2xl border border-indigo-200 bg-white p-8 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                      <Target className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-zinc-900">Real-World Data</h3>
                      <p className="text-sm text-indigo-600 font-medium">Anchors your policy to reality</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2">Strengths</p>
                      <ul className="space-y-2">
                        {comparisonData.realWorld.strengths.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-zinc-700">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">Challenges</p>
                      <ul className="space-y-2">
                        {comparisonData.realWorld.challenges.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-zinc-500">
                            <span className="h-4 w-4 mt-0.5 flex items-center justify-center text-amber-500 shrink-0">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="rounded-lg bg-indigo-50 p-4">
                    <p className="text-sm text-indigo-900">
                      <strong>Typical collection:</strong> 20-400 expert demonstrations
                    </p>
                  </div>
                </div>

                {/* Simulation Column */}
                <div className="rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                      <Database className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-zinc-900">Simulation Data</h3>
                      <p className="text-sm text-emerald-600 font-medium">Scales your training infinitely</p>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2">Strengths</p>
                      <ul className="space-y-2">
                        {comparisonData.simulation.strengths.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-zinc-700">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-500 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-2">Limitations</p>
                      <ul className="space-y-2">
                        {comparisonData.simulation.challenges.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-zinc-500">
                            <span className="h-4 w-4 mt-0.5 flex items-center justify-center text-amber-500 shrink-0">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="rounded-lg bg-emerald-50 p-4">
                    <p className="text-sm text-emerald-900">
                      <strong>Typical generation:</strong> 10,000-1,000,000+ episodes
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Key insight callout */}
            <div className="mt-12 max-w-3xl mx-auto">
              <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 p-8 text-white text-center">
                <p className="text-lg font-medium">
                  "Mixing simulation with even a small amount of real data can improve real-world task performance by <strong>38% on average</strong> compared to real-only training."
                </p>
                <p className="mt-3 text-sm text-emerald-100">
                  — Sim-and-Real Co-Training Research, 2025
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Research-Backed Stats */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                The Research Is Clear
              </h2>
              <p className="mt-4 text-lg text-zinc-600">
                Recent studies consistently show that simulation data improves robotics AI
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {researchStats.map((item) => (
                <div
                  key={item.label}
                  className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 inline-flex rounded-lg bg-emerald-50 p-2.5 text-emerald-600">
                    {item.icon}
                  </div>
                  <p className="text-4xl font-bold text-zinc-900">{item.stat}</p>
                  <p className="mt-1 font-semibold text-zinc-700">{item.label}</p>
                  <p className="mt-2 text-sm text-zinc-500">{item.description}</p>
                  <p className="mt-3 text-xs text-zinc-400 italic">{item.source}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works - The Complementary Approach */}
        <section className="py-20 bg-zinc-50 border-y border-zinc-100">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                How Teams Use Sim + Real Together
              </h2>
              <p className="mt-4 text-lg text-zinc-600">
                The most successful robotics teams follow a simple pattern
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              {complementarySteps.map((item) => (
                <div
                  key={item.step}
                  className="relative rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 font-mono text-lg font-bold text-zinc-400">
                      {item.step}
                    </span>
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      item.color === "emerald" ? "bg-emerald-100 text-emerald-600" :
                      item.color === "indigo" ? "bg-indigo-100 text-indigo-600" :
                      "bg-amber-100 text-amber-600"
                    }`}>
                      {item.icon}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-zinc-900">{item.title}</h3>
                  <p className="mt-3 text-zinc-600 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>

            {/* Visual training mix diagram */}
            <div className="mt-16 max-w-2xl mx-auto">
              <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                <p className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4">
                  Typical Training Mix
                </p>
                <div className="relative h-8 rounded-full overflow-hidden bg-zinc-100">
                  <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-l-full"
                    style={{ width: "99%" }}
                  />
                  <div
                    className="absolute right-0 top-0 h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-r-full"
                    style={{ width: "1%" }}
                  />
                </div>
                <div className="mt-4 flex justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-500" />
                    <span className="text-zinc-600">~99% Simulation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-indigo-500" />
                    <span className="text-zinc-600">~1% Real</span>
                  </div>
                </div>
                <p className="mt-4 text-sm text-zinc-500 text-center">
                  Research shows this ratio often achieves the best real-world performance
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Value Props for Real-Data Teams */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                Why Add Simulation to Your Real-World Pipeline?
              </h2>
              <p className="mt-4 max-w-2xl mx-auto text-lg text-zinc-600">
                Even if you're committed to real-world data, simulation accelerates and de-risks your path to deployment
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              {valueProps.map((item) => (
                <div
                  key={item.title}
                  className="group rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm transition-all hover:shadow-md hover:border-emerald-200"
                >
                  <div className="flex items-start gap-6">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-zinc-900">{item.title}</h3>
                      <p className="mt-2 text-zinc-600 leading-relaxed">{item.description}</p>
                      <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                        <Zap className="h-3 w-3" />
                        {item.stat}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Addressing Objections */}
        <section className="py-20 bg-zinc-900 text-white">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight">
                Common Questions from Real-Data Teams
              </h2>
              <p className="mt-4 text-lg text-zinc-400">
                We get it—simulation skepticism is healthy. Here's how we address it.
              </p>
            </div>

            <div className="space-y-6">
              {objections.map((item, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-zinc-700 bg-zinc-800/50 p-6"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-sm font-bold text-zinc-300">
                      ?
                    </span>
                    <div>
                      <p className="font-semibold text-white">"{item.objection}"</p>
                      <p className="mt-3 text-zinc-300 leading-relaxed">{item.response}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Blueprint */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-8 sm:p-12 lg:p-16">
              <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-medium text-emerald-700">
                    <Sparkles className="h-4 w-4" />
                    Why Blueprint
                  </div>
                  <h2 className="mt-6 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                    Simulation data built for sim-to-real success
                  </h2>
                  <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
                    We don't just create pretty 3D scenes. Every Blueprint environment is
                    engineered with physics-accurate properties, domain randomization configs,
                    and validation notes specifically designed for policies that transfer to
                    real robots.
                  </p>
                  <ul className="mt-8 space-y-4">
                    {[
                      "Physics-accurate colliders, mass, and friction properties",
                      "Domain randomization scripts for lighting, textures, and positions",
                      "Camera alignment matched to real-world setups",
                      "Sim2Real validation notes based on our QA testing",
                      "Isaac Sim, MuJoCo, and LeRobot format support",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3 text-zinc-700">
                        <CheckCircle2 className="h-5 w-5 mt-0.5 text-emerald-500 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-white p-6 shadow-md border border-emerald-100">
                    <p className="text-3xl font-bold text-zinc-900">1,000+</p>
                    <p className="mt-1 text-sm text-zinc-600">SimReady scenes available</p>
                  </div>
                  <div className="rounded-xl bg-white p-6 shadow-md border border-emerald-100">
                    <p className="text-3xl font-bold text-zinc-900">85%+</p>
                    <p className="mt-1 text-sm text-zinc-600">Sim2Real transfer target</p>
                  </div>
                  <div className="rounded-xl bg-white p-6 shadow-md border border-emerald-100">
                    <p className="text-3xl font-bold text-zinc-900">10M+</p>
                    <p className="mt-1 text-sm text-zinc-600">Episodes generated</p>
                  </div>
                  <div className="rounded-xl bg-white p-6 shadow-md border border-emerald-100">
                    <p className="text-3xl font-bold text-zinc-900">50+</p>
                    <p className="mt-1 text-sm text-zinc-600">Robotics teams served</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-zinc-950 px-8 py-16 text-center shadow-2xl sm:px-16">
              <div className="absolute top-0 right-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-emerald-900/30 blur-3xl" />
              <div className="absolute bottom-0 left-0 -mb-12 -ml-12 h-64 w-64 rounded-full bg-indigo-900/20 blur-3xl" />

              <div className="relative z-10">
                <h2 className="text-3xl font-bold text-white sm:text-4xl">
                  Ready to complement your real-world data?
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
                  Browse our marketplace of physics-accurate SimReady scenes, or talk to our team
                  about how simulation can accelerate your robotics AI development.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
                  <a
                    href="/environments"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
                  >
                    <Database className="h-4 w-4" />
                    Browse Marketplace
                  </a>
                  <a
                    href="/contact"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800"
                  >
                    Talk to Our Team
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
