import { SEO } from "@/components/SEO";
import { ArrowRight, BarChart3, TrendingUp, CheckCircle2, Zap, Target } from "lucide-react";

export default function MultiPolicyComparison() {
  return (
    <>
      <SEO
        title="Multi-Policy Comparison | Blueprint - Benchmark Robot Policies Scientifically"
        description="Run policies head-to-head on identical test scenarios. Hyperparameter sensitivity, ablation studies, statistical significance testing. Find the best policy with confidence."
        canonical="/analytics/multi-policy-comparison"
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-emerald-700 backdrop-blur-sm">
                <BarChart3 className="h-4 w-4" />
                Scientific Benchmarking
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-zinc-950">
                Multi-Policy Comparison Benchmarks
              </h1>
              <p className="max-w-2xl text-xl text-zinc-600">
                Systematically compare trained policies on identical test scenarios. Hyperparameter sensitivity analysis, ablation studies, statistical significance testing. Stop guessing which policy is better — prove it scientifically.
              </p>
            </div>

            {/* Impact Metrics */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">95%</div>
                <p className="mt-2 text-sm text-zinc-600">Statistical confidence in comparisons</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">8+</div>
                <p className="mt-2 text-sm text-zinc-600">Comparison dimensions analyzed</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">$5-12K</div>
                <p className="mt-2 text-sm text-zinc-600">Per policy comparison study</p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                href="/contact?analytics=multi-policy-comparison"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Start Comparison
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

        {/* Comparison Types */}
        <section className="border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-bold text-zinc-950">Six Comparison Types</h2>
                <p className="mt-2 text-zinc-600">
                  Multiple perspectives on policy performance
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                {[
                  {
                    title: "Algorithm Comparison",
                    description: "Compare different RL algorithms (PPO vs. SAC vs. DDPG) on identical tasks",
                    analyses: [
                      "Sample efficiency (steps to convergence)",
                      "Final performance level achieved",
                      "Training stability & variance",
                      "Computational requirements",
                      "Ease of hyperparameter tuning",
                    ],
                  },
                  {
                    title: "Hyperparameter Sensitivity",
                    description: "Identify which training parameters matter most for your task",
                    analyses: [
                      "Learning rate sensitivity",
                      "Batch size effects",
                      "Network architecture (depth, width)",
                      "Entropy coefficient impact",
                      "Discount factor (gamma) effects",
                    ],
                  },
                  {
                    title: "Ablation Studies",
                    description: "Measure impact of removing each training component",
                    analyses: [
                      "Reward shaping contribution",
                      "Domain randomization necessity",
                      "Observation preprocessing impact",
                      "Auxiliary task contribution",
                      "Curriculum learning effectiveness",
                    ],
                  },
                  {
                    title: "Architecture Comparison",
                    description: "Test different network designs for your policy",
                    analyses: [
                      "CNN vs. MLP for vision tasks",
                      "Transformer vs. LSTM for temporal reasoning",
                      "Encoder-decoder architectures",
                      "Multi-head attention variants",
                      "Parameter efficiency vs. performance",
                    ],
                  },
                  {
                    title: "Cross-Embodiment Testing",
                    description: "Test policies trained on one robot on different embodiments",
                    analyses: [
                      "Transfer success rates (Panda → UR10)",
                      "Performance degradation across robots",
                      "Morphology sensitivity",
                      "Actionable transfer recommendations",
                      "Multi-robot policy generalization",
                    ],
                  },
                  {
                    title: "Real-World Simulation Gap",
                    description: "Predict real-world performance based on simulation metrics",
                    analyses: [
                      "Sim-to-real success prediction models",
                      "Domain randomization sufficiency",
                      "Transfer probability estimates",
                      "Confidence bounds on deployment success",
                      "Risk mitigation recommendations",
                    ],
                  },
                ].map((compType, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-zinc-200 bg-white p-6"
                  >
                    <h3 className="font-semibold text-zinc-950">{compType.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{compType.description}</p>
                    <ul className="mt-4 space-y-2">
                      {compType.analyses.map((analysis, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-zinc-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
                          {analysis}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Analysis Outputs */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-12">
            <div>
              <h2 className="text-3xl font-bold text-zinc-950">Comparison Deliverables</h2>
              <p className="mt-2 text-zinc-600">
                Comprehensive analysis across multiple performance dimensions
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {[
                {
                  title: "Performance Comparison Report",
                  description: "Head-to-head results on standard benchmarks",
                  metrics: [
                    "Success rate (mean ± std dev)",
                    "Episode return and cumulative reward",
                    "Per-task success breakdown",
                    "Learning efficiency curves",
                    "Statistical significance (p-values)",
                  ],
                },
                {
                  title: "Sensitivity Analysis",
                  description: "Impact of each training hyperparameter",
                  metrics: [
                    "Parameter importance ranking",
                    "Interaction effects (which pairs matter)",
                    "Robustness to parameter changes",
                    "Recommended ranges for each hyperparameter",
                    "Computational cost vs. performance tradeoff",
                  ],
                },
                {
                  title: "Ablation Study Results",
                  description: "Contribution of each training component",
                  metrics: [
                    "Baseline performance",
                    "Performance with each component removed",
                    "Interaction effects between components",
                    "Essential vs. optional components",
                    "Computational savings from ablations",
                  ],
                },
                {
                  title: "Statistical Rigor Report",
                  description: "Confidence that one policy is actually better",
                  metrics: [
                    "95% confidence intervals for all metrics",
                    "Statistical power analysis",
                    "Minimum sample size for significance",
                    "Effect size reporting (Cohen's d)",
                    "Multiple comparison corrections",
                  ],
                },
              ].map((output, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg border border-zinc-200 bg-white p-2">
                      <BarChart3 className="h-6 w-6 text-zinc-700" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-zinc-950">{output.title}</h3>
                      <p className="mt-1 text-sm text-zinc-600">{output.description}</p>
                      <ul className="mt-3 space-y-1">
                        {output.metrics.map((metric, i) => (
                          <li key={i} className="text-xs text-zinc-600 flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                            {metric}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-bold text-zinc-950">Who Benefits</h2>
                <p className="mt-2 text-zinc-600">
                  Common use cases for policy comparison
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {[
                  {
                    title: "Research Paper Submissions",
                    description: "Rigorous comparisons for academic publication",
                    example: "\"Our method achieves 5% improvement (p < 0.01) vs. SOTA baselines\"",
                  },
                  {
                    title: "Internal R&D Decisions",
                    description: "Know which algorithm/hyperparameters to invest in",
                    example: "Compare SAC vs. PPO on your specific task; pick the winner",
                  },
                  {
                    title: "Regulatory Validation",
                    description: "Document robustness through systematic testing",
                    example: "Show regulators that your algorithm is 95%+ reliable across parameter variations",
                  },
                  {
                    title: "Customer Benchmark Suite",
                    description: "Provide objective comparisons for your community",
                    example: "Standard benchmark dataset comparing 10+ robot policies",
                  },
                ].map((useCase, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-zinc-200 bg-white p-6"
                  >
                    <h3 className="font-semibold text-zinc-950">{useCase.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{useCase.description}</p>
                    <div className="mt-4 rounded-lg bg-emerald-50 p-3">
                      <p className="text-xs text-emerald-700 font-medium">{useCase.example}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Methodology */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-12">
            <div>
              <h2 className="text-3xl font-bold text-zinc-950">Comparison Methodology</h2>
              <p className="mt-2 text-zinc-600">
                Rigorous scientific approach to policy evaluation
              </p>
            </div>

            <div className="space-y-6">
              {[
                {
                  step: "1",
                  title: "Test Set Definition",
                  description: "Create fixed test scenarios that all policies evaluate on (fixed seeds for reproducibility)",
                },
                {
                  step: "2",
                  title: "Equal Training Budget",
                  description: "Train all policies with same compute resources, time, and training data",
                },
                {
                  step: "3",
                  title: "Parallel Evaluation",
                  description: "Run all policies through identical test suites simultaneously",
                },
                {
                  step: "4",
                  title: "Metric Computation",
                  description: "Calculate success rates, rewards, and performance metrics with confidence intervals",
                },
                {
                  step: "5",
                  title: "Statistical Testing",
                  description: "Use t-tests, bootstrap resampling to determine if differences are significant",
                },
                {
                  step: "6",
                  title: "Sensitivity Analysis",
                  description: "Vary each hyperparameter independently, measure performance impact",
                },
                {
                  step: "7",
                  title: "Report Generation",
                  description: "Create comprehensive comparison report with visualizations and recommendations",
                },
              ].map((step, idx) => (
                <div key={idx} className="flex gap-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <span className="font-bold text-emerald-700">{step.step}</span>
                  </div>
                  <div className="flex-1 rounded-2xl border border-zinc-200 bg-white p-6">
                    <h3 className="font-semibold text-zinc-950">{step.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{step.description}</p>
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
                <h2 className="text-3xl font-bold text-zinc-950">Why Rigorous Comparison Matters</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Avoid False Positives</h3>
                  <p className="mt-3 text-zinc-600">
                    A 2% improvement could be noise. Statistical testing tells you if it's real.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Objective Decision-Making</h3>
                  <p className="mt-3 text-zinc-600">
                    Stop debating — data-driven comparison removes opinion from algorithm selection.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Publication-Quality Results</h3>
                  <p className="mt-3 text-zinc-600">
                    Meet academic rigor standards for peer review and industry credibility.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Resource Optimization</h3>
                  <p className="mt-3 text-zinc-600">
                    Know which hyperparameters matter; skip tuning parameters that don't affect results.
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
              Multi-Policy Comparison Benchmarks
            </h2>
            <p className="mt-4 text-xl text-zinc-600">
              Available as add-on to Professional and Enterprise tiers
            </p>

            <div className="mt-8">
              <p className="text-sm text-zinc-500 uppercase tracking-wider">
                Standalone Price
              </p>
              <p className="mt-2 text-4xl font-bold text-zinc-950">$5,000-$12,000</p>
              <p className="mt-2 text-sm text-zinc-600">per comparison study (2-5 policies, full analysis)</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/contact?analytics=multi-policy-comparison&tier=professional"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Start Comparison Study
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/contact?analytics=multi-policy-comparison"
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
