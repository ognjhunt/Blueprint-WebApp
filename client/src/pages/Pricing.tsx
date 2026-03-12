import { SEO } from "@/components/SEO";
import { getPricingContactInterest, simplePricingOptions } from "@/data/simplePricing";
import { CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";

const billingSteps = [
  "Start with a Readiness Pack.",
  "Open qualified sites to robot teams only after qualification.",
  "Use self-serve hosted session hours when you want to test on a real site now.",
  "Buy managed evaluation only when both sides are serious.",
  "Use deployment prep or managed tuning only for selected programs.",
];

const hostedSessionBands = [
  {
    title: "Self-serve hosted session",
    price: "$10 - $30",
    unit: "per session-hour",
    description:
      "This is the meter for opening a site and testing now. Best for robot teams and integrators that already know the robot, task, and outputs they want. Each Site Worlds card carries its own exact self-serve rate inside this band.",
    bullets: [
      "Fast time to first test on a real site",
      "Repeatable policy evaluation without another field visit",
      "Checkpoint comparison and exportable rollout outputs",
    ],
  },
  {
    title: "Managed or priority session",
    price: "$30 - $100",
    unit: "per session-hour",
    description:
      "Use this when you need priority turnaround, custom scenario work, more operator support, or higher-fidelity handling than the self-serve lane. Final pricing is scoped per session inside this band.",
    bullets: [
      "Priority scheduling and hands-on support",
      "Heavier scenario setup and deeper review",
      "Better fit for high-stakes evals and tighter timelines",
    ],
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description="Blueprint pricing starts with qualification, then moves into qualified access, hosted evaluation time, and managed deployment work only when needed."
        canonical="/pricing"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <header className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Simple pricing
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Start with qualification. Add the next layer only when it matters.
            </h1>
            <p className="text-lg text-slate-600">
              Blueprint is not priced like a generic marketplace. The first product is a readiness
              decision. After that, robot teams and integrators can buy access, hosted eval time,
              and higher-touch work only when the site is real and the question is worth answering.
            </p>
          </header>

          <section className="mt-10 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              The ladder
            </p>
            <div className="mt-2 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div>
                <h2 className="text-3xl font-bold text-emerald-950">Readiness first. Marketplace later.</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-900">
                  The business model is simple. Site operators buy qualification. Robot teams pay
                  for access to better opportunities, site-specific eval time, and later technical
                  work only when a site deserves it.
                </p>
                <ul className="mt-4 space-y-2">
                  <li className="flex items-start gap-2 text-sm text-emerald-900">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <span>Qualification gets site operators in</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-emerald-900">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <span>Qualified opportunities monetize robot-team demand</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-emerald-900">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <span>Hosted session hours and managed evaluation are premium follow-ons</span>
                  </li>
                </ul>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-white p-5">
                <p className="text-sm font-medium text-emerald-700">Revenue stack</p>
                <p className="mt-2 text-xl font-bold text-emerald-950">Operator revenue first</p>
                <p className="mt-2 text-sm text-emerald-800">
                  Then exchange access, hosted eval time, and later tuning or licensing.
                </p>
                <a
                  href="/contact?interest=site-qualification"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Start with a Readiness Pack
                </a>
              </div>
            </div>
          </section>

          <section className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
            <div className="mb-6 flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-slate-700" />
              <h2 className="text-2xl font-bold text-slate-900">Who pays?</h2>
            </div>
            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Site operator pays
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">Readiness Pack</p>
                <p className="mt-2 text-sm text-slate-600">
                  If you run the site, you pay first so everyone knows whether the site is worth
                  pursuing.
                </p>
              </div>
              <div className="rounded-2xl border border-indigo-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">
                  Robot team pays
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  Everything after qualification
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  If you want access, hosted eval hours, deeper checks, or managed work, your team
                  pays for that next layer.
                </p>
              </div>
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

          <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Hosted evaluation session fee
              </p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                The session meter starts when your team opens the site and tests.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This is the robot-team lane behind Site Worlds. It is priced like hosted eval time,
                not like a perpetual software seat. Use it when you need a quick answer on a real
                site, a repeatable benchmark, or a few counterfactual runs before spending another
                day in the field.
              </p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {hostedSessionBands.map((band) => (
                <article
                  key={band.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {band.title}
                  </p>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <p className="text-3xl font-bold text-slate-900">{band.price}</p>
                    <p className="pb-1 text-sm text-slate-500">{band.unit}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{band.description}</p>
                  <ul className="mt-4 space-y-2">
                    {band.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-10">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Four packages
              </p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">Extra work only after the site earns it.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Keep the buying motion simple. Start with a readiness decision. Only add the next
                layer when the site and the team are real.
              </p>
            </div>
          </section>

          <section className="mobile-snap-row mt-6 md:block md:space-y-4">
            {simplePricingOptions.map((option) => (
              <article
                key={option.id}
                className="grid h-full gap-5 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 lg:grid-cols-[1.15fr_0.85fr]"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {option.step}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="text-2xl font-bold text-slate-900">{option.name}</h2>
                    <span className="text-sm text-slate-500">({option.internalName})</span>
                  </div>
                  <div className="mt-3 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                    Who pays: {option.payer}
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
                      option.id === "qualified-opportunity"
                        ? "/qualified-opportunities"
                        : `/contact?interest=${getPricingContactInterest(option.id)}`
                    }
                    className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {option.id === "qualified-opportunity" ? "View qualified opportunities" : "Talk to sales"}
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
                If a site needs private access, exclusivity, licensing changes, or long-running
                managed work, that becomes a separate enterprise deal.
              </p>
              <a
                href="/contact?interest=evaluation-package"
                className="mt-4 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Discuss private terms
              </a>
            </div>
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              Private or higher-control terms are available when the engagement needs them.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
