import { ContactForm } from "@/components/site/ContactForm";
import { SEO } from "@/components/SEO";
import { Check, ChevronRight } from "lucide-react";

export default function Solutions() {
  return (
    <>
      <SEO
        title="Solutions - Blueprint"
        description="Three ways to get certified simulation training data for robots: off-the-shelf packs, custom dataset runs, or continuous delivery."
        canonical="/solutions"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="mb-20 space-y-6">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Three ways to get certified training data for robots
            </h1>

            <p className="max-w-3xl text-lg text-slate-600">
              Open-source generators can create trajectories. The hard part is shipping data you
              can trust: certified physics, episode QC, quality scores, and provenance metadata.
              Choose the path that matches your timeline.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#catalog"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                Browse the catalog
                <ChevronRight className="h-4 w-4" />
              </a>
              <a
                href="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition"
              >
                Talk to us
              </a>
            </div>
          </div>

          {/* Three Paths */}
          <div className="mb-20 space-y-12">
            {/* Path 1: Catalog */}
            <div id="catalog" className="space-y-6 border-l-4 border-slate-900 pl-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  1. Buy off-the-shelf packs (fastest)
                </h2>
                <p className="mt-2 text-slate-600">
                  Start with scenes and dataset packs from the catalog. Each pack is shipped with
                  certification outputs and metadata so you can train immediately.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-900">What you get:</h3>
                  <ul className="mt-3 space-y-2 text-slate-600">
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>SimReady scenes (USD) with validated colliders and articulation</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Quality-scored episodes (where applicable) with episode-level metadata</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Certification report: physics gates, known limits, and recommended filters</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Provenance metadata for reproducibility and auditing</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Time to data:</span> Immediate (download and start training)
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Cost:</span> Per-pack pricing is listed in the catalog
                  </p>
                </div>
              </div>

              <a
                href="/marketplace"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 transition"
              >
                Browse the catalog
              </a>
            </div>

            {/* Path 2: Custom */}
            <div id="custom" className="space-y-6 border-l-4 border-slate-900 pl-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  2. Request a custom dataset run (most common)
                </h2>
                <p className="mt-2 text-slate-600">
                  Tell us the robot, task, environment archetype, and success criteria. We generate scenes
                  and trajectories, then certify physics and score episode quality before delivery.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-900">How it works:</h3>
                  <ol className="mt-3 space-y-2 text-slate-600">
                    <li className="flex items-start gap-3">
                      <span className="font-semibold text-slate-400 shrink-0">1.</span>
                      <span>Define your dataset spec (robot, tasks, sensors, target formats)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-semibold text-slate-400 shrink-0">2.</span>
                      <span>Generate or tailor scenes (catalog + custom + reference-based)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-semibold text-slate-400 shrink-0">3.</span>
                      <span>Run physics certification and episode QC + quality scoring</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-semibold text-slate-400 shrink-0">4.</span>
                      <span>Deliver the dataset with metadata, filters, and documentation</span>
                    </li>
                  </ol>
                </div>

                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Time to data:</span> Days to weeks (depends on scope)
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Cost:</span> Custom (based on scenes, episodes, and certification gates)
                  </p>
                </div>
              </div>

              <a
                href="/contact?interest=exclusive-dataset"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 transition"
              >
                Request a dataset
              </a>
            </div>

            {/* Path 3: Continuous */}
            <div id="continuous" className="space-y-6 border-l-4 border-slate-900 pl-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  3. Subscribe to continuous delivery (scale)
                </h2>
                <p className="mt-2 text-slate-600">
                  If you're training continuously, you need new certified data continuously. We run ongoing
                  generation and QA so you can keep feeding your training pipeline without rebuilding
                  infrastructure.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-900">What you get:</h3>
                  <ul className="mt-3 space-y-2 text-slate-600">
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Recurring drops of new episodes and scene variations</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Consistent schema, quality scoring, and versioned provenance</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>A dedicated feedback loop to target your model's current failure modes</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Time to value:</span> Weekly (or faster) ongoing updates
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Cost:</span> Annual license (based on throughput and scope)
                  </p>
                </div>
              </div>

              <a
                href="/contact?tier=foundation"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 transition"
              >
                Talk about licensing
              </a>
            </div>
          </div>

          {/* What's Included Section */}
          <div className="mb-20 border-t border-slate-200 pt-16 space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Every delivery includes certification outputs
              </h2>
              <p className="text-slate-600 mb-6">
                Whether you buy a pack or request a custom run, you get the artifacts that turn raw simulation into a trustworthy dataset: physics gates, episode QC, quality distributions, and provenance.
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  title: "Physics certification report",
                  desc: "Documented gates and checks for colliders, articulation, stability, and known limits."
                },
                {
                  title: "Episode quality scores",
                  desc: "A quality distribution so you can filter or tier episodes by trust level."
                },
                {
                  title: "Normalization & schema consistency",
                  desc: "Episode normalization so data stays consistent across scenes, runs, and versions."
                },
                {
                  title: "Provenance metadata",
                  desc: "Track assets, parameters, and versions for reproducibility and auditability."
                },
                {
                  title: "Task and environment specs",
                  desc: "Clear documentation of what the pack is for: tasks, sensors, and evaluation criteria."
                },
                {
                  title: "Support for iteration",
                  desc: "A feedback loop to request targeted new data as your model exposes new failure modes."
                },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition">
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* How to Start */}
          <div className="mb-20 border-t border-slate-200 pt-16 space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Which path should you choose?
              </h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  when: "You need something off-the-shelf and want to start training today",
                  path: "Buy catalog packs"
                },
                {
                  when: "You need your exact robot, task, and constraints with QA gates",
                  path: "Request a custom dataset run"
                },
                {
                  when: "You need a steady stream of new data as training scales",
                  path: "Subscribe to continuous delivery"
                },
              ].map((item, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition">
                  <p className="text-slate-600">{item.when}</p>
                  <p className="mt-2 font-semibold text-slate-900">→ {item.path}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="border-t border-slate-200 pt-16 space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold text-slate-900">
                Ready to get started?
              </h2>
              <p className="text-slate-600">
                Tell us your robot, task, environment archetype, and target formats. We'll recommend the fastest path to certified data.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-8 bg-slate-50">
              <ContactForm />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
