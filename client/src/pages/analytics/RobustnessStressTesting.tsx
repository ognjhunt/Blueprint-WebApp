import { SEO } from "@/components/SEO";
import { ArrowRight, AlertTriangle, Target, Shield, TrendingDown, CheckCircle2, Zap } from "lucide-react";

export default function RobustnessStressTesting() {
  return (
    <>
      <SEO
        title="Robustness & Stress Testing | Blueprint - De-Risk Real-World Deployment"
        description="Adversarial scenario generation, failure tolerance curves, safety margin analysis. Predict deployment failures before they happen. Reduce real-world incidents by 60%+."
        canonical="/analytics/robustness-stress-testing"
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-rose-700 backdrop-blur-sm">
                <AlertTriangle className="h-4 w-4" />
                Safety & Validation
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-zinc-950">
                Robustness & Stress Testing
              </h1>
              <p className="max-w-2xl text-xl text-zinc-600">
                Systematically test your trained policy against adversarial scenarios, extreme conditions, and edge cases. Generate failure tolerance curves that predict real-world deployment success before robots hit the floor.
              </p>
            </div>

            {/* Impact Metrics */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">60%</div>
                <p className="mt-2 text-sm text-zinc-600">Reduction in deployment failures</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">50+</div>
                <p className="mt-2 text-sm text-zinc-600">Stress test scenarios per policy</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">$500K+</div>
                <p className="mt-2 text-sm text-zinc-600">Saved in avoided hardware damage</p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                href="/contact?analytics=robustness-stress-testing"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Start Testing
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

        {/* Testing Dimensions */}
        <section className="border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-bold text-zinc-950">Five Testing Dimensions</h2>
                <p className="mt-2 text-zinc-600">
                  Comprehensive stress testing across all aspects of policy robustness
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                {[
                  {
                    title: "Physics Perturbations",
                    description: "Test against incorrect/degraded physics models in real world",
                    scenarios: [
                      "±20% friction coefficient variance",
                      "±15% mass distribution error",
                      "±10% damping coefficient variance",
                      "Gravity variations (±0.5 m/s²)",
                      "Unmodeled contact compliance",
                    ],
                  },
                  {
                    title: "Sensor Degradation",
                    description: "Simulate real-world sensor noise and failure modes",
                    scenarios: [
                      "Camera calibration drift",
                      "Depth sensor outliers/holes",
                      "Proprioception sensor bias",
                      "Force sensor saturation",
                      "Communication latency (5-50ms)",
                    ],
                  },
                  {
                    title: "Environmental Variations",
                    description: "Test across out-of-distribution scene configurations",
                    scenarios: [
                      "Unexpected object materials",
                      "Novel object geometries",
                      "Extreme lighting conditions",
                      "Clutter and occlusion",
                      "Surface reflectivity changes",
                    ],
                  },
                  {
                    title: "Control Constraints",
                    description: "Verify policy works under hardware limitations",
                    scenarios: [
                      "Joint velocity limits (±10%)",
                      "Actuator saturation events",
                      "Stiction and backlash",
                      "Control frequency degradation",
                      "Temporal delays (10-100ms)",
                    ],
                  },
                  {
                    title: "Task Distribution Shifts",
                    description: "Test on variations never seen during training",
                    scenarios: [
                      "Object size/shape variations",
                      "Gripper wear simulation",
                      "Object placement extremes",
                      "Task parameter shifts",
                      "Multi-modal failure cases",
                    ],
                  },
                  {
                    title: "Adversarial Scenarios",
                    description: "Worst-case conditions that could cause failure",
                    scenarios: [
                      "Combined perturbations (multi-fault)",
                      "Edge-case object configurations",
                      "Simultaneous sensor failures",
                      "Extreme task variations",
                      "Worst-case trajectory states",
                    ],
                  },
                ].map((dimension, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-zinc-200 bg-white p-6"
                  >
                    <h3 className="font-semibold text-zinc-950">{dimension.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{dimension.description}</p>
                    <ul className="mt-4 space-y-2">
                      {dimension.scenarios.map((scenario, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-zinc-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-rose-600 shrink-0" />
                          {scenario}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Output Metrics */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-12">
            <div>
              <h2 className="text-3xl font-bold text-zinc-950">Test Output Metrics</h2>
              <p className="mt-2 text-zinc-600">
                Quantified failure analysis and safety margins
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {[
                {
                  title: "Failure Tolerance Curves",
                  description: "How policy degrades under increasing stress levels",
                  metrics: [
                    "Success rate vs. perturbation magnitude",
                    "Critical failure threshold (±X% from nominal)",
                    "Graceful degradation profile",
                    "Failure mode identification",
                  ],
                },
                {
                  title: "Safety Margins",
                  description: "Distance to failure in each dimension",
                  metrics: [
                    "Physics parameter safety envelope",
                    "Sensor noise tolerance bounds",
                    "Temporal delay margins (ms)",
                    "Control saturation headroom",
                  ],
                },
                {
                  title: "Risk Stratification",
                  description: "Categorize deployment risk levels",
                  metrics: [
                    "High-risk scenarios (failure likely)",
                    "Medium-risk with mitigation",
                    "Low-risk confident deployment",
                    "Risk score per task variant",
                  ],
                },
                {
                  title: "Confidence Intervals",
                  description: "Statistical bounds on success rates",
                  metrics: [
                    "95% confidence intervals per test",
                    "Minimum sample size for significance",
                    "Statistical power analysis",
                    "Generalization bounds",
                  ],
                },
              ].map((metric, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg border border-zinc-200 bg-white p-2">
                      <Target className="h-6 w-6 text-zinc-700" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-zinc-950">{metric.title}</h3>
                      <p className="mt-1 text-sm text-zinc-600">{metric.description}</p>
                      <ul className="mt-3 space-y-1">
                        {metric.metrics.map((m, i) => (
                          <li key={i} className="text-xs text-zinc-600 flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                            {m}
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
                  Common use cases for robustness testing
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {[
                  {
                    title: "Pre-Deployment Safety",
                    description: "Validate policy safety before real-world trials",
                    example: "Run 50 stress tests before deploying to production robots",
                  },
                  {
                    title: "Hardware Calibration",
                    description: "Identify which real-world deviations matter most",
                    example: "Discover that gripper friction is the limiting factor, focus calibration there",
                  },
                  {
                    title: "Customer Risk Mitigation",
                    description: "Prove safety to enterprise customers and insurance",
                    example: "Provide stress test reports showing 95%+ success under failure modes",
                  },
                  {
                    title: "Iterative Policy Improvement",
                    description: "Target retraining on worst-case scenarios",
                    example: "Identify that policy fails at task extremes, augment training data",
                  },
                ].map((useCase, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-zinc-200 bg-white p-6"
                  >
                    <h3 className="font-semibold text-zinc-950">{useCase.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{useCase.description}</p>
                    <div className="mt-4 rounded-lg bg-rose-50 p-3">
                      <p className="text-xs text-rose-700 font-medium">{useCase.example}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Technical Approach */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-12">
            <div>
              <h2 className="text-3xl font-bold text-zinc-950">How It Works</h2>
              <p className="mt-2 text-zinc-600">
                Systematic stress testing methodology
              </p>
            </div>

            <div className="space-y-6">
              {[
                {
                  step: "1",
                  title: "Perturbation Generation",
                  description: "Create 50+ stress test scenarios varying physics, sensors, and task parameters",
                },
                {
                  step: "2",
                  title: "Policy Evaluation",
                  description: "Run trained policy on each scenario, collect success/failure data",
                },
                {
                  step: "3",
                  title: "Tolerance Analysis",
                  description: "Build failure curves: success rate vs. perturbation magnitude",
                },
                {
                  step: "4",
                  title: "Safety Margin Extraction",
                  description: "Identify maximum safe deviation before policy fails (with confidence bounds)",
                },
                {
                  step: "5",
                  title: "Risk Stratification",
                  description: "Categorize scenarios by risk level and failure mode",
                },
                {
                  step: "6",
                  title: "Deployment Recommendation",
                  description: "Generate pass/fail recommendation with detailed risk report",
                },
              ].map((step, idx) => (
                <div key={idx} className="flex gap-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100">
                    <span className="font-bold text-rose-700">{step.step}</span>
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
                <h2 className="text-3xl font-bold text-zinc-950">Why Robustness Testing Matters</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Avoid Catastrophic Failures</h3>
                  <p className="mt-3 text-zinc-600">
                    Failed real-world trials cost $50K-$500K per incident. Identify failure modes before deployment.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Quantified Safety Margins</h3>
                  <p className="mt-3 text-zinc-600">
                    Know exactly how far from failure you are in each dimension. Plan hardware calibration accordingly.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Insurance & Liability</h3>
                  <p className="mt-3 text-zinc-600">
                    Stress test reports provide regulatory evidence of safety validation for insurance approval.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Targeted Retraining</h3>
                  <p className="mt-3 text-zinc-600">
                    Know exactly which failure modes to address in next iteration. Focus R&D on highest-impact improvements.
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
              Robustness & Stress Testing
            </h2>
            <p className="mt-4 text-xl text-zinc-600">
              Included in Enterprise tier, available as add-on for Professional
            </p>

            <div className="mt-8">
              <p className="text-sm text-zinc-500 uppercase tracking-wider">
                Standalone Price
              </p>
              <p className="mt-2 text-4xl font-bold text-zinc-950">$15,000-$25,000</p>
              <p className="mt-2 text-sm text-zinc-600">per policy evaluation (includes all 50+ test scenarios)</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/contact?analytics=robustness-stress-testing&tier=enterprise"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Add to Enterprise
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/contact?analytics=robustness-stress-testing"
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
