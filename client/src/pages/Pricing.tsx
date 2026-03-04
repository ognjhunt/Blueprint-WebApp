import { SEO } from "@/components/SEO";
import { CheckCircle2 } from "lucide-react";

const plans = [
  {
    name: "Starter",
    price: "$2,500",
    unit: "one-time per site",
    bestFor: "You need one digital twin fast.",
    includes: [
      "One walkthrough capture",
      "One site digital twin",
      "Basic metadata package",
      "Delivery in about 7 days",
    ],
    ctaLabel: "Start Starter Plan",
    ctaHref: "/contact?tier=starter",
    highlighted: false,
  },
  {
    name: "Deployment Ready",
    price: "$9,000",
    unit: "per site adaptation cycle",
    bestFor: "You want model tuning plus a readiness scorecard.",
    includes: [
      "Everything in Starter",
      "Site-specific model adaptation",
      "Pre-deployment evaluation scorecard",
      "Readout meeting with action plan",
    ],
    ctaLabel: "Start Deployment Ready",
    ctaHref: "/contact?tier=deployment-ready",
    highlighted: true,
  },
  {
    name: "Always Current",
    price: "$1,500",
    unit: "per month per site",
    bestFor: "Your site changes often and needs continuous updates.",
    includes: [
      "Scheduled re-capture cadence",
      "Updated twin versions",
      "Ongoing adaptation refreshes",
      "Priority support",
    ],
    ctaLabel: "Start Always Current",
    ctaHref: "/contact?tier=always-current",
    highlighted: false,
  },
];

const simpleSteps = [
  "Pick a plan.",
  "We capture or update your site.",
  "You get a twin, results, and next steps.",
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description="Simple pricing for site capture, model adaptation, and pre-deployment evaluation."
        canonical="/pricing"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <header className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Simple pricing
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              Three plans. Clear deliverables. No confusing pricing math.
            </p>
          </header>

          <section className="mt-12 grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`rounded-2xl border p-6 ${
                  plan.highlighted
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-900"
                }`}
              >
                <h2 className="text-xl font-bold">{plan.name}</h2>
                <p className={`mt-1 text-sm ${plan.highlighted ? "text-slate-200" : "text-slate-600"}`}>
                  {plan.bestFor}
                </p>

                <div className="mt-5">
                  <p className="text-3xl font-bold">{plan.price}</p>
                  <p className={`text-sm ${plan.highlighted ? "text-slate-300" : "text-slate-500"}`}>
                    {plan.unit}
                  </p>
                </div>

                <ul className="mt-5 space-y-2">
                  {plan.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <CheckCircle2
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          plan.highlighted ? "text-emerald-300" : "text-emerald-600"
                        }`}
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={plan.ctaHref}
                  className={`mt-6 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    plan.highlighted
                      ? "bg-white text-slate-900 hover:bg-slate-100"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  {plan.ctaLabel}
                </a>
              </article>
            ))}
          </section>

          <section className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-2xl font-bold text-slate-900">How it works (super short)</h2>
            <ol className="mt-4 space-y-2 text-slate-700">
              {simpleSteps.map((step, index) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-10 rounded-2xl border border-slate-200 p-6">
            <h2 className="text-2xl font-bold text-slate-900">Need multi-site pricing?</h2>
            <p className="mt-2 text-slate-600">
              If you have many sites, we bundle capture, adaptation, and refresh cycles into one
              enterprise agreement.
            </p>
            <a
              href="/contact?tier=enterprise"
              className="mt-4 inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Talk to sales
            </a>
          </section>
        </div>
      </div>
    </>
  );
}
