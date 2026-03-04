import { SEO } from "@/components/SEO";
import { CheckCircle2, CreditCard, FileSearch, RefreshCcw, ShieldCheck, Wallet } from "lucide-react";

const chargeItems = [
  {
    name: "Evaluation Runs",
    unit: "Pay per run",
    description:
      "Run policy evaluations on a site twin and receive a standardized scorecard before any live deployment.",
    includes: [
      "Scenario execution in the exchange workflow",
      "Pass/fail metrics against agreed task criteria",
      "Shareable pre-deployment scorecard output",
    ],
    ctaHref: "/contact?interest=evaluation-runs",
    ctaLabel: "Get evaluation pricing",
    icon: <FileSearch className="h-5 w-5 text-slate-700" />,
  },
  {
    name: "Fine-Tune Cycles",
    unit: "Pay per cycle",
    description:
      "Blueprint runs site-specific fine-tuning or post-training and delivers updated weights for your target deployment site.",
    includes: [
      "Twin-based training data preparation",
      "Site-specific adaptation cycle",
      "Delivery report with performance deltas",
    ],
    ctaHref: "/contact?interest=fine-tune-cycle",
    ctaLabel: "Get fine-tune pricing",
    icon: <RefreshCcw className="h-5 w-5 text-slate-700" />,
  },
  {
    name: "Data License",
    unit: "Pay per site license",
    description:
      "If your team does post-training in-house, license the capture/twin data and train on your own stack.",
    includes: [
      "Licensed access to capture-derived twin data",
      "Defined usage rights for robot training workflows",
      "Optional multi-site license packaging",
    ],
    ctaHref: "/contact?interest=data-license",
    ctaLabel: "Get data license pricing",
    icon: <Wallet className="h-5 w-5 text-slate-700" />,
  },
];

const billingSteps = [
  "Set your team budget and optional monthly cap.",
  "Run evaluations, fine-tune cycles, or license data.",
  "See usage clearly and pay only for what you used.",
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description="Site operators pay $0. Robot teams pay only for evaluations, fine-tuning cycles, or data licenses."
        canonical="/pricing"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <header className="space-y-4 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Sites are free. Robot teams pay only for usage.
            </h1>
            <p className="mx-auto max-w-3xl text-lg text-slate-600">
              Site operators never pay. Blueprint funds capture and owns the capture. Robot teams
              pay only when they run evaluations, request fine-tuning, or license data.
            </p>
          </header>

          <section className="mt-10 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Who Pays
              </p>
              <p className="mt-2 text-2xl font-bold text-emerald-900">Site Operators: $0</p>
              <p className="mt-2 text-sm text-emerald-800">
                No listing fee, no capture fee, no subscription.
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Who Pays
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">Robot Teams: Usage Only</p>
              <p className="mt-2 text-sm text-slate-600">
                Pay only for `Evaluation Runs`, `Fine-Tune Cycles`, and `Data License`.
              </p>
            </article>
          </section>

          <section className="mt-10 grid gap-6 md:grid-cols-3">
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
              Need annual or multi-site terms? We can set a custom commitment.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
