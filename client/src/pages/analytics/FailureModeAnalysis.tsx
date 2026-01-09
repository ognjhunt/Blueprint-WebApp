import { SEO } from "@/components/SEO";
import { BarChart3, ArrowRight, CheckCircle2, Target, TrendingUp } from "lucide-react";

export default function FailureModeAnalysis() {
  return (
    <>
      <SEO
        title="Failure Mode Analysis | Blueprint - Data Quality Validation"
        description="Comprehensive failure taxonomy and root cause analysis. Categorize failures, track root causes, and generate filtering recommendations. Save labs 10x debugging time."
        canonical="/analytics/failure-mode-analysis"
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-600">
                <BarChart3 className="h-4 w-4 text-zinc-700" />
                Premium Analytics
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-zinc-950">
                Failure Mode Analysis
              </h1>
              <p className="max-w-2xl text-xl text-zinc-600">
                Automatically categorize and analyze why episodes fail. Get root cause taxonomy, frame-by-frame failure detection, and actionable filtering recommendations to improve dataset quality 10x faster.
              </p>
            </div>

            {/* Impact Metrics */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">10x</div>
                <p className="mt-2 text-sm text-zinc-600">Faster debugging with automated taxonomy</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">5 Types</div>
                <p className="mt-2 text-sm text-zinc-600">Failure categories identified automatically</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">Frame-by-Frame</div>
                <p className="mt-2 text-sm text-zinc-600">Pinpoint exact failure moment</p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                href="/contact?analytics=failure-mode-analysis"
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
                <h2 className="text-3xl font-bold text-zinc-950">What You Get</h2>
                <p className="mt-2 text-zinc-600">
                  Comprehensive failure analysis powered by physics simulation data
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                {[
                  {
                    title: "Failure Taxonomy",
                    description: "Automatic categorization into: collision, grasp_fail, placement_error, timeout, contact_violation",
                  },
                  {
                    title: "Root Cause Analysis",
                    description: "Frame-by-frame failure detection with confidence scores and localizable fault regions",
                  },
                  {
                    title: "Filtering Recommendations",
                    description: "Data quality improvement guidance: which episodes to exclude, patterns to avoid",
                  },
                  {
                    title: "Statistics & Reporting",
                    description: "Aggregated failure distribution by scene, object, task, and robot type",
                  },
                  {
                    title: "Recovery Patterns",
                    description: "Identify sequences where systems recover from failures (if applicable)",
                  },
                  {
                    title: "Actionable Insights",
                    description: "Debugging recommendations and data curation priorities for training",
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
                Who benefits from failure mode analysis
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {[
                {
                  icon: <CheckCircle2 className="h-6 w-6 text-zinc-700" />,
                  title: "Data Quality Assessment",
                  description: "Understand dataset health before model training begins",
                },
                {
                  icon: <Target className="h-6 w-6 text-zinc-700" />,
                  title: "Curriculum Design",
                  description: "Identify which failure modes to include in training progression",
                },
                {
                  icon: <TrendingUp className="h-6 w-6 text-zinc-700" />,
                  title: "Policy Debugging",
                  description: "Trace failed policy executions to root causes",
                },
                {
                  icon: <BarChart3 className="h-6 w-6 text-zinc-700" />,
                  title: "Comparative Analysis",
                  description: "Compare failure patterns across scene variations and robot types",
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
                <h2 className="text-3xl font-bold text-zinc-950">Why Labs Choose This</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">10x Faster Debugging</h3>
                  <p className="mt-3 text-zinc-600">
                    Instead of manually reviewing hours of failed episodes, get automatic categorization and root cause identification in minutes.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Smarter Data Curation</h3>
                  <p className="mt-3 text-zinc-600">
                    Understand which failure modes hurt training and which are valuable edge cases. Make informed decisions about data filtering.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Quality Confidence</h3>
                  <p className="mt-3 text-zinc-600">
                    Prove data quality to stakeholders with comprehensive failure statistics and improvement recommendations.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Better Models</h3>
                  <p className="mt-3 text-zinc-600">
                    Clean training data without catastrophic failures leads to more robust learned policies in deployment.
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
              Failure Mode Analysis
            </h2>
            <p className="mt-4 text-xl text-zinc-600">
              Included in Pro, Enterprise, and Foundation tiers
            </p>

            <div className="mt-8">
              <p className="text-sm text-zinc-500 uppercase tracking-wider">
                Standalone Price
              </p>
              <p className="mt-2 text-4xl font-bold text-zinc-950">$12,000</p>
              <p className="mt-2 text-sm text-zinc-600">per dataset</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/contact?analytics=failure-mode-analysis&tier=pro"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Add to Pro Bundle
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/contact?analytics=failure-mode-analysis"
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
