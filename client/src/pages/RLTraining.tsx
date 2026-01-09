import { SEO } from "@/components/SEO";
import {
  ArrowRight,
  BarChart3,
  Box,
  Brain,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileJson,
  Fingerprint,
  Layers,
  LineChart,
  Play,
  RefreshCw,
  Server,
  Settings2,
  Sparkles,
  Target,
  Terminal,
  TrendingUp,
  Zap,
} from "lucide-react";

// --- Data ---

const whatWeDeliver = [
  {
    title: "Trained Policy Checkpoints",
    desc: "Production-ready PyTorch models that work immediately with your robot hardware.",
    icon: <Brain className="h-6 w-6" />,
    color: "indigo",
  },
  {
    title: "Training Curves & Metrics",
    desc: "Full visibility into how your policy learned — reward progression, success rates, and convergence data.",
    icon: <LineChart className="h-6 w-6" />,
    color: "emerald",
  },
  {
    title: "Benchmark Reports",
    desc: "Standardized evaluation across fixed test scenarios so you know exactly how your policy performs.",
    icon: <BarChart3 className="h-6 w-6" />,
    color: "amber",
  },
  {
    title: "Sim-to-Real Indicators",
    desc: "Metrics that predict real-world performance — action smoothness, jerk analysis, and transfer gap estimates.",
    icon: <Target className="h-6 w-6" />,
    color: "rose",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "You Provide the Scene",
    desc: "Use any Blueprint scene from our marketplace or request a custom scene. Every scene already includes Isaac Lab task configs.",
    icon: <Layers className="h-6 w-6" />,
  },
  {
    step: "02",
    title: "We Train at Scale",
    desc: "Our infrastructure runs thousands of simulated robots in parallel, collecting experience 1000x faster than real-world training.",
    icon: <Server className="h-6 w-6" />,
  },
  {
    step: "03",
    title: "Policy Learns from Experience",
    desc: "Using reinforcement learning (PPO), your robot's brain improves through trial and error — millions of attempts compressed into hours.",
    icon: <RefreshCw className="h-6 w-6" />,
  },
  {
    step: "04",
    title: "You Receive Trained Policy",
    desc: "Download a production-ready model with full training history, benchmark scores, and deployment guides.",
    icon: <CheckCircle2 className="h-6 w-6" />,
  },
];

const whyRLTraining = [
  {
    title: "1000x Faster Than Reality",
    desc: "Train in hours what would take months of real-world robot time. Our GPU-parallel infrastructure runs thousands of simulations simultaneously.",
    stat: "1000x",
    statLabel: "Speed increase",
  },
  {
    title: "No Hardware Risk",
    desc: "Your physical robots stay safe while virtual ones learn through trial and error. Failures in simulation cost nothing.",
    stat: "0",
    statLabel: "Hardware damage",
  },
  {
    title: "Infinite Variations",
    desc: "Train across thousands of scene variations — different object positions, lighting, physics randomization — so your policy generalizes.",
    stat: "4096+",
    statLabel: "Parallel environments",
  },
  {
    title: "Reproducible Results",
    desc: "Fixed benchmark seeds ensure consistent evaluation. Compare policies apples-to-apples across different training runs.",
    stat: "100%",
    statLabel: "Reproducible",
  },
];

const supportedTasks = [
  { name: "Pick & Place", desc: "Grasp objects and place them accurately", icon: <Box className="h-5 w-5" /> },
  { name: "Door Opening", desc: "Handle articulated doors and latches", icon: <Fingerprint className="h-5 w-5" /> },
  { name: "Drawer Access", desc: "Open and close drawers smoothly", icon: <Layers className="h-5 w-5" /> },
  { name: "Knob Manipulation", desc: "Turn dials, knobs, and valves", icon: <Settings2 className="h-5 w-5" /> },
  { name: "Button Pressing", desc: "Precise contact with switches and buttons", icon: <Play className="h-5 w-5" /> },
  { name: "Precision Insertion", desc: "Peg-in-hole and connector tasks", icon: <Target className="h-5 w-5" /> },
];

const pricingTiers = [
  {
    name: "Starter",
    price: "$5,000",
    desc: "Perfect for evaluating RL training on a single scene",
    features: [
      "1 scene, 1 task",
      "Up to 1,500 training iterations",
      "Single GPU training",
      "Policy checkpoint delivery",
      "Basic benchmark report",
    ],
    highlight: false,
  },
  {
    name: "Professional",
    price: "$15,000",
    desc: "Production-ready training with comprehensive evaluation",
    features: [
      "Up to 5 scenes, 3 tasks each",
      "Up to 5,000 training iterations",
      "Multi-GPU distributed training",
      "Full benchmark suite with fixed seeds",
      "Sim-to-real transfer indicators",
      "Hyperparameter tuning",
    ],
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    desc: "Foundation model scale with dedicated infrastructure",
    features: [
      "Unlimited scenes and tasks",
      "Custom training duration",
      "Dedicated GPU cluster",
      "Priority queue access",
      "Custom reward engineering",
      "Ongoing policy iteration",
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
        title="RL Training | Reinforcement Learning as a Service"
        description="Train robot policies at scale with GPU-parallel reinforcement learning. Blueprint delivers trained policy checkpoints, benchmark reports, and sim-to-real transfer indicators. Coming Q2 2026."
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
                    RL Training-as-a-Service
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-700">
                    <Clock className="h-3 w-3" />
                    Coming Q2 2026
                  </div>
                </div>
                <h1 className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
                  Train your robot's brain at scale.
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-zinc-600">
                  You bring the simulation scene. We run thousands of virtual robots in parallel,
                  learning through trial and error. You receive a trained policy ready for
                  real-world deployment — no ML infrastructure required.
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
                  <p className="text-3xl font-bold text-violet-600">4096+</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Parallel Envs</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-600">1000x</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Faster</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-amber-600">14+</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Task Types</p>
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
                      rl_training_dashboard.py
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {/* Training Progress */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-900">Training Progress</span>
                      <span className="font-mono text-violet-600">87%</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-violet-400"
                        style={{ width: "87%" }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>Iteration 1,305 / 1,500</span>
                      <span>ETA: 23 min</span>
                    </div>
                  </div>

                  {/* Live Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-100">
                      <p className="text-xs text-emerald-600 font-medium">Success Rate</p>
                      <p className="text-xl font-bold text-emerald-700">87.3%</p>
                    </div>
                    <div className="rounded-lg bg-violet-50 p-3 ring-1 ring-violet-100">
                      <p className="text-xs text-violet-600 font-medium">Mean Reward</p>
                      <p className="text-xl font-bold text-violet-700">+85.2</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3 ring-1 ring-amber-100">
                      <p className="text-xs text-amber-600 font-medium">Parallel Envs</p>
                      <p className="text-xl font-bold text-amber-700">4,096</p>
                    </div>
                    <div className="rounded-lg bg-zinc-50 p-3 ring-1 ring-zinc-200">
                      <p className="text-xs text-zinc-500 font-medium">Steps/sec</p>
                      <p className="text-xl font-bold text-zinc-700">45,000</p>
                    </div>
                  </div>

                  {/* Task Info */}
                  <div className="rounded-lg bg-zinc-900 p-4 font-mono text-xs text-zinc-300">
                    <p className="text-zinc-500"># Current training job</p>
                    <p><span className="text-violet-400">scene:</span> industrial_kitchen_v3</p>
                    <p><span className="text-violet-400">task:</span> dish_loading</p>
                    <p><span className="text-violet-400">robot:</span> franka_panda</p>
                    <p><span className="text-emerald-400">status:</span> training...</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="space-y-24">
            {/* --- What is RL Training Section --- */}
            <section className="relative overflow-hidden rounded-[2.5rem] border border-violet-100 bg-gradient-to-br from-violet-50/50 to-white p-8 sm:p-12 lg:p-16">
              <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-violet-100/60 blur-3xl" />

              <div className="relative z-10 grid gap-12 lg:grid-cols-2 lg:items-center">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-md bg-violet-100 px-2 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
                    <Brain className="h-3 w-3" /> What is RL Training?
                  </div>
                  <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
                    Teaching robots through practice, not programming.
                  </h2>
                  <p className="text-zinc-600 leading-relaxed">
                    Traditional robotics requires engineers to manually program every movement.
                    <strong> Reinforcement Learning (RL)</strong> is different — your robot learns
                    by trying things, getting feedback on what works, and improving over time.
                    Think of it like how humans learn to ride a bike: through practice, not instruction manuals.
                  </p>
                  <ul className="space-y-3 text-sm text-zinc-700">
                    {[
                      "Robot takes an action (move arm, grasp object)",
                      "Simulation tells it: good move or bad move (reward signal)",
                      "Robot adjusts its behavior to get more rewards",
                      "After millions of attempts, it becomes expert at the task",
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

                {/* Visual: RL Loop Diagram */}
                <div className="rounded-2xl border border-violet-100 bg-white p-6 shadow-sm">
                  <p className="mb-4 text-xs font-bold uppercase tracking-widest text-violet-600">
                    The RL Training Loop
                  </p>
                  <div className="space-y-4">
                    <div className="relative flex items-center justify-center py-8">
                      {/* Circular flow visualization */}
                      <div className="relative h-48 w-48">
                        <div className="absolute inset-0 rounded-full border-2 border-dashed border-violet-200" />

                        {/* Nodes */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-lg bg-violet-100 px-3 py-2 text-center">
                          <p className="text-xs font-bold text-violet-700">Action</p>
                        </div>
                        <div className="absolute top-1/2 -right-3 -translate-y-1/2 rounded-lg bg-emerald-100 px-3 py-2 text-center">
                          <p className="text-xs font-bold text-emerald-700">Reward</p>
                        </div>
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-lg bg-amber-100 px-3 py-2 text-center">
                          <p className="text-xs font-bold text-amber-700">Learn</p>
                        </div>
                        <div className="absolute top-1/2 -left-3 -translate-y-1/2 rounded-lg bg-rose-100 px-3 py-2 text-center">
                          <p className="text-xs font-bold text-rose-700">Observe</p>
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
                        We run this loop <strong>millions of times</strong> in simulation —
                        what would take years on a real robot happens in hours on our GPU cluster.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* --- Why RL Training Section --- */}
            <section className="relative">
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/50 px-4 py-1 text-xs font-bold uppercase tracking-wider text-emerald-600">
                  <Zap className="h-3 w-3" />
                  Why RL Training?
                </div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  The benefits of simulation-first training.
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-zinc-600">
                  Instead of risking expensive hardware and waiting months for results, train your
                  robot's brain in a virtual environment where failures are free and time moves 1000x faster.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {whyRLTraining.map((item) => (
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
                    How It Works
                  </h2>
                  <p className="mt-4 max-w-2xl mx-auto text-zinc-400">
                    From simulation scene to production-ready robot policy in four steps.
                    No ML expertise required on your end.
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
                  What You Receive
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-zinc-600">
                  Every RL training job delivers a complete analysis package — trained policy,
                  detailed training history, benchmark reports, and premium analytics showing
                  how well your policy will perform in the real world.
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
                    Core Deliverable Files
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { file: "policy.pt", desc: "Trained PyTorch model" },
                      { file: "training_curves.json", desc: "Reward & metrics history" },
                      { file: "benchmark_report.json", desc: "Evaluation results" },
                      { file: "policy_config.json", desc: "Architecture & metadata" },
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
                    Premium Analytics Included
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      { title: "Per-Step Telemetry", desc: "Rewards, collisions, grasps, forces tracked at every step" },
                      { title: "Failure Analysis", desc: "Automatic breakdown of timeout vs collision failures" },
                      { title: "Grasp Quality", desc: "Force profiles, contact tracking, slip detection" },
                      { title: "Sim2Real Confidence", desc: "Transfer likelihood score (0-100%) for real-world deployment" },
                      { title: "Trajectory Optimality", desc: "Path efficiency, jerk analysis, energy metrics" },
                      { title: "Generalization Metrics", desc: "Per-object success rates, learning curves, data efficiency" },
                    ].map((item) => (
                      <div key={item.title} className="rounded-xl bg-white p-4 ring-1 ring-emerald-100">
                        <p className="font-semibold text-zinc-900">{item.title}</p>
                        <p className="mt-1 text-xs text-zinc-600">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-zinc-200 pt-6 bg-white rounded-xl p-4 ring-1 ring-violet-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-violet-700 mb-2">Total Value</p>
                  <p className="text-sm text-zinc-700">
                    Every training job includes <strong>$50k-$100k+ in premium analytics</strong> showing exactly how your policy learned and whether it will succeed in the real world. No additional cost.
                  </p>
                </div>
              </div>
            </section>

            {/* --- Supported Tasks Section --- */}
            <section className="relative overflow-hidden rounded-[2.5rem] border border-amber-100 bg-gradient-to-br from-amber-50/50 to-white p-8 sm:p-12 lg:p-16">
              <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-amber-100/60 blur-3xl" />

              <div className="relative z-10 grid gap-12 lg:grid-cols-2">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-md bg-amber-100 px-2 py-1 text-xs font-bold uppercase tracking-wider text-amber-700">
                    <Terminal className="h-3 w-3" /> Supported Tasks
                  </div>
                  <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
                    14+ manipulation policies out of the box.
                  </h2>
                  <p className="text-zinc-600 leading-relaxed">
                    Blueprint scenes already include task configurations for common manipulation
                    scenarios. The RL Training service uses these configs to train policies that
                    match your specific environment and objects.
                  </p>
                  <p className="text-sm text-zinc-500">
                    Need a custom task? We can engineer reward functions and training configs for
                    specialized manipulation requirements.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {supportedTasks.map((task) => (
                    <div
                      key={task.name}
                      className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-amber-100"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                        {task.icon}
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900">{task.name}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">{task.desc}</p>
                      </div>
                    </div>
                  ))}
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
                  Training packages for every scale.
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-zinc-600">
                  From single-scene experiments to foundation model scale. Final pricing will be
                  announced at launch.
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
                    Works seamlessly with your Blueprint scenes.
                  </h2>
                  <p className="text-zinc-600 leading-relaxed">
                    Every scene from the Blueprint marketplace already includes Isaac Lab task
                    configurations — reward functions, observation spaces, action configs, and
                    domain randomization settings. Just select a scene and task, and RL Training
                    handles the rest.
                  </p>
                  <ul className="space-y-3 text-sm text-zinc-700">
                    {[
                      "Scenes already include env_cfg.py and train_cfg.yaml",
                      "14+ policy types pre-configured per scene",
                      "Domain randomization included for sim-to-real transfer",
                      "Evaluation benchmark seeds for reproducible results",
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
                    The Complete Pipeline
                  </p>
                  <div className="space-y-3">
                    {[
                      { step: "1", label: "Scene Generation", desc: "Blueprint creates SimReady USD", color: "bg-zinc-100 text-zinc-700" },
                      { step: "2", label: "Task Config", desc: "Isaac Lab env configs included", color: "bg-indigo-100 text-indigo-700" },
                      { step: "3", label: "Evals", desc: "Policy benchmarking & affordances", color: "bg-emerald-100 text-emerald-700" },
                      { step: "4", label: "RL Training", desc: "Trained policy delivery", color: "bg-violet-100 text-violet-700" },
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
                  Be first in line for RL Training.
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-violet-100">
                  Join the waitlist to get early access when RL Training launches. We'll notify
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
                    Explore Scenes Now
                  </a>
                </div>

                {/* Partner logos */}
                <div className="mt-12 flex items-center justify-center gap-8 opacity-60">
                  <div className="text-xs font-bold text-white/80 uppercase tracking-wider">
                    Powered by
                  </div>
                  <div className="text-white/80 font-semibold">NVIDIA Isaac Lab</div>
                  <div className="text-white/80 font-semibold">Ray</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
