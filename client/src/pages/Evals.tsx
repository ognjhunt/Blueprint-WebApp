import { SEO } from "@/components/SEO";
import { useAuth } from "@/contexts/AuthContext";
import { syntheticDatasets } from "@/data/content";
import {
  ArrowRight,
  BarChart3,
  Box,
  CheckCircle2,
  Cpu,
  Database,
  FileJson,
  Fingerprint,
  FlaskConical,
  GitBranch,
  Layers,
  LayoutGrid,
  Play,
  Send,
  Settings2,
  Sparkles,
  Target,
  Terminal,
  Workflow,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";

// --- Data ---

const affordanceTypes = [
  { name: "Openable", desc: "Doors, drawers, lids", icon: "door", color: "indigo" },
  { name: "Graspable", desc: "Pickable objects", icon: "hand", color: "emerald" },
  { name: "Turnable", desc: "Knobs, dials, valves", icon: "rotate", color: "amber" },
  { name: "Pressable", desc: "Buttons, switches", icon: "pointer", color: "rose" },
  { name: "Insertable", desc: "Peg-in-hole, plugs", icon: "plug", color: "violet" },
  { name: "Stackable", desc: "Plates, boxes, pallets", icon: "layers", color: "cyan" },
  { name: "Pourable", desc: "Liquids, granular", icon: "droplet", color: "blue" },
  { name: "Slidable", desc: "Linear motion", icon: "move", color: "orange" },
];

const pipelineSteps = [
  {
    step: "01",
    title: "Scene Generation",
    desc: "Select from marketplace or request a custom scene. Blueprint delivers physics-accurate 3D environments ready for simulation.",
    icon: <Layers className="h-6 w-6" />,
  },
  {
    step: "02",
    title: "Affordance Detection",
    desc: "AI automatically tags objects with interaction affordances (Openable, Graspable, Turnable, etc.).",
    icon: <Fingerprint className="h-6 w-6" />,
  },
  {
    step: "03",
    title: "Arena Export",
    desc: "Scenes convert to Isaac Lab-Arena format with task definitions, asset registry, and Hub config.",
    icon: <GitBranch className="h-6 w-6" />,
  },
  {
    step: "04",
    title: "Policy Evaluation",
    desc: "Run benchmarks at scale with GPU-parallel evaluation and VLM-based scoring. Genie Sim 3.0 automatically grades task completion with evidence-based justification.",
    icon: <BarChart3 className="h-6 w-6" />,
  },
];

const evaluationMetrics = [
  { metric: "Success Rate", desc: "Task completion percentage across variations" },
  { metric: "Completion Time", desc: "Average steps/time to complete task" },
  { metric: "Collision Count", desc: "Unintended contacts during execution" },
  { metric: "Path Efficiency", desc: "Actual vs optimal trajectory length" },
  { metric: "Grasp Quality", desc: "Force distribution and stability metrics" },
  { metric: "Generalization", desc: "Performance across unseen object instances" },
];

const integrationBenefits = [
  {
    title: "Standardized Benchmarks",
    desc: "Compare policies apples-to-apples with consistent evaluation methodology across labs.",
    icon: <Target className="h-5 w-5" />,
  },
  {
    title: "GPU-Parallel Scale",
    desc: "Run thousands of evaluation episodes in parallel for statistically significant results.",
    icon: <Zap className="h-5 w-5" />,
  },
  {
    title: "LeRobot Hub Integration",
    desc: "Auto-register environments with Hugging Face for community sharing and leaderboards.",
    icon: <Database className="h-5 w-5" />,
  },
  {
    title: "Policy-Agnostic",
    desc: "Evaluate any policy architecture - imitation learning, RL, VLA, or hybrid approaches.",
    icon: <Workflow className="h-5 w-5" />,
  },
];

const taskMappings = [
  { policy: "Door Manipulation", affordance: "Openable", tasks: ["open_door", "close_door"] },
  { policy: "Drawer Access", affordance: "Openable", tasks: ["open_drawer", "close_drawer"] },
  { policy: "Pick & Place", affordance: "Graspable", tasks: ["pick_object", "place_object"] },
  { policy: "Knob Manipulation", affordance: "Turnable", tasks: ["turn_knob", "set_dial"] },
  { policy: "Button Press", affordance: "Pressable", tasks: ["press_button", "toggle_switch"] },
  { policy: "Precision Insertion", affordance: "Insertable", tasks: ["peg_insertion", "plug_insert"] },
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
          id="grid-pattern-arena"
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
        fill="url(#grid-pattern-arena)"
      />
    </svg>
  );
}

// --- Main Component ---

export default function Evals() {
  const { currentUser } = useAuth();
  const [, navigate] = useLocation();

  const handleBenchmarkClick = (targetPath: string) => {
    if (!currentUser) {
      sessionStorage.setItem("redirectAfterAuth", targetPath);
      navigate("/login");
      return;
    }
    navigate(targetPath);
  };

  return (
    <>
      <SEO
        title="Benchmarks | Policy Evaluation at Scale"
        description="Standardized benchmark suites for robotics policy evaluation. Genie Sim 3.0 powered with VLM scoring, Isaac Lab-Arena integration, and GPU-parallel benchmarking."
        canonical="/evals"
      />
      <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

        <div className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
          {/* --- Hero Section --- */}
          <header className="mb-20 grid gap-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-emerald-700 backdrop-blur-sm">
                  <Sparkles className="h-3 w-3" />
                  Standardized Benchmarks
                </div>
                <h1 className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
                  Benchmark your policies at scale.
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-zinc-600">
                  Runnable benchmark suites with scenes, tasks, and evaluation harnesses.
                  Fixed seeds, deterministic resets, and standardized metrics. Plug in your
                  policy, get a comparable score immediately. Powered by Genie Sim 3.0 with
                  VLM-based evaluation at 100,000+ scenarios scale.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <a
                  href="#benchmark-suites"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-zinc-700"
                >
                  View Benchmark Suites
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="/contact?request=benchmark"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                >
                  Request Evaluation
                  <Send className="h-4 w-4" />
                </a>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-6 pt-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-indigo-600">17</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Affordance Types</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-emerald-600">1000x</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Parallel Evals</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-amber-600">250+</p>
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">Task Templates</p>
                </div>
              </div>
            </div>

            {/* Hero Visual - Arena Pipeline Diagram */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-full bg-emerald-500/10 blur-3xl filter" />
              <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
                {/* Pipeline Visualization */}
                <div className="border-b border-zinc-100 bg-zinc-50 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-red-400" />
                      <div className="h-3 w-3 rounded-full bg-amber-400" />
                      <div className="h-3 w-3 rounded-full bg-emerald-400" />
                    </div>
                    <span className="ml-2 font-mono text-xs text-zinc-500">
                      arena_pipeline.py
                    </span>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {/* Mini Pipeline Diagram */}
                  <div className="grid grid-cols-4 gap-2">
                    {["Scene", "Affordances", "Tasks", "Eval"].map((label, i) => (
                      <div key={label} className="relative">
                        <div className={`rounded-lg p-3 text-center text-xs font-medium ${
                          i === 0 ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200" :
                          i === 1 ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" :
                          i === 2 ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200" :
                          "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                        }`}>
                          {label}
                        </div>
                        {i < 3 && (
                          <ArrowRight className="absolute -right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-300" />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Code Preview */}
                  <div className="rounded-lg bg-zinc-900 p-4 font-mono text-xs text-zinc-300 overflow-hidden">
                    <p className="text-zinc-500"># Export scene to Arena format</p>
                    <p><span className="text-emerald-400">from</span> blueprint.arena <span className="text-emerald-400">import</span> export_scene</p>
                    <p className="mt-2">result = export_scene(</p>
                    <p className="pl-4">scene_id=<span className="text-amber-400">"kitchen_v3"</span>,</p>
                    <p className="pl-4">detect_affordances=<span className="text-indigo-400">True</span>,</p>
                    <p className="pl-4">register_hub=<span className="text-indigo-400">True</span></p>
                    <p>)</p>
                  </div>

                  {/* Output badges */}
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
                      scene_module.py
                    </span>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                      tasks/*.py
                    </span>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                      hub_config.yaml
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="space-y-24">
            {/* --- What is Arena Section --- */}
            <section className="relative overflow-hidden rounded-[2.5rem] border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-8 sm:p-12 lg:p-16">
              <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-100/60 blur-3xl" />

              <div className="relative z-10 grid gap-12 lg:grid-cols-2 lg:items-center">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                    <FlaskConical className="h-3 w-3" /> What is Isaac Lab-Arena?
                  </div>
                  <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
                    Standardized robot policy evaluation.
                  </h2>
                  <p className="text-zinc-600 leading-relaxed">
                    NVIDIA Isaac Lab-Arena is an open-source evaluation framework that makes it easy
                    to benchmark "generalist" robot policies across many tasks and environments at
                    scale. Think of it as <strong>standardized testing for robot skills</strong>.
                  </p>
                  <ul className="space-y-3 text-sm text-zinc-700">
                    {[
                      "Affordance-based task generation (Openable, Graspable, etc.)",
                      "GPU-parallel evaluation for statistically significant results",
                      "Policy-agnostic: works with any architecture (RL, IL, VLA)",
                      "Community benchmarks via LeRobot Hub integration",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Arena Concepts Diagram */}
                <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <p className="mb-4 text-xs font-bold uppercase tracking-widest text-emerald-600">
                    Arena Building Blocks
                  </p>
                  <div className="space-y-4">
                    {[
                      { label: "Scene", desc: "Physical environment (kitchen, warehouse)", color: "bg-indigo-100 text-indigo-700" },
                      { label: "Embodiment", desc: "Robot configuration (Franka, GR1, Fetch)", color: "bg-emerald-100 text-emerald-700" },
                      { label: "Task", desc: "Objective + success criteria", color: "bg-amber-100 text-amber-700" },
                      { label: "Affordance", desc: "Standardized interaction type", color: "bg-rose-100 text-rose-700" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-4">
                        <div className={`rounded-lg px-3 py-2 text-sm font-bold ${item.color}`}>
                          {item.label}
                        </div>
                        <p className="text-sm text-zinc-600">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 rounded-lg bg-zinc-50 p-4 text-xs text-zinc-600">
                    <p className="font-semibold text-zinc-900">The key insight:</p>
                    <p className="mt-1">
                      Arena composes environments from reusable pieces instead of monolithic task files.
                      Swap robots or objects without duplicating code.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* --- Affordance System Section --- */}
            <section className="relative">
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-4 py-1 text-xs font-bold uppercase tracking-wider text-indigo-600">
                  <Fingerprint className="h-3 w-3" />
                  Affordance System
                </div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  Standardized object interactions.
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-zinc-600">
                  Affordances are labels that describe what objects can do. Instead of writing task-specific
                  code for each object, Arena auto-generates compatible tasks based on affordance tags.
                </p>
              </div>

              {/* Affordance Grid */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {affordanceTypes.map((aff) => (
                  <div
                    key={aff.name}
                    className={`group rounded-2xl border p-6 transition-all hover:shadow-md ${
                      aff.color === "indigo" ? "border-indigo-100 hover:border-indigo-200 bg-white" :
                      aff.color === "emerald" ? "border-emerald-100 hover:border-emerald-200 bg-white" :
                      aff.color === "amber" ? "border-amber-100 hover:border-amber-200 bg-white" :
                      aff.color === "rose" ? "border-rose-100 hover:border-rose-200 bg-white" :
                      aff.color === "violet" ? "border-violet-100 hover:border-violet-200 bg-white" :
                      aff.color === "cyan" ? "border-cyan-100 hover:border-cyan-200 bg-white" :
                      aff.color === "blue" ? "border-blue-100 hover:border-blue-200 bg-white" :
                      "border-orange-100 hover:border-orange-200 bg-white"
                    }`}
                  >
                    <div className={`mb-3 inline-flex rounded-lg p-2 ${
                      aff.color === "indigo" ? "bg-indigo-100 text-indigo-600" :
                      aff.color === "emerald" ? "bg-emerald-100 text-emerald-600" :
                      aff.color === "amber" ? "bg-amber-100 text-amber-600" :
                      aff.color === "rose" ? "bg-rose-100 text-rose-600" :
                      aff.color === "violet" ? "bg-violet-100 text-violet-600" :
                      aff.color === "cyan" ? "bg-cyan-100 text-cyan-600" :
                      aff.color === "blue" ? "bg-blue-100 text-blue-600" :
                      "bg-orange-100 text-orange-600"
                    }`}>
                      <Box className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-zinc-900">{aff.name}</h3>
                    <p className="mt-1 text-sm text-zinc-500">{aff.desc}</p>
                  </div>
                ))}
              </div>

              {/* Detection Methods */}
              <div className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
                  Powered by Genie Sim 3.0
                </div>
                <div className="grid gap-6 lg:grid-cols-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                      <Cpu className="h-4 w-4 text-indigo-600" />
                      LLM Task Generation
                    </div>
                    <p className="mt-2 text-sm text-zinc-600">
                      Genie Sim 3.0 uses LLMs to auto-generate task instructions and evaluation configs from scene content.
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                      <Settings2 className="h-4 w-4 text-emerald-600" />
                      cuRobo Trajectories
                    </div>
                    <p className="mt-2 text-sm text-zinc-600">
                      GPU-accelerated motion planning with automatic waypoint filtering and failure recovery.
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                      <FileJson className="h-4 w-4 text-amber-600" />
                      VLM Scoring
                    </div>
                    <p className="mt-2 text-sm text-zinc-600">
                      Vision-language models evaluate task completion from rollouts with evidence-based justification.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* --- Pipeline Section --- */}
            <section className="relative overflow-hidden rounded-[2.5rem] bg-zinc-900 p-8 text-zinc-300 sm:p-12 lg:p-16 shadow-2xl">
              <div className="absolute top-0 left-0 h-full w-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
              <div className="absolute bottom-0 right-0 -mb-32 -mr-32 h-96 w-96 rounded-full bg-indigo-900/20 blur-3xl" />

              <div className="relative z-10 space-y-12">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-white sm:text-4xl">
                    From Scene to Benchmark
                  </h2>
                  <p className="mt-4 max-w-2xl mx-auto text-zinc-400">
                    Blueprint scenes automatically convert to Arena format with affordances,
                    task definitions, and evaluation infrastructure.
                  </p>
                </div>

                {/* Pipeline Steps */}
                <div className="grid gap-6 lg:grid-cols-4">
                  {pipelineSteps.map((step, i) => (
                    <div key={step.step} className="relative">
                      <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10 h-full">
                        <div className="mb-4 flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-indigo-400">
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

                {/* Output Files Visual */}
                <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
                  <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
                    Arena Export Output
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { file: "scene_module.py", desc: "Arena Scene class definition" },
                      { file: "tasks/*.py", desc: "Generated task definitions" },
                      { file: "arena_manifest.json", desc: "Assets + affordances registry" },
                      { file: "hub_config.yaml", desc: "LeRobot Hub registration" },
                    ].map((item) => (
                      <div key={item.file} className="rounded-xl bg-zinc-800 p-4">
                        <p className="font-mono text-sm font-bold text-emerald-400">{item.file}</p>
                        <p className="mt-1 text-xs text-zinc-500">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* --- Task Mapping Section --- */}
            <section className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                  Policy to Task Mapping
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-zinc-600">
                  Blueprint policies automatically map to Arena tasks via the affordance system.
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-zinc-200">
                <table className="w-full">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-zinc-500">
                        Blueprint Policy
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-zinc-500">
                        Affordance
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-zinc-500">
                        Arena Tasks
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {taskMappings.map((mapping) => (
                      <tr key={mapping.policy} className="hover:bg-zinc-50">
                        <td className="px-6 py-4 text-sm font-medium text-zinc-900">
                          {mapping.policy}
                        </td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
                            {mapping.affordance}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {mapping.tasks.map((task) => (
                              <span
                                key={task}
                                className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600"
                              >
                                {task}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* --- Comprehensive Analytics Section --- */}
            <section className="relative overflow-hidden rounded-[2.5rem] border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-8 sm:p-12 lg:p-16">
              <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-100/60 blur-3xl" />

              <div className="relative z-10 space-y-10">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/50 px-4 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                    <BarChart3 className="h-3 w-3" />
                    Complete Analytics Suite
                  </div>
                  <h2 className="text-4xl font-bold text-zinc-900 sm:text-5xl">
                    Understand every aspect of performance.
                  </h2>
                  <p className="max-w-3xl mx-auto text-zinc-600 leading-relaxed">
                    Beyond pass/fail. Every evaluation captures comprehensive telemetry—per-step rewards, collision analysis, grasp quality, failure breakdown, and sim-to-real transfer indicators.
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {[
                    {
                      title: "Per-Step Telemetry",
                      items: ["Rewards at each step", "Collision forces & bodies", "Grasp events (approach→lift)", "EE forces & torques", "Joint torques"],
                      icon: "📊"
                    },
                    {
                      title: "Failure Analysis",
                      items: ["Timeout vs Collision breakdown", "Phase-level failure location", "Collision type distribution", "Average collision forces", "Progress-at-timeout metrics"],
                      icon: "🔍"
                    },
                    {
                      title: "Grasp Quality",
                      items: ["Event timeline", "Time-to-grasp metrics", "Force profiles (max/mean/var)", "Contact point tracking", "Slip detection"],
                      icon: "✋"
                    },
                    {
                      title: "Trajectory Analysis",
                      items: ["Path efficiency", "Jerk analysis (smoothness)", "Energy metrics", "Velocity profiles", "Outlier detection"],
                      icon: "🎯"
                    },
                    {
                      title: "Generalization",
                      items: ["Per-object success rates", "Difficulty stratification", "Learning curve analysis", "Data efficiency", "Curriculum recommendations"],
                      icon: "📈"
                    },
                    {
                      title: "Transfer Prediction",
                      items: ["Sim2Real confidence score", "Physics fidelity matrix", "Visual fidelity scoring", "Sensor transfer likelihood", "Real-world success estimate"],
                      icon: "🚀"
                    },
                  ].map((category) => (
                    <div key={category.title} className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3 mb-4">
                        <span className="text-2xl">{category.icon}</span>
                        <h3 className="font-bold text-zinc-900 flex-1">{category.title}</h3>
                      </div>
                      <ul className="space-y-2">
                        {category.items.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-zinc-700">
                            <span className="text-emerald-600 mt-1">✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* --- Evaluation Metrics Section --- */}
            <section className="relative overflow-hidden rounded-[2.5rem] border border-amber-100 bg-gradient-to-br from-amber-50/50 to-white p-8 sm:p-12 lg:p-16">
              <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-amber-100/60 blur-3xl" />

              <div className="relative z-10 grid gap-12 lg:grid-cols-2">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-md bg-amber-100 px-2 py-1 text-xs font-bold uppercase tracking-wider text-amber-700">
                    <BarChart3 className="h-3 w-3" /> Quick Metrics Reference
                  </div>
                  <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
                    Standardized comparison metrics.
                  </h2>
                  <p className="text-zinc-600 leading-relaxed">
                    Standard metrics across all policy evaluations enable apples-to-apples comparison. Plus deep-dive telemetry for detailed analysis.
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {evaluationMetrics.map((item) => (
                      <div
                        key={item.metric}
                        className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-amber-100"
                      >
                        <p className="font-bold text-zinc-900">{item.metric}</p>
                        <p className="mt-1 text-xs text-zinc-500">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sample Results Visual */}
                <div className="rounded-2xl border border-amber-100 bg-white p-6 shadow-sm">
                  <p className="mb-4 text-xs font-bold uppercase tracking-widest text-amber-600">
                    Sample Evaluation Results
                  </p>
                  <div className="space-y-4">
                    {[
                      { policy: "OpenVLA-7B", success: 87, time: "12.3s" },
                      { policy: "RT-2-X", success: 82, time: "14.1s" },
                      { policy: "Octo-Base", success: 79, time: "11.8s" },
                      { policy: "Custom RL", success: 91, time: "9.2s" },
                    ].map((result, i) => (
                      <div key={result.policy} className="flex items-center gap-4">
                        <span className="w-8 text-center font-mono text-sm font-bold text-zinc-400">
                          #{i + 1}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-zinc-900">
                              {result.policy}
                            </span>
                            <span className="text-xs text-zinc-500">{result.time}</span>
                          </div>
                          <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                              style={{ width: `${result.success}%` }}
                            />
                          </div>
                        </div>
                        <span className="font-mono text-sm font-bold text-amber-600">
                          {result.success}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-zinc-500 text-center">
                    Example results from "open_microwave" task evaluation
                  </p>
                </div>
              </div>
            </section>

            {/* --- Integration Benefits Section --- */}
            <section className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                  Why Arena Integration?
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-zinc-600">
                  Blueprint + Arena creates a complete robotics data platform from scene generation
                  to policy benchmarking.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {integrationBenefits.map((benefit) => (
                  <div
                    key={benefit.title}
                    className="group rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:shadow-md hover:border-indigo-200"
                  >
                    <div className="mb-4 inline-flex rounded-lg bg-indigo-50 p-2.5 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                      {benefit.icon}
                    </div>
                    <h3 className="font-bold text-zinc-900">{benefit.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{benefit.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* --- Available Benchmark Suites Section --- */}
            <section id="benchmark-suites" className="space-y-8 scroll-mt-8">
              <div className="text-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/50 px-4 py-1 text-xs font-bold uppercase tracking-wider text-emerald-600">
                  <BarChart3 className="h-3 w-3" />
                  Available Suites
                </div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                  Benchmark Suites
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-zinc-600">
                  Submit your policy for evaluation against any of these standardized benchmark suites.
                  Get comparable results with detailed metrics and failure analysis.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {syntheticDatasets.map((benchmark) => (
                  <button
                    key={benchmark.slug}
                    type="button"
                    onClick={() => handleBenchmarkClick(`/benchmarks/${benchmark.slug}`)}
                    className="group rounded-2xl border border-zinc-200 bg-white p-6 text-left shadow-sm transition-all hover:shadow-md hover:border-emerald-200"
                  >
                    <div className="aspect-video overflow-hidden rounded-xl mb-4">
                      <img
                        src={benchmark.heroImage}
                        alt={benchmark.title}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {benchmark.locationType}
                        </span>
                        {benchmark.isNew && (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            New
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-zinc-900 group-hover:text-emerald-700 transition-colors">
                        {benchmark.title}
                      </h3>
                      <p className="text-sm text-zinc-500 line-clamp-2">
                        {benchmark.description}
                      </p>
                      <div className="flex items-center gap-4 pt-2 text-xs text-zinc-500">
                        <span>{benchmark.sceneCount} scenes</span>
                        <span>{benchmark.variationCount?.toLocaleString()} variations</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="text-center">
                <a
                  href="/contact?request=benchmark"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Need a custom benchmark suite?
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </section>

            {/* --- CTA Section --- */}
            <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 sm:p-12 lg:p-16 shadow-2xl">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />

              <div className="relative z-10 text-center">
                <h2 className="text-3xl font-bold text-white sm:text-4xl">
                  Ready to evaluate your policy?
                </h2>
                <p className="mt-4 max-w-2xl mx-auto text-emerald-100">
                  Submit your robot policy for standardized evaluation. Get detailed metrics,
                  comparison against baselines, and actionable insights for improvement.
                </p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
                  <a
                    href="/contact?request=benchmark"
                    className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-4 text-sm font-semibold text-emerald-700 shadow-lg transition hover:bg-emerald-50"
                  >
                    Request Evaluation
                    <Send className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="/marketplace"
                    className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/10 px-8 py-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                  >
                    Buy Scenes for DIY Evals
                    <LayoutGrid className="ml-2 h-4 w-4" />
                  </a>
                </div>

                {/* Partner logos */}
                <div className="mt-12 flex items-center justify-center gap-8 opacity-60">
                  <div className="text-xs font-bold text-white/80 uppercase tracking-wider">
                    Powered by
                  </div>
                  <div className="text-white/80 font-semibold">NVIDIA Isaac Lab</div>
                  <div className="text-white/80 font-semibold">Hugging Face</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
