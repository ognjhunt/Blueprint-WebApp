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
  Box,
  Layers,
  CheckCircle2,
  Scan,
  Hammer,
  LineChart,
  ArrowRight,
  FileCode,
  Video,
  FileJson,
  Sparkles,
  Factory,
  Beaker,
  Camera,
  Terminal,
} from "lucide-react";

// --- Configuration ---

const SHOW_REAL_WORLD_CAPTURE = false;

const proceduralSteps = [
  {
    title: "Author",
    description:
      "Procedural seed meshes and kitbashed assets routed through Blueprint finishing for watertight, UV’d geometry.",
    icon: <Layers className="h-6 w-6 text-indigo-600" />,
  },
  {
    title: "Articulate",
    description:
      "We add pivots, joints, and clean colliders so your team can focus on policy authoring instead of asset repair.",
    icon: <Hammer className="h-6 w-6 text-indigo-600" />,
  },
  {
    title: "Validate",
    description:
      "Every release includes simulation QA runs, semantic labels on request, and annotation-ready metadata.",
    icon: <CheckCircle2 className="h-6 w-6 text-indigo-600" />,
  },
];

const onsiteSteps = [
  {
    title: "Scan",
    description:
      "Lidar + photogrammetry capture of your in-house testbed or customer site—aligned for robotics-safe coverage.",
    icon: <Scan className="h-6 w-6 text-emerald-400" />,
  },
  {
    title: "Rebuild",
    description:
      "Engineers convert captures into SimReady scenes with joints, colliders, and the exact layout you will deploy into.",
    icon: <Box className="h-6 w-6 text-emerald-400" />,
  },
  {
    title: "Prove",
    description:
      "Run policies in your simulator to forecast KPIs, adapt behaviors, and prove ROI before hardware deployment.",
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
    title: "Variant generator",
    desc: "Omniverse Replicator scripts for swaps, clutter, lighting, material variants, and articulation state noise.",
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
                Whether you need procedural synthetic data grounded in
                real-world analogs, an exclusive one-photo reconstruction of a
                known archetype, or a digital twin of a facility you operate,
                we deliver environments engineered for physics, not just
                rendering.
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
          <section className="relative overflow-hidden rounded-[2.5rem] border border-emerald-100 bg-white p-8 shadow-sm sm:p-12 lg:p-16">
            <div className="absolute -right-16 -bottom-16 h-64 w-64 rounded-full bg-emerald-100/60 blur-3xl" />
            <div className="relative z-10 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold uppercase tracking-wider text-emerald-700">
                  <Terminal className="h-3 w-3" /> Scene Recipes
                </div>
                <h2 className="text-3xl font-bold text-zinc-900 sm:text-4xl">
                  Layouts, manifests, and variants—BYO SimReady assets.
                </h2>
                <p className="text-zinc-600 leading-relaxed">
                  We deliver a lightweight USD layer plus a manifest that references NVIDIA SimReady packs you install locally. Omniverse Replicator scripts handle swaps, clutter, lighting, and articulation state randomization without us shipping the source assets.
                </p>
                <ul className="grid gap-3 text-sm text-zinc-700 sm:grid-cols-2">
                  {["No asset redistribution—packs stay on your Nucleus/local disk", "Semantics + USDPhysics defaults aligned to SimReady best practices", "Variant generator tuned for RL-friendly randomization", "Reusable integration snippets for Isaac Lab / Isaac Sim"].map(
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
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700">Variant knobs</p>
                  <p className="mt-2 text-sm text-zinc-700">
                    Replicator randomizes object swaps, clutter placement, HDRI/time-of-day, material variants, and pose noise. We keep USD writes optional for RL loops.
                  </p>
                </div>
              </div>
            </div>
          </section>

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
                  {["Budget averages around $1k per environment", "Exclusive access by default—opt into open catalog if you want", "Includes authored colliders, pivots, and materials", "Submit use cases so we validate against your policies"].map(
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
