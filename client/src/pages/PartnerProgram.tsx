import { ContactForm } from "@/components/site/ContactForm";
import { SEO } from "@/components/SEO";
import { Check, ChevronRight } from "lucide-react";

export default function PartnerProgram() {
  return (
    <>
      <SEO
        title="Partners - Blueprint"
        description="Join our early partner program and get free access to our entire robotics data platform while we validate it together."
        canonical="/partners"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="mb-20 space-y-6">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Partner with us — free platform, help us validate
            </h1>
            <p className="text-lg text-slate-600">
              We've built a robotics data platform. It works great in testing, but we need real labs using it on real projects to make sure it actually helps. Partner with us during validation, get everything free, and help us prove it works.
            </p>
          </div>

          {/* What You Get */}
          <div className="mb-20 space-y-8">
            <div>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">What you get (free)</h2>
              <p className="mb-6 text-slate-600">
                Our entire platform, including everything below. Worth $235,000-$605,000 normally. Free during validation phase.
              </p>
            </div>

            <div className="space-y-4">
              {/* Service 1 */}
              <div className="border-l-2 border-slate-200 pl-6">
                <h3 className="font-semibold text-slate-900">3D Training Environments</h3>
                <p className="text-sm text-slate-600">
                  Realistic scenes (kitchens, offices, warehouses) where your robot practices different tasks.
                </p>
              </div>

              {/* Service 2 */}
              <div className="border-l-2 border-slate-200 pl-6">
                <h3 className="font-semibold text-slate-900">Training Data Generation</h3>
                <p className="text-sm text-slate-600">
                  Thousands of automatically generated robot training examples — camera views, positions, success/failure, everything your AI needs.
                </p>
              </div>

              {/* Service 3 */}
              <div className="border-l-2 border-slate-200 pl-6">
                <h3 className="font-semibold text-slate-900">Data Quality Reports</h3>
                <p className="text-sm text-slate-600">
                  Automatic analysis that tells you if your training data is actually good, identifies gaps, and recommends what to collect next.
                </p>
              </div>

              {/* Service 4 */}
              <div className="border-l-2 border-slate-200 pl-6">
                <h3 className="font-semibold text-slate-900">Multi-Robot Support</h3>
                <p className="text-sm text-slate-600">
                  Works with robot arms, mobile robots, humanoids. We analyze if training data from one robot helps train another.
                </p>
              </div>

              {/* Service 5 */}
              <div className="border-l-2 border-slate-200 pl-6">
                <h3 className="font-semibold text-slate-900">Real Robot Testing</h3>
                <p className="text-sm text-slate-600">
                  We'll work with you to test if sim training actually works on your real hardware and improve the transfer from simulation to reality.
                </p>
              </div>

              {/* Service 6 */}
              <div className="border-l-2 border-slate-200 pl-6">
                <h3 className="font-semibold text-slate-900">Everything Else</h3>
                <p className="text-sm text-slate-600">
                  Natural language instructions for tasks, audio descriptions, performance benchmarks, and more. Our entire platform.
                </p>
              </div>
            </div>
          </div>

          {/* Why You Should Apply */}
          <div className="mb-20 space-y-8">
            <div>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">Why you should apply</h2>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="mb-2 font-semibold text-slate-900">Get $235k-$605k of tooling for free</h3>
                <p className="text-slate-600">
                  No payment. No contract. Keep all the data we generate.
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-slate-900">Shape the product</h3>
                <p className="text-slate-600">
                  Your feedback directly influences our roadmap. We'll build features based on what actually helps you.
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-slate-900">Forever pricing</h3>
                <p className="text-slate-600">
                  After validation, early partners get discounted pricing for life. We take care of people who helped us get started.
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-slate-900">Zero risk</h3>
                <p className="text-slate-600">
                  Not working out? Walk away anytime. You keep everything. You literally cannot lose.
                </p>
              </div>
            </div>
          </div>

          {/* Who We're Looking For */}
          <div className="mb-20 space-y-8">
            <div>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">Who should apply</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-900" />
                <div>
                  <p className="font-semibold text-slate-900">Labs or companies with real robots</p>
                  <p className="text-sm text-slate-600">Robot arms, mobile robots, humanoids — if you have hardware, we want to work with you</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-900" />
                <div>
                  <p className="font-semibold text-slate-900">Teams needing training data</p>
                  <p className="text-sm text-slate-600">Training AI for robots, need more scenarios, want to test sim→real transfer</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-900" />
                <div>
                  <p className="font-semibold text-slate-900">People willing to share feedback</p>
                  <p className="text-sm text-slate-600">Tell us what works and what doesn't. ~30 minutes every 2 weeks</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-900" />
                <div>
                  <p className="font-semibold text-slate-900">Anyone interested in robotics data</p>
                  <p className="text-sm text-slate-600">Even if you don't fit perfectly above — apply anyway. Worst case is free access to our platform</p>
                </div>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="mb-20 space-y-8">
            <h2 className="text-2xl font-bold text-slate-900">How it works</h2>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-900">
                  1
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Apply</h3>
                  <p className="text-sm text-slate-600">Fill out the form below</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-900">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Talk</h3>
                  <p className="text-sm text-slate-600">We'll schedule a 30-minute call to understand your project</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-900">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Get Access</h3>
                  <p className="text-sm text-slate-600">We'll set up everything and you get full platform access (free)</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-900">
                  4
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Use & Validate</h3>
                  <p className="text-sm text-slate-600">Use our platform on your real projects, share feedback, help us prove it works</p>
                </div>
              </div>
            </div>
          </div>

          {/* Application Section */}
          <div className="mb-20 space-y-8">
            <div>
              <h2 className="mb-2 text-2xl font-bold text-slate-900">Apply to partner</h2>
              <p className="text-slate-600">Ready? Fill out the form and we'll reach out within 24 hours.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-8">
              <ContactForm />
            </div>
          </div>

          {/* Info Section */}
          <div className="space-y-6 border-t border-slate-200 pt-12">
            <div>
              <h3 className="mb-2 font-semibold text-slate-900">Limited spots</h3>
              <p className="text-sm text-slate-600">
                We're looking for 5-10 validation partners to work closely with during Q1 2026. Priority given to labs with real hardware.
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-semibold text-slate-900">Questions?</h3>
              <p className="text-sm text-slate-600">
                Email us at{" "}
                <a href="mailto:partners@tryblueprint.io" className="font-semibold text-slate-900 hover:underline">
                  partners@tryblueprint.io
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
