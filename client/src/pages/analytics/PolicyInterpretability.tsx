import { SEO } from "@/components/SEO";
import { ArrowRight, Brain, Eye, Layers, BarChart3, CheckCircle2, Lightbulb } from "lucide-react";

export default function PolicyInterpretability() {
  return (
    <>
      <SEO
        title="Policy Interpretability | Blueprint - Explainable AI for Robotics"
        description="Understand what your trained policy is learning. Feature importance, activation heatmaps, decision tree approximations, reward attribution. Explain AI to regulators and customers."
        canonical="/analytics/policy-interpretability"
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-700 backdrop-blur-sm">
                <Lightbulb className="h-4 w-4" />
                Explainable AI
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-zinc-950">
                Policy Interpretability Dashboards
              </h1>
              <p className="max-w-2xl text-xl text-zinc-600">
                Open the black box of trained policies. Generate explainability reports showing exactly what your policy learned, which observations matter most, and why it makes decisions. Build trust with regulators, customers, and boards.
              </p>
            </div>

            {/* Impact Metrics */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">100%</div>
                <p className="mt-2 text-sm text-zinc-600">Explainability coverage (all decisions)</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">8</div>
                <p className="mt-2 text-sm text-zinc-600">Explainability techniques included</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">$7-15K</div>
                <p className="mt-2 text-sm text-zinc-600">Add-on to Professional tier</p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                href="/contact?analytics=policy-interpretability"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Get Explainability Reports
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

        {/* Interpretability Techniques */}
        <section className="border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-bold text-zinc-950">Eight Explainability Techniques</h2>
                <p className="mt-2 text-zinc-600">
                  Multiple perspectives on policy decision-making
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                {[
                  {
                    title: "Feature Importance (SHAP)",
                    description: "Which observations (vision, proprioception, force) most influence each action",
                    details: [
                      "Global feature importance across all episodes",
                      "Per-timestep feature importance",
                      "Feature interaction analysis",
                      "Shapley value decomposition",
                    ],
                  },
                  {
                    title: "Activation Heatmaps",
                    description: "Visualize which policy neurons activate for different task phases",
                    details: [
                      "Neural network layer activations",
                      "Neuron importance scoring",
                      "Task-phase specific activation patterns",
                      "Video overlays of active neurons",
                    ],
                  },
                  {
                    title: "Policy Decision Trees",
                    description: "Approximate policy as human-readable decision trees",
                    details: [
                      "Branching logic for each action dimension",
                      "Threshold identification and explanation",
                      "Tree depth & complexity metrics",
                      "Rule extraction and export",
                    ],
                  },
                  {
                    title: "Reward Attribution",
                    description: "Which reward function terms actually drove learning",
                    details: [
                      "Per-reward-component contribution analysis",
                      "Temporal reward decomposition",
                      "Task-specific reward weighting",
                      "Reward shaping effectiveness metrics",
                    ],
                  },
                  {
                    title: "Attention Maps",
                    description: "Where in the image/state space does the policy focus attention",
                    details: [
                      "Visual attention saliency maps",
                      "Spatial focus regions per task phase",
                      "Temporal attention evolution",
                      "Object-centric attention analysis",
                    ],
                  },
                  {
                    title: "Counterfactual Analysis",
                    description: "What-if scenarios showing policy sensitivity to perturbations",
                    details: [
                      "Observation counterfactuals",
                      "Action counterfactuals (what if we did X?)",
                      "Sensitivity to object position/size",
                      "Robustness to distribution shifts",
                    ],
                  },
                  {
                    title: "Learning Dynamics",
                    description: "How the policy's behavior evolved during training",
                    details: [
                      "Policy changes across training epochs",
                      "Feature importance evolution",
                      "Strategy pivots during training",
                      "Convergence analysis",
                    ],
                  },
                  {
                    title: "Failure Case Analysis",
                    description: "Understand why the policy fails in specific scenarios",
                    details: [
                      "Failure clustering by type",
                      "Decision path to failure",
                      "Explanations for each failure mode",
                      "Correction strategies suggested",
                    ],
                  },
                ].map((technique, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-zinc-200 bg-white p-6"
                  >
                    <h3 className="font-semibold text-zinc-950">{technique.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{technique.description}</p>
                    <ul className="mt-4 space-y-2">
                      {technique.details.map((detail, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-zinc-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Components */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-12">
            <div>
              <h2 className="text-3xl font-bold text-zinc-950">Interactive Dashboards</h2>
              <p className="mt-2 text-zinc-600">
                Comprehensive explainability visualizations
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {[
                {
                  title: "Overview Dashboard",
                  description: "High-level summary of what the policy learned",
                  features: [
                    "Key decision factors",
                    "Feature importance rankings",
                    "Task success distribution",
                    "Episode video with annotations",
                  ],
                },
                {
                  title: "Feature Analysis Dashboard",
                  description: "Deep dive into each observation type",
                  features: [
                    "Vision vs. proprioception importance",
                    "Temporal feature dependencies",
                    "Feature interaction networks",
                    "Sensitivity to specific features",
                  ],
                },
                {
                  title: "Activation Analysis",
                  description: "Neural network internals visualization",
                  features: [
                    "Layer-by-layer activation heatmaps",
                    "Neuron importance network graphs",
                    "Task phase specific patterns",
                    "Bottleneck identification",
                  ],
                },
                {
                  title: "Failure Analysis Dashboard",
                  description: "Understand and fix policy failures",
                  features: [
                    "Failure case clustering",
                    "Decision path tracing to failure",
                    "Root cause suggestions",
                    "Similar successful trajectories comparison",
                  ],
                },
              ].map((dashboard, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg border border-zinc-200 bg-white p-2">
                      <Eye className="h-6 w-6 text-zinc-700" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-zinc-950">{dashboard.title}</h3>
                      <p className="mt-1 text-sm text-zinc-600">{dashboard.description}</p>
                      <ul className="mt-3 space-y-1">
                        {dashboard.features.map((f, i) => (
                          <li key={i} className="text-xs text-zinc-600 flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                            {f}
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
                  Common use cases for policy explainability
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {[
                  {
                    title: "Regulatory Compliance",
                    description: "Explain AI decisions to government and safety boards",
                    example: "Show regulators that policy makes decisions based on gripper feedback, not luck",
                  },
                  {
                    title: "Customer Due Diligence",
                    description: "Prove to enterprise customers how your policy works",
                    example: "Interactive dashboard showing what the robot 'thinks' at each decision point",
                  },
                  {
                    title: "Internal Debugging",
                    description: "Understand why your policy learns unexpected behaviors",
                    example: "Discover policy is using object color as proxy for hardness (wrong!) and fix it",
                  },
                  {
                    title: "Targeted Improvement",
                    description: "Know exactly which training signals to adjust",
                    example: "See that policy ignores force feedback; retrain with higher force weight",
                  },
                ].map((useCase, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-zinc-200 bg-white p-6"
                  >
                    <h3 className="font-semibold text-zinc-950">{useCase.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{useCase.description}</p>
                    <div className="mt-4 rounded-lg bg-amber-50 p-3">
                      <p className="text-xs text-amber-700 font-medium">{useCase.example}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Output Formats */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-12">
            <div>
              <h2 className="text-3xl font-bold text-zinc-950">Report Formats</h2>
              <p className="mt-2 text-zinc-600">
                Multiple ways to share explainability findings
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "Interactive HTML Report",
                  description: "Shareable dashboard with full interactivity",
                  icon: <Eye className="h-6 w-6" />,
                },
                {
                  title: "PDF Executive Summary",
                  description: "1-page summary for board presentations",
                  icon: <BarChart3 className="h-6 w-6" />,
                },
                {
                  title: "Decision Trees (Code)",
                  description: "Human-readable policy approximation in Python/pseudocode",
                  icon: <Brain className="h-6 w-6" />,
                },
                {
                  title: "Video Walkthroughs",
                  description: "Annotated episode videos with feature importance overlays",
                  icon: <Layers className="h-6 w-6" />,
                },
                {
                  title: "JSON Data Export",
                  description: "All explainability metrics in structured format",
                  icon: <CheckCircle2 className="h-6 w-6" />,
                },
                {
                  title: "API Access",
                  description: "Query explainability data programmatically",
                  icon: <Brain className="h-6 w-6" />,
                },
              ].map((format, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 flex flex-col items-center text-center"
                >
                  <div className="rounded-lg border border-zinc-200 bg-white p-3 mb-3">
                    {format.icon}
                  </div>
                  <h3 className="font-semibold text-zinc-950">{format.title}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{format.description}</p>
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
                <h2 className="text-3xl font-bold text-zinc-950">Why Interpretability Matters</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Build Trust</h3>
                  <p className="mt-3 text-zinc-600">
                    Black-box AI scares enterprise customers. Interactive explanations build confidence in your solution.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Regulatory Proof</h3>
                  <p className="mt-3 text-zinc-600">
                    ISO 13849, SOTIF, and other standards increasingly require explainable decision-making.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Faster Debugging</h3>
                  <p className="mt-3 text-zinc-600">
                    See exactly where policies go wrong. Fix the right thing instead of guessing.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Competitive Advantage</h3>
                  <p className="mt-3 text-zinc-600">
                    Most robot teams don't have explainability. Use it to win customer confidence.
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
              Policy Interpretability Dashboards
            </h2>
            <p className="mt-4 text-xl text-zinc-600">
              Available as add-on to Professional and Enterprise tiers
            </p>

            <div className="mt-8">
              <p className="text-sm text-zinc-500 uppercase tracking-wider">
                Standalone Price
              </p>
              <p className="mt-2 text-4xl font-bold text-zinc-950">$7,000-$15,000</p>
              <p className="mt-2 text-sm text-zinc-600">per policy (includes all 8 explainability techniques)</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/contact?analytics=policy-interpretability&tier=professional"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Add to Professional
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/contact?analytics=policy-interpretability"
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
