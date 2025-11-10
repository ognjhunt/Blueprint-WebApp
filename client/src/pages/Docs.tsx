export default function Docs() {
  return (
    <div className="mx-auto max-w-5xl space-y-16 px-4 pb-24 pt-16 sm:px-6">
      <header className="space-y-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Documentation
        </p>
        <h1 className="text-4xl font-semibold text-slate-900">
          Blueprint SimReady specification.
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Every scene we ship follows the SimReady spec: metric accuracy, clean articulation, physics-ready materials, and semantic coverage. Use this guide to integrate Blueprint scenes into your simulator or extend them with your own tooling.
        </p>
      </header>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-slate-900">Units & coordinate system</h2>
        <div className="space-y-3 text-sm text-slate-600">
          <p>• Linear units: meters. Angular units: degrees. Scene origin at floor center unless otherwise annotated.</p>
          <p>• Forward axis: +X, up axis: +Z, matching common robotics sim defaults.</p>
          <p>• Scale variations for dataset diversity are provided as USD variants.</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-slate-900">Pivots, joints & articulation</h2>
        <div className="space-y-3 text-sm text-slate-600">
          <p>• All articulated assets ship with authored joints, axis definitions, and limits validated in simulation.</p>
          <p>• Revolute joints use degrees; prismatic joints use meters. Pivots align with physical hinges or slides.</p>
          <p>• Optional articulation presets: soft-close damping, friction overrides, and event callbacks for buttons/knobs.</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-slate-900">Colliders & physics</h2>
        <div className="space-y-3 text-sm text-slate-600">
          <p>• Default collider strategy mixes convex decomposition and SDF volumes. Each scene ships with collider preview renders.</p>
          <p>• Physics materials use calibrated coefficients for stainless, polymer, wood, and fabric surfaces.</p>
          <p>• AMR clearance envelopes, safety zones, and interaction volumes are packaged as USD prims.</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-slate-900">Semantics & annotations</h2>
        <div className="space-y-3 text-sm text-slate-600">
          <p>• Semantic labels follow Blueprint’s ontology and map cleanly to class, instance, and SKU exports.</p>
          <p>• Scenes include optional CSV/JSON metadata for planograms, signage, and device IDs.</p>
          <p>• Ask for annotation bundles to receive camera rigs, lighting variants, and sensor trajectories.</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-slate-900">Importing into your simulator</h2>
        <div className="space-y-3 text-sm text-slate-600">
          <p>1. Add the scene package to your preferred project workspace or file mount.</p>
          <p>2. Load the stage, enable physics inspection, and confirm articulation limits.</p>
          <p>3. Attach your policies or task graphs; Blueprint colliders and semantics are ready for pick-place, inspection, or manipulation workflows.</p>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold text-slate-900">What we deliver vs what you finish</h2>
        <div className="overflow-hidden rounded-3xl border border-slate-200">
          <table className="w-full table-auto text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.3em] text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-500">Blueprint</th>
                <th className="px-4 py-3 font-medium text-slate-500">You</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-100">
                <td className="px-4 py-3">Watertight geometry, clean UVs, and PBR textures</td>
                <td className="px-4 py-3">Optional lookdev tweaks, branding, decals</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-4 py-3">Joints, limits, physics materials, collider tuning</td>
                <td className="px-4 py-3">Custom task graphs, policy training</td>
              </tr>
              <tr className="border-t border-slate-100">
                <td className="px-4 py-3">Semantic labels, annotation schemas, metadata exports</td>
                <td className="px-4 py-3">Integration with internal analytics, additional sensors</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
