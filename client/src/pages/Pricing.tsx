import { SEO } from "@/components/SEO";
import { getPricingContactInterest, simplePricingOptions } from "@/data/simplePricing";
import { CheckCircle2, CreditCard, ShieldCheck } from "lucide-react";

const hostedSessionBands = [
  {
    title: "Self-serve simulation",
    price: "$10 - $30",
    unit: "per session-hour",
    description:
      "Open a world model and test immediately. Best for robot teams that know the robot, task, and outputs they need. Each world model card shows its own exact rate.",
    bullets: [
      "Fast time to first test on a real site",
      "Repeatable policy evaluation without field visits",
      "Checkpoint comparison and exportable rollout outputs",
    ],
  },
  {
    title: "Managed or priority session",
    price: "$30 - $100",
    unit: "per session-hour",
    description:
      "Priority turnaround, custom scenario work, deeper support, or higher-fidelity handling. Final pricing scoped per session.",
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
        description="Blueprint pricing: capturers earn for free, robot teams buy world models and simulation access, enterprise gets custom captures and managed deployment."
        canonical="/pricing"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <header className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Pricing
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              Earn, buy, or partner. Pick your side of the marketplace.
            </h1>
            <p className="text-lg text-slate-600">
              Capturers earn money for free. Robot teams buy world models and simulation access.
              Site operators register their spaces and earn passive revenue. Enterprise gets
              custom captures and managed deployment support.
            </p>
          </header>

          {/* Three-sided overview */}
          <section className="mt-10 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Three-sided marketplace
            </p>
            <div className="mt-2 grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-emerald-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-700">
                  Capturers
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">Earn $20-$60</p>
                <p className="mt-2 text-sm text-slate-600">
                  Per capture session. Most approved captures land around $40. Free to join.
                  Quality bonuses and device multipliers increase your rate.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                  Robot teams
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">Buy world models</p>
                <p className="mt-2 text-sm text-slate-600">
                  $500-$2,000 per model or subscription access. Simulation sessions from
                  $10/hour.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-700">
                  Site operators
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">Earn 15-25%</p>
                <p className="mt-2 text-sm text-slate-600">
                  Revenue share on every world model sold from your facility. Free to register.
                </p>
              </div>
            </div>
          </section>

          {/* Hosted session bands */}
          <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Simulation access
              </p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                Run your robot in real-world environments.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Open a world model and start testing. Priced per session-hour. Use it when you
                need a quick answer on a real site, a repeatable benchmark, or counterfactual
                runs before deployment.
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

          {/* Four tiers */}
          <section className="mt-10">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                All tiers
              </p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">
                From free captures to enterprise contracts.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Start capturing for free or buy a single world model. Scale up to subscription
                access or enterprise-level managed deployment.
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
                      option.id === "capture"
                        ? "/capture"
                        : option.id === "world-models"
                          ? "/world-models"
                          : `/contact?interest=${getPricingContactInterest(option.id)}`
                    }
                    className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {option.id === "capture"
                      ? "Start earning"
                      : option.id === "world-models"
                        ? "Browse world models"
                        : "Talk to sales"}
                  </a>
                </div>
              </article>
            ))}
          </section>

          <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Enterprise
              </p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">
                Need custom captures, exclusive access, or managed deployment?
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Enterprise contracts include on-demand capture requests for specific locations,
                exclusive world model access, managed evaluation, and deployment assistance.
              </p>
              <a
                href="/contact?interest=enterprise"
                className="mt-4 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Talk to us about enterprise
              </a>
            </div>
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              Private or higher-control terms available when the engagement needs them.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
