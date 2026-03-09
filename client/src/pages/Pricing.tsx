import { SEO } from "@/components/SEO";
import { getPricingContactInterest, simplePricingOptions } from "@/data/simplePricing";
import { CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";

const billingSteps = [
  "Start with one test.",
  "Add site data only if you need to improve for that exact site.",
  "Use managed adaptation only if you want Blueprint to do the tuning work.",
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description="Simple Blueprint pricing: site operators pay $0, robot teams pay per use for evaluation, site data, or managed adaptation."
        canonical="/pricing"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
          <header className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Simple pricing
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Pay for the job you need.
            </h1>
            <p className="text-lg text-slate-600">
              Site operators pay nothing to list a site. Robot teams pay per use. Most teams start
              with one test, then add more only if they need it.
            </p>
          </header>

          <section className="mt-10 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Sites
              </p>
              <p className="mt-2 text-3xl font-bold text-emerald-950">$0</p>
              <p className="mt-2 text-sm text-emerald-900">
                No listing fee. No default subscription. Operators can open demand without paying
                upfront.
              </p>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Robot teams
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-900">Pay per use</p>
              <p className="mt-2 text-sm text-slate-600">
                No bundle to decode. Pick the one thing you need now: test, data, or tuning.
              </p>
            </article>
          </section>

          <section className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-slate-700" />
              <h2 className="text-2xl font-bold text-slate-900">How to think about it</h2>
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
          </section>

          <section className="mt-10 space-y-4">
            {simplePricingOptions.map((option) => (
              <article
                key={option.id}
                className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 lg:grid-cols-[1.15fr_0.85fr]"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {option.step}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="text-2xl font-bold text-slate-900">{option.name}</h2>
                    <span className="text-sm text-slate-500">({option.internalName})</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{option.summary}</p>
                  <ul className="mt-4 space-y-2">
                    {option.includes.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-sm font-medium text-slate-500">Price</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{option.price}</p>
                  <p className="mt-1 text-sm text-slate-500">{option.unit}</p>
                  <a
                    href={
                      option.id === "evaluation"
                        ? "/deployment-marketplace"
                        : `/contact?interest=${getPricingContactInterest(option.id)}`
                    }
                    className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {option.id === "evaluation" ? "Run a test" : "Talk to sales"}
                  </a>
                </div>
              </article>
            ))}
          </section>

          <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Enterprise only
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Private site terms are custom.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                If a site needs private access, exclusivity, or longer internal-use rights, that is
                a separate enterprise deal. It is not part of the standard pay-per-use path.
              </p>
              <a
                href="/contact?interest=private-twin-buyout"
                className="mt-4 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Discuss private terms
              </a>
            </div>
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              Blueprint hosts the default site asset. Private or higher-control terms are available
              when the engagement needs them.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
