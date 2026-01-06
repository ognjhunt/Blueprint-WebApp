// import { CTAButtons } from "@/components/site/CTAButtons";
// import { WaitlistForm } from "@/components/site/WaitlistForm";

// const proceduralSteps = [
//   {
//     title: "Author",
//     description:
//       "Procedural seed meshes and kitbashed assets routed through Blueprint finishing for watertight, UV’d geometry.",
//   },
//   {
//     title: "Articulate",
//     description:
//       "We add pivots, joints, and clean colliders so your team can focus on policy authoring instead of asset repair.",
//   },
//   {
//     title: "Validate",
//     description:
//       "Every delivery ships with simulation QA runs, semantic labels on request, and annotation-ready metadata.",
//   },
// ];

// const onsiteSteps = [
//   {
//     title: "Scan",
//     description:
//       "Lidar + photogrammetry capture of either your in-house testbed or the customer site you need to validate—aligned for robotics-safe coverage and survey-grade accuracy.",
//   },
//   {
//     title: "Rebuild",
//     description:
//       "Blueprint engineers convert captures into SimReady scene packages with joints, colliders, semantics, and the exact layout your team will deploy into.",
//   },
//   {
//     title: "Prove",
//     description:
//       "Run targeted policies in your preferred simulator to forecast KPIs, adapt behaviors to site-specific constraints, and prove ROI before hardware deployment.",
//   },
// ];

// export default function Solutions() {
//   return (
//     <div className="mx-auto max-w-6xl space-y-16 px-4 pb-24 pt-16 sm:px-6">
//       <header className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
//         <div className="space-y-6">
//           <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//             Solutions
//           </p>
//           <h1 className="text-4xl font-semibold text-slate-900">
//             Two ways to get SimReady scenes.
//           </h1>
//           <p className="text-sm text-slate-600">
//             Whether you need procedural synthetic data grounded in documented
//             kitchens, warehouses, utility rooms, and other real locations or a
//             digital twin of a facility you operate, Blueprint delivers
//             robotics-ready environments with precision pivots, physics
//             materials, and simulation validation. Choose from non-exclusive
//             catalog scenes or commission exclusive dataset programs tailored to
//             your roadmap.
//           </p>
//           <CTAButtons
//             primaryHref="/environments"
//             primaryLabel="Browse scenes"
//             secondaryHref="/contact"
//             secondaryLabel="Talk to us"
//           />
//         </div>
//         <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8">
//           <h2 className="text-sm font-semibold text-slate-900">
//             What makes a scene SimReady?
//           </h2>
//           <p className="mt-3 text-sm text-slate-600">
//             We measure every build against contact accuracy, articulated
//             coverage, clean semantics, and integration readiness. Delivery
//             includes validation videos, collider previews, and annotated scene
//             files.
//           </p>
//         </div>
//       </header>

//       <section className="space-y-8">
//         <div className="space-y-3">
//           <h2 className="text-3xl font-semibold text-slate-900">
//             Procedural & Synthetic Scene Data
//           </h2>
//           <p className="max-w-3xl text-sm text-slate-600">
//             Generate diverse training sets with curated procedural environments.
//             Each scene begins with survey photos, scans, or CAD from real-world
//             analogs so the layouts, sight lines, and clutter patterns match
//             kitchens, grocery aisles, warehouse pick lanes, retail floors, and
//             residential rooms your robots will encounter.
//           </p>
//         </div>
//         <div className="grid gap-6 md:grid-cols-3">
//           {proceduralSteps.map((step, index) => (
//             <div
//               key={step.title}
//               className="rounded-3xl border border-slate-200 bg-white p-6"
//             >
//               <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                 0{index + 1}
//               </span>
//               <h3 className="mt-3 text-lg font-semibold text-slate-900">
//                 {step.title}
//               </h3>
//               <p className="mt-3 text-sm text-slate-600">{step.description}</p>
//             </div>
//           ))}
//         </div>
//         <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
//           <p>
//             Deliverables: Scene package with articulated assets, texture
//             libraries, annotation schema (optional), simulation validation reel,
//             change-log, and recommended policy tasks.
//           </p>
//         </div>
//       </section>

//       <section className="space-y-8" id="pricing">
//         <div className="space-y-3">
//           <h2 className="text-3xl font-semibold text-slate-900">
//             On-site SimReady Location (waitlist)
//           </h2>
//           <p className="max-w-3xl text-sm text-slate-600">
//             Turn a real site into a validated digital twin. Whether you need to
//             capture a facility you already control or a prospect’s floor you
//             hope to deploy into, we scan, rebuild, and deliver SimReady scenes
//             within days so your robotics team can prove ROI in simulation before
//             rolling out hardware.
//           </p>
//           <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
//             <p className="font-semibold text-slate-900">
//               Two ways customers use the service today:
//             </p>
//             <ul className="mt-2 space-y-2 list-disc pl-5">
//               <li>
//                 Capture a lab-owned environment so you can iterate and
//                 post-train policies against a space you control before inviting
//                 external stakeholders.
//               </li>
//               <li>
//                 Scan the exact warehouse, grocery, or retail floor you’re
//                 selling into, then simulate workflows to quantify savings, prove
//                 uptime, and de-risk the rollout before robots ever arrive.
//               </li>
//             </ul>
//           </div>
//         </div>
//         <div className="grid gap-6 md:grid-cols-3">
//           {onsiteSteps.map((step, index) => (
//             <div
//               key={step.title}
//               className="rounded-3xl border border-slate-200 bg-white p-6"
//             >
//               <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                 0{index + 1}
//               </span>
//               <h3 className="mt-3 text-lg font-semibold text-slate-900">
//                 {step.title}
//               </h3>
//               <p className="mt-3 text-sm text-slate-600">{step.description}</p>
//             </div>
//           ))}
//         </div>
//         <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
//           <h3 className="text-sm font-semibold text-slate-900">
//             Reserve your slot
//           </h3>
//           <p className="mt-2 text-sm text-slate-600">
//             Priority goes to facilities with active robotic deployments. Join
//             the waitlist and we’ll coordinate capture windows, SLAs, and
//             pricing.
//           </p>
//           <div className="mt-4">
//             <WaitlistForm />
//           </div>
//         </div>
//       </section>
//     </div>
//   );
// }
import { CTAButtons } from "@/components/site/CTAButtons";
import { WaitlistForm } from "@/components/site/WaitlistForm";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Beaker,
  Box,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock,
  Clock3,
  Cpu,
  Database,
  DollarSign,
  Download,
  Factory,
  FileCode,
  FileJson,
  Fingerprint,
  Hammer,
  Layers,
  LineChart,
  Package,
  Play,
  Scan,
  Share2,
  Sparkles,
  Target,
  Terminal,
  TestTube,
  Video,
  Zap,
} from "lucide-react";

// --- Configuration ---

const SHOW_REAL_WORLD_CAPTURE = false;
const SHOW_SCENE_RECIPES = false; // Hidden: recipes temporarily removed from offerings (will be added back later)

const proceduralSteps = [
  {
    title: "Author",
    description:
      "Precision geometry with PBR materials and watertight topology optimized for physics solvers.",
    icon: <Layers className="h-6 w-6 text-indigo-600" />,
  },
  {
    title: "Articulate",
    description:
      "Full physics metadata: mass, inertia, joint friction, constraints, and validated colliders for manipulation.",
    icon: <Hammer className="h-6 w-6 text-indigo-600" />,
  },
  {
    title: "Validate",
    description:
      "Sim2real QA, deterministic domain randomization scripts, and semantic annotations for perception training.",
    icon: <CheckCircle2 className="h-6 w-6 text-indigo-600" />,
  },
];

const onsiteSteps = [
  {
    title: "Scan",
    description:
      "Lidar + photogrammetry capture with survey-grade accuracy for field robotics and industrial automation sites.",
    icon: <Scan className="h-6 w-6 text-emerald-400" />,
  },
  {
    title: "Rebuild",
    description:
      "Physics-accurate reconstruction with mass, inertia, friction properties, and sim2real-validated geometry.",
    icon: <Box className="h-6 w-6 text-emerald-400" />,
  },
  {
    title: "Prove",
    description:
      "Domain randomization + policy validation to prove sim-to-real transfer before hardware deployment.",
    icon: <LineChart className="h-6 w-6 text-emerald-400" />,
  },
];

const recipeDeliverables = [
  {
    icon: <FileCode className="h-5 w-5 text-indigo-600" />,
    title: "USD recipe layer",
    desc: "Room shell, prim hierarchy, transforms, semantics, and physics defaults in a lightweight .usda layer.",
  },
  {
    icon: <FileJson className="h-5 w-5 text-indigo-600" />,
    title: "Dependency manifest",
    desc: "References to required NVIDIA SimReady packs, expected root paths, and fallbacks so you install assets locally.",
  },
  {
    icon: <Terminal className="h-5 w-5 text-indigo-600" />,
    title: "Variation generator",
    desc: "Omniverse Replicator scripts for swaps, clutter, lighting, material randomization, and articulation state noise. Typically 500–2,000 variations per scene, plus AI-generated episodes.",
  },
];

const simreadyUseCases = [
  {
    title: "Sim2Real Policy Training",
    icon: <Cpu className="h-5 w-5 text-indigo-600" />,
    desc: "Domain randomization across train seeds with held-out layouts for measuring sim-to-real transfer and policy generalization.",
  },
  {
    title: "Physics-Accurate Evaluation",
    icon: <CheckCircle2 className="h-5 w-5 text-indigo-600" />,
    desc: "Strict seeds with validated mass, inertia, and friction for regression testing and policy comparison.",
  },
  {
    title: "Perception Synthetic Data",
    icon: <Camera className="h-5 w-5 text-indigo-600" />,
    desc: "Replicator renders RGB plus segmentation, boxes, depth, and normals with deterministic domain randomization.",
  },
  {
    title: "Industrial Automation & Field Robotics",
    icon: <Factory className="h-5 w-5 text-indigo-600" />,
    desc: "Digital twins for manufacturing, warehouse, agriculture, and outdoor deployments with physics-accurate layouts.",
  },
];

const hardParts = [
  {
    title: "Scene assembly & references",
    icon: <Layers className="h-5 w-5 text-emerald-600" />,
    desc: "Pull assets from Nucleus or local paths, place them, and keep prim paths and references stable. Dependency and repathing issues are common.",
  },
  {
    title: "Physics correctness",
    icon: <Box className="h-5 w-5 text-emerald-600" />,
    desc: "Prims need colliders, rigid body schema, and tuned materials. SimReady ships baseline metadata, but teams still decide runtime interactions.",
  },
  {
    title: "Semantics & labeling",
    icon: <FileJson className="h-5 w-5 text-emerald-600" />,
    desc: "Consistent segmentation, instance IDs, and task-level tags (like handles) must stay aligned across scenes.",
  },
  {
    title: "Task logic for policies",
    icon: <Terminal className="h-5 w-5 text-emerald-600" />,
    desc: "Action application, rewards/observations, resets/termination, and multi-env cloning in Isaac Lab are often more work than 3D placement.",
  },
  {
    title: "Randomization & SDG",
    icon: <Video className="h-5 w-5 text-emerald-600" />,
    desc: "Replicator scripts randomize perception datasets. RL flows lean on PhysX-side writes when USD edits are disabled for speed.",
  },
  {
    title: "Packaging & reproducibility",
    icon: <AlertTriangle className="h-5 w-5 text-emerald-600" />,
    desc: "Collecting or flattening scenes can break materials and paths, so teams build validation and packaging tooling to stay sane.",
  },
];

const labWorkflow = [
  {
    title: "Start from a template scene",
    detail: "Warehouse, kitchen, or workcell shell with assets referenced via Nucleus or local usd_path configs in Isaac Lab.",
  },
  {
    title: "Run physics QA",
    detail: "Confirm colliders, rigid bodies, stable stacking, and perf budgets before scaling multi-env runs.",
  },
  {
    title: "Add semantics",
    detail: "Segment labels, instance IDs, and task-relevant tags such as handles or grasp affordances.",
  },
  {
    title: "Integrate the training harness",
    detail: "Define sim settings, cloning, actions, rewards/obs, and reset/termination logic in Isaac Lab.",
  },
  {
    title: "Randomize",
    detail: "Replicator for perception SDG; RL-specific randomizers that keep USD writes optional for speed.",
  },
  {
    title: "Split train/eval and package",
    detail: "Hold out layouts or seeds, then collect/share scenes. This is where path/material issues often appear.",
  },
];

const effortBands = [
  {
    label: "Demo scene",
    time: "~0.5–2 days",
    cost: "1–3 engineer-days",
    desc: "Looks right and runs with minimal QA; slowed down by paths, scaling, colliders, and lighting.",
  },
  {
    label: "Training-grade RL scene",
    time: "~1–3 weeks",
    cost: "$10k–$100k engineering time",
    desc: "New task + environment combo with rewards/obs/reset code, physics stability, and randomization plumbing at scale.",
  },
  {
    label: "Perception SDG pipeline",
    time: "~2–10 days",
    cost: "Engineering + compute/storage/QA",
    desc: "Robust generators with annotation needs, randomization rules, and dataset validation loops.",
  },
];

// --- Data Pipeline Component ---

function DataPipelineSection() {
  return (
    <section className="relative overflow-hidden rounded-[2.5rem] bg-zinc-900 p-8 text-zinc-300 sm:p-12 lg:p-16 shadow-2xl">
      {/* Background Pattern */}
      <div className="absolute top-0 left-0 h-full w-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
      <div className="absolute bottom-0 right-0 -mb-32 -mr-32 h-96 w-96 rounded-full bg-indigo-900/20 blur-3xl" />
      <div className="absolute top-0 left-0 -mt-32 -ml-32 h-96 w-96 rounded-full bg-zinc-800/50 blur-3xl" />

      <div className="relative z-10 space-y-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold text-white sm:text-5xl">
            Image to SimReady Scene
          </h2>
          <p className="max-w-3xl mx-auto text-zinc-400 leading-relaxed">
            Upload a reference photo and receive a fully articulated, physics-accurate 3D scene ready for Isaac Sim, complete with domain randomization scripts and RL training configs.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-indigo-900/40 bg-zinc-900/70 shadow-xl ring-1 ring-indigo-500/30">
          <img
            src="/images/Gemini_Solutions.png"
            alt="Image to SimReady pipeline illustration"
            className="w-full object-cover"
            loading="lazy"
          />
        </div>

        {/* Pipeline Flow */}
        <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr_auto_1fr] items-start">
          {/* Input Column */}
          <div className="space-y-4">
            <h3 className="text-center text-xl font-bold text-white">Upload</h3>
            <div className="rounded-2xl border border-zinc-700/50 bg-zinc-800/50 p-5 space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-zinc-700/50 p-4 ring-1 ring-indigo-500/30">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-800 text-indigo-400 ring-1 ring-indigo-400/30">
                  <Camera className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Reference Photo</p>
                  <p className="text-xs text-zinc-400">single wide-angle image</p>
                </div>
              </div>
              <div className="rounded-xl bg-zinc-800/80 p-3 text-xs text-zinc-500">
                <p className="font-medium text-zinc-400 mb-1">Supported scenes:</p>
                <p>Kitchens, warehouses, retail, labs, workcells, residential</p>
              </div>
            </div>
          </div>

          {/* Arrow 1 */}
          <div className="hidden lg:flex items-center justify-center h-full pt-12">
            <ArrowRight className="h-8 w-8 text-zinc-600" />
          </div>

          {/* Processing Column */}
          <div className="space-y-4">
            <h3 className="text-center text-xl font-bold text-white">Automatic Processing</h3>
            <div className="rounded-2xl border border-zinc-700/50 bg-zinc-800/50 p-5 space-y-3">
              <div className="flex items-center justify-center gap-2 text-zinc-400 pb-2">
                <Clock className="h-4 w-4 text-indigo-400" />
                <span className="text-xs font-medium">30–60 minutes</span>
              </div>
              {[
                { step: "Scene Reconstruction", desc: "3D geometry from photo" },
                { step: "Articulation", desc: "joints, pivots, constraints" },
                { step: "Physics Properties", desc: "mass, friction, colliders" },
                { step: "USD Assembly", desc: "scene.usda composition" },
                { step: "Domain Randomization", desc: "Replicator scripts" },
                { step: "RL Config Generation", desc: "Isaac Lab env configs" },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl bg-zinc-700/50 px-4 py-2.5 ring-1 ring-zinc-600/50"
                >
                  <p className="text-sm font-medium text-zinc-200">{item.step}</p>
                  <p className="text-xs text-zinc-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Arrow 2 */}
          <div className="hidden lg:flex items-center justify-center h-full pt-12">
            <ArrowRight className="h-8 w-8 text-zinc-600" />
          </div>

          {/* Output Column */}
          <div className="space-y-4">
            <h3 className="text-center text-xl font-bold text-white">Deliverables</h3>
            <div className="rounded-2xl border border-zinc-700/50 bg-zinc-800/50 p-5 space-y-4">
              {/* Main Output */}
              <div className="rounded-xl bg-indigo-900/30 p-4 ring-1 ring-indigo-500/30">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-3 w-3 rounded-full bg-indigo-400" />
                  <p className="text-sm font-bold text-white">Isaac Sim Scene</p>
                </div>
                <p className="text-xs text-zinc-400">USD scene package with all assets, physics, and semantics</p>
              </div>

              {/* Included Bundles */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Included</p>
                {[
                  { icon: <Layers className="h-4 w-4" />, label: "Articulated assets", desc: "per-object USD" },
                  { icon: <Video className="h-4 w-4" />, label: "Replicator bundle", desc: "domain randomization" },
                  { icon: <Terminal className="h-4 w-4" />, label: "Isaac Lab config", desc: "env_cfg.py + train.yaml" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-xl bg-zinc-700/50 px-3 py-2 ring-1 ring-zinc-600/50"
                  >
                    <span className="text-indigo-400">{item.icon}</span>
                    <div>
                      <p className="text-xs font-medium text-zinc-200">{item.label}</p>
                      <p className="text-xs text-zinc-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Access */}
              <div className="pt-2 border-t border-zinc-700/50">
                <div className="flex items-center justify-center gap-2 rounded-xl bg-zinc-700/50 px-4 py-2 ring-1 ring-zinc-600/50">
                  <Download className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs font-medium text-zinc-200">Download from marketplace</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3 pt-6 border-t border-zinc-800">
          <div className="text-center">
            <p className="text-3xl font-bold text-indigo-400">15</p>
            <p className="text-sm text-zinc-400">manipulation policies included</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-indigo-400">30-60 min</p>
            <p className="text-sm text-zinc-400">end-to-end pipeline</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-indigo-400">1000+</p>
            <p className="text-sm text-zinc-400">scenes/day at scale</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Arena Integration Section ---

function ArenaIntegrationSection() {
  return (
    <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 text-white sm:p-12 lg:p-16 shadow-2xl">
      <div className="absolute top-0 left-0 h-full w-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
      <div className="absolute bottom-0 right-0 -mb-32 -mr-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute top-0 left-0 -mt-32 -ml-32 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl" />

      {/* NEW Badge */}
      <div className="absolute top-6 right-6 sm:top-8 sm:right-8">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-sm ring-1 ring-white/30">
          <Zap className="h-3 w-3" />
          New
        </span>
      </div>

      <div className="relative z-10 space-y-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-md bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-sm">
            <BarChart3 className="h-3 w-3" />
            Isaac Lab-Arena Integration
          </div>
          <h2 className="text-4xl font-bold text-white sm:text-5xl">
            Policy Evaluation at Scale
          </h2>
          <p className="max-w-3xl mx-auto text-emerald-100 leading-relaxed">
            Every Blueprint scene now exports directly to NVIDIA Isaac Lab-Arena format. Standardized
            affordances enable automatic task generation and GPU-parallel policy benchmarking.
          </p>
        </div>

        {/* Arena Pipeline Visual */}
        <div className="grid gap-6 lg:grid-cols-4">
          {[
            { step: "01", title: "Scene", desc: "Physics-accurate USD from Blueprint", icon: <Layers className="h-6 w-6" /> },
            { step: "02", title: "Affordances", desc: "Auto-detect: Openable, Graspable, etc.", icon: <Fingerprint className="h-6 w-6" /> },
            { step: "03", title: "Tasks", desc: "Generate Arena task definitions", icon: <Target className="h-6 w-6" /> },
            { step: "04", title: "Evaluate", desc: "GPU-parallel policy benchmarks", icon: <BarChart3 className="h-6 w-6" /> },
          ].map((item, i) => (
            <div key={item.step} className="relative">
              <div className="rounded-2xl bg-white/10 p-6 backdrop-blur-sm ring-1 ring-white/20 h-full">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-emerald-300">{item.step}</span>
                  <div className="text-white/60">{item.icon}</div>
                </div>
                <h3 className="text-lg font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-emerald-100">{item.desc}</p>
              </div>
              {i < 3 && (
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 hidden lg:block">
                  <ArrowRight className="h-6 w-6 text-white/40" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Benefits Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: <Target className="h-5 w-5" />, title: "Standardized Benchmarks", desc: "Compare policies apples-to-apples" },
            { icon: <Zap className="h-5 w-5" />, title: "1000x Parallel Scale", desc: "GPU-accelerated evaluation" },
            { icon: <Database className="h-5 w-5" />, title: "LeRobot Hub", desc: "Auto-register for community sharing" },
            { icon: <Fingerprint className="h-5 w-5" />, title: "17 Affordances", desc: "Openable, Graspable, Turnable, etc." },
          ].map((benefit) => (
            <div
              key={benefit.title}
              className="flex items-start gap-3 rounded-xl bg-white/10 p-4 backdrop-blur-sm ring-1 ring-white/10"
            >
              <div className="text-emerald-300">{benefit.icon}</div>
              <div>
                <p className="text-sm font-bold text-white">{benefit.title}</p>
                <p className="text-xs text-emerald-200">{benefit.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center pt-4">
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="/arena"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-emerald-700 shadow-lg transition hover:bg-emerald-50"
            >
              Learn About Arena Integration
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/environments"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              Browse Arena-Ready Scenes
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Arena Services Data ---

const arenaServices = [
  {
    title: "Smart Simulation Scenes",
    tagline: "3D environments where every object knows what it can do",
    icon: <Layers className="h-6 w-6" />,
    color: "indigo",
    price: "$1K–3K per scene",
    plainEnglish: "We build 3D worlds for your robot to practice in. But unlike regular 3D models, every object in our scenes is \"smart\" — doors know they can open, drawers know they slide, buttons know they can be pressed. This is called \"affordance tagging\" and it's the new industry standard.",
    whyPayMore: "Your robot policies work immediately with NVIDIA's evaluation tools. No manual labeling needed.",
    includes: [
      "Physics-accurate 3D environment",
      "All objects tagged with what they can do",
      "Ready for Isaac Lab-Arena benchmarks",
      "Domain randomization scripts included",
    ],
  },
  {
    title: "Policy Benchmarking Service",
    tagline: "Send us your robot AI, we'll tell you how well it works",
    icon: <TestTube className="h-6 w-6" />,
    color: "emerald",
    price: "$200–500 per run or $3K–5K/month",
    plainEnglish: "Think of this like a report card for your robot's brain. You send us your trained policy (the AI that controls your robot), we run it through hundreds of test scenarios, and give you a detailed breakdown of how it performed.",
    whyPayMore: "Before this, companies had to buy expensive hardware or build their own testing systems. We offer testing-as-a-service.",
    includes: [
      "Run your policy through 100+ test scenarios",
      "Detailed success/failure breakdown",
      "Performance metrics (speed, accuracy, collisions)",
      "Comparison against baseline policies",
    ],
    example: "\"Your robot opened doors successfully 73% of the time, picked up cups 89% of the time, and navigated obstacles with only 2 collisions per 100 attempts.\"",
  },
  {
    title: "Custom Evaluation Suites",
    tagline: "A custom \"test course\" built for your specific use case",
    icon: <Target className="h-6 w-6" />,
    color: "amber",
    price: "$5K–20K per suite",
    plainEnglish: "We build a custom testing environment designed specifically for what your robot needs to do. It's like building a driving test course, but for robots — complete with all the scenarios they'll face in the real world.",
    whyPayMore: "Generic tests don't catch problems specific to your use case. A custom suite tests exactly what matters for your deployment.",
    includes: [
      "50+ custom test scenes for your use case",
      "Task-specific success criteria",
      "Automated scoring and reporting",
      "Unlimited test runs",
    ],
    example: "Warehouse company: \"Test if the robot can pick items from shelves at various heights, navigate around moving obstacles, and place items in bins without dropping them.\"",
  },
  {
    title: "LeRobot Hub Publishing",
    tagline: "Share your training environments with the robotics community",
    icon: <Share2 className="h-6 w-6" />,
    color: "violet",
    price: "$500–1K per environment",
    plainEnglish: "Hugging Face runs a registry called LeRobot Hub where researchers share robot training environments. We help you package and publish your environments there so others can use them (and cite your work).",
    whyPayMore: "Academic labs get citations and visibility. Companies get community contributions back. Everyone benefits from shared standards.",
    includes: [
      "Environment packaging for Hub format",
      "Metadata and documentation setup",
      "Registration and publishing",
      "Leaderboard integration",
    ],
  },
  {
    title: "Photo-to-Evaluation Pipeline",
    tagline: "The complete package: from photos to trained, tested robot policies",
    icon: <Package className="h-6 w-6" />,
    color: "rose",
    price: "Custom pricing (typically $15K–50K)",
    plainEnglish: "Give us pictures of your warehouse, kitchen, or factory. We'll build a digital twin, add all the \"smart\" object tags, create evaluation tasks, benchmark your policies, and deliver trained policies with performance reports. It's the full service.",
    whyPayMore: "You get a complete solution instead of piecing together multiple vendors. One partner, one pipeline, tested results.",
    includes: [
      "Photo-based 3D reconstruction",
      "Full affordance tagging",
      "Custom evaluation suite",
      "Policy benchmarking runs",
      "Performance reports and recommendations",
      "Optional: Policy fine-tuning",
    ],
    example: "\"Give us photos of your facility, we'll give you a simulation where you can train and test robot brains safely and cheaply — before risking real hardware.\"",
  },
];

// --- Arena Services Section ---

function ArenaServicesSection() {
  return (
    <section className="relative overflow-hidden rounded-[2.5rem] border border-zinc-200 bg-white p-8 shadow-sm sm:p-12 lg:p-16">
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-indigo-100/40 blur-3xl" />
      <div className="absolute -left-24 -bottom-24 h-80 w-80 rounded-full bg-emerald-100/40 blur-3xl" />

      <div className="relative z-10 space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600">
            <DollarSign className="h-3 w-3" />
            New Services Available
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            What we can build for you.
          </h2>
          <p className="max-w-3xl mx-auto text-zinc-600 leading-relaxed">
            With our Arena integration, Blueprint now offers end-to-end robotics evaluation services.
            Here's what that means for your team — in plain English.
          </p>
        </div>

        {/* Services Grid */}
        <div className="space-y-8">
          {arenaServices.map((service, index) => (
            <div
              key={service.title}
              className={`rounded-2xl border p-6 sm:p-8 transition-all hover:shadow-lg ${
                service.color === "indigo" ? "border-indigo-100 hover:border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white" :
                service.color === "emerald" ? "border-emerald-100 hover:border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white" :
                service.color === "amber" ? "border-amber-100 hover:border-amber-200 bg-gradient-to-br from-amber-50/50 to-white" :
                service.color === "violet" ? "border-violet-100 hover:border-violet-200 bg-gradient-to-br from-violet-50/50 to-white" :
                "border-rose-100 hover:border-rose-200 bg-gradient-to-br from-rose-50/50 to-white"
              }`}
            >
              <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
                {/* Left: Title and Description */}
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      service.color === "indigo" ? "bg-indigo-100 text-indigo-600" :
                      service.color === "emerald" ? "bg-emerald-100 text-emerald-600" :
                      service.color === "amber" ? "bg-amber-100 text-amber-600" :
                      service.color === "violet" ? "bg-violet-100 text-violet-600" :
                      "bg-rose-100 text-rose-600"
                    }`}>
                      {service.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl font-bold text-zinc-900">{service.title}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${
                          service.color === "indigo" ? "bg-indigo-100 text-indigo-700" :
                          service.color === "emerald" ? "bg-emerald-100 text-emerald-700" :
                          service.color === "amber" ? "bg-amber-100 text-amber-700" :
                          service.color === "violet" ? "bg-violet-100 text-violet-700" :
                          "bg-rose-100 text-rose-700"
                        }`}>
                          {service.price}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-500 italic">{service.tagline}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">In plain English</p>
                      <p className="text-sm text-zinc-700 leading-relaxed">{service.plainEnglish}</p>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Why it's valuable</p>
                      <p className="text-sm text-zinc-600 leading-relaxed">{service.whyPayMore}</p>
                    </div>

                    {service.example && (
                      <div className={`rounded-lg p-3 text-sm italic ${
                        service.color === "indigo" ? "bg-indigo-50 text-indigo-700" :
                        service.color === "emerald" ? "bg-emerald-50 text-emerald-700" :
                        service.color === "amber" ? "bg-amber-50 text-amber-700" :
                        service.color === "violet" ? "bg-violet-50 text-violet-700" :
                        "bg-rose-50 text-rose-700"
                      }`}>
                        <span className="font-semibold not-italic">Example: </span>
                        {service.example}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: What's Included */}
                <div className={`rounded-xl p-5 ${
                  service.color === "indigo" ? "bg-indigo-50/70 ring-1 ring-indigo-100" :
                  service.color === "emerald" ? "bg-emerald-50/70 ring-1 ring-emerald-100" :
                  service.color === "amber" ? "bg-amber-50/70 ring-1 ring-amber-100" :
                  service.color === "violet" ? "bg-violet-50/70 ring-1 ring-violet-100" :
                  "bg-rose-50/70 ring-1 ring-rose-100"
                }`}>
                  <p className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-3">What's included</p>
                  <ul className="space-y-2">
                    {service.includes.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-zinc-700">
                        <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${
                          service.color === "indigo" ? "text-indigo-500" :
                          service.color === "emerald" ? "text-emerald-500" :
                          service.color === "amber" ? "text-amber-500" :
                          service.color === "violet" ? "text-violet-500" :
                          "text-rose-500"
                        }`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Line Summary */}
        <div className="rounded-2xl bg-zinc-900 p-6 sm:p-8 text-white">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="space-y-3">
              <h3 className="text-xl font-bold">The bottom line</h3>
              <div className="space-y-2 text-zinc-300">
                <p><span className="text-zinc-400">Before Arena integration:</span> We sold digital dollhouses for robots.</p>
                <p><span className="text-zinc-400">After Arena integration:</span> We sell digital dollhouses <span className="text-emerald-400 font-semibold">+ the testing equipment + the report cards + community publishing</span>.</p>
              </div>
              <p className="text-sm text-zinc-400">
                We've gone from "scene vendor" to "complete robotics evaluation platform" — exactly what labs need as they move from research to real-world deployment.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <a
                href="/contact?service=evaluation"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-zinc-900 shadow-lg transition hover:bg-zinc-100"
              >
                Request a Quote
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/arena"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                Technical Details
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- Visual Helpers ---

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
      <rect
        width="100%"
        height="100%"
        strokeWidth={0}
        fill="url(#grid-pattern)"
      />
    </svg>
  );
}

export default function Solutions() {
  return (
    <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
      <DotPattern />

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        {/* --- Header --- */}
        <header className="grid gap-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center mb-24">
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600 backdrop-blur-sm">
                <Sparkles className="h-3 w-3" />
                Solutions
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
                Three paths to <br />
                <span className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
                  SimReady reality.
                </span>
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-zinc-600">
                Whether you need procedural synthetic data with domain randomization,
                an exclusive physics-accurate reconstruction, or a sim2real-validated
                digital twin, we deliver environments engineered for manipulation,
                perception, and policy transfer.
              </p>
            </div>
            <CTAButtons
              primaryHref="/environments"
              primaryLabel="Browse Marketplace"
              secondaryHref="/contact"
              secondaryLabel="Discuss Custom Needs"
            />
          </div>

          {/* QA Badge Card */}
          <div className="relative rounded-3xl border border-zinc-200 bg-white/80 p-8 shadow-xl backdrop-blur-sm lg:translate-y-4">
            <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-indigo-500/10 blur-2xl" />

            <div className="relative space-y-4">
              <div className="flex items-center gap-3 border-b border-zinc-100 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-900">
                    The SimReady Standard
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Guaranteed in every release
                  </p>
                </div>
              </div>
              <ul className="space-y-3">
                {[
                  "Contact-accurate colliders",
                  "Articulated coverage (100%)",
                  "Semantic segmentation",
                  "Integration readiness (USD/URDF)",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 text-sm text-zinc-600"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </header>

        <div className="space-y-24">
          {/* --- Section: Data Pipeline --- */}
          <DataPipelineSection />

          {/* --- Section: Arena Integration (NEW) --- */}
          <ArenaIntegrationSection />

          {/* --- Section: Arena Services (What We Can Sell) --- */}
          <ArenaServicesSection />

          {/* --- Section: SimReady Use Cases --- */}
          <section className="relative overflow-hidden rounded-[2.5rem] border border-indigo-100 bg-white p-8 shadow-sm sm:p-12 lg:p-16">
            <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-indigo-100/60 blur-3xl" />

            <div className="relative z-10 space-y-8">
              <div className="inline-flex items-center gap-2 rounded-md bg-indigo-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
                <ClipboardList className="h-3 w-3" /> Use cases
              </div>
              <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                <div className="space-y-4">
                  <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">Where labs plug SimReady packs.</h2>
                  <p className="text-zinc-600 leading-relaxed">
                    SimReady scenes power policy training, perception data engines, and industrial digital twins. The
                    common thread: teams need consistent semantics, USDPhysics metadata, and stable frame generation to measure
                    generalization.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {simreadyUseCases.map((item) => (
                      <div
                        key={item.title}
                        className="flex h-full flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 shadow-sm"
                      >
                        <div className="flex items-center gap-2 text-indigo-700">
                          {item.icon}
                          <span className="text-sm font-bold uppercase tracking-wider">{item.title}</span>
                        </div>
                        <p className="text-sm text-zinc-700 leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-indigo-600" />
                    <h3 className="text-lg font-bold text-zinc-900">Why it matters</h3>
                  </div>
                  <p className="text-sm text-zinc-700 leading-relaxed">
                    NVIDIA’s own SimReady docs frame packs as the bridge between robot/autonomy training and industrial
                    digital twins, emphasizing the extra metadata beyond visuals. Position papers in RL call "environment
                    shaping" the main bottleneck, exactly the gap we close.
                  </p>
                  <div className="rounded-xl bg-white p-4 text-xs text-zinc-600 ring-1 ring-indigo-100">
                    <p className="font-semibold text-zinc-900">Important nuance</p>
                    <p className="mt-1 leading-relaxed">
                      The current SimReady spec focuses on static props; anything with doors, drawers, or hinges often still
                      needs additional rigging and schema work. Our articulation and QA passes cover that edge.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* --- Section: Why it’s still hard --- */}
          <section className="relative overflow-hidden rounded-[2.5rem] border border-emerald-100 bg-white p-8 shadow-sm sm:p-12 lg:p-16">
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-100/60 blur-3xl" />

            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                <AlertTriangle className="h-3 w-3" /> Why it’s still hard
              </div>
              <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">Having assets doesn’t finish the scene.</h2>
              <p className="max-w-3xl text-zinc-600 leading-relaxed">
                Asset hunting ends once you own SimReady packs. The heavy lift is shaping an environment that behaves: USD
                composition, physics correctness, semantics, task logic, robust randomization, and packaging without broken
                paths.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                {hardParts.map((item) => (
                  <div
                    key={item.title}
                    className="flex h-full flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-emerald-700">
                      {item.icon}
                      <span className="text-sm font-bold uppercase tracking-wider">{item.title}</span>
                    </div>
                    <p className="text-sm text-zinc-700 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* --- Section: Workflow --- */}
          <section className="relative overflow-hidden rounded-[2.5rem] border border-zinc-200 bg-white p-8 shadow-sm sm:p-12 lg:p-16">
            <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-zinc-100/60 blur-3xl" />

            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-2 py-1 text-xs font-bold uppercase tracking-wider text-zinc-700">
                <ClipboardList className="h-3 w-3" /> Typical workflow
              </div>
              <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">What serious labs do today.</h2>
              <p className="max-w-3xl text-zinc-600 leading-relaxed">
                A modern pipeline blends USD assembly, Isaac Lab task code, Replicator randomization, and reproducible
                packaging. We build the scene, semantics, and QA so your team can focus on policies and metrics.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                {labWorkflow.map((step, index) => (
                  <div
                    key={step.title}
                    className="group relative flex h-full items-start gap-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm ring-1 ring-zinc-200 group-hover:scale-105 transition-transform">
                      <span className="font-mono text-sm font-bold">0{index + 1}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-900">{step.title}</h3>
                      <p className="mt-2 text-sm text-zinc-700 leading-relaxed">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* --- Section: Timeline & Cost --- */}
          <section className="relative overflow-hidden rounded-[2.5rem] border border-indigo-100 bg-white p-8 shadow-sm sm:p-12 lg:p-16">
            <div className="absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-indigo-100/60 blur-3xl" />

            <div className="relative z-10 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-md bg-indigo-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
                <Clock3 className="h-3 w-3" /> Timeline & cost
              </div>
              <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">How long it really takes.</h2>
              <p className="max-w-3xl text-zinc-600 leading-relaxed">
                Having assets helps, but environment shaping, task logic, and reproducible packaging still dominate the
                schedule. Here’s what typical engineering effort looks like once assets are in hand.
              </p>

              <div className="grid gap-4 md:grid-cols-3">
                {effortBands.map((item) => (
                  <div
                    key={item.label}
                    className="flex h-full flex-col gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-indigo-700">
                      <Clock3 className="h-4 w-4" />
                      <span className="text-sm font-bold uppercase tracking-wider">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-zinc-700">
                      <span className="rounded-full bg-white px-2 py-1 font-semibold text-zinc-900 ring-1 ring-indigo-100">{item.time}</span>
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">{item.cost}</span>
                    </div>
                    <p className="text-sm text-zinc-700 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* --- Section 1: Procedural (Light Theme) --- */}
          <section className="relative rounded-[2.5rem] border border-zinc-200 bg-zinc-50/50 p-8 sm:p-12 lg:p-16 overflow-hidden">
            <div className="absolute top-0 right-0 -mt-20 -mr-20 h-96 w-96 rounded-full bg-indigo-100/50 blur-3xl" />

            <div className="relative z-10 grid gap-12 lg:grid-cols-2">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-md bg-indigo-100 px-2 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
                  <Box className="h-3 w-3" /> Procedural & Synthetic
                </div>
                <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
                  Scale your training with infinite variety.
                </h2>
                <p className="text-zinc-600 leading-relaxed">
                  Generate diverse training sets with curated procedural
                  environments. Each scene begins with survey photos or CAD from
                  real-world analogs so layouts and clutter patterns match the
                  kitchens, aisles, and rooms your robots will encounter.
                </p>

                {/* Deliverables Box */}
                <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-400">
                    Included Deliverables
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3">
                      <FileCode className="h-5 w-5 text-zinc-400" />
                      <div className="text-xs">
                        <span className="block font-bold text-zinc-900">
                          Scene Package
                        </span>
                        <span className="text-zinc-500">USD + Textures</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3">
                      <Video className="h-5 w-5 text-zinc-400" />
                      <div className="text-xs">
                        <span className="block font-bold text-zinc-900">
                          Validation
                        </span>
                        <span className="text-zinc-500">Sim Reel + Logs</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-lg bg-zinc-50 p-3">
                      <FileJson className="h-5 w-5 text-zinc-400" />
                      <div className="text-xs">
                        <span className="block font-bold text-zinc-900">
                          Metadata
                        </span>
                        <span className="text-zinc-500">
                          Semantics + Annotations
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Steps Vertical List */}
              <div className="flex flex-col justify-center gap-6">
                {proceduralSteps.map((step, index) => (
                  <div
                    key={step.title}
                    className="group relative flex gap-6 rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:shadow-md hover:border-indigo-200"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
                      {step.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-zinc-300">
                          0{index + 1}
                        </span>
                        <h3 className="text-lg font-bold text-zinc-900">
                          {step.title}
                        </h3>
                      </div>
                      <p className="mt-2 text-sm text-zinc-600">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* --- Section: Scene Recipes --- */}
          {SHOW_SCENE_RECIPES && (
          <section className="relative overflow-hidden rounded-[2.5rem] border border-emerald-100 bg-white p-8 shadow-sm sm:p-12 lg:p-16">
            <div className="absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-emerald-100/60 blur-3xl" />
            <div className="relative z-10 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                  <Terminal className="h-3 w-3" /> Scene Recipes
                </div>
                <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
                  Layouts, manifests, and variation generators. BYO SimReady assets.
                </h2>
                <p className="text-zinc-600 leading-relaxed">
                  We deliver a lightweight USD layer plus a manifest that references NVIDIA SimReady packs you install locally. Omniverse Replicator scripts handle swaps, clutter, lighting, and articulation state randomization without us shipping the source assets.
                </p>
                <ul className="grid gap-3 text-sm text-zinc-700 sm:grid-cols-2">
                  {["No asset redistribution: packs stay on your Nucleus/local disk", "Semantics + USDPhysics defaults aligned to SimReady best practices", "Variation generator tuned for RL-friendly randomization (500–2,000 variations/scene)", "Reusable integration snippets for Isaac Lab / Isaac Sim"].map(
                    (item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 rounded-xl bg-emerald-50/80 p-3 ring-1 ring-emerald-100"
                      >
                        <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                        <span>{item}</span>
                      </li>
                    ),
                  )}
                </ul>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href="/contact?request=recipe"
                    className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    Request a scene recipe
                  </a>
                  <a
                    href="/recipes"
                    className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
                  >
                    Browse sample recipes
                  </a>
                  <span className="text-xs uppercase tracking-[0.2em] text-emerald-600">
                    BYO SimReady packs
                  </span>
                </div>
              </div>

              <div className="grid gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6 sm:grid-cols-2">
                {recipeDeliverables.map((item) => (
                  <div
                    key={item.title}
                    className="flex h-full flex-col gap-2 rounded-xl border border-emerald-100 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-2 text-emerald-700">
                      {item.icon}
                      <span className="text-sm font-bold uppercase tracking-wider">{item.title}</span>
                    </div>
                    <p className="text-sm text-zinc-600 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
                <div className="col-span-full rounded-xl border border-emerald-100 bg-white p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700">Variation randomization + Episodes</p>
                  <p className="mt-2 text-sm text-zinc-700">
                    Replicator randomizes object swaps, clutter placement, HDRI/time-of-day, materials, and pose noise across hundreds of variations. AI-generated episodes (via Gemini) provide ready-to-train trajectories. We keep USD writes optional for RL loops.
                  </p>
                </div>
              </div>
            </div>
          </section>
          )}

          {/* --- Section: Reference Photo Reconstruction --- */}
          <section className="relative overflow-hidden rounded-[2.5rem] border border-indigo-100 bg-white p-8 shadow-sm sm:p-12 lg:p-16">
            <div className="absolute -left-10 -top-10 h-64 w-64 rounded-full bg-indigo-100/60 blur-3xl" />
            <div className="relative z-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-md bg-indigo-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
                  <Camera className="h-3 w-3" /> Reference Photo Reconstruction
                </div>
                <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
                  Exclusive, one-shot rebuilds.
                </h2>
                <p className="text-zinc-600 leading-relaxed">
                  Upload a single wide, well-lit image of a kitchen, aisle, lab,
                  or other supported archetype. We reconstruct that exact layout
                  into a SimReady scene with USD/URDF handoff and QA against your
                  mission profile.
                </p>

                <ul className="grid gap-3 text-sm text-zinc-700 sm:grid-cols-2">
                  {["Budget averages around $1k per environment", "Exclusive access by default (opt into open catalog if you want)", "Includes authored colliders, pivots, and materials", "Submit use cases so we validate against your policies"].map(
                    (item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 rounded-xl bg-indigo-50/80 p-3 ring-1 ring-indigo-100"
                      >
                        <span className="mt-1 h-2 w-2 rounded-full bg-indigo-500" />
                        <span>{item}</span>
                      </li>
                    ),
                  )}
                </ul>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <a
                    href="/contact"
                    className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                  >
                    Submit a reference photo
                  </a>
                  <span className="text-xs uppercase tracking-[0.2em] text-indigo-500">
                    Exclusive by default
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-6 shadow-inner">
                <div className="flex items-center gap-3 border-b border-indigo-100 pb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">
                      Release Checklist
                    </p>
                    <p className="text-sm text-zinc-700">
                      Built for labs that need a specific, exclusive layout.
                    </p>
                  </div>
                </div>

                <ul className="mt-4 space-y-3 text-sm text-zinc-700">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    Wide-shot photo intake (multiple allowed)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    USD/URDF handoff with authored colliders & pivots
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    Mission-profile QA against your provided use cases
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    Optional open-catalog toggle with pricing unchanged
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {SHOW_REAL_WORLD_CAPTURE && (
            /* --- Section 2: On-Site (Dark/Premium Theme) --- */
            <section
            id="pricing"
            className="relative overflow-hidden rounded-[2.5rem] bg-zinc-900 p-8 text-zinc-300 sm:p-12 lg:p-16 shadow-2xl"
          >
            {/* Dark Background Effects */}
            <div className="absolute top-0 left-0 h-full w-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
            <div className="absolute bottom-0 left-0 -mb-32 -ml-32 h-96 w-96 rounded-full bg-emerald-900/30 blur-3xl" />

            <div className="relative z-10 grid gap-16 lg:grid-cols-[1fr_1.2fr]">
              {/* Left Content */}
              <div className="space-y-8">
                <div className="inline-flex items-center gap-2 rounded-md bg-emerald-900/30 ring-1 ring-inset ring-emerald-500/30 px-2 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <Scan className="h-3 w-3" /> On-Site Capture
                </div>

                <div className="space-y-4">
                  <h2 className="text-3xl font-bold text-white sm:text-4xl">
                    Digital twins for critical validation.
                  </h2>
                  <p className="leading-relaxed text-zinc-400">
                    Turn a real site into a validated digital twin. We scan,
                    rebuild, and deliver SimReady scenes within days so your
                    robotics team can prove ROI in simulation before rolling out
                    hardware.
                  </p>
                </div>

                {/* Use Case Cards */}
                <div className="space-y-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                    Common Scenarios
                  </p>

                  <div className="grid gap-4">
                    <div className="flex items-start gap-4 rounded-xl bg-white/5 p-4 ring-1 ring-white/10 hover:bg-white/10 transition-colors">
                      <Beaker className="mt-1 h-5 w-5 text-emerald-400" />
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          Internal Testbeds
                        </h4>
                        <p className="mt-1 text-xs text-zinc-400">
                          Capture a lab-owned environment to iterate and
                          post-train policies before inviting stakeholders.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 rounded-xl bg-white/5 p-4 ring-1 ring-white/10 hover:bg-white/10 transition-colors">
                      <Factory className="mt-1 h-5 w-5 text-emerald-400" />
                      <div>
                        <h4 className="text-sm font-bold text-white">
                          Customer Facility
                        </h4>
                        <p className="mt-1 text-xs text-zinc-400">
                          Scan the exact warehouse or retail floor you’re
                          selling into to de-risk the rollout.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Content: Steps & Waitlist */}
              <div className="space-y-8">
                {/* Horizontal Process Steps (Dark) */}
                <div className="grid gap-4 sm:grid-cols-3">
                  {onsiteSteps.map((step, index) => (
                    <div
                      key={step.title}
                      className="relative rounded-2xl bg-white/5 p-5 ring-1 ring-white/10"
                    >
                      <div className="mb-3 text-emerald-400">{step.icon}</div>
                      <h3 className="text-sm font-bold text-white">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-xs text-zinc-400">
                        {step.description}
                      </p>

                      {/* Connector Arrow (Desktop only) */}
                      {index < 2 && (
                        <div className="absolute -right-3 top-8 hidden lg:block text-zinc-600">
                          <ArrowRight className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Waitlist Box */}
                <div className="rounded-3xl bg-white p-8 text-zinc-900 shadow-lg">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold">
                      Reserve your capture slot
                    </h3>
                    <p className="text-sm text-zinc-500">
                      Priority goes to facilities with active robotic
                      deployments. Join the waitlist to coordinate capture
                      windows and SLAs.
                    </p>
                  </div>
                  <WaitlistForm />
                </div>
              </div>
            </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
