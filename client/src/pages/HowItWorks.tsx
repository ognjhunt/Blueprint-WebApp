import { CTAButtons } from "@/components/site/CTAButtons";
import SceneSmithExplainerMedia from "@/components/sections/SceneSmithExplainerMedia";
import { SEO } from "@/components/SEO";
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Smartphone,
  Ruler,
  Video,
  BrainCircuit,
  Send,
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
    title: "Every facility is different",
    description:
      "Warehouses, kitchens, retail floors, and factories each have unique layouts, lighting, and obstacles. A model trained on generic environments will encounter conditions it has never seen.",
    icon: <Ruler className="h-6 w-6" />,
  },
  {
    title: "General models don't transfer perfectly",
    description:
      "A world model or VLA trained on broad data still makes mistakes in a specific building. Small differences in shelf height, aisle width, or ambient light add up to real failures on-site.",
    icon: <BrainCircuit className="h-6 w-6" />,
  },
  {
    title: "Re-scanning is cheaper than re-deploying",
    description:
      "Sending a technician to fix a confused robot is expensive. A 15-minute iPhone scan that adapts the model before the robot ships is dramatically cheaper and faster.",
    icon: <Smartphone className="h-6 w-6" />,
  },
];

const pipelineSteps = [
  {
    step: "01",
    title: "Scan the facility",
    icon: <Smartphone className="h-5 w-5" />,
    description:
      "A 15-minute iPhone scan captures a real commercial location -- warehouse, kitchen, retail store, or factory floor. We process the scan into a Gaussian Splat (a PLY file), a 3D representation of the space you can render from any angle.",
  },
  {
    step: "02",
    title: "Calibrate the twin",
    icon: <Ruler className="h-5 w-5" />,
    description:
      "We check geometric accuracy, lighting fidelity, and real-world scale. Location metadata gets tagged: room dimensions, facility type, scan date. The result is a digital twin you can measure against the real building.",
  },
  {
    step: "03",
    title: "Render training video",
    icon: <Video className="h-5 w-5" />,
    description:
      "The Gaussian Splat renders training video from novel camera viewpoints throughout the space -- hundreds of hours from a single scan. World models like DreamDojo and Cosmos consume this video directly. No physics engine or USD conversion required.",
  },
  {
    step: "04",
    title: "Fine-tune your model",
    icon: <BrainCircuit className="h-5 w-5" />,
    description:
      "We run site-specific fine-tuning against the rendered video. Your world model or Vision-Language-Action model (VLA) adapts to the exact layout, lighting, and geometry of the target facility. This is what we call Mode 2: the model learns this specific place.",
  },
  {
    step: "05",
    title: "Deliver adapter weights",
    icon: <Send className="h-5 w-5" />,
    description:
      "You receive LoRA adapter weights -- small, efficient model updates that can be transferred over the air. Your robot can load the site-specific weights before it arrives on-site, so it is already adapted to the facility on day one.",
  },
];

const deliverables = [
  "Gaussian Splat (PLY) of the target facility",
  "Location metadata: dimensions, facility type, scan date, and quality report",
  "Rendered training video from novel viewpoints throughout the space",
  "LoRA adapter weights fine-tuned to the specific site (small enough for OTA transfer)",
  "Evaluation report: video-prediction accuracy and site-adaptation metrics",
];

export default function HowItWorks() {
  return (
    <>
      <SEO
        title="How It Works | Blueprint"
        description="How Blueprint turns an iPhone scan into a digital twin and fine-tunes your world model to a specific facility. Adapter weights delivered over the air."
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
                    How It Works
                  </div>
                  <h1 className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
                    Scan a building. Fine-tune a model. Deploy on day one.
                  </h1>
                  <p className="max-w-xl text-lg leading-relaxed text-zinc-600">
                    Blueprint turns a 15-minute iPhone scan into a digital twin, then fine-tunes
                    your world model or VLA to that exact facility. Your robot arrives already
                    adapted to the site.
                  </p>
                </div>

                <CTAButtons
                  primaryHref="/contact"
                  primaryLabel="Schedule a scan"
                  secondaryHref="/marketplace"
                  secondaryLabel="Browse environments"
                />
              </div>

              <div className="relative">
                <div className="absolute -inset-6 rounded-full bg-indigo-500/15 blur-3xl filter" />
                <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-xl backdrop-blur-md">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-800">
                      <Send className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                        What we deliver
                      </p>
                      <p className="text-sm text-zinc-600">
                        A digital twin of your facility plus LoRA adapter weights that
                        fine-tune your model to the site. Small enough for over-the-air transfer
                        to the robot.
                      </p>
                      <a
                        href="/contact"
                        className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-900 hover:text-indigo-600"
                      >
                        Get started <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Why Site-Specific Fine-Tuning */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 max-w-2xl">
              <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                Why site-specific fine-tuning matters
              </h2>
              <p className="mt-4 text-zinc-600">
                General-purpose models are a strong starting point, but real deployment sites have
                details that generic training data cannot capture. A quick fine-tuning pass on
                the target facility fixes most of those errors.
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
                From iPhone scan to adapted robot
              </h2>
              <p className="mt-4 text-lg text-zinc-600">
                Five steps take you from a raw facility scan to a model that already knows the
                building. The whole process is designed so you never have to build simulation
                infrastructure yourself.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pipelineSteps.map((step) => (
                <div
                  key={step.step}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-mono font-bold text-indigo-600">{step.step}</p>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                      {step.icon}
                    </div>
                  </div>
                  <h3 className="mt-3 text-lg font-bold text-zinc-900">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <SceneSmithExplainerMedia id="howItWorksSceneSmithMedia" />

        {/* Evaluation Approach */}
        <section className="border-y border-zinc-100 bg-zinc-50/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
              <div className="space-y-5">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  How we evaluate VLA performance
                </h2>
                <p className="text-zinc-600">
                  Our primary evaluation method is world-model-based: we feed video of the target
                  environment to the model, ask it to predict what happens next in pixels, and
                  measure how well those predictions match reality. No physics engine is required --
                  the evaluation runs entirely on rendered video.
                </p>
                <p className="text-zinc-600">
                  This approach is fast, scalable, and directly tied to the visual data the model was
                  fine-tuned on. It tells you how well the model understands the specific facility
                  before the robot ever arrives.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Evaluation methods
                </p>
                <ul className="mt-5 space-y-4">
                  <li className="flex items-start gap-3 text-sm text-zinc-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <span>
                      <span className="font-semibold">Video prediction (primary):</span> Feed
                      rendered site video to the model, predict outcomes in pixels, and score
                      accuracy. Works today with any world model or VLA.
                    </span>
                  </li>
                  <li className="flex items-start gap-3 text-sm text-zinc-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                    <span>
                      <span className="font-semibold">Physics-based sim eval (future):</span>{" "}
                      Traditional simulation with SimReady USD assets, articulated objects, and
                      contact dynamics. A planned capability for tasks where physics accuracy is
                      critical, such as precision manipulation or load-bearing assessment.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Deliverables */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div className="space-y-5">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  What you receive
                </h2>
                <p className="text-zinc-600">
                  Every engagement delivers the digital twin, the fine-tuned weights, and the
                  evaluation data. Everything is packaged so your team can load the weights, verify
                  the results, and deploy with confidence.
                </p>
                <a
                  href="/contact"
                  className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700"
                >
                  Schedule a scan
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
              Adapt your model to any facility.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-zinc-400">
              Tell us the site and the model. We&apos;ll scan the building, create the digital twin,
              and deliver adapter weights your robot can load before it ships.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <a
                href="/contact"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                Schedule a scan
              </a>
              <a
                href="/marketplace"
                className="inline-flex items-center justify-center rounded-lg border border-zinc-700 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Browse environments
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
