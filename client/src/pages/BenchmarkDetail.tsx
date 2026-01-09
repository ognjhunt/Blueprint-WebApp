import { useEffect, useMemo } from "react";
import { Helmet } from "react-helmet";
import { syntheticDatasets, type SyntheticDataset } from "@/data/content";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Box,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  FileJson,
  Fingerprint,
  Layers,
  Play,
  Send,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";

interface BenchmarkDetailProps {
  params: {
    slug: string;
  };
}

// Sample benchmark results for demonstration
const sampleResults = [
  { policy: "OpenVLA-7B", successRate: 87, avgTime: "12.3s", collisions: 2.1, rank: 1 },
  { policy: "RT-2-X", successRate: 82, avgTime: "14.1s", collisions: 3.4, rank: 2 },
  { policy: "Octo-Base", successRate: 79, avgTime: "11.8s", collisions: 2.8, rank: 3 },
  { policy: "ACT-Small", successRate: 76, avgTime: "10.2s", collisions: 4.1, rank: 4 },
];

// Task categories derived from policy slugs
const getTasksFromPolicy = (policySlugs: string[]) => {
  const taskMap: Record<string, { name: string; tasks: string[]; affordance: string }> = {
    "dexterous-pick-place": {
      name: "Pick & Place",
      tasks: ["pick_object", "place_object", "regrasp", "handover"],
      affordance: "Graspable",
    },
    "articulated-access-validation": {
      name: "Articulated Access",
      tasks: ["open_door", "close_door", "open_drawer", "close_drawer"],
      affordance: "Openable",
    },
    "panel-interaction-suite": {
      name: "Panel Interaction",
      tasks: ["press_button", "turn_knob", "flip_switch", "adjust_dial"],
      affordance: "Pressable / Turnable",
    },
    "mixed-sku-logistics": {
      name: "SKU Logistics",
      tasks: ["sort_items", "stack_pallets", "bin_picking", "inventory_scan"],
      affordance: "Graspable / Stackable",
    },
    "mobile-manipulation": {
      name: "Mobile Manipulation",
      tasks: ["navigate_to", "approach_object", "mobile_pick", "mobile_place"],
      affordance: "Multi-modal",
    },
  };

  return policySlugs.map(slug => taskMap[slug] || {
    name: slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    tasks: ["custom_task_1", "custom_task_2"],
    affordance: "Custom",
  });
};

// Evaluation metrics for all benchmarks
const evaluationMetrics = [
  { metric: "Success Rate", desc: "Task completion percentage across all variations", icon: Target },
  { metric: "Completion Time", desc: "Average steps/time to complete task", icon: Clock },
  { metric: "Collision Count", desc: "Unintended contacts during execution", icon: Zap },
  { metric: "Path Efficiency", desc: "Actual vs optimal trajectory length", icon: TrendingUp },
];

export default function BenchmarkDetail({ params }: BenchmarkDetailProps) {
  // Scroll to top when navigating to this page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const benchmark = syntheticDatasets.find((item) => item.slug === params.slug);

  const formattedReleaseDate = useMemo(() => {
    if (!benchmark) return null;
    return new Intl.DateTimeFormat("en", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(benchmark.releaseDate));
  }, [benchmark]);

  const taskCategories = useMemo(() => {
    if (!benchmark) return [];
    return getTasksFromPolicy(benchmark.policySlugs);
  }, [benchmark]);

  if (!benchmark) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <h1 className="text-3xl font-semibold text-zinc-900">
          Benchmark not found
        </h1>
        <p className="mt-4 text-sm text-zinc-600">
          The benchmark suite you are looking for doesn't exist. Browse available benchmarks or contact us.
        </p>
        <a
          href="/evals"
          className="mt-6 inline-flex rounded-full border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-900"
        >
          Back to Benchmarks
        </a>
      </div>
    );
  }

  const contactUrl = `/contact?request=benchmark&suite=${benchmark.slug}`;

  return (
    <>
      <Helmet>
        <title>{benchmark.title} Benchmark | Blueprint Evaluation</title>
        <meta
          name="description"
          content={`Evaluate your robot policy against the ${benchmark.title} benchmark suite. ${benchmark.sceneCount} scenes, ${benchmark.variationCount} variations, standardized metrics.`}
        />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://tryblueprint.io/benchmarks/${benchmark.slug}`} />
        <meta property="og:title" content={`${benchmark.title} Benchmark | Blueprint`} />
        <meta property="og:description" content={`Submit your policy for standardized evaluation. ${benchmark.description}`} />
        <meta
          property="og:image"
          content={benchmark.heroImage.startsWith("/") ? `https://tryblueprint.io${benchmark.heroImage}` : benchmark.heroImage}
        />
        <link rel="canonical" href={`https://tryblueprint.io/benchmarks/${benchmark.slug}`} />
      </Helmet>

      <div className="mx-auto max-w-6xl space-y-12 px-4 pb-24 pt-16 sm:px-6">
        <a
          href="/evals"
          className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Benchmarks
        </a>

        {/* Hero Section */}
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900 px-3 py-1 text-xs font-semibold text-white">
                <BarChart3 className="h-3 w-3" />
                Benchmark Suite
              </span>
              {benchmark.isNew && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                  <Sparkles className="h-3 w-3" /> New
                </span>
              )}
              {benchmark.isTrending && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                  <TrendingUp className="h-3 w-3" /> Popular
                </span>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">
                {benchmark.locationType}
              </p>
              <h1 className="text-4xl font-semibold text-zinc-900">
                {benchmark.title}
              </h1>
              <p className="text-lg text-zinc-600">{benchmark.description}</p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-zinc-200">
              <img
                src={benchmark.heroImage}
                alt={benchmark.title}
                className="h-full w-full object-cover"
              />
            </div>

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  <Box className="h-4 w-4" /> Scenes
                </div>
                <div className="mt-2 text-2xl font-bold text-zinc-900">
                  {benchmark.sceneCount}
                </div>
                <div className="text-xs text-zinc-500">unique environments</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  <Layers className="h-4 w-4" /> Variations
                </div>
                <div className="mt-2 text-2xl font-bold text-zinc-900">
                  {benchmark.variationCount?.toLocaleString()}
                </div>
                <div className="text-xs text-zinc-500">domain randomization</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  <Play className="h-4 w-4" /> Episodes
                </div>
                <div className="mt-2 text-2xl font-bold text-zinc-900">
                  {benchmark.episodeCount?.toLocaleString()}
                </div>
                <div className="text-xs text-zinc-500">evaluation runs</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  <Calendar className="h-4 w-4" /> Released
                </div>
                <div className="mt-2 text-sm font-medium text-zinc-900">
                  {formattedReleaseDate}
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Tiers Card */}
          <aside className="space-y-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-zinc-900">Choose Your Package</p>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  3 Options
                </span>
              </div>

              {/* Pricing Options */}
              <div className="space-y-2 mb-4">
                {/* Basic: Scene Only */}
                <button
                  type="button"
                  className="w-full rounded-xl border-2 border-zinc-200 p-3 text-left hover:border-emerald-300 hover:bg-emerald-50 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-semibold text-zinc-900 text-sm">Benchmark Suite</span>
                      <p className="text-xs text-zinc-500">Scenes + variations only</p>
                    </div>
                    <span className="font-bold text-zinc-900">${Math.round((benchmark.sceneCount || 1) * 1500).toLocaleString()}</span>
                  </div>
                  <ul className="space-y-1 text-xs text-zinc-600">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span>{benchmark.sceneCount} scenes</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span>{benchmark.variationCount?.toLocaleString()} domain variations</span>
                    </li>
                  </ul>
                </button>

                {/* Standard: Full Evaluation */}
                <button
                  type="button"
                  className="w-full rounded-xl border-2 border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20 p-3 text-left transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900 text-sm">Complete Evaluation</span>
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          POPULAR
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">Suite + policy evaluation runs</p>
                    </div>
                    <span className="font-bold text-emerald-600 text-lg">${Math.round(((benchmark.sceneCount || 1) * 1500) + (benchmark.episodeCount ? Math.floor(benchmark.episodeCount / 1000) * 2000 : 4000)).toLocaleString()}</span>
                  </div>
                  <ul className="space-y-1 text-xs text-zinc-600">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span>Everything in Benchmark Suite</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span>{benchmark.episodeCount?.toLocaleString()} evaluation runs</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span>Standardized metrics & leaderboard</span>
                    </li>
                  </ul>
                </button>

                {/* Premium: Extended Analysis */}
                <button
                  type="button"
                  className="w-full rounded-xl border-2 border-zinc-200 p-3 text-left hover:border-amber-300 hover:bg-amber-50 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-semibold text-zinc-900 text-sm">Premium Analysis</span>
                      <p className="text-xs text-zinc-500">Suite + eval + failure analysis</p>
                    </div>
                    <span className="font-bold text-zinc-900">${Math.round(((benchmark.sceneCount || 1) * 1500) + (benchmark.episodeCount ? Math.floor(benchmark.episodeCount / 1000) * 2000 : 4000) + 5000).toLocaleString()}</span>
                  </div>
                  <ul className="space-y-1 text-xs text-zinc-600">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span>Everything in Complete Evaluation</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span>Detailed failure case analysis</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      <span>Video recordings + recommendations</span>
                    </li>
                  </ul>
                </button>
              </div>

              <a
                href={contactUrl}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
              >
                <Send className="h-4 w-4" />
                Request Your Package
              </a>

              <p className="text-center text-xs text-zinc-500 mt-3">
                We'll discuss your evaluation requirements and custom options
              </p>
            </div>

            {/* Evaluation Methods */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Evaluation Methods
              </p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-indigo-50 p-2">
                    <Cpu className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">GPU-Parallel Simulation</p>
                    <p className="text-xs text-zinc-500">1000+ parallel evaluation runs</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-amber-50 p-2">
                    <FileJson className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">VLM-Based Scoring</p>
                    <p className="text-xs text-zinc-500">Evidence-based task completion</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-emerald-50 p-2">
                    <Fingerprint className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">Affordance-Based Tasks</p>
                    <p className="text-xs text-zinc-500">Standardized interaction types</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Object Tags */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                Object Coverage
              </p>
              <div className="flex flex-wrap gap-2">
                {benchmark.objectTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* Task Categories Section */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-zinc-900">Task Categories</h2>
          <p className="text-zinc-600">
            This benchmark evaluates policies across {taskCategories.length} task categories,
            each with multiple specific tasks derived from object affordances.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {taskCategories.map((category) => (
              <div
                key={category.name}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-zinc-900">{category.name}</h3>
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                    {category.affordance}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {category.tasks.map((task) => (
                    <span
                      key={task}
                      className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600"
                    >
                      {task}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Evaluation Metrics Section */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-zinc-900">Evaluation Metrics</h2>
          <p className="text-zinc-600">
            All policies are evaluated using standardized metrics for fair comparison.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {evaluationMetrics.map((item) => (
              <div
                key={item.metric}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 inline-flex rounded-lg bg-zinc-100 p-2">
                  <item.icon className="h-5 w-5 text-zinc-600" />
                </div>
                <h3 className="font-semibold text-zinc-900">{item.metric}</h3>
                <p className="mt-1 text-sm text-zinc-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sample Results / Leaderboard Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-zinc-900">Sample Results</h2>
              <p className="text-zinc-600">
                Example evaluation results from publicly available policies.
              </p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
              Illustrative data
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-zinc-200">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Rank
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Policy
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Success Rate
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Avg Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Collisions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 bg-white">
                {sampleResults.map((result) => (
                  <tr key={result.policy} className="hover:bg-zinc-50">
                    <td className="px-6 py-4">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        result.rank === 1 ? "bg-amber-100 text-amber-700" :
                        result.rank === 2 ? "bg-zinc-200 text-zinc-700" :
                        result.rank === 3 ? "bg-orange-100 text-orange-700" :
                        "bg-zinc-100 text-zinc-500"
                      }`}>
                        {result.rank}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-zinc-900">
                      {result.policy}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-20 rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${result.successRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-zinc-900">
                          {result.successRate}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">
                      {result.avgTime}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">
                      {result.collisions}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-sm text-zinc-500">
            Submit your policy to see how it compares
          </p>
        </section>

        {/* CTA Section */}
        <section className="rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 sm:p-12 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to evaluate your policy?
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-emerald-100">
            Get standardized benchmark results for your robot policy.
            Compare against baselines and identify areas for improvement.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
            <a
              href={contactUrl}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-4 text-sm font-semibold text-emerald-700 shadow-lg transition hover:bg-emerald-50"
            >
              Submit Policy for Evaluation
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/evals"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-8 py-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              View All Benchmarks
            </a>
          </div>
        </section>
      </div>
    </>
  );
}
