// export default function Docs() {
//   return (
//     <div className="mx-auto max-w-5xl space-y-16 px-4 pb-24 pt-16 sm:px-6">
//       <header className="space-y-4">
//         <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
//           Documentation
//         </p>
//         <h1 className="text-4xl font-semibold text-slate-900">
//           Blueprint SimReady specification.
//         </h1>
//         <p className="max-w-3xl text-sm text-slate-600">
//           Every scene we ship follows the SimReady spec: metric accuracy, clean articulation, physics-ready materials, and semantic coverage. Use this guide to integrate Blueprint scenes into your simulator or extend them with your own tooling.
//         </p>
//       </header>

//       <section className="space-y-6">
//         <h2 className="text-2xl font-semibold text-slate-900">Units & coordinate system</h2>
//         <div className="space-y-3 text-sm text-slate-600">
//           <p>• Linear units: meters. Angular units: degrees. Scene origin at floor center unless otherwise annotated.</p>
//           <p>• Forward axis: +X, up axis: +Z, matching common robotics sim defaults.</p>
//           <p>• Scale variations for dataset diversity are provided as USD variants.</p>
//         </div>
//       </section>

//       <section className="space-y-6">
//         <h2 className="text-2xl font-semibold text-slate-900">Pivots, joints & articulation</h2>
//         <div className="space-y-3 text-sm text-slate-600">
//           <p>• All articulated assets ship with authored joints, axis definitions, and limits validated in simulation.</p>
//           <p>• Revolute joints use degrees; prismatic joints use meters. Pivots align with physical hinges or slides.</p>
//           <p>• Optional articulation presets: soft-close damping, friction overrides, and event callbacks for buttons/knobs.</p>
//         </div>
//       </section>

//       <section className="space-y-6">
//         <h2 className="text-2xl font-semibold text-slate-900">Colliders & physics</h2>
//         <div className="space-y-3 text-sm text-slate-600">
//           <p>• Default collider strategy mixes convex decomposition and SDF volumes. Each scene ships with collider preview renders.</p>
//           <p>• Physics materials use calibrated coefficients for stainless, polymer, wood, and fabric surfaces.</p>
//           <p>• AMR clearance envelopes, safety zones, and interaction volumes are packaged as USD prims.</p>
//         </div>
//       </section>

//       <section className="space-y-6">
//         <h2 className="text-2xl font-semibold text-slate-900">Semantics & annotations</h2>
//         <div className="space-y-3 text-sm text-slate-600">
//           <p>• Semantic labels follow Blueprint’s ontology and map cleanly to class, instance, and SKU exports.</p>
//           <p>• Scenes include optional CSV/JSON metadata for planograms, signage, and device IDs.</p>
//           <p>• Ask for annotation bundles to receive camera rigs, lighting variants, and sensor trajectories.</p>
//         </div>
//       </section>

//       <section className="space-y-6">
//         <h2 className="text-2xl font-semibold text-slate-900">Importing into your simulator</h2>
//         <div className="space-y-3 text-sm text-slate-600">
//           <p>1. Add the scene package to your preferred project workspace or file mount.</p>
//           <p>2. Load the stage, enable physics inspection, and confirm articulation limits.</p>
//           <p>3. Attach your policies or task graphs; Blueprint colliders and semantics are ready for pick-place, inspection, or manipulation workflows.</p>
//         </div>
//       </section>

//       <section className="space-y-6">
//         <h2 className="text-2xl font-semibold text-slate-900">What we deliver vs what you finish</h2>
//         <div className="overflow-hidden rounded-3xl border border-slate-200">
//           <table className="w-full table-auto text-left text-sm text-slate-600">
//             <thead className="bg-slate-50 text-xs uppercase tracking-[0.3em] text-slate-400">
//               <tr>
//                 <th className="px-4 py-3 font-medium text-slate-500">Blueprint</th>
//                 <th className="px-4 py-3 font-medium text-slate-500">You</th>
//               </tr>
//             </thead>
//             <tbody>
//               <tr className="border-t border-slate-100">
//                 <td className="px-4 py-3">Watertight geometry, clean UVs, and PBR textures</td>
//                 <td className="px-4 py-3">Optional lookdev tweaks, branding, decals</td>
//               </tr>
//               <tr className="border-t border-slate-100">
//                 <td className="px-4 py-3">Joints, limits, physics materials, collider tuning</td>
//                 <td className="px-4 py-3">Custom task graphs, policy training</td>
//               </tr>
//               <tr className="border-t border-slate-100">
//                 <td className="px-4 py-3">Semantic labels, annotation schemas, metadata exports</td>
//                 <td className="px-4 py-3">Integration with internal analytics, additional sensors</td>
//               </tr>
//             </tbody>
//           </table>
//         </div>
//       </section>
//     </div>
//   );
// }
import {
  Axis3d,
  Box,
  FileJson,
  Layers,
  Settings2,
  Terminal,
  Check,
  BookOpen,
} from "lucide-react";

// --- Visual Helper ---
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

function SpecCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:shadow-md hover:border-indigo-200">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-50 text-indigo-600 group-hover:bg-indigo-50 group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <h3 className="font-bold text-zinc-900">{title}</h3>
      </div>
      <div className="space-y-3 text-sm text-zinc-600">{children}</div>
    </div>
  );
}

export default function Docs() {
  return (
    <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
      <DotPattern />

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[240px_1fr]">
          {/* --- Sidebar Navigation (Desktop) --- */}
          <aside className="hidden lg:block">
            <div className="sticky top-8 space-y-8">
              <div className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                <BookOpen className="h-4 w-4" />
                Documentation
              </div>
              <nav className="space-y-1 border-l border-zinc-200 pl-4">
                {[
                  "Overview",
                  "Coordinates",
                  "Articulation",
                  "Physics",
                  "Semantics",
                  "Import Guide",
                ].map((item, i) => (
                  <a
                    key={item}
                    href={`#${item.toLowerCase()}`}
                    className={`block border-l-2 py-2 pl-4 text-sm transition-colors -ml-[17px] ${i === 0 ? "border-indigo-600 font-medium text-indigo-600" : "border-transparent text-zinc-500 hover:text-zinc-900"}`}
                  >
                    {item}
                  </a>
                ))}
              </nav>

              <div className="rounded-xl bg-indigo-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                  Need help?
                </p>
                <p className="mt-1 text-xs text-indigo-700">
                  Join our Discord for real-time integration support.
                </p>
              </div>
            </div>
          </aside>

          {/* --- Main Content --- */}
          <main className="space-y-16">
            {/* Header */}
            <header className="space-y-6 border-b border-zinc-100 pb-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-zinc-500">
                Version 2.1
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
                The SimReady Standard.
              </h1>
              <p className="max-w-3xl text-lg leading-relaxed text-zinc-600">
                Every scene we ship follows strict engineering specs: metric
                accuracy, clean articulation, physics-ready materials, and
                semantic coverage. Use this guide to integrate Blueprint scenes
                into your simulator.
              </p>
            </header>

            {/* Tech Specs Grid */}
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-zinc-900">
                Core Specifications
              </h2>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Coordinates */}
                <SpecCard
                  icon={<Axis3d className="h-5 w-5" />}
                  title="Coordinate System"
                >
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-3 text-xs">
                    <div className="text-zinc-500">Linear Units</div>
                    <div className="font-mono font-bold text-zinc-900">
                      Meters
                    </div>
                    <div className="text-zinc-500">Angular Units</div>
                    <div className="font-mono font-bold text-zinc-900">
                      Degrees
                    </div>
                    <div className="text-zinc-500">Up Axis</div>
                    <div className="font-mono font-bold text-indigo-600">
                      +Z Axis
                    </div>
                    <div className="text-zinc-500">Forward</div>
                    <div className="font-mono font-bold text-indigo-600">
                      +X Axis
                    </div>
                  </div>
                  <p>
                    Scene origin is always normalized to floor center (0,0,0)
                    unless annotated.
                  </p>
                </SpecCard>

                {/* Articulation */}
                <SpecCard
                  icon={<Settings2 className="h-5 w-5" />}
                  title="Joints & Pivots"
                >
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                      <span>
                        Revolute joints in degrees; Prismatic in meters.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Real-world limits validated in Isaac Sim.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                      <span>
                        Optional soft-close damping & friction presets.
                      </span>
                    </li>
                  </ul>
                </SpecCard>

                {/* Physics */}
                <SpecCard
                  icon={<Box className="h-5 w-5" />}
                  title="Colliders & Physics"
                >
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                      <span>Hybrid convex decomposition + SDF volumes.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                      <span>
                        Calibrated friction coefficients (PBR materials).
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                      <span>
                        AMR clearance envelopes included as invisible prims.
                      </span>
                    </li>
                  </ul>
                </SpecCard>

                {/* Semantics */}
                <SpecCard
                  icon={<FileJson className="h-5 w-5" />}
                  title="Semantics & Data"
                >
                  <div className="flex flex-wrap gap-2 mb-3">
                    {["Class", "Instance", "SKU", "Material"].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-zinc-100 border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p>
                    Scenes include optional CSV/JSON metadata for planograms,
                    signage, and device IDs. Compatible with Replicator for
                    synthetic data generation.
                  </p>
                </SpecCard>
              </div>
            </section>

            {/* Import Guide (Terminal Style) */}
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-zinc-900">
                Integration Flow
              </h2>
              <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-300 shadow-xl">
                <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-500/20" />
                    <div className="h-3 w-3 rounded-full bg-amber-500/20" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500/20" />
                  </div>
                  <span className="ml-2 font-mono text-xs text-zinc-500">
                    simulator_terminal
                  </span>
                </div>
                <div className="p-6 font-mono text-sm space-y-6">
                  <div className="space-y-2">
                    <p className="text-zinc-500"># 1. Mount the USD package</p>
                    <p className="flex gap-2">
                      <span className="text-emerald-400">$</span>
                      <span>blueprint load --scene=kitchen_v3.usd</span>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-zinc-500">
                      # 2. Verify physics state (optional)
                    </p>
                    <p className="flex gap-2">
                      <span className="text-emerald-400">$</span>
                      <span>sim.physics.inspect --colliders --joints</span>
                    </p>
                    <p className="text-indigo-400">
                      &gt;&gt; Physics mesh: WATERTIGHT
                    </p>
                    <p className="text-indigo-400">
                      &gt;&gt; Joints: 14 articulated
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-zinc-500">
                      # 3. Attach your agent policy
                    </p>
                    <p className="flex gap-2">
                      <span className="text-emerald-400">$</span>
                      <span>agent.spawn --pose=start_point_A</span>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Responsibility Matrix (Comparison) */}
            <section className="space-y-6">
              <h2 className="text-2xl font-bold text-zinc-900">
                Responsibility Matrix
              </h2>
              <div className="grid overflow-hidden rounded-2xl border border-zinc-200 md:grid-cols-2">
                {/* Blueprint Side */}
                <div className="bg-indigo-50/30 p-8">
                  <div className="mb-6 flex items-center gap-2 font-bold text-indigo-900">
                    <Layers className="h-5 w-5" />
                    We Deliver
                  </div>
                  <ul className="space-y-4 text-sm text-zinc-700">
                    <li className="flex gap-3">
                      <div className="h-px w-4 bg-indigo-400 mt-2.5"></div>
                      <span>
                        Watertight geometry, clean UVs, and PBR textures ready
                        for raytracing.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <div className="h-px w-4 bg-indigo-400 mt-2.5"></div>
                      <span>
                        Rigged joints, physics materials, and tuned collision
                        proxies.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <div className="h-px w-4 bg-indigo-400 mt-2.5"></div>
                      <span>
                        Semantic labels, annotation schemas, and metadata
                        exports.
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Client Side */}
                <div className="bg-white p-8 border-t md:border-t-0 md:border-l border-zinc-200">
                  <div className="mb-6 flex items-center gap-2 font-bold text-zinc-900">
                    <Terminal className="h-5 w-5" />
                    You Control
                  </div>
                  <ul className="space-y-4 text-sm text-zinc-600">
                    <li className="flex gap-3">
                      <div className="h-px w-4 bg-zinc-300 mt-2.5"></div>
                      <span>
                        Lookdev tweaks, customer branding, and specific decals.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <div className="h-px w-4 bg-zinc-300 mt-2.5"></div>
                      <span>
                        Custom task graphs, rewards, and policy training loops.
                      </span>
                    </li>
                    <li className="flex gap-3">
                      <div className="h-px w-4 bg-zinc-300 mt-2.5"></div>
                      <span>
                        Integration with your internal analytics and sensor
                        stack.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
