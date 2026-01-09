import { SEO } from "@/components/SEO";
import { Hand, ArrowRight, CheckCircle2, Target, Zap } from "lucide-react";

export default function GraspQuality() {
  return (
    <>
      <SEO
        title="Grasp Quality Metrics | Blueprint - Manipulation Validation"
        description="Force closure analysis, contact point assessment, grasp stability and robustness scoring. Essential for 60% of real manipulation research."
        canonical="/analytics/grasp-quality"
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-600">
                <Hand className="h-4 w-4 text-zinc-700" />
                Premium Analytics
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-zinc-950">
                Grasp Quality Metrics
              </h1>
              <p className="max-w-2xl text-xl text-zinc-600">
                Comprehensive grasp stability assessment with force closure computation, contact point analysis, slip probability estimation, and grasp robustness scoring. Essential for contact-rich learning since 60% of real manipulation research focuses on grasping.
              </p>
            </div>

            {/* Impact Metrics */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">60%</div>
                <p className="mt-2 text-sm text-zinc-600">Of manipulation research is grasping</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">Force Closure</div>
                <p className="mt-2 text-sm text-zinc-600">Stability metrics computed per grasp</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">Contact Analysis</div>
                <p className="mt-2 text-sm text-zinc-600">Where objects are grasped matters</p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                href="/contact?analytics=grasp-quality"
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
                <h2 className="text-3xl font-bold text-zinc-950">Grasp Analysis Metrics</h2>
                <p className="mt-2 text-zinc-600">
                  Six dimensions of grasp quality and robustness
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                {[
                  {
                    title: "Force Closure Analysis",
                    description: "Grasp matrix rank, epsilon (minimum singular value), and stability scores",
                  },
                  {
                    title: "Contact Points",
                    description: "Clustering and quality assessment of where objects are grasped",
                  },
                  {
                    title: "Robustness Estimation",
                    description: "Slip probability and friction cone validation per contact",
                  },
                  {
                    title: "Approach Vectors",
                    description: "Analysis of gripper approach quality and optimization potential",
                  },
                  {
                    title: "Grasp Configuration",
                    description: "Diversity scoring and gripper-specific quality metrics",
                  },
                  {
                    title: "Object-Specific Profiles",
                    description: "Grasp robustness tailored by object type and material",
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
                Grasp learning and manipulation research
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {[
                {
                  icon: <Hand className="h-6 w-6 text-zinc-700" />,
                  title: "Grasp Learning",
                  description: "Train grasp policies with confidence in grasp quality",
                },
                {
                  icon: <CheckCircle2 className="h-6 w-6 text-zinc-700" />,
                  title: "Contact-Rich Validation",
                  description: "Verify robustness of manipulation episodes before training",
                },
                {
                  icon: <Target className="h-6 w-6 text-zinc-700" />,
                  title: "Robustness Estimation",
                  description: "Identify fragile vs. robust grasps in dataset",
                },
                {
                  icon: <Zap className="h-6 w-6 text-zinc-700" />,
                  title: "Manipulation Success",
                  description: "Improve real-world pick-and-place success rates",
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
                <h2 className="text-3xl font-bold text-zinc-950">Why Manipulation Labs Need This</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Confident Grasping</h3>
                  <p className="mt-3 text-zinc-600">
                    Know which grasps are stable and robust before deploying on real hardware.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Higher Success Rates</h3>
                  <p className="mt-3 text-zinc-600">
                    Train policies on high-quality grasps for better pick-and-place outcomes.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Reduce Failures</h3>
                  <p className="mt-3 text-zinc-600">
                    Filter out fragile grasps that cause drops and damage to objects.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Generalization</h3>
                  <p className="mt-3 text-zinc-600">
                    Understand how grasp quality transfers across objects and gripper types.
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
              Grasp Quality Metrics
            </h2>
            <p className="mt-4 text-xl text-zinc-600">
              Included in Enterprise and Foundation tiers
            </p>

            <div className="mt-8">
              <p className="text-sm text-zinc-500 uppercase tracking-wider">
                Standalone Price
              </p>
              <p className="mt-2 text-4xl font-bold text-zinc-950">$14,000</p>
              <p className="mt-2 text-sm text-zinc-600">per dataset</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/contact?analytics=grasp-quality&tier=enterprise"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Add to Enterprise Bundle
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/contact?analytics=grasp-quality"
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
