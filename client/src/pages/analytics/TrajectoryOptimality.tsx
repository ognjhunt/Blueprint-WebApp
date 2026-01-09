import { SEO } from "@/components/SEO";
import { Zap, ArrowRight, CheckCircle2, BarChart3, TrendingUp } from "lucide-react";

export default function TrajectoryOptimality() {
  return (
    <>
      <SEO
        title="Trajectory Optimality Analysis | Blueprint - Path Quality Validation"
        description="Energy efficiency, path straightness, smoothness, and joint limit analysis. Identify inefficient motion patterns that hurt policy learning."
        canonical="/analytics/trajectory-optimality"
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-600">
                <Zap className="h-4 w-4 text-zinc-700" />
                Premium Analytics
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-zinc-950">
                Trajectory Optimality Analysis
              </h1>
              <p className="max-w-2xl text-xl text-zinc-600">
                Comprehensive trajectory quality metrics: energy efficiency (joint torque integral), path straightness (deviation from optimal), smoothness (jerk analysis), joint limit margins, velocity profiles, and singularity avoidance. Validates trajectory quality for training and identifies inefficient motion patterns.
              </p>
            </div>

            {/* Impact Metrics */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">Energy Scores</div>
                <p className="mt-2 text-sm text-zinc-600">Torque efficiency per trajectory</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">Path Quality</div>
                <p className="mt-2 text-sm text-zinc-600">Smoothness and straightness metrics</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">Anomaly Detection</div>
                <p className="mt-2 text-sm text-zinc-600">Identify problematic trajectories</p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                href="/contact?analytics=trajectory-optimality"
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
                <h2 className="text-3xl font-bold text-zinc-950">Quality Metrics</h2>
                <p className="mt-2 text-zinc-600">
                  Seven dimensions of trajectory quality and efficiency
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                {[
                  {
                    title: "Energy Efficiency",
                    description: "Joint torque integrals showing motion efficiency",
                  },
                  {
                    title: "Path Optimality",
                    description: "Comparison to optimal trajectories (RRT*, Trajopt, iLQR)",
                  },
                  {
                    title: "Smoothness Analysis",
                    description: "Jerk integral and acceleration continuity metrics",
                  },
                  {
                    title: "Joint Limit Margins",
                    description: "Safety clearance from joint limits throughout motion",
                  },
                  {
                    title: "Velocity Profiling",
                    description: "Joint and Cartesian velocity characteristics",
                  },
                  {
                    title: "Singularity Avoidance",
                    description: "Jacobian conditioning and singularity proximity detection",
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
                Path quality and policy learning
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {[
                {
                  icon: <CheckCircle2 className="h-6 w-6 text-zinc-700" />,
                  title: "Training Data Quality",
                  description: "Validate trajectory quality before model training",
                },
                {
                  icon: <TrendingUp className="h-6 w-6 text-zinc-700" />,
                  title: "Motion Efficiency",
                  description: "Identify inefficient motion patterns to avoid",
                },
                {
                  icon: <BarChart3 className="h-6 w-6 text-zinc-700" />,
                  title: "Trajectory Comparison",
                  description: "Compare generation methods and filter quality",
                },
                {
                  icon: <Zap className="h-6 w-6 text-zinc-700" />,
                  title: "Energy Optimization",
                  description: "Train policies for energy-efficient operation",
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
                <h2 className="text-3xl font-bold text-zinc-950">Why Motion Quality Matters</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Better Policy Learning</h3>
                  <p className="mt-3 text-zinc-600">
                    Clean, efficient trajectories lead to more robust learned behaviors.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Hardware Efficiency</h3>
                  <p className="mt-3 text-zinc-600">
                    Energy-efficient training data reduces motor wear and operational costs.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Identify Problems</h3>
                  <p className="mt-3 text-zinc-600">
                    Automatically detect anomalous or inefficient trajectories for filtering.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Safe Operation</h3>
                  <p className="mt-3 text-zinc-600">
                    Avoid joint limits and singularities with trajectory validation.
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
              Trajectory Optimality Analysis
            </h2>
            <p className="mt-4 text-xl text-zinc-600">
              Included in Enterprise and Foundation tiers
            </p>

            <div className="mt-8">
              <p className="text-sm text-zinc-500 uppercase tracking-wider">
                Standalone Price
              </p>
              <p className="mt-2 text-4xl font-bold text-zinc-950">$9,500</p>
              <p className="mt-2 text-sm text-zinc-600">per dataset</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/contact?analytics=trajectory-optimality&tier=enterprise"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Add to Enterprise Bundle
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/contact?analytics=trajectory-optimality"
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
