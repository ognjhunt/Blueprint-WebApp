import { SEO } from "@/components/SEO";
import { TrendingUp, ArrowRight, CheckCircle2, BarChart3, Zap } from "lucide-react";

export default function GeneralizationCurves() {
  return (
    <>
      <SEO
        title="Generalization & Learning Curves | Blueprint - Data Efficiency"
        description="Task difficulty stratification, per-object success rates, learning curves, and curriculum learning recommendations. Answer 'how much data do I need?'"
        canonical="/analytics/generalization-curves"
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-600">
                <TrendingUp className="h-4 w-4 text-zinc-700" />
                Premium Analytics
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-zinc-950">
                Generalization & Learning Curves
              </h1>
              <p className="max-w-2xl text-xl text-zinc-600">
                Task difficulty stratification, per-object success rates, learning efficiency metrics, and curriculum learning recommendations. Tells labs "How much data do I really need?" and "Will this cover my use case?" Critical for planning data acquisition budgets.
              </p>
            </div>

            {/* Impact Metrics */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">Budget Clarity</div>
                <p className="mt-2 text-sm text-zinc-600">Know data needs upfront</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">Curriculum Maps</div>
                <p className="mt-2 text-sm text-zinc-600">Optimal learning progressions</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">Coverage Proof</div>
                <p className="mt-2 text-sm text-zinc-600">Per-object success rates</p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                href="/contact?analytics=generalization-curves"
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
                <h2 className="text-3xl font-bold text-zinc-950">Analysis Dimensions</h2>
                <p className="mt-2 text-zinc-600">
                  Seven critical measurements of dataset generalization
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                {[
                  {
                    title: "Task Difficulty Stratification",
                    description: "Classification by complexity with success rate breakdown",
                  },
                  {
                    title: "Per-Object Success Rates",
                    description: "Which object categories perform best and worst",
                  },
                  {
                    title: "Learning Efficiency Curves",
                    description: "Episodes vs. convergence showing data efficiency",
                  },
                  {
                    title: "Data Efficiency Estimation",
                    description: "Minimum data needed for target performance levels",
                  },
                  {
                    title: "Scene Variation Impact",
                    description: "How different scene variations affect learning",
                  },
                  {
                    title: "Curriculum Learning Sequence",
                    description: "Optimal ordering from easy to hard tasks",
                  },
                  {
                    title: "Generalization Gap Analysis",
                    description: "Training vs. deployment performance delta",
                  },
                  {
                    title: "Coverage Mapping",
                    description: "Scene, object, and task coverage visualization",
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
                Budget planning and curriculum design
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {[
                {
                  icon: <BarChart3 className="h-6 w-6 text-zinc-700" />,
                  title: "Budget Planning",
                  description: "Justify data acquisition spend with efficiency curves",
                },
                {
                  icon: <TrendingUp className="h-6 w-6 text-zinc-700" />,
                  title: "Curriculum Design",
                  description: "Optimal learning progression from easy to hard",
                },
                {
                  icon: <CheckCircle2 className="h-6 w-6 text-zinc-700" />,
                  title: "Coverage Validation",
                  description: "Verify dataset covers your specific use cases",
                },
                {
                  icon: <Zap className="h-6 w-6 text-zinc-700" />,
                  title: "Training Strategy",
                  description: "Optimize model training with data insights",
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
                <h2 className="text-3xl font-bold text-zinc-950">Why This Matters for Your Budget</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Know What You Need</h3>
                  <p className="mt-3 text-zinc-600">
                    Stop guessing. Learning curves show exactly how much data drives convergence.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Justify Spend</h3>
                  <p className="mt-3 text-zinc-600">
                    Show boards that your data acquisition budget is optimized and efficient.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Plan Training</h3>
                  <p className="mt-3 text-zinc-600">
                    Curriculum learning paths accelerate convergence and improve model quality.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Validate Coverage</h3>
                  <p className="mt-3 text-zinc-600">
                    Verify data covers your specific use cases before committing resources.
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
              Generalization & Learning Curves
            </h2>
            <p className="mt-4 text-xl text-zinc-600">
              Included in Pro, Enterprise, and Foundation tiers
            </p>

            <div className="mt-8">
              <p className="text-sm text-zinc-500 uppercase tracking-wider">
                Standalone Price
              </p>
              <p className="mt-2 text-4xl font-bold text-zinc-950">$11,000</p>
              <p className="mt-2 text-sm text-zinc-600">per dataset</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/contact?analytics=generalization-curves&tier=pro"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Add to Pro Bundle
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/contact?analytics=generalization-curves"
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
