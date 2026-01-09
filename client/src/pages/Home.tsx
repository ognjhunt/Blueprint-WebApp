// import { CTAButtons } from "@/components/site/CTAButtons";
// import { LogoWall } from "@/components/site/LogoWall";
// import { TileGrid } from "@/components/site/TileGrid";
// import { WaitlistForm } from "@/components/site/WaitlistForm";
// import { environmentCategories, syntheticDatasets } from "@/data/content"; //yeetasdasddasdsadsadsdanjnkjsdasdasd

// const whySimReady = [
//   {
//     title: "Contact-accurate geometry",
//     description:
//       "Watertight topology with sub-millimeter tolerances so perception and policy transfer hold up.",
//   },
//   {
//     title: "Correct pivots & joints",
//     description:
//       "Every articulated component ships with validated axes, limits, and authored USD skeletons.",
//   },
//   {
//     title: "Simulation-ready handoff",
//     description:
//       "Physics materials, collision proxies, and semantic schemas tuned for leading robotics simulators out of the box.",
//   },
// ];

// const labBullets = [
//   "Articulated containers (doors, drawers, racks)",
//   "Pick-place props with clean colliders",
//   "Simulation packages validated in our QA stack",
//   "Annotation-ready semantics on request",
// ];

// const artistBullets = [
//   "Join a network shipping scenes to leading labs",
//   "Focus on fidelity: we'll handle the pipeline",
//   "Paid per scene, bonuses for articulation coverage",
// ];

// const offeringCards = [
//   {
//     title: "Synthetic SimReady Scenes Marketplace",
//     description:
//       "Daily synthetic dataset drops with plug-and-play USD, randomizer scripts, and policy validation notes.",
//     bullets: [
//       "Filter by policy, object coverage, and facility archetype",
//       "Frames + scripting so labs can train without touching pipelines",
//       "Pricing starts around $50/scene depending on scale",
//     ],
//     ctaLabel: "Browse drops",
//     ctaHref: "/environments",
//   },
//   {
//     title: "Real-world SimReady capture",
//     description:
//       "We scan your exact facility, rebuild it in USD, and return a validated scene tuned to your deployment stack.",
//     bullets: [
//       "On-site capture crews for kitchens, warehouses, labs, and more",
//       "Plug-and-play handoff for Isaac 4.x/5.x, URDF, or custom formats",
//       "Site-specific randomizers + QA so you ship with confidence",
//     ],
//     ctaLabel: "Book a capture",
//     ctaHref: "/contact",
//   },
// ];

// export default function Home() {
//   const datasetPreview = syntheticDatasets.slice(0, 3);

//   return (
//     <div className="space-y-24 pb-24">
//       <section className="mx-auto grid max-w-6xl gap-16 px-4 pt-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
//         <div className="space-y-10">
//           <div className="space-y-6">
//             <div className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-500">
//               SimReady Environment Network
//             </div>
//             <h1 className="text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
//               SimReady worlds for robotic training.
//             </h1>
//             <p className="max-w-xl text-lg text-slate-600">
//               High-fidelity scenes, physics-clean assets, delivered fast. Pick
//               from our synthetic marketplace—new datasets publish daily with
//               frames, randomizers, and plug-and-play USD—or send us to your
//               actual site and we’ll return a SimReady digital twin tuned to your
//               deployment stack. Either path keeps labs out of DCC tools so they
//               can focus on training and proving ROI sooner.
//             </p>
//           </div>
//           <CTAButtons
//             primaryHref="/environments"
//             primaryLabel="Browse Synthetic Marketplace"
//             secondaryHref="/contact"
//             secondaryLabel="Book a Real-World Capture"
//           />
//           <LogoWall />
//         </div>
//         <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-10">
//           <div className="absolute -top-24 right-8 h-48 w-48 rounded-full bg-emerald-200/40 blur-3xl" />
//           <div className="relative space-y-6 text-sm text-slate-600">
//             <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               Network coverage
//             </p>
//             <p>
//               Kitchens, groceries, warehouse lanes, labs, offices, retail,
//               utility, and more. The synthetic marketplace blends scan-derived
//               references with procedural scale so you get the layouts, objects,
//               and articulation policies you actually deploy.
//             </p>
//             <p>
//               Need something site-specific? Add on our capture service and the
//               same team will rebuild your exact facility with plugs for Isaac
//               and your QA stack.
//             </p>
//           </div>
//         </div>
//       </section>

//       <section className="mx-auto max-w-6xl px-4 sm:px-6">
//         <div className="grid gap-6 md:grid-cols-2">
//           {offeringCards.map((offering) => (
//             <article
//               key={offering.title}
//               className="flex h-full flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6"
//             >
//               <div className="space-y-2">
//                 <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                   {offering.title.includes("Synthetic")
//                     ? "Marketplace"
//                     : "Capture"}
//                 </p>
//                 <h3 className="text-2xl font-semibold text-slate-900">
//                   {offering.title}
//                 </h3>
//                 <p className="text-sm text-slate-600">{offering.description}</p>
//               </div>
//               <ul className="space-y-3 text-sm text-slate-600">
//                 {offering.bullets.map((bullet) => (
//                   <li key={bullet} className="flex items-start gap-2">
//                     <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
//                     <span>{bullet}</span>
//                   </li>
//                 ))}
//               </ul>
//               <div className="pt-2">
//                 <a
//                   href={offering.ctaHref}
//                   className="inline-flex items-center text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
//                 >
//                   {offering.ctaLabel}
//                 </a>
//               </div>
//             </article>
//           ))}
//         </div>
//       </section>

//       <section className="mx-auto max-w-6xl px-4 sm:px-6">
//         <h2 className="text-3xl font-semibold text-slate-900">Why SimReady</h2>
//         <div className="mt-8 grid gap-6 md:grid-cols-3">
//           {whySimReady.map((item) => (
//             <div
//               key={item.title}
//               className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600"
//             >
//               <h3 className="text-lg font-semibold text-slate-900">
//                 {item.title}
//               </h3>
//               <p className="mt-3 leading-relaxed">{item.description}</p>
//             </div>
//           ))}
//         </div>
//       </section>

//       <section className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
//         <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
//           <div>
//             <h2 className="text-3xl font-semibold text-slate-900">
//               Synthetic marketplace highlights
//             </h2>
//             <p className="mt-2 max-w-2xl text-sm text-slate-600">
//               Here’s a peek at today’s drops. Filter every dataset by policy,
//               location type, objects, frames, and cadence in the full
//               marketplace.
//             </p>
//           </div>
//           <a
//             href="/marketplace"
//             className="text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
//           >
//             Explore marketplace
//           </a>
//         </div>
//         <div className="grid gap-6 md:grid-cols-3">
//           {datasetPreview.map((dataset) => (
//             <article
//               key={dataset.slug}
//               className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white"
//             >
//               <div className="relative h-48 w-full">
//                 <img
//                   src={dataset.heroImage}
//                   alt={dataset.title}
//                   className="h-full w-full object-cover"
//                   loading="lazy"
//                 />
//                 {dataset.isNew ? (
//                   <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-900">
//                     New drop
//                   </span>
//                 ) : null}
//               </div>
//               <div className="flex flex-1 flex-col gap-4 p-5">
//                 <div>
//                   <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                     {dataset.locationType}
//                   </p>
//                   <h3 className="text-lg font-semibold text-slate-900">
//                     {dataset.title}
//                   </h3>
//                   <p className="mt-2 text-sm text-slate-600">
//                     {dataset.description}
//                   </p>
//                 </div>
//                 <dl className="grid grid-cols-3 gap-3 text-center text-xs text-slate-500">
//                   <div>
//                     <dt className="uppercase tracking-[0.2em]">$/scene</dt>
//                     <dd className="text-base font-semibold text-slate-900">
//                       ${dataset.pricePerScene}
//                     </dd>
//                   </div>
//                   <div>
//                     <dt className="uppercase tracking-[0.2em]">Scenes</dt>
//                     <dd className="text-base font-semibold text-slate-900">
//                       {dataset.sceneCount}
//                     </dd>
//                   </div>
//                   <div>
//                     <dt className="uppercase tracking-[0.2em]">Frames</dt>
//                     <dd className="text-base font-semibold text-slate-900">
//                       {dataset.frameCount}
//                     </dd>
//                   </div>
//                 </dl>
//                 <div className="flex flex-wrap gap-2 text-xs text-slate-500">
//                   {dataset.tags.map((tag) => (
//                     <span
//                       key={tag}
//                       className="rounded-full border border-slate-200 px-3 py-1"
//                     >
//                       {tag}
//                     </span>
//                   ))}
//                 </div>
//                 <div className="mt-auto">
//                   <a
//                     href={`/environments?dataset=${dataset.slug}`}
//                     className="text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
//                   >
//                     See details
//                   </a>
//                 </div>
//               </div>
//             </article>
//           ))}
//         </div>
//       </section>

//       <section className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
//         <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
//           <div>
//             <h2 className="text-3xl font-semibold text-slate-900">
//               Environment families we cover daily
//             </h2>
//             <p className="mt-2 max-w-xl text-sm text-slate-600">
//               Use these archetypes to anchor your wishlist or capture brief. We
//               keep releasing frames that span aisle widths, heights, and
//               policy complexity so your models see the long tail.
//             </p>
//           </div>
//           <a
//             href="/marketplace"
//             className="text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
//           >
//             View full taxonomy
//           </a>
//         </div>
//         <TileGrid
//           items={environmentCategories.map((category) => ({
//             label: category.title,
//             href: `/environments?category=${category.slug}`,
//             description: category.summary,
//           }))}
//         />
//       </section>

//       <section className="mx-auto max-w-6xl space-y-12 px-4 sm:px-6">
//         <div className="grid gap-12 md:grid-cols-3">
//           <div className="space-y-4">
//             <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               How it works
//             </p>
//             <h2 className="text-3xl font-semibold text-slate-900">
//               From real-world location to SimReady scene in three moves.
//             </h2>
//           </div>
//           <div className="md:col-span-2 grid gap-6 md:grid-cols-3">
//             <div className="rounded-3xl border border-slate-200 bg-white p-6">
//               <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                 01 • Generate
//               </span>
//               <p className="mt-3 text-sm text-slate-600">
//                 Start from on-site captures or thoroughly documented real-world
//                 locations. We clean topology, UVs, and materials to create
//                 watertight, PBR-ready geometry.
//               </p>
//             </div>
//             <div className="rounded-3xl border border-slate-200 bg-white p-6">
//               <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                 02 • Prep
//               </span>
//               <p className="mt-3 text-sm text-slate-600">
//                 Artist finishing adds precise pivots, separated links, and
//                 optional joint rigs. Colliders are authored and tuned for
//                 contact-rich tasks.
//               </p>
//             </div>
//             <div className="rounded-3xl border border-slate-200 bg-white p-6">
//               <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                 03 • Sim authoring
//               </span>
//               <p className="mt-3 text-sm text-slate-600">
//                 Final packaging with physics materials, articulation limits, and
//                 simulation validation. Annotation exports available on request.
//               </p>
//             </div>
//           </div>
//         </div>

//         <div className="grid gap-12 md:grid-cols-2">
//           <div className="space-y-4">
//             <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               For robotics labs
//             </p>
//             <h3 className="text-2xl font-semibold text-slate-900">
//               Open. Slide. Pick. Place. Repeat.
//             </h3>
//             <ul className="mt-4 space-y-3 text-sm text-slate-600">
//               {labBullets.map((item) => (
//                 <li key={item} className="flex items-start gap-2">
//                   <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
//                   <span>{item}</span>
//                 </li>
//               ))}
//             </ul>
//           </div>
//           <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6">
//             <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//               For 3D artists
//             </p>
//             <h3 className="text-2xl font-semibold text-slate-900">
//               Join the network building the worlds robots learn in.
//             </h3>
//             <ul className="mt-4 space-y-3 text-sm text-slate-600">
//               {artistBullets.map((item) => (
//                 <li key={item} className="flex items-start gap-2">
//                   <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
//                   <span>{item}</span>
//                 </li>
//               ))}
//             </ul>
//             <a
//               href="/careers"
//               className="inline-flex items-center text-sm font-semibold text-slate-900 underline-offset-4 hover:underline"
//             >
//               Apply
//             </a>
//           </div>
//         </div>
//       </section>

//       <section className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6">
//         <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 md:p-12">
//           <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
//             <div>
//               <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//                 Real-world capture waitlist
//               </p>
//               <h3 className="mt-2 text-2xl font-semibold text-slate-900">
//                 Turn any facility into a SimReady digital twin.
//               </h3>
//               <p className="mt-3 max-w-xl text-sm text-slate-600">
//                 Share the address you care about and we’ll coordinate a capture
//                 window. Expect delivery in days (not months) with USD, URDF, and
//                 QA reports ready for your simulator.
//               </p>
//             </div>
//             <WaitlistForm />
//           </div>
//         </div>
//       </section>
//     </div>
//   );
// }
import { CTAButtons } from "@/components/site/CTAButtons";
import { LogoWall } from "@/components/site/LogoWall";
import { TileGrid } from "@/components/site/TileGrid";
import { PremiumAnalyticsSection } from "@/components/site/PremiumAnalyticsSection";
import ComingSoon from "@/components/sections/ComingSoon";
import { SEO } from "@/components/SEO";
import { environmentCategories, syntheticDatasets } from "@/data/content";
import {
  ArrowRight,
  BarChart3,
  Box,
  CheckCircle2,
  Cpu,
  Database,
  Fingerprint,
  Layers,
  LayoutGrid,
  Scan,
  Settings2,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";

// --- Data & Config ---

const whySimReady = [
  {
    icon: <Box className="h-6 w-6 text-indigo-600" />,
    title: "Precision geometry for sim-to-real",
    description:
      "Physics-accurate topology with sub-millimeter tolerances engineered for reliable sim2real transfer and policy generalization.",
  },
  {
    icon: <Settings2 className="h-6 w-6 text-indigo-600" />,
    title: "Articulation with physics metadata",
    description:
      "Every joint ships with validated axes, limits, friction constraints, mass, and inertia properties ready for manipulation tasks.",
  },
  {
    icon: <Cpu className="h-6 w-6 text-indigo-600" />,
    title: "Domain randomization ready",
    description:
      "Deterministic domain randomization, PBR materials, and semantic schemas tuned for Isaac Sim, MuJoCo, and leading simulators.",
  },
];

const labBullets = [
  "Articulated containers with joint friction & constraints",
  "Physics-accurate props with validated colliders",
  "Sim2real-validated packages for policy transfer",
  "Semantic annotations for perception training",
];

const artistBullets = [
  "Join a network shipping scenes to leading labs",
  "Focus on fidelity: we'll handle the pipeline",
  "Project-based pay with bonuses for articulation coverage",
];

const SHOW_REAL_WORLD_CAPTURE = false;

const offeringCards = [
  {
    title: "Benchmark Packs",
    badge: "Evaluation",
    description:
      "Runnable benchmark suites with SimReady scenes, tasks, and an eval harness. Plug in your policy and get a standardized report.",
    bullets: [
      "Scenes + tasks + evaluation harness in one package",
      "Fixed seeds, deterministic resets, and reproducible protocols",
      "JSON reports: success rate, time-to-success, collisions, path efficiency",
      "Isaac Lab-Arena format with GPU-parallel evaluation",
    ],
    ctaLabel: "Browse benchmarks",
    ctaHref: "/environments?type=datasets",
    icon: <BarChart3 className="h-8 w-8 text-zinc-900" />,
  },
  {
    title: "Scene Library",
    badge: "Assets",
    description:
      "Individual SimReady USD scenes for training, evaluation, or custom benchmark assembly. Physics-accurate with full metadata.",
    bullets: [
      "Physics-stable geometry with sub-mm tolerances",
      "Full articulation: joints, friction, mass, inertia properties",
      "Domain randomization scripts included",
      "Compatible with Isaac Sim, MuJoCo, and leading simulators",
    ],
    ctaLabel: "Browse scenes",
    ctaHref: "/environments?type=scenes",
    icon: <LayoutGrid className="h-8 w-8 text-zinc-900" />,
  },
  {
    title: "Dataset Packs",
    badge: "Training Data",
    description:
      "Pre-generated episode trajectories for offline training. Observations, actions, states, and labels in LeRobot format.",
    bullets: [
      "Thousands of expert trajectories per scene/task",
      "Multi-sensor: RGB-D, proprioception, end-effector poses",
      "Train/val/test splits with example data loaders",
      "Ideal for imitation learning and offline RL",
    ],
    ctaLabel: "Browse datasets",
    ctaHref: "/environments?type=training",
    icon: <Database className="h-8 w-8 text-zinc-900" />,
  },
  {
    title: "Real-world Capture",
    badge: "Service",
    description:
      "We scan your exact facility and return a physics-accurate digital twin with sim2real-validated geometry.",
    bullets: [
      "On-site capture crews for industrial automation & field robotics sites",
      "Plug-and-play handoff for Isaac 4.x/5.x, URDF, or custom formats",
      "Site-specific domain randomization + QA for reliable policy transfer",
    ],
    ctaLabel: "Request a SimReady scene",
    ctaHref: "/contact",
    icon: <Scan className="h-8 w-8 text-zinc-900" />,
  },
  {
    title: "Scene Recipes",
    badge: "Layouts + Frames",
    description:
      "Lightweight USD layers with physics metadata, PBR materials, and Replicator scripts for domain randomization.",
    bullets: [
      "Precision geometry with mass, inertia & friction properties",
      "Manifest for SimReady packs + asset fallbacks you install locally",
      "Task logic scaffolds tuned for vectorized RL and sim2real transfer",
      "Variation generator for swaps, clutter, lighting, and articulation states (500–2,000 variations/scene)",
    ],
    ctaLabel: "Request a recipe",
    ctaHref: "/recipes",
    icon: <Terminal className="h-8 w-8 text-zinc-900" />,
  },
];

// Hidden offerings (will be added back later when ready)
const SHOW_SCENE_RECIPES = false;
const SHOW_DATASET_PACKS = true; // Dataset Packs shown - part of main offering

const visibleOfferingCards = offeringCards.filter((card) => {
  if (!SHOW_REAL_WORLD_CAPTURE && card.title === "Real-world Capture") return false;
  if (!SHOW_SCENE_RECIPES && card.title === "Scene Recipes") return false;
  if (!SHOW_DATASET_PACKS && card.title === "Dataset Packs") return false;
  return true;
});

// --- Helper Components ---

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

const heroDescriptionWithCapture =
  "Physics-accurate environments with domain randomization, precision geometry, and sim2real-validated assets. Pick from our synthetic marketplace or send us to your actual site for a digital twin tuned to your deployment stack.";

const heroDescriptionWithoutCapture =
  "Physics-accurate environments with domain randomization, precision geometry, and sim2real-validated assets. Pick from our synthetic marketplace or upload a reference photo for an exclusive reconstruction.";

const facilitySupportCopy = SHOW_REAL_WORLD_CAPTURE
  ? "Need exact facility matching? Add on our capture service or upload one reference photo for an exclusive reconstruction. We rebuild your facility with plugs for Isaac and your QA stack."
  : "Need exact facility matching? Upload one reference photo for an exclusive reconstruction. We’ll return a SimReady scene with plugs for Isaac and your QA stack.";

export default function Home() {
  const datasetPreview = syntheticDatasets.slice(0, 3);

  return (
    <>
      <SEO
        title="Blueprint | SimReady Scenes for Robotic Training"
        description="Physics-accurate environments with domain randomization, precision geometry, and sim2real-validated assets. SimReady USD packages for Isaac Sim, MuJoCo, and leading robotics simulators."
        canonical="/"
        image="https://tryblueprint.io/images/og-home.png"
      />
      <div className="relative min-h-screen overflow-hidden bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

      {/* --- Hero Section --- */}
      <div className="relative pb-24 pt-16 sm:pt-24 lg:pb-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            {/* Hero Content */}
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600 backdrop-blur-sm">
                  <Sparkles className="h-3 w-3" />
                  SimReady Environment Network
                </div>
                <h1 className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl lg:text-7xl">
                  SimReady worlds for robotic training.
                </h1>
                <p className="max-w-xl text-lg leading-relaxed text-zinc-600">
                  {SHOW_REAL_WORLD_CAPTURE
                    ? heroDescriptionWithCapture
                    : heroDescriptionWithoutCapture}
                </p>
              </div>

              <CTAButtons
                primaryHref="/environments"
                primaryLabel="Browse Marketplace"
                secondaryHref="/contact"
                secondaryLabel="Submit a request"
              />

              <div className="pt-4 opacity-80 grayscale transition-all duration-500 hover:opacity-100 hover:grayscale-0">
                <LogoWall />
              </div>
            </div>

            {/* Hero Visual / Feature Card */}
            <div className="relative">
              {/* Gradient Glow */}
              <div className="absolute -inset-4 rounded-full bg-indigo-500/20 blur-3xl filter" />

              <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/80 p-8 shadow-xl backdrop-blur-md sm:p-10">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <LayoutGrid className="h-32 w-32" />
                </div>

                <div className="space-y-6">
                  <div className="overflow-hidden rounded-xl border border-zinc-100 bg-zinc-50">
                    <img
                      src="/images/Gemini_Hero.png"
                      alt="SimReady scene anatomy hero"
                      className="h-56 w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                      <Terminal className="h-4 w-4" />
                      Network Coverage
                    </p>
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_2px_rgba(16,185,129,0.4)]" />
                  </div>

                  <div className="space-y-4 text-sm leading-relaxed text-zinc-600">
                    <p>
                      <strong className="text-zinc-900">
                        Supported Archetypes:
                      </strong>{" "}
                      Kitchens, groceries, warehouse lanes, labs, offices,
                      retail, utility.
                    </p>
                    <p>
                      The synthetic marketplace blends scan-derived references
                      with procedural scale so you get the layouts, objects, and
                      articulation policies you actually deploy.
                    </p>
                    <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 text-xs text-zinc-500">
                      <span className="mb-1 block font-mono text-indigo-600">
                        $ system_check --site-specific
                      </span>
                      {facilitySupportCopy}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --- Offering Cards --- */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-2">
          {visibleOfferingCards.map((offering) => (
            <article
              key={offering.title}
              className="group relative flex h-full flex-col gap-6 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-indigo-200"
            >
              <div className="flex items-start justify-between">
                <div className="rounded-xl bg-zinc-100 p-3 text-zinc-900 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  {offering.icon}
                </div>
                <span className="rounded-full border border-zinc-200 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                  {offering.badge}
                </span>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-zinc-900">
                  {offering.title}
                </h3>
                <p className="text-sm leading-relaxed text-zinc-600">
                  {offering.description}
                </p>
              </div>

              <ul className="space-y-3 text-sm text-zinc-600">
                {offering.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 min-w-[1rem] text-emerald-500" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-4">
                <a
                  href={offering.ctaHref}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-zinc-900 decoration-indigo-300 decoration-2 underline-offset-4 hover:text-indigo-600 hover:underline"
                >
                  {offering.ctaLabel}
                  <span aria-hidden="true">→</span>
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* --- Why SimReady --- */}
      <section className="relative border-y border-zinc-100 bg-zinc-50/50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 md:max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
              Why SimReady?
            </h2>
            <p className="mt-4 text-lg text-zinc-600">
              We solve the sim-to-real gap by engineering physics-accurate assets
              for robotic perception and manipulation, not just visual fidelity.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {whySimReady.map((item) => (
              <div
                key={item.title}
                className="relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-200"
              >
                <div className="mb-4 inline-flex rounded-lg bg-indigo-50 p-2.5">
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold text-zinc-900">
                  {item.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Marketplace Highlights --- */}
      <section className="mx-auto max-w-7xl space-y-10 px-4 py-24 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
              Marketplace drops
            </h2>
            <p className="mt-2 max-w-2xl text-zinc-600">
              Latest datasets tuned for manipulation and navigation.
            </p>
          </div>
          <a
            href="/marketplace"
            className="group flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Explore full marketplace
            <span className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </a>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {datasetPreview.map((dataset) => (
            <article
              key={dataset.slug}
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-shadow hover:shadow-lg"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
                <img
                  src={dataset.heroImage}
                  alt={dataset.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                {dataset.isNew && (
                  <span className="absolute left-4 top-4 rounded-full bg-zinc-900/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                    New drop
                  </span>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-zinc-900/60 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="text-xs font-medium text-white">
                    View details →
                  </p>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-5 p-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                    {dataset.locationType}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-zinc-900">
                    {dataset.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-600">
                    {dataset.description}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                  <div className="text-center">
                    <dt className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Bundle
                    </dt>
                    <dd className="font-mono text-sm font-semibold text-zinc-900">
                      ${dataset.bundlePrice?.toLocaleString()}
                    </dd>
                  </div>
                  <div className="text-center border-l border-zinc-200">
                    <dt className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Variations
                    </dt>
                    <dd className="font-mono text-sm font-semibold text-zinc-900">
                      {dataset.variationCount?.toLocaleString()}
                    </dd>
                  </div>
                  <div className="text-center border-l border-zinc-200">
                    <dt className="text-[10px] uppercase tracking-wider text-zinc-400">
                      Episodes
                    </dt>
                    <dd className="font-mono text-sm font-semibold text-zinc-900">
                      {dataset.episodeCount?.toLocaleString()}
                    </dd>
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap gap-2">
                  {dataset.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[10px] font-medium text-zinc-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* --- Taxonomy --- */}
      <section className="mx-auto max-w-7xl space-y-8 px-4 pb-24 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
              Environment families
            </h2>
            <p className="mt-2 max-w-xl text-zinc-600">
              Archetypes to anchor your wishlist. We keep releasing variations
              that span aisle widths, heights, and policy complexity.
            </p>
          </div>
        </div>

        {/* Enhanced TileGrid Wrapper */}
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50/50 p-2">
          <TileGrid
            items={environmentCategories.map((category) => ({
              label: category.title,
              href: `/environments?category=${category.slug}`,
              description: category.summary,
            }))}
          />
        </div>
      </section>

      {/* --- How It Works & Personas --- */}
      <section className="mx-auto max-w-7xl space-y-20 px-4 pb-24 sm:px-6 lg:px-8">
        {/* Process Steps */}
        <div className="grid gap-12 lg:grid-cols-3">
          <div className="space-y-4">
            <span className="inline-block h-1 w-12 rounded-full bg-indigo-600" />
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
              From real-world to SimReady in three moves.
            </h2>
            <p className="text-zinc-600">
              Our pipeline creates digital twins that aren't just visual
              copies. They are functional simulation environments.
            </p>
          </div>

          <div className="col-span-2 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Generate",
                desc: "Precision geometry with clean UVs, PBR materials, and watertight topology for physics accuracy.",
                icon: <Layers className="h-5 w-5" />,
              },
              {
                step: "02",
                title: "Prep",
                desc: "Artist finishing adds joint friction, mass, inertia properties, and constraint definitions.",
                icon: <Settings2 className="h-5 w-5" />,
              },
              {
                step: "03",
                title: "Sim Author",
                desc: "Domain randomization configs, physics validation, and sim2real QA for Isaac/MuJoCo.",
                icon: <Cpu className="h-5 w-5" />,
              },
            ].map((item, i) => (
              <div
                key={i}
                className="relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-indigo-600">
                    {item.step}
                  </span>
                  <div className="text-zinc-400">{item.icon}</div>
                </div>
                <h3 className="font-bold text-zinc-900">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Personas */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Lab Persona */}
          <div className="rounded-3xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-8 lg:p-10">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                  For Robotics Labs
                </p>
                <h3 className="mt-2 text-2xl font-bold text-zinc-900">
                  Open. Slide. Pick. Repeat.
                </h3>
              </div>
              <ul className="space-y-4">
                {labBullets.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-sm text-zinc-700"
                  >
                    <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Artist Persona */}
          <div className="rounded-3xl border border-zinc-200 bg-zinc-900 p-8 text-white lg:p-10">
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  For 3D Artists
                </p>
                <h3 className="mt-2 text-2xl font-bold text-white">
                  Build the worlds robots learn in.
                </h3>
              </div>
              <ul className="space-y-4">
                {artistBullets.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-sm text-zinc-300"
                  >
                    <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-emerald-400">
                      <Sparkles className="h-3.5 w-3.5" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <div className="pt-4">
                <a
                  href="/careers"
                  className="inline-block rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-200"
                >
                  Apply to network
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Premium Capabilities & Bundle Tiers --- */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1 text-xs font-bold uppercase tracking-wider text-indigo-600">
            <Sparkles className="h-3 w-3" />
            Premium Capabilities
          </div>
          <h2 className="mt-6 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            From scenes to benchmarked policies
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-zinc-600">
            Powered by Genie Sim 3.0 for automated data generation and evaluation. Every bundle includes
            LLM-generated tasks, GPU-accelerated trajectories, and VLM-evaluated episodes
            in LeRobot format. Upgrade for VLA fine-tuning and sim2real validation.
          </p>
        </div>

        {/* Key Capability Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-16">
          {/* VLA Training */}
          <div className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-indigo-200">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100 transition-colors">
              <Cpu className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-zinc-900">VLA Fine-Tuning</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Turnkey configs for OpenVLA, Pi0, SmolVLA, and GR00T. Save 2-4 weeks per model.
            </p>
            <p className="mt-3 text-sm font-semibold text-indigo-600">+$3k–$8k/scene</p>
          </div>

          {/* Language Annotations */}
          <div className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-indigo-200">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
              <Terminal className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-zinc-900">Language Annotations</h3>
            <p className="mt-2 text-sm text-zinc-600">
              10+ natural language variations per task. Required for VLA model training.
            </p>
            <p className="mt-3 text-sm font-semibold text-emerald-600">+$1.5k/scene</p>
          </div>

          {/* Sim2Real Validation */}
          <div className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-indigo-200">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-100 transition-colors">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-zinc-900">Sim2Real Validation</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Automated transfer gap analysis with 85%+ real-world success guarantees.
            </p>
            <p className="mt-3 text-sm font-semibold text-amber-600">$5k–$25k/study</p>
          </div>

          {/* Contact-Rich Tasks */}
          <div className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:border-indigo-200">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 group-hover:bg-rose-100 transition-colors">
              <Layers className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-zinc-900">Precision Assembly</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Peg-in-hole, snap-fit, and insertion tasks with sub-mm tolerance physics.
            </p>
            <p className="mt-3 text-sm font-semibold text-rose-600">3x base price</p>
          </div>
        </div>

        {/* Bundle Tiers CTA */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-8 sm:p-12">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />

          <div className="relative z-10 grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h3 className="text-2xl font-bold text-white sm:text-3xl">
                Choose your benchmark bundle
              </h3>
              <p className="mt-4 text-indigo-100">
                From single-scene benchmarks to foundation model evaluation at scale. Every bundle includes
                physics-accurate USD, evaluation harness, and Genie Sim 3.0-generated episodes
                with automated task generation and standardized metrics.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <a
                  href="/pricing"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-indigo-600 shadow-lg transition-colors hover:bg-indigo-50"
                >
                  View All Bundles
                  <Box className="ml-2 h-4 w-4" />
                </a>
                <a
                  href="/contact?tier=enterprise"
                  className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                >
                  Talk to Sales
                </a>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-3xl font-bold text-white">$5,499</p>
                <p className="mt-1 font-semibold text-indigo-200">Standard</p>
                <p className="mt-2 text-sm text-indigo-100">2,500 episodes + USD scene</p>
              </div>
              <div className="rounded-xl bg-white/20 p-5 backdrop-blur-sm ring-2 ring-white/30">
                <p className="text-3xl font-bold text-white">$12,499</p>
                <p className="mt-1 font-semibold text-indigo-200">Pro</p>
                <p className="mt-2 text-sm text-indigo-100">5,000 episodes + VLA configs</p>
              </div>
              <div className="rounded-xl bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-3xl font-bold text-white">$25,000</p>
                <p className="mt-1 font-semibold text-indigo-200">Enterprise</p>
                <p className="mt-2 text-sm text-indigo-100">10,000 episodes + sim2real</p>
              </div>
              <div className="rounded-xl bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-3xl font-bold text-white">$500K+</p>
                <p className="mt-1 font-semibold text-indigo-200">Foundation</p>
                <p className="mt-2 text-sm text-indigo-100">Unlimited + streaming API</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Arena Integration Announcement --- */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 shadow-2xl sm:p-12 lg:p-16">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />

          {/* NEW Badge */}
          <div className="absolute top-6 right-6 sm:top-8 sm:right-8">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-sm ring-1 ring-white/30">
              <Zap className="h-3 w-3" />
              New
            </span>
          </div>

          <div className="relative z-10 grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-md bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                <BarChart3 className="h-3 w-3" />
                Isaac Lab-Arena Integration
              </div>
              <h2 className="text-3xl font-bold text-white sm:text-4xl">
                Policy evaluation at scale.
              </h2>
              <p className="text-emerald-100 leading-relaxed">
                Blueprint scenes now export directly to NVIDIA Isaac Lab-Arena format. Standardized
                affordances, GPU-parallel evaluation, and automatic LeRobot Hub registration for
                community benchmarks.
              </p>
              <ul className="space-y-3 text-sm text-emerald-100">
                {[
                  "17 affordance types (Openable, Graspable, Turnable, etc.)",
                  "GPU-parallel evaluation at 1000x scale",
                  "Auto-registration with LeRobot Hub",
                  "250+ task templates included",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-4 pt-2">
                <a
                  href="/evals"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-emerald-700 shadow-lg transition hover:bg-emerald-50"
                >
                  Learn About Benchmarks
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="/marketplace"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                >
                  Browse Benchmark Packs
                </a>
              </div>
            </div>

            {/* Arena Visual */}
            <div className="rounded-2xl bg-white/10 p-6 backdrop-blur-sm ring-1 ring-white/20">
              <div className="space-y-4">
                {/* Mini Pipeline */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Scene", icon: <Layers className="h-4 w-4" /> },
                    { label: "Affordances", icon: <Fingerprint className="h-4 w-4" /> },
                    { label: "Tasks", icon: <Terminal className="h-4 w-4" /> },
                    { label: "Eval", icon: <BarChart3 className="h-4 w-4" /> },
                  ].map((step, i) => (
                    <div key={step.label} className="relative text-center">
                      <div className="rounded-lg bg-white/20 p-3 backdrop-blur-sm">
                        <div className="flex justify-center text-white mb-1">{step.icon}</div>
                        <p className="text-xs font-medium text-white/90">{step.label}</p>
                      </div>
                      {i < 3 && (
                        <ArrowRight className="absolute -right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 rounded-xl bg-white/10 p-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">17</p>
                    <p className="text-xs text-emerald-200">Affordances</p>
                  </div>
                  <div className="text-center border-x border-white/20">
                    <p className="text-2xl font-bold text-white">1000x</p>
                    <p className="text-xs text-emerald-200">Parallel</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">250+</p>
                    <p className="text-xs text-emerald-200">Tasks</p>
                  </div>
                </div>

                {/* Affordance Tags Preview */}
                <div className="flex flex-wrap gap-2">
                  {["Openable", "Graspable", "Turnable", "Pressable", "Insertable"].map((aff) => (
                    <span
                      key={aff}
                      className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white"
                    >
                      {aff}
                    </span>
                  ))}
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
                    +12 more
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Premium Analytics Section --- */}
      <PremiumAnalyticsSection />

      {/* --- Coming Soon / Future Offerings --- */}
      <ComingSoon />
    </div>
    </>
  );
}
