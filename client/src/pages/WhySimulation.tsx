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
      "Expensive to collect and label",
      "Slow and resource-intensive collection",
      "Safety risks during exploration",
      "Limited variation coverage",
    ],
  },
  simulation: {
    label: "Simulation Data",
    color: "emerald",
    strengths: [
      "Faster generation and iteration cycles",
      "Broad edge case and variation coverage",
      "Zero hardware risk during collection",
      "Perfect ground truth labels",
      "Digital twins make simulation data site-specific -- not generic environments, but your exact facility",
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
    stat: "Faster",
    label: "Iteration",
    description: "Render training video from a digital twin in hours instead of waiting weeks for lab time",
    source: "Operational reality",
    icon: <Zap className="h-6 w-6" />,
  },
  {
    stat: "Safer",
    label: "Exploration",
    description: "Explore failure modes in rendered video without risking hardware, operators, or facilities",
    source: "Operational reality",
    icon: <Shield className="h-6 w-6" />,
  },
  {
    stat: "Broader",
    label: "Coverage",
    description: "One digital twin generates hundreds of viewpoints, lighting, and clutter variations from the same scan",
    source: "Operational reality",
    icon: <Layers className="h-6 w-6" />,
  },
  {
    stat: "More",
    label: "Consistent",
    description: "The same twin produces identical training runs, enabling reproducible benchmarks and fair comparisons",
    source: "Operational reality",
    icon: <BarChart3 className="h-6 w-6" />,
  },
];

// How the complementary relationship works
const complementarySteps = [
  {
    step: "01",
    title: "Digital twins provide scale",
    description:
      "Scan a facility once, then render hours of training video from novel viewpoints and lighting conditions. World models like DreamDojo and Cosmos consume this video directly, so one scan turns into thousands of diverse training episodes.",
    icon: <Database className="h-6 w-6" />,
    color: "emerald",
  },
  {
    step: "02",
    title: "Real data anchors reality",
    description:
      "A small set of real-world demonstrations captures the true sensor noise, contact physics, and controller nuances that even the best digital twin approximates but can't perfectly replicate.",
    icon: <Target className="h-6 w-6" />,
    color: "indigo",
  },
  {
    step: "03",
    title: "Fine-tuning bridges the gap",
    description:
      "Your world model trains broadly on diverse video, then fine-tunes on rendered video from the exact deployment site. This site-specific adaptation means the policy already understands your facility before it touches a real robot.",
    icon: <RefreshCw className="h-6 w-6" />,
    color: "amber",
  },
];

// Why simulation is valuable even for real-data-first teams
const valueProps = [
  {
    icon: <Clock className="h-8 w-8" />,
    title: "Faster iteration",
    description:
      "Render new training video from a digital twin in hours, not weeks. Catch regressions before expensive real-world validation.",
    stat: "Faster iteration cycles",
  },
  {
    icon: <Shield className="h-8 w-8" />,
    title: "Safer exploration",
    description:
      "Let robots fail in rendered video instead of on real hardware. Explore edge cases without risking equipment or people.",
    stat: "Lower hardware risk",
  },
  {
    icon: <Scale className="h-8 w-8" />,
    title: "Long-tail coverage",
    description:
      "Your real dataset probably doesn't include the rare scenarios that cause production failures. A digital twin generates the unusual viewpoints, lighting, and clutter your robots will eventually encounter.",
    stat: "Broader scenario coverage",
  },
  {
    icon: <BarChart3 className="h-8 w-8" />,
    title: "Reproducible benchmarks",
    description:
      "The same digital twin produces identical rendered environments, so you can compare model versions fairly. Deterministic rendering means reproducible results.",
    stat: "More consistent evals",
  },
];

// Common objections addressed
const objections = [
  {
    objection: "We only trust real-world data",
    response:
      "That's the right instinct for final validation. But a digital twin of your actual facility generates training video that looks like your site, not a generic sim. Teams that combine twin-rendered video with a small set of real demos tend to reach deployment faster.",
  },
  {
    objection: "Sim-to-real transfer doesn't work",
    response:
      "The gap shrinks when your training video comes from a digital twin of the actual deployment site. The model learns your facility's geometry, lighting, and layout before touching a real robot. DreamDojo showed 0.995 Pearson correlation between twin-rendered and real-world results.",
  },
  {
    objection: "We already have enough real data",
    response:
      "Your real data is valuable, but is it diverse enough? A digital twin lets you test your policy against many variations of the same site: different lighting, clutter, viewpoints. Think of it as coverage for the scenarios you haven't collected yet.",
  },
  {
    objection: "Simulation is too expensive to set up",
    response:
      "Building sim infrastructure from scratch is expensive, agreed. We handle the scanning, twin creation, and fine-tuning. You get site-specific training video and adapted weights without standing up the pipeline yourself.",
  },
];

export default function WhySimulation() {
  return (
    <>
      <SEO
        title="Why Simulation Data? | Blueprint"
        description="Digital twins and simulation data complement real-world capture to accelerate robotics AI training. Learn how teams use Gaussian Splat twins, rendered video, and site-specific fine-tuning to reach production faster."
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
                <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent"> better robots</span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-zinc-600 sm:text-xl">
                Digital twins (Gaussian Splats) of real facilities let you generate hours of training
                video without deploying real robots. Combine that with a small amount of real-world
                data and you have a faster path to production.
              </p>
              <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
                <a
                  href="/marketplace"
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
                Real-world data is irreplaceable, but it's also slow and expensive.
                Simulation fills the gaps that real capture can't cover economically.
              </p>
            </div>

            {/* Visual Diagram: The Complementary Relationship */}
            <div className="relative max-w-4xl mx-auto">
              {/* Connection line */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-gradient-to-br from-indigo-100 to-emerald-100 flex items-center justify-center z-10 border-4 border-white shadow-lg">
                <div className="text-center">
                  <p className="text-lg font-bold text-zinc-900">+</p>
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
                      <strong>Typical collection:</strong> limited expert demonstrations
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
                      <p className="text-sm text-emerald-600 font-medium">Adds scale without hardware</p>
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
                      <strong>Typical generation:</strong> thousands to millions of episodes
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Key insight callout */}
            <div className="mt-12 max-w-3xl mx-auto">
              <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 p-8 text-white text-center">
                <p className="text-lg font-medium">
                  Digital twins provide scale. Real data anchors reality. Site-specific fine-tuning is what bridges the gap for production deployment.
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
                Why teams use simulation
              </h2>
              <p className="mt-4 text-lg text-zinc-600">
                Simulation is valuable for speed, safety, coverage, and repeatability.
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
                How teams use sim + real together
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
                  Common pattern
                </p>
                <div className="relative h-8 rounded-full overflow-hidden bg-zinc-100">
                  <div
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-l-full"
                    style={{ width: "50%" }}
                  />
                  <div
                    className="absolute right-0 top-0 h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-r-full"
                    style={{ width: "50%" }}
                  />
                </div>
                <div className="mt-4 flex justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-500" />
                    <span className="text-zinc-600">Twin-rendered video (scale + site specificity)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-indigo-500" />
                    <span className="text-zinc-600">Real-world demos (anchoring + validation)</span>
                  </div>
                </div>
                <p className="mt-4 text-sm text-zinc-500 text-center">
                  Train broadly on diverse video, then fine-tune on your site. The mix varies by task.
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
                Why add simulation to your real-world pipeline?
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
                We get it, simulation skepticism is healthy. Here's how we address it.
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
                    From scan to trained weights
                  </h2>
                  <p className="mt-4 text-lg text-zinc-600 leading-relaxed">
                    We handle the full pipeline: scan your facility, build a Gaussian Splat
                    digital twin, render site-specific training video, and deliver adapted
                    model weights you can deploy.
                  </p>
                  <ul className="mt-8 space-y-4">
                    {[
                      "Gaussian Splat digital twins of your actual facility",
                      "Rendered training video from novel viewpoints and conditions",
                      "DreamDojo, Cosmos, and other video-native architectures supported",
                      "Site-specific LoRA adaptation fine-tuned to your deployment environment",
                      "Scan-to-weights pipeline with provenance metadata at every stage",
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
                    <p className="text-lg font-bold text-zinc-900">Digital twins</p>
                    <p className="mt-1 text-sm text-zinc-600">Gaussian Splats of your real facility</p>
                  </div>
                  <div className="rounded-xl bg-white p-6 shadow-md border border-emerald-100">
                    <p className="text-lg font-bold text-zinc-900">Rendered video</p>
                    <p className="mt-1 text-sm text-zinc-600">Site-specific training video from novel viewpoints</p>
                  </div>
                  <div className="rounded-xl bg-white p-6 shadow-md border border-emerald-100">
                    <p className="text-lg font-bold text-zinc-900">LoRA adaptation</p>
                    <p className="mt-1 text-sm text-zinc-600">Site-specific fine-tuning for your deployment environment</p>
                  </div>
                  <div className="rounded-xl bg-white p-6 shadow-md border border-emerald-100">
                    <p className="text-lg font-bold text-zinc-900">World model ready</p>
                    <p className="mt-1 text-sm text-zinc-600">DreamDojo, Cosmos, and other video-native architectures</p>
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
                  Add simulation to your training pipeline.
                </h2>
                <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
                  Get a digital twin of your facility and site-specific training video, or talk to
                  our team about a scan-to-weights pipeline for your robot and task.
                </p>
                <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
                  <a
                    href="/marketplace"
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
