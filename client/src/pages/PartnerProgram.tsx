import { ContactForm } from "@/components/site/ContactForm";
import { SEO } from "@/components/SEO";
import { Check } from "lucide-react";

export default function PartnerProgram() {
  return (
    <>
      <SEO
        title="Founding Partner Program - Blueprint"
        description="Join Blueprint's Founding Partner Program. Get early access to our digital twin network, shape the roadmap, and lock in founding partner pricing."
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
              Be a founding partner of our digital twin network
            </h1>
            <p className="text-lg text-slate-600">
              Blueprint is building a library of digital twins of real commercial locations. Partners get early access, shape the roadmap, and lock in founding pricing.
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
                <h3 className="font-semibold text-slate-900">Digital Twin Library Access</h3>
                <p className="text-sm text-slate-600">
                  Gaussian Splat twins of real commercial locations, ready for training and evaluation.
                </p>
              </div>

              {/* Service 2 */}
              <div className="border-l-2 border-slate-200 pl-6">
                <h3 className="font-semibold text-slate-900">Site-Specific Fine-Tuning</h3>
                <p className="text-sm text-slate-600">
                  We fine-tune your world model or VLA per site and deliver LoRA adapter weights.
                </p>
              </div>

              {/* Service 3 */}
              <div className="border-l-2 border-slate-200 pl-6">
                <h3 className="font-semibold text-slate-900">Pre-Deploy Benchmarks</h3>
                <p className="text-sm text-slate-600">
                  Test your adapted policy before real-world deployment with site-matched evaluation suites.
                </p>
              </div>

              {/* Service 4 */}
              <div className="border-l-2 border-slate-200 pl-6">
                <h3 className="font-semibold text-slate-900">Multi-Model Support</h3>
                <p className="text-sm text-slate-600">
                  Works with DreamDojo, Cosmos, OpenVLA, GR00T, and custom models.
                </p>
              </div>

              {/* Service 5 */}
              <div className="border-l-2 border-slate-200 pl-6">
                <h3 className="font-semibold text-slate-900">Real Robot Testing</h3>
                <p className="text-sm text-slate-600">
                  We help validate on your hardware and iterate until transfer works.
                </p>
              </div>

              {/* Service 6 */}
              <div className="border-l-2 border-slate-200 pl-6">
                <h3 className="font-semibold text-slate-900">Everything Else</h3>
                <p className="text-sm text-slate-600">
                  Pilot Exchange access, priority support, and environment pack licensing.
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
                <h3 className="mb-2 font-semibold text-slate-900">Founding Partner pricing - forever</h3>
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
                  <p className="font-semibold text-slate-900">Teams training world models or VLAs for robot deployment</p>
                  <p className="text-sm text-slate-600">You're building or fine-tuning models that need site-specific adaptation before going live</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-slate-900" />
                <div>
                  <p className="font-semibold text-slate-900">Companies deploying robots to commercial facilities</p>
                  <p className="text-sm text-slate-600">Warehouses, kitchens, retail, offices -- you need your policy to work in a specific real location</p>
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
                  <p className="text-sm text-slate-600">Fill out the form below, it takes 2 minutes</p>
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
