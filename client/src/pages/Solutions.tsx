import { ContactForm } from "@/components/site/ContactForm";
import { SEO } from "@/components/SEO";
import { Check, ChevronRight } from "lucide-react";

export default function Solutions() {
  return (
    <>
      <SEO
        title="Solutions - Blueprint"
        description="Three simple ways to get training data for your robots"
        canonical="/solutions"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="mb-20 space-y-6">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Three simple paths to training data for robots
            </h1>

            <p className="text-lg text-slate-600 max-w-3xl">
              Pick the approach that fits your timeline and budget. Each path gives you realistic 3D environments where robots can practice, plus detailed data analytics to understand if your training is working.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#procedural"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                Browse marketplace
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
            {/* Path 1: Procedural */}
            <div id="procedural" className="border-l-4 border-slate-900 pl-8 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">1. Use pre-made scenes (fastest)</h2>
                <p className="mt-2 text-slate-600">
                  Browse our marketplace of ready-to-use 3D environments. New scenes added daily. Perfect if you need data quickly.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-900">What you get:</h3>
                  <ul className="mt-3 space-y-2 text-slate-600">
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Ready-to-use 3D scene files</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Thousands of training examples (episodes) from the scene</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Quality reports showing if your robots actually learned</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Data analytics ($235k+ value) included for free</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Time to data:</span> Immediate (download and start training)
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Cost:</span> $1,000 - $5,000 per scene
                  </p>
                </div>
              </div>

              <a
                href="/marketplace"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 transition"
              >
                Browse scenes
              </a>
            </div>

            {/* Path 2: Custom Site Scan */}
            <div className="border-l-4 border-slate-900 pl-8 space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">2. Full site scan (most accurate)</h2>
                <p className="mt-2 text-slate-600">
                  We send a team to physically scan your facility with laser precision. Best for when you need an exact digital copy for testing before real deployment.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-900">What happens:</h3>
                  <ol className="mt-3 space-y-2 text-slate-600">
                    <li className="flex items-start gap-3">
                      <span className="font-semibold text-slate-400 shrink-0">1.</span>
                      <span>We schedule an on-site visit</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-semibold text-slate-400 shrink-0">2.</span>
                      <span>Our team scans your space with LiDAR + high-res cameras</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-semibold text-slate-400 shrink-0">3.</span>
                      <span>We rebuild your exact facility in simulation</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-semibold text-slate-400 shrink-0">4.</span>
                      <span>Test your robots in the simulation before going real</span>
                    </li>
                  </ol>
                </div>

                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Time to data:</span> 2-4 weeks (includes site visit + scene authoring)
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Cost:</span> $10,000 - $50,000 depending on facility size
                  </p>
                </div>
              </div>

              <a
                href="/contact?service=site-scan"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 transition"
              >
                Schedule a scan
              </a>
            </div>
          </div>

          {/* What's Included Section */}
          <div className="mb-20 border-t border-slate-200 pt-16 space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Everything includes premium data analytics
              </h2>
              <p className="text-slate-600 mb-6">
                No matter which path you choose, you get $235k+ worth of analytics for free. This is data science that helps you understand if your training actually worked.
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  title: "Quality Reports",
                  desc: "Is your training data actually good? We tell you exactly what worked and what didn't."
                },
                {
                  title: "Success Rates by Task",
                  desc: "See how well your robot succeeded at each task in simulation (picking, placing, opening, etc.)"
                },
                {
                  title: "Sim-to-Real Confidence",
                  desc: "Get a confidence score for whether this simulation data will work on your real robot"
                },
                {
                  title: "Multi-Robot Compatibility",
                  desc: "If you have multiple robots, we show you how much your Franka data helps your UR10 (data multiplier)"
                },
                {
                  title: "Failure Analysis",
                  desc: "Understand WHY your robot failed (collision vs timeout vs other reasons)"
                },
                {
                  title: "Language Instructions",
                  desc: "Automatic natural language descriptions of each training example (good for advanced AI models)"
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
                  when: "You need data fast and don't need it customized",
                  path: "Use pre-made scenes"
                },
                {
                  when: "You need laser-accurate 3D scan and real deployment testing",
                  path: "Full site scan"
                },
                {
                  when: "You're not sure which fits your situation",
                  path: "Talk to our team"
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
                Tell us about your use case and we'll recommend the right solution.
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
