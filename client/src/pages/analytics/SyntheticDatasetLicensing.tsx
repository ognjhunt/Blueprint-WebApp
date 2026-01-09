import { SEO } from "@/components/SEO";
import { ArrowRight, Database, Download, Zap, TrendingUp, CheckCircle2, Package } from "lucide-react";

export default function SyntheticDatasetLicensing() {
  return (
    <>
      <SEO
        title="Synthetic Dataset Licensing | Blueprint - AI Training Data at Scale"
        description="Generate and monetize labeled video, trajectory, and action datasets from simulation. Recurring revenue model: $2-10K/month. Includes domain randomization, collision data, and temporal sequences."
        canonical="/analytics/synthetic-dataset-licensing"
      />
      <div className="min-h-screen bg-white">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-8">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50/50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-violet-700 backdrop-blur-sm">
                <Database className="h-4 w-4" />
                Recurring Revenue
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-zinc-950">
                Synthetic Dataset Licensing
              </h1>
              <p className="max-w-2xl text-xl text-zinc-600">
                Generate infinite labeled training data from physics-accurate simulation. License video, trajectory, and force datasets to AI/robotics teams at scale. Transform simulation runs into recurring revenue ($2-10K/month per client).
              </p>
            </div>

            {/* Impact Metrics */}
            <div className="grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">∞</div>
                <p className="mt-2 text-sm text-zinc-600">Labeled samples (no human annotation)</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">10x</div>
                <p className="mt-2 text-sm text-zinc-600">Cheaper than manual data collection</p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
                <div className="text-3xl font-bold text-zinc-950">$2-10K</div>
                <p className="mt-2 text-sm text-zinc-600">Monthly recurring per dataset license</p>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-4 sm:flex-row">
              <a
                href="/contact?analytics=synthetic-dataset-licensing"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Start Licensing Data
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

        {/* Dataset Types */}
        <section className="border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-bold text-zinc-950">What You Can License</h2>
                <p className="mt-2 text-zinc-600">
                  Multiple data types generated from your simulation pipeline
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-2">
                {[
                  {
                    title: "Video Dataset",
                    description: "RGB-D video frames with full metadata: 60fps, resolution control, lighting variation",
                    dataPoints: [
                      "Raw RGB + Depth frames",
                      "Camera intrinsics & extrinsics",
                      "Domain randomization params",
                      "Multi-camera views",
                    ],
                    pricing: "$3-5K/month",
                  },
                  {
                    title: "Trajectory Dataset",
                    description: "Robot actions, states, rewards - everything for imitation or RL pre-training",
                    dataPoints: [
                      "Action sequences (joint angles, EEF pose)",
                      "Observation history (proprioception, vision)",
                      "Reward signals (task-specific)",
                      "Episode metadata (success/fail flags)",
                    ],
                    pricing: "$2-4K/month",
                  },
                  {
                    title: "Contact & Force Data",
                    description: "Tactile and force sensor signals for force-control policy training",
                    dataPoints: [
                      "Contact point clouds",
                      "Force/torque vectors",
                      "Contact state transitions",
                      "Gripper pressure sensors",
                    ],
                    pricing: "$3-6K/month",
                  },
                  {
                    title: "Composite Dataset Bundle",
                    description: "All data types combined with curated filtering and stratified sampling",
                    dataPoints: [
                      "Video + trajectories + forces",
                      "Stratified by task difficulty",
                      "Filtered by quality metrics",
                      "Temporal alignment guaranteed",
                    ],
                    pricing: "$7-10K/month",
                  },
                ].map((dataset, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-zinc-200 bg-white p-6"
                  >
                    <h3 className="font-semibold text-zinc-950">{dataset.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{dataset.description}</p>
                    <ul className="mt-4 space-y-2">
                      {dataset.dataPoints.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-zinc-700">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
                          {point}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-6 rounded-lg bg-violet-50 p-3">
                      <p className="text-sm font-semibold text-violet-900">{dataset.pricing}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Data Quality Features */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="space-y-12">
            <div>
              <h2 className="text-3xl font-bold text-zinc-950">Enterprise Data Features</h2>
              <p className="mt-2 text-zinc-600">
                Production-ready datasets with quality guarantees
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {[
                {
                  title: "Automatic Labeling",
                  description: "Every sample includes rich metadata without manual annotation effort",
                  features: [
                    "Task success/failure labels",
                    "Anomaly detection flags",
                    "Difficulty scores",
                    "Scene/object IDs",
                  ],
                },
                {
                  title: "Stratified Sampling",
                  description: "Control data distribution across difficulty, object type, and task variant",
                  features: [
                    "Balanced class distribution",
                    "Difficulty stratification",
                    "Object type coverage",
                    "Failure mode representation",
                  ],
                },
                {
                  title: "Quality Filters",
                  description: "Remove low-quality samples automatically based on physics and sensor accuracy",
                  features: [
                    "Contact stability checks",
                    "Sensor noise thresholds",
                    "Trajectory smoothness filters",
                    "Physics validity checks",
                  ],
                },
                {
                  title: "Version Control",
                  description: "Track data lineage, domain randomization params, and simulation version",
                  features: [
                    "Data versioning & changelog",
                    "Simulation snapshot tracking",
                    "Reproducible sampling seeds",
                    "Audit trail for compliance",
                  ],
                },
              ].map((feature, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg border border-zinc-200 bg-white p-2">
                      <Database className="h-6 w-6 text-zinc-700" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-zinc-950">{feature.title}</h3>
                      <p className="mt-1 text-sm text-zinc-600">{feature.description}</p>
                      <ul className="mt-3 space-y-1">
                        {feature.features.map((f, i) => (
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
                  Common use cases for synthetic dataset licensing
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {[
                  {
                    title: "Foundation Model Teams",
                    description: "Train multimodal models on diverse manipulation tasks",
                    example: "Train vision foundation models on 1M+ robot interaction frames",
                  },
                  {
                    title: "Imitation Learning Companies",
                    description: "Bootstrap behavioral cloning without real robot data collection",
                    example: "Dataset for 50+ task variants across 5+ robot morphologies",
                  },
                  {
                    title: "Policy Evaluation Services",
                    description: "Benchmark competitors' models on standardized synthetic tasks",
                    example: "Provide common evaluation benchmark dataset to customers",
                  },
                  {
                    title: "Enterprise Robotics",
                    description: "Accelerate internal training with domain-specific synthetic data",
                    example: "Licensing task-specific data for warehouse automation tasks",
                  },
                ].map((useCase, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-zinc-200 bg-white p-6"
                  >
                    <h3 className="font-semibold text-zinc-950">{useCase.title}</h3>
                    <p className="mt-2 text-sm text-zinc-600">{useCase.description}</p>
                    <div className="mt-4 rounded-lg bg-violet-50 p-3">
                      <p className="text-xs text-violet-700 font-medium">{useCase.example}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Business Model */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="rounded-3xl border border-zinc-200 bg-white p-12">
            <h2 className="text-3xl font-bold text-zinc-950 mb-6">Recurring Revenue Model</h2>
            <div className="grid gap-8 md:grid-cols-3">
              <div>
                <div className="text-sm font-semibold uppercase text-zinc-500 mb-3">Tier 1: Single Dataset</div>
                <div className="text-3xl font-bold text-zinc-950 mb-4">$2-4K</div>
                <ul className="space-y-2 text-sm text-zinc-600">
                  <li>✓ 100K samples/month</li>
                  <li>✓ 1 data type (video OR trajectory OR forces)</li>
                  <li>✓ 1 task configuration</li>
                  <li>✓ Delivered as cloud storage links</li>
                  <li>✓ Monthly updates</li>
                </ul>
              </div>
              <div className="rounded-2xl border-2 border-violet-600 bg-violet-50 p-8">
                <div className="text-sm font-semibold uppercase text-violet-700 mb-3">Tier 2: Multi-Type (Popular)</div>
                <div className="text-3xl font-bold text-violet-950 mb-4">$5-7K</div>
                <ul className="space-y-2 text-sm text-violet-900">
                  <li>✓ 250K samples/month</li>
                  <li>✓ All data types included</li>
                  <li>✓ Up to 3 task variants</li>
                  <li>✓ API access + batch download</li>
                  <li>✓ Monthly + on-demand updates</li>
                  <li className="font-semibold">✓ Most popular option</li>
                </ul>
              </div>
              <div>
                <div className="text-sm font-semibold uppercase text-zinc-500 mb-3">Tier 3: Enterprise</div>
                <div className="text-3xl font-bold text-zinc-950 mb-4">$8-10K+</div>
                <ul className="space-y-2 text-sm text-zinc-600">
                  <li>✓ Unlimited samples</li>
                  <li>✓ Custom domain randomization</li>
                  <li>✓ Unlimited task configurations</li>
                  <li>✓ Dedicated API infrastructure</li>
                  <li>✓ Real-time data streaming</li>
                  <li>✓ Custom data pipelines</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Value Props */}
        <section className="border-t border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="space-y-12">
              <div>
                <h2 className="text-3xl font-bold text-zinc-950">Why Synthetic Datasets Win</h2>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Infinite Diversity</h3>
                  <p className="mt-3 text-zinc-600">
                    Generate millions of unique scenes with object variations, lighting, physics randomization - no manual annotation needed.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Cost-Effective at Scale</h3>
                  <p className="mt-3 text-zinc-600">
                    Cost per labeled sample drops to pennies at volume, vs. $50-$100 per manually labeled sample.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-8">
                  <h3 className="text-lg font-semibold text-zinc-950">Reproducible & Versioned</h3>
                  <p className="mt-3 text-zinc-600">
                    Every sample is fully versioned - know exactly which simulation parameters generated each frame.
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p=8">
                  <h3 className="text-lg font-semibold text-zinc-950">Recurring Revenue</h3>
                  <p className="mt-3 text-zinc-600">
                    Monthly subscription model means predictable, growing revenue per customer ($2-10K/month per dataset).
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
              Synthetic Dataset Licensing
            </h2>
            <p className="mt-4 text-xl text-zinc-600">
              Included in Professional and Enterprise tiers
            </p>

            <div className="mt-8">
              <p className="text-sm text-zinc-500 uppercase tracking-wider">
                Base Price (Monthly Recurring)
              </p>
              <p className="mt-2 text-4xl font-bold text-zinc-950">$2-10K</p>
              <p className="mt-2 text-sm text-zinc-600">per dataset tier, billed monthly</p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/contact?analytics=synthetic-dataset-licensing&tier=professional"
                className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-8 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Start with Multi-Type Tier
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <a
                href="/contact?analytics=synthetic-dataset-licensing"
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
