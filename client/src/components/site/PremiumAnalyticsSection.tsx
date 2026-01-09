import {
  BarChart3,
  CheckCircle2,
  Cpu,
  Hand,
  TrendingUp,
  Users,
  Zap,
  ArrowRight,
} from "lucide-react";

interface ImpactMetric {
  before: string;
  after: string;
  improvement: string;
}

const analyticsModules = [
  {
    slug: "failure-mode-analysis",
    title: "Failure Mode Analysis",
    description: "Root cause taxonomy and failure detection",
    icon: <BarChart3 className="h-6 w-6 text-zinc-700" />,
    shortBenefit: "10x faster debugging",
    impact: {
      before: "Days of manual failure investigation",
      after: "Automated failure taxonomy & filtering",
      improvement: "10x faster debugging",
    },
  },
  {
    slug: "sim2real-fidelity-matrix",
    title: "Sim-to-Real Fidelity Matrix",
    description: "Physics validation and transfer confidence",
    icon: <Cpu className="h-6 w-6 text-zinc-700" />,
    shortBenefit: "Reduce transfer risk",
    impact: {
      before: "$100K+ in failed real-robot experiments",
      after: "Validated fidelity scores (A-F grades)",
      improvement: "Pre-validate transferability",
    },
  },
  {
    slug: "embodiment-transfer-analysis",
    title: "Embodiment Transfer Analysis",
    description: "Cross-robot compatibility matrix",
    icon: <Users className="h-6 w-6 text-zinc-700" />,
    shortBenefit: "3-5x more value",
    impact: {
      before: "Single-robot dataset utility",
      after: "Multi-robot compatibility matrix",
      improvement: "3-5x dataset value increase",
    },
  },
  {
    slug: "grasp-quality-metrics",
    title: "Grasp Quality Metrics",
    description: "Grasp stability and robustness analysis",
    icon: <Hand className="h-6 w-6 text-zinc-700" />,
    shortBenefit: "Validate grasp robustness",
    impact: {
      before: "Unknown grasp quality",
      after: "Force closure & stability scores",
      improvement: "Confident manipulation training",
    },
  },
  {
    slug: "generalization-curves",
    title: "Generalization & Learning Curves",
    description: "Data efficiency and curriculum learning",
    icon: <TrendingUp className="h-6 w-6 text-zinc-700" />,
    shortBenefit: "Data budget planning",
    impact: {
      before: '"How much data do I need?" unknown',
      after: "Learning curves & data efficiency metrics",
      improvement: "Optimize acquisition budgets",
    },
  },
  {
    slug: "trajectory-optimality",
    title: "Trajectory Optimality Analysis",
    description: "Path quality and efficiency metrics",
    icon: <Zap className="h-6 w-6 text-zinc-700" />,
    shortBenefit: "Trajectory validation",
    impact: {
      before: "Unknown path quality",
      after: "Energy & smoothness analysis",
      improvement: "Identify training inefficiencies",
    },
  },
];

export function PremiumAnalyticsSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <div className="space-y-16">
        {/* Header */}
        <div className="space-y-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-600">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Data Quality Validation
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl">
            Premium Analytics for Robotics Labs
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-zinc-600">
            Transform your raw dataset into an enterprise-grade product. Comprehensive data quality validation modules that answer the questions robotics labs actually ask.
          </p>
        </div>

        {/* Impact Callouts */}
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { metric: "10x", label: "Faster debugging with failure analysis" },
            { metric: "3-5x", label: "More dataset value from cross-robot transfer" },
            { metric: "$100K+", label: "Savings in avoided failed deployments" },
          ].map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-zinc-200 bg-white p-6 text-center"
            >
              <div className="text-4xl font-bold text-zinc-950">{item.metric}</div>
              <p className="mt-2 text-sm text-zinc-600">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Analytics Modules Grid */}
        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-zinc-950">Six Analytics Modules</h3>
          <div className="grid gap-6 lg:grid-cols-2">
            {analyticsModules.map((module) => (
              <div key={module.slug} className="rounded-2xl border border-zinc-200 bg-white p-6">
                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    {module.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-zinc-950">{module.title}</h4>
                    <p className="text-sm text-zinc-600">{module.description}</p>
                  </div>
                </div>

                {/* Impact Comparison */}
                <div className="mt-6 space-y-4 border-t border-zinc-100 pt-6">
                  <div>
                    <p className="text-xs font-semibold uppercase text-zinc-400">Before</p>
                    <p className="mt-1 text-sm text-zinc-600">{module.impact.before}</p>
                  </div>
                  <div className="flex justify-center">
                    <ArrowRight className="h-4 w-4 text-zinc-300" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-zinc-400">After</p>
                    <p className="mt-1 text-sm text-zinc-600">{module.impact.after}</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <p className="text-sm font-semibold text-emerald-900">
                      {module.impact.improvement}
                    </p>
                  </div>
                </div>

                {/* CTA */}
                <a
                  href={`/analytics/${module.slug}`}
                  className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-zinc-900 hover:text-zinc-700"
                >
                  Learn more <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 text-center">
          <h3 className="text-2xl font-semibold text-zinc-950">
            Get All 6 Modules with Premium Analytics Bundle
          </h3>
          <p className="mt-3 text-zinc-600">
            Complete data quality validation suite valued at $80K+ if purchased separately
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a
              href="/contact?analytics=premium-bundle"
              className="inline-flex items-center justify-center rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Get Full Bundle
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <a
              href="/marketplace"
              className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50"
            >
              Browse Individual Modules
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
