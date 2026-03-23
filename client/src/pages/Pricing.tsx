import { SEO } from "@/components/SEO";
import { InteractiveCard, ScrollReveal, StaggerGroup } from "@/components/motion";
import { simplePricingOptions } from "@/data/simplePricing";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

const buyerPricingOptions = simplePricingOptions.filter((option) => option.id !== "capture");

const pricingHighlights = [
  {
    title: "World model package",
    price: "$2,100 - $3,400",
    detail: "Per site package on the current public catalog.",
  },
  {
    title: "Hosted evaluation",
    price: "$16 - $29",
    detail: "Per session-hour depending on the site.",
  },
  {
    title: "Custom engagement",
    price: "$50,000+",
    detail: "For custom capture, exclusive access, or managed support.",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description="Blueprint pricing for robot teams: site-specific world model packages, hosted evaluations, and custom engagements."
        canonical="/pricing"
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <ScrollReveal>
            <header className="max-w-3xl space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Pricing
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Pricing for robot teams, not the whole marketplace story.
              </h1>
              <p className="text-lg leading-8 text-slate-600">
                Start with the site package or request a hosted evaluation. If the public catalog
                is not enough, Blueprint can scope custom capture, exclusive access, or a managed
                engagement around one real facility.
              </p>
            </header>
          </ScrollReveal>

          <ScrollReveal delay={0.1}>
            <section className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Current public range
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {pricingHighlights.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-2xl border border-slate-200 bg-white p-5"
                  >
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                      {item.price}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                  </article>
                ))}
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal>
            <section className="mt-10">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Options
                </p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">
                  Pick the buying path that matches the work.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  The catalog should make it obvious whether your team needs the package, the
                  hosted path, or a heavier custom engagement.
                </p>
              </div>
            </section>
          </ScrollReveal>

          <StaggerGroup className="mt-6 space-y-4" stagger={0.12}>
            {buyerPricingOptions.map((option) => (
              <InteractiveCard key={option.id} className="overflow-hidden p-0">
                <article className="grid h-full gap-5 p-5 sm:p-6 lg:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {option.step}
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">{option.name}</h2>
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
                        option.id === "world-models"
                          ? "/world-models"
                          : option.id === "simulation"
                            ? "/contact?persona=robot-team&interest=evaluation-package"
                            : "/contact?persona=robot-team&interest=enterprise"
                      }
                      className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      {option.id === "world-models"
                        ? "Browse world models"
                        : option.id === "simulation"
                          ? "Request hosted eval"
                          : "Talk to Blueprint"}
                    </a>
                  </div>
                </article>
              </InteractiveCard>
            ))}
          </StaggerGroup>

          <ScrollReveal>
            <section className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Notes
                </p>
                <h2 className="mt-2 text-xl font-bold text-slate-900">
                  Need a site that is not in the catalog yet?
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Ask about a custom capture or a private engagement. The public pricing page stays
                  focused on the robot-team buying path, but Blueprint can scope custom work when a
                  specific site matters.
                </p>
                <a
                  href="/contact?persona=robot-team&interest=enterprise"
                  className="mt-4 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  Request a custom quote
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </div>
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <ShieldCheck className="h-4 w-4 text-slate-500" />
                Capturer payouts live in the app handoff and do not need to compete with buyer pricing.
              </p>
            </section>
          </ScrollReveal>
        </div>
      </div>
    </>
  );
}
