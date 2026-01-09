import { SEO } from "@/components/SEO";
import { Users, ArrowRight, CheckCircle2, BarChart3, Zap } from "lucide-react";

export default function EmbodimentTransfer() {
  return (
    <>
      <SEO
        title="Embodiment Transfer Analysis | Blueprint - Multi-Robot Validation"
        description="Cross-robot compatibility matrix showing per-robot success rates and transfer predictions. Increase dataset value 3-5x for multi-robot labs."
        canonical="/analytics/embodiment-transfer"
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-600">
                <Users className="h-4 w-4 text-zinc-700" />
                Premium Analytics
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-zinc-950">
                Embodiment Transfer Analysis
              </h1>
              <p className="max-w-2xl text-xl text-zinc-600">
                Quantify cross-robot compatibility with a matrix showing per-robot success rates, kinematic capability matching, and transfer learning predictions. Answer: "Can I use Franka data to train UR10?" and increase dataset value 3-5x for multi-robot labs.
              </p>
            </div>

            {/* Impact Metrics */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">3-5x</div>
                <p className="mt-2 text-sm text-zinc-600">More dataset value from multi-robot transfer</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">6+ Robots</div>
                <p className="mt-2 text-sm text-zinc-600">Franka, UR, GR1, Fetch, ABB, FANUC, more</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">100% Clear</div>
                <p className="mt-2 text-sm text-zinc-600">Transfer confidence matrix per robot</p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                href="/contact?analytics=embodiment-transfer"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/analytics"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-8 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
              >
                View All Modules
              </a>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-bold text-zinc-950">Compatibility Matrix</h2>
                <p className="mt-2 text-zinc-600">
                  Comprehensive cross-robot analysis with kinematic and transfer metrics
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                {[
                  {
                    title: "Per-Robot Success Rates",
                    description: "Success metrics broken down by robot embodiment and task type",
                  },
                  {
                    title: "Kinematic Compatibility",
                    description: "Joint limit matching, workspace overlap, reachability analysis",
                  },
                  {
                    title: "Transfer Predictions",
                    description: "Confidence scores for cross-embodiment policy transfer",
                  },
                  {
                    title: "Workspace Coverage",
                    description: "Which robots can execute the same trajectories from your data",
                  },
                  {
                    title: "Trajectory Retargeting",
                    description: "Recommendations for adapting trajectories to different kinematics",
                  },
                  {
                    title: "Multi-Arm Configuration",
                    description: "Support for dual-arm and multi-robot fleet compatibility",
                  },
                ].map((feature, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-zinc-200 bg-white p-6"
                  >
                    <h3 className="font-semibold text-zinc-950">{feature.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{feature.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases Section */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-12">
            <div>
              <h2 className="text-3xl font-bold text-zinc-950">Use Cases</h2>
              <p className="mt-2 text-zinc-600">
                Multi-robot teams and fleet operators
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {[
                {
                  icon: <Zap className="h-6 w-6 text-zinc-700" />,
                  title: "Fleet Deployment Planning",
                  description: "Know which robots benefit from your training dataset upfront",
                },
                {
                  icon: <CheckCircle2 className="h-6 w-6 text-zinc-700" />,
                  title: "Multi-Robot Lab Training",
                  description: "Train multiple embodiments on the same dataset with confidence scores",
                },
                {
                  icon: <BarChart3 className="h-6 w-6 text-zinc-700" />,
                  title: "Dataset Value Justification",
                  description: "Prove to stakeholders why multi-robot compatibility increases ROI",
                },
                {
                  icon: <Users className="h-6 w-6 text-zinc-700" />,
                  title: "Cross-Lab Collaboration",
                  description: "Share data across institutions with different robot fleets",
                },
              ].map((useCase, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg border border-zinc-200 bg-white p-2">
                      {useCase.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-zinc-950">{useCase.title}</h3>
                      <p className="mt-1 text-sm text-zinc-600">{useCase.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Value Props */}
        <section className="border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-bold text-zinc-950">Why Multi-Robot Labs Love This</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">3-5x Dataset Value</h3>
                  <p className="mt-3 text-zinc-600">
                    One dataset now serves multiple robots. Multiply your ROI across the fleet.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Clear Transfer Paths</h3>
                  <p className="mt-3 text-zinc-600">
                    Know exactly which robots will benefit most from this data and why.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Unified Purchasing</h3>
                  <p className="mt-3 text-zinc-600">
                    Buy once, deploy to multiple platforms. Simplify your data acquisition.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Cross-Platform Training</h3>
                  <p className="mt-3 text-zinc-600">
                    Build better foundation models by training on compatible multi-robot data.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing & CTA */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center">
            <h2 className="text-3xl font-bold text-zinc-950">
              Embodiment Transfer Analysis
            </h2>
            <p className="mt-4 text-xl text-zinc-600">
              Included in Enterprise and Foundation tiers
            </p>

            <div className="mt-8">
              <p className="text-sm text-zinc-500 uppercase tracking-wider">
                Standalone Price
              </p>
              <p className="mt-2 text-4xl font-bold text-zinc-950">$18,000</p>
              <p className="mt-2 text-sm text-zinc-600">per dataset</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/contact?analytics=embodiment-transfer&tier=enterprise"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Add to Enterprise Bundle
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/contact?analytics=embodiment-transfer"
                className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-8 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
