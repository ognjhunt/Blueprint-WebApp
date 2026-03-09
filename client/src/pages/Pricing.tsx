import { SEO } from "@/components/SEO";
import {
  CheckCircle2,
  CreditCard,
  FileSearch,
  RefreshCcw,
  ShieldCheck,
  Wallet,
} from "lucide-react";

const chargeItems = [
  {
    name: "Site Twin License",
    unit: "Entry product",
    description:
      "Blueprint captures, reconstructs, and hosts the site twin by default so teams start from a reusable facility asset instead of a one-off scan.",
    includes: [
      "Hosted twin access and review rights",
      "Scoped facility context for planning and evaluation",
      "Reusable base asset for future packs and refreshes",
    ],
    ctaHref: "/contact?interest=site-twin-license",
    ctaLabel: "Discuss twin access",
    icon: <FileSearch className="h-5 w-5 text-slate-700" />,
  },
  {
    name: "Readiness Pack",
    unit: "Default core SKU",
    description:
      "The default buying motion for robot teams: Blueprint turns the twin into a pre-pilot decision package before travel, floor time, and integration spend start.",
    includes: [
      "Task/workcell scoping and readiness review",
      "Pre-pilot scorecard, safety/integration prep, and risk map",
      "Go / adapt / wait recommendation",
    ],
    ctaHref: "/contact?interest=readiness-pack",
    ctaLabel: "Price the readiness pack",
    icon: <RefreshCcw className="h-5 w-5 text-slate-700" />,
  },
  {
    name: "Adaptation Data Pack",
    unit: "Primary upsell",
    description:
      "For teams that want better site conditioning, Blueprint generates the eval and training artifacts that sit on top of the hosted twin.",
    includes: [
      "Task-scoped render packs and scenario variants",
      "Site-conditioned eval set and training-ready artifacts",
      "Useful for teams training in-house or preparing for managed adaptation later",
    ],
    ctaHref: "/contact?interest=adaptation-data-pack",
    ctaLabel: "Price adaptation data",
    icon: <Wallet className="h-5 w-5 text-slate-700" />,
  },
  {
    name: "Managed Adaptation",
    unit: "Premium service",
    description:
      "Blueprint can run fine-tuning or post-training for supported stacks once the interface, data rights, and evaluation path are clear.",
    includes: [
      "Supported-stack model updates or post-training",
      "Offline regression and evaluation report",
      "Rollout recommendation for the updated artifact",
    ],
    ctaHref: "/contact?interest=managed-adaptation",
    ctaLabel: "Check stack eligibility",
    icon: <RefreshCcw className="h-5 w-5 text-slate-700" />,
  },
  {
    name: "Drift Refresh",
    unit: "Recurring extension",
    description:
      "When the site changes after the first engagement, Blueprint refreshes the twin and regenerates the affected readiness or adaptation artifacts.",
    includes: [
      "Changed-area recapture and site diff",
      "Affected-task analysis and refreshed packs",
      "Recurring value tied to the hosted twin",
    ],
    ctaHref: "/contact?interest=drift-refresh",
    ctaLabel: "Plan a refresh cycle",
    icon: <RefreshCcw className="h-5 w-5 text-slate-700" />,
  },
];

const billingSteps = [
  "Start with the hosted twin and the default readiness pack.",
  "Add adaptation data when the team needs more than a scorecard.",
  "Use managed adaptation or drift refresh only when the stack and site justify it.",
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description="Blueprint sells a product ladder: hosted site twins, readiness packs, adaptation data, managed adaptation, and drift refresh."
        canonical="/pricing"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <header className="space-y-4 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              A product ladder built on the hosted twin.
            </h1>
            <p className="mx-auto max-w-3xl text-lg text-slate-600">
              Site operators still have a $0 default path. Robot teams buy the level of artifact
              depth they need: readiness first, adaptation data second, managed adaptation third.
            </p>
          </header>

          <section className="mt-10 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Who Pays
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">Site Operators: $0</p>
              <p className="mt-2 text-sm text-emerald-800">
                No listing fee, no upfront capture fee, no default subscription.
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Who Pays
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">Robot Teams: Product Ladder</p>
              <p className="mt-2 text-sm text-slate-600">
                Start with the twin and readiness pack, then add adaptation data, managed
                adaptation, or drift refresh when it makes sense.
              </p>
            </article>
          </section>

          <section className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {chargeItems.map((item) => (
              <article key={item.name} className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-2">{item.icon}</div>
                <h2 className="text-xl font-bold text-slate-900">{item.name}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{item.unit}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.description}</p>
                <ul className="mt-4 space-y-2">
                  {item.includes.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href={item.ctaHref}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {item.ctaLabel}
                </a>
              </article>
            ))}
          </section>

          <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-slate-700" />
              <h2 className="text-2xl font-bold text-slate-900">Simple billing controls</h2>
            </div>
            <ol className="space-y-3">
              {billingSteps.map((step, index) => (
                <li key={step} className="flex items-start gap-3 text-slate-700">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              Blueprint owns and hosts the capture by default; private or higher-control terms are
              available for larger engagements.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
