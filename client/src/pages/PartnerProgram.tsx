import { ContactForm } from "@/components/site/ContactForm";
import { SEO } from "@/components/SEO";
import { Check } from "lucide-react";

export default function PartnerProgram() {
  return (
    <>
      <SEO
        title="Founding Partner Program - Blueprint"
        description="Join Blueprint's Founding Partner Program. Get early access to our robotics data platform, shape the roadmap, and lock in exclusive pricing."
        canonical="/partners"
      />
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Hero */}
          <div className="mb-20 space-y-6">
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Founding Partner Program
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Be the first to use our robotics data platform
            </h1>
            <p className="text-lg text-slate-600">
              We're selecting a small group of robotics teams to get early access to Blueprint. You'll shape our roadmap, get hands-on support from our team, and lock in founding partner pricing permanently.
            </p>
          </div>

          {/* What You Get */}
          <div className="mb-20 space-y-8">
            <div>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">What's included</h2>
              <p className="mb-6 text-slate-600">
                Full platform access for the duration of the program. No usage limits.
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

          {/* Why Join */}
          <div className="mb-20 space-y-8">
            <div>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">Why join as a Founding Partner</h2>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="mb-2 font-semibold text-slate-900">Direct roadmap influence</h3>
                <p className="text-slate-600">
                  Your feedback shapes what we build. Founding partners get a direct line to our team and priority on feature requests.
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-slate-900">Hands-on support</h3>
                <p className="text-slate-600">
                  We'll work directly with your team to integrate Blueprint into your workflow and optimize for your use case.
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-slate-900">Founding Partner pricing — forever</h3>
                <p className="text-slate-600">
                  Lock in early-access rates permanently. When we raise prices for new customers, yours stays the same.
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-slate-900">Keep everything you create</h3>
                <p className="text-slate-600">
                  All training data, environments, and exports are yours. No lock-in.
                </p>
              </div>
            </div>
          </div>

          {/* Who We're Looking For */}
          <div className="mb-20 space-y-8">
            <div>
              <h2 className="mb-4 text-2xl font-bold text-slate-900">Who we're looking for</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-900" />
                <div>
                  <p className="font-semibold text-slate-900">Teams with real robot hardware</p>
                  <p className="text-sm text-slate-600">Robot arms, mobile robots, humanoids — we prioritize partners who can validate sim-to-real transfer</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-900" />
                <div>
                  <p className="font-semibold text-slate-900">Active ML/AI training pipelines</p>
                  <p className="text-sm text-slate-600">You're already training models for robot manipulation, navigation, or perception</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-900" />
                <div>
                  <p className="font-semibold text-slate-900">Willing to commit ~2 hours/month</p>
                  <p className="text-sm text-slate-600">Bi-weekly check-ins to share feedback on what's working and what we should build next</p>
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
                  <p className="text-sm text-slate-600">Fill out the form below — takes 2 minutes</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-900">
                  2
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Intro call</h3>
                  <p className="text-sm text-slate-600">30-minute call to understand your use case and see if there's a fit</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-900">
                  3
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Onboarding</h3>
                  <p className="text-sm text-slate-600">We set up your account and walk your team through the platform</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-semibold text-slate-900">
                  4
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">Build together</h3>
                  <p className="text-sm text-slate-600">Use the platform, share feedback, and help us make it better</p>
                </div>
              </div>
            </div>
          </div>

          {/* Application Section */}
          <div className="mb-20 space-y-8">
            <div>
              <h2 className="mb-2 text-2xl font-bold text-slate-900">Apply now</h2>
              <p className="text-slate-600">Tell us about your team and project. We'll respond within 48 hours.</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-8">
              <ContactForm />
            </div>
          </div>

          {/* Info Section */}
          <div className="space-y-6 border-t border-slate-200 pt-12">
            <div>
              <h3 className="mb-2 font-semibold text-slate-900">Limited availability</h3>
              <p className="text-sm text-slate-600">
                We're accepting 5-10 partners for this cohort to ensure we can give each team dedicated support.
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
