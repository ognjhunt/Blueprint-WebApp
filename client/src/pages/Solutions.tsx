import { ContactForm } from "@/components/site/ContactForm";
import { SEO } from "@/components/SEO";
import { Check, ChevronRight } from "lucide-react";

export default function Solutions() {
  return (
    <>
      <SEO
        title="Solutions - Blueprint"
        description="Three ways to use Blueprint's digital twins: download twin assets, get site-specific fine-tuning as a service, or subscribe to a living twin."
        canonical="/solutions"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="mb-20 space-y-6">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Three ways to use our digital twins
            </h1>

            <p className="max-w-3xl text-lg text-slate-600">
              We maintain Gaussian Splat twins of real commercial locations. You can
              download raw twin assets, hire us for a managed fine-tuning cycle, or
              subscribe for continuous updates as your facility changes.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#twin-access"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition"
              >
                See options
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
            {/* Path 1: Twin Asset Access */}
            <div id="twin-access" className="space-y-6 border-l-4 border-slate-900 pl-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  1. Twin Asset Access (fastest start)
                </h2>
                <p className="mt-2 text-slate-600">
                  Download Gaussian Splat files of real commercial facilities.
                  Render your own training video and run fine-tuning in-house.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-900">What you get:</h3>
                  <ul className="mt-3 space-y-2 text-slate-600">
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>PLY splat files of real warehouses, kitchens, retail stores, and factories</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Location metadata: dimensions, layout type, lighting conditions, scan date</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Render from any viewpoint to produce training video for your world model</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Works with DreamDojo, Cosmos, V-JEPA 2, or your own model stack</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Time to data:</span> Immediate download
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Cost:</span> $2,000 - $5,000 per site
                  </p>
                </div>
              </div>

              <a
                href="/marketplace/scenes"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 transition"
              >
                Browse twin library
              </a>
            </div>

            {/* Path 2: Adaptation-as-a-Service */}
            <div id="adaptation" className="space-y-6 border-l-4 border-slate-900 pl-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  2. Site-Specific Fine-Tuning (most common)
                </h2>
                <p className="mt-2 text-slate-600">
                  Tell us your target facility and model stack. We render training video from the
                  twin, fine-tune your world model or VLA against it, and deliver LoRA adapter
                  weights you can flash to your robot. This is how DreamDojo and Cosmos adapt
                  to new sites.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-900">How it works:</h3>
                  <ol className="mt-3 space-y-2 text-slate-600">
                    <li className="flex items-start gap-3">
                      <span className="font-semibold text-slate-400 shrink-0">1.</span>
                      <span>Pick a target facility from our twin library (or we scan yours)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-semibold text-slate-400 shrink-0">2.</span>
                      <span>We render training video from the splat at novel viewpoints</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-semibold text-slate-400 shrink-0">3.</span>
                      <span>Fine-tune your world model or VLA against the site video</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="font-semibold text-slate-400 shrink-0">4.</span>
                      <span>Deliver LoRA adapter weights (small enough for OTA transfer)</span>
                    </li>
                  </ol>
                </div>

                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Time to weights:</span> Days (depends on model and site complexity)
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Cost:</span> $5,000 - $15,000 per adaptation cycle
                  </p>
                </div>
              </div>

              <a
                href="/contact?interest=adaptation"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 transition"
              >
                Request an adaptation cycle
              </a>
            </div>

            {/* Path 3: Living Twin */}
            <div id="living-twin" className="space-y-6 border-l-4 border-slate-900 pl-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  3. Living Twin Subscription (continuous)
                </h2>
                <p className="mt-2 text-slate-600">
                  Facilities change: new shelving goes up, seasonal inventory shifts, layouts
                  get reconfigured. A living twin subscription means we re-scan periodically and
                  deliver updated adapter weights so your model stays current with the real world.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-900">What you get:</h3>
                  <ul className="mt-3 space-y-2 text-slate-600">
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Periodic re-scans of your target facility (monthly or quarterly)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Updated Gaussian Splat twins reflecting current layout</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Fresh LoRA adapter weights delivered each cycle</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                      <span>Drift monitoring to flag when re-adaptation is needed</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <p className="text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Cadence:</span> Monthly or quarterly re-scans and re-adaptation
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Cost:</span> $1,000 - $3,000/month per site
                  </p>
                </div>
              </div>

              <a
                href="/contact?tier=living-twin"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 transition"
              >
                Talk about subscriptions
              </a>
            </div>
          </div>

          {/* What's Included Section */}
          <div className="mb-20 border-t border-slate-200 pt-16 space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Every delivery includes
              </h2>
              <p className="text-slate-600 mb-6">
                Regardless of which option you pick, you get the files and metadata
                your team needs to deploy.
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  title: "Gaussian Splat (PLY)",
                  desc: "3D capture of the real facility, ready to render from any viewpoint."
                },
                {
                  title: "Location metadata",
                  desc: "Dimensions, facility type, lighting conditions, scan timestamp, and layout annotations."
                },
                {
                  title: "Rendered training video",
                  desc: "Novel-viewpoint video clips ready for world model fine-tuning (DreamDojo, Cosmos, etc.)."
                },
                {
                  title: "LoRA adapter weights (Tier 2+)",
                  desc: "Lightweight model weights fine-tuned to your target site, deliverable over-the-air."
                },
                {
                  title: "Adaptation report",
                  desc: "Fine-tuning metrics, confidence scores, and recommended next steps for deployment."
                },
                {
                  title: "Pre-deploy benchmark results (optional)",
                  desc: "World-model-based evaluation of your adapted policy against the target facility twin."
                },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition">
                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Which Path */}
          <div className="mb-20 border-t border-slate-200 pt-16 space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-4">
                Which path should you choose?
              </h2>
            </div>

            <div className="space-y-4">
              {[
                {
                  when: "You have your own fine-tuning pipeline and just need twin assets",
                  path: "Twin Asset Access ($2K-$5K per site)"
                },
                {
                  when: "You want us to handle fine-tuning and deliver ready-to-deploy weights",
                  path: "Site-Specific Fine-Tuning ($5K-$15K per cycle)"
                },
                {
                  when: "Your facilities change over time and you need continuous re-adaptation",
                  path: "Living Twin Subscription ($1K-$3K/month per site)"
                },
              ].map((item, idx) => (
                <div key={idx} className="rounded-lg border border-slate-200 p-4 hover:border-slate-300 transition">
                  <p className="text-slate-600">{item.when}</p>
                  <p className="mt-2 font-semibold text-slate-900">{item.path}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="border-t border-slate-200 pt-16 space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold text-slate-900">
                Tell us the building and the model.
              </h2>
              <p className="text-slate-600">
                Share your target facility, model stack, and deployment timeline. We'll
                scope an adaptation and get you a quote.
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
