import { SEO } from "@/components/SEO";
import {
  ArrowRight,
  Beaker,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Home,
  Package,
  Send,
  ShoppingCart,
  Sparkles,
  Truck,
  Upload,
  Warehouse,
  Wrench,
} from "lucide-react";

// --- Task Categories (inspired by BEHAVIOR benchmark) ---

const taskCategories = [
  {
    name: "Pick & Place",
    icon: <Package className="h-5 w-5" />,
    color: "indigo",
    examples: [
      "Picking up objects",
      "Placing items on shelves",
      "Sorting items into bins",
      "Stacking boxes",
    ],
  },
  {
    name: "Open & Close",
    icon: <Home className="h-5 w-5" />,
    color: "emerald",
    examples: [
      "Opening doors",
      "Closing drawers",
      "Lifting lids",
      "Operating cabinets",
    ],
  },
  {
    name: "Kitchen Tasks",
    icon: <ChefHat className="h-5 w-5" />,
    color: "amber",
    examples: [
      "Clearing dishes",
      "Loading dishwasher",
      "Organizing utensils",
      "Putting away groceries",
    ],
  },
  {
    name: "Logistics",
    icon: <Truck className="h-5 w-5" />,
    color: "rose",
    examples: [
      "Moving boxes",
      "Restocking shelves",
      "Pallet handling",
      "Inventory sorting",
    ],
  },
  {
    name: "Retail",
    icon: <ShoppingCart className="h-5 w-5" />,
    color: "violet",
    examples: [
      "Shelf restocking",
      "Product facing",
      "Inventory counts",
      "Cart organization",
    ],
  },
  {
    name: "Assembly",
    icon: <Wrench className="h-5 w-5" />,
    color: "cyan",
    examples: [
      "Part insertion",
      "Component alignment",
      "Tool handling",
      "Precision placement",
    ],
  },
];

// --- How It Works Steps ---

const howItWorksSteps = [
  {
    step: "1",
    title: "Send us your policy",
    desc: "Upload your robot policy (any format: PyTorch, ONNX, or API endpoint).",
    icon: <Upload className="h-6 w-6" />,
  },
  {
    step: "2",
    title: "We run evaluations",
    desc: "Your policy runs through our reserved benchmark scenes with standardized tasks.",
    icon: <Beaker className="h-6 w-6" />,
  },
  {
    step: "3",
    title: "Get your results",
    desc: "Receive detailed metrics: success rate, completion time, and failure analysis.",
    icon: <ClipboardList className="h-6 w-6" />,
  },
];

// --- Scene Types ---

const sceneTypes = [
  {
    name: "Kitchens",
    desc: "Commercial prep stations, dishpits, and service areas",
    icon: <ChefHat className="h-5 w-5" />,
  },
  {
    name: "Warehouses",
    desc: "Fulfillment centers, storage racks, and loading docks",
    icon: <Warehouse className="h-5 w-5" />,
  },
  {
    name: "Retail",
    desc: "Grocery aisles, stockrooms, and checkout areas",
    icon: <ShoppingCart className="h-5 w-5" />,
  },
  {
    name: "Homes",
    desc: "Living rooms, bedrooms, and household environments",
    icon: <Home className="h-5 w-5" />,
  },
];

// --- Visual Helpers ---

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern-evals"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        strokeWidth={0}
        fill="url(#grid-pattern-evals)"
      />
    </svg>
  );
}

// --- Main Component ---

export default function Evals() {
  return (
    <>
      <SEO
        title="Evaluations | Test Your Robot Policy"
        description="Submit your robot policy for standardized evaluation. We test on reserved benchmark scenes with real-world tasks like pick & place, opening doors, and kitchen operations."
        canonical="/evals"
      />
      <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-emerald-100 selection:text-emerald-900">
        <DotPattern />

        <div className="mx-auto max-w-5xl px-4 pb-24 pt-16 sm:px-6 lg:px-8">
          {/* --- Hero Section --- */}
          <header className="mb-20 text-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/50 px-4 py-1.5 text-sm font-medium text-emerald-700">
                <Sparkles className="h-4 w-4" />
                Policy Evaluation Service
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
                Test your robot on
                <br />
                <span className="text-emerald-600">real-world tasks</span>
              </h1>

              <p className="mx-auto max-w-2xl text-lg text-zinc-600">
                Send us your policy. We'll run it through our{" "}
                <strong>reserved benchmark scenes</strong> — environments we
                don't sell as data — and tell you how it performs on tasks like
                picking objects, opening doors, and organizing spaces.
              </p>

              <div className="flex flex-col gap-4 sm:flex-row sm:justify-center pt-4">
                <a
                  href="/contact?request=evaluation"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:bg-emerald-700"
                >
                  Request an Evaluation
                  <Send className="h-5 w-5" />
                </a>
              </div>
            </div>
          </header>

          <div className="space-y-24">
            {/* --- What Makes This Different --- */}
            <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/50 to-white p-8 sm:p-10">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                  Why evaluate with Blueprint?
                </h2>
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                <div className="text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Beaker className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-zinc-900">Reserved Scenes</h3>
                  <p className="text-sm text-zinc-600">
                    Our benchmark environments aren't sold as training data — no
                    risk of overfitting to our test set.
                  </p>
                </div>
                <div className="text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <ClipboardList className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-zinc-900">Standardized Tasks</h3>
                  <p className="text-sm text-zinc-600">
                    Compare your policy against others using the same tasks,
                    metrics, and success criteria.
                  </p>
                </div>
                <div className="text-center space-y-3">
                  <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold text-zinc-900">Actionable Results</h3>
                  <p className="text-sm text-zinc-600">
                    Get detailed metrics and failure analysis to understand
                    where your policy struggles.
                  </p>
                </div>
              </div>
            </section>

            {/* --- How It Works --- */}
            <section>
              <div className="text-center mb-10">
                <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                  How it works
                </h2>
                <p className="mt-3 text-zinc-600">
                  Three simple steps to benchmark your robot policy.
                </p>
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                {howItWorksSteps.map((step) => (
                  <div
                    key={step.step}
                    className="relative rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                  >
                    <div className="absolute -top-4 left-6 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                      {step.step}
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="text-emerald-600">{step.icon}</div>
                      <h3 className="font-semibold text-zinc-900">{step.title}</h3>
                      <p className="text-sm text-zinc-600">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* --- What We Can Evaluate --- */}
            <section>
              <div className="text-center mb-10">
                <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                  Tasks we can evaluate
                </h2>
                <p className="mt-3 text-zinc-600 max-w-2xl mx-auto">
                  Our benchmark suite covers common robotics tasks inspired by
                  real-world applications. Similar to the{" "}
                  <a
                    href="https://behavior.stanford.edu/challenge/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:underline"
                  >
                    BEHAVIOR benchmark
                  </a>
                  , we test practical skills robots need in homes, kitchens,
                  warehouses, and retail environments.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {taskCategories.map((category) => (
                  <div
                    key={category.name}
                    className={`rounded-2xl border p-6 bg-white transition-shadow hover:shadow-md ${
                      category.color === "indigo"
                        ? "border-indigo-100 hover:border-indigo-200"
                        : category.color === "emerald"
                          ? "border-emerald-100 hover:border-emerald-200"
                          : category.color === "amber"
                            ? "border-amber-100 hover:border-amber-200"
                            : category.color === "rose"
                              ? "border-rose-100 hover:border-rose-200"
                              : category.color === "violet"
                                ? "border-violet-100 hover:border-violet-200"
                                : "border-cyan-100 hover:border-cyan-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={`rounded-lg p-2 ${
                          category.color === "indigo"
                            ? "bg-indigo-100 text-indigo-600"
                            : category.color === "emerald"
                              ? "bg-emerald-100 text-emerald-600"
                              : category.color === "amber"
                                ? "bg-amber-100 text-amber-600"
                                : category.color === "rose"
                                  ? "bg-rose-100 text-rose-600"
                                  : category.color === "violet"
                                    ? "bg-violet-100 text-violet-600"
                                    : "bg-cyan-100 text-cyan-600"
                        }`}
                      >
                        {category.icon}
                      </div>
                      <h3 className="font-semibold text-zinc-900">
                        {category.name}
                      </h3>
                    </div>
                    <ul className="space-y-2">
                      {category.examples.map((example) => (
                        <li
                          key={example}
                          className="flex items-center gap-2 text-sm text-zinc-600"
                        >
                          <CheckCircle2 className="h-4 w-4 text-zinc-300 shrink-0" />
                          {example}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* --- Available Scene Types --- */}
            <section className="rounded-3xl bg-zinc-900 p-8 sm:p-10 text-white">
              <div className="text-center mb-10">
                <h2 className="text-2xl font-bold sm:text-3xl">
                  Benchmark environments
                </h2>
                <p className="mt-3 text-zinc-400 max-w-xl mx-auto">
                  Our reserved evaluation scenes span multiple domains. These
                  environments are exclusively for benchmarking — we don't sell
                  them as training data.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {sceneTypes.map((scene) => (
                  <div
                    key={scene.name}
                    className="rounded-xl bg-white/5 p-5 ring-1 ring-white/10"
                  >
                    <div className="mb-3 text-emerald-400">{scene.icon}</div>
                    <h3 className="font-semibold text-white">{scene.name}</h3>
                    <p className="mt-1 text-sm text-zinc-400">{scene.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* --- What You Get --- */}
            <section>
              <div className="text-center mb-10">
                <h2 className="text-2xl font-bold text-zinc-900 sm:text-3xl">
                  What you'll receive
                </h2>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
                <div className="grid gap-8 sm:grid-cols-2">
                  <div>
                    <h3 className="font-semibold text-zinc-900 mb-4">
                      Metrics Report
                    </h3>
                    <ul className="space-y-3">
                      {[
                        "Success rate across all tasks",
                        "Average completion time",
                        "Collision count and types",
                        "Path efficiency scores",
                        "Per-task breakdown",
                      ].map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-3 text-sm text-zinc-600"
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-900 mb-4">
                      Failure Analysis
                    </h3>
                    <ul className="space-y-3">
                      {[
                        "Where your policy failed and why",
                        "Video recordings of failure cases",
                        "Comparison to baseline policies",
                        "Recommendations for improvement",
                        "Raw data export (optional)",
                      ].map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-3 text-sm text-zinc-600"
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* --- CTA Section --- */}
            <section className="rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 sm:p-12 text-center shadow-xl">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">
                Ready to evaluate your policy?
              </h2>
              <p className="mt-4 max-w-xl mx-auto text-emerald-100">
                Tell us about your robot and policy. We'll set up a custom
                evaluation plan and get you results within days.
              </p>

              <div className="mt-8">
                <a
                  href="/contact?request=evaluation"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-emerald-700 shadow-lg transition hover:bg-emerald-50"
                >
                  Request an Evaluation
                  <ArrowRight className="h-5 w-5" />
                </a>
              </div>

              <p className="mt-6 text-sm text-emerald-200">
                Questions?{" "}
                <a href="/contact" className="underline hover:text-white">
                  Contact us
                </a>{" "}
                to learn more.
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
