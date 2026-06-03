import { SEO } from "@/components/SEO";
import { humanoidReadinessAssets } from "@/lib/editorialGeneratedAssets";
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  MonitorPlay,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type PricingPlan = {
  icon: LucideIcon;
  name: string;
  range: string;
  bestFor: string;
  includes: string[];
  href: string;
  cta: string;
};

const plans: PricingPlan[] = [
  {
    icon: ClipboardCheck,
    name: "Site/Task Readiness Review",
    range: "$2,100 - $3,400",
    bestFor:
      "Robot teams or site operators deciding whether one exact task deserves pilot time.",
    includes: [
      "One site and task suite",
      "Robot profile and threshold set",
      "Failure modes and missing proof",
      "Pilot recommendation and next data ask",
    ],
    href: "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=pricing-kiss",
    cta: "Request readiness review",
  },
  {
    icon: MonitorPlay,
    name: "Hosted Evaluation",
    range: "$16 - $29 / session-hour",
    bestFor:
      "Teams that want a managed browser room, reruns, observations, and export framing before deeper field work.",
    includes: [
      "Managed hosted review",
      "Scenario reruns and notes",
      "Buyer-room observations",
      "Availability confirmed per request",
    ],
    href: "/contact?persona=robot-team&buyerType=robot_team&interest=hosted-evaluation&path=hosted-evaluation&source=pricing-kiss",
    cta: "Request hosted evaluation",
  },
  {
    icon: Building2,
    name: "Custom Multi-Site Benchmark",
    range: "$50,000+ scoped",
    bestFor:
      "Private, multi-site, vendor-comparison, or operator-heavy work where one review is too narrow.",
    includes: [
      "Capture and benchmark plan",
      "Vendor-neutral comparison",
      "Custom data/eval package",
      "Operator boundaries and commercial scope",
    ],
    href: "/contact?persona=robot-team&buyerType=robot_team&interest=custom-scope&path=world-model&source=pricing-kiss",
    cta: "Request benchmark scope",
  },
];

const choiceRows = [
  {
    title: "Choose readiness review first",
    body: "Use it when the next decision is whether the robot pilot is worth starting at one site.",
  },
  {
    title: "Choose hosted evaluation first",
    body: "Use it when the team needs a managed review room before file handoff or deeper package work.",
  },
  {
    title: "Choose custom benchmark first",
    body: "Use it when multiple sites, vendors, operators, or robot releases need a shared methodology.",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description="Planning ranges for Blueprint site/task readiness reviews, hosted evaluation, and custom multi-site robot deployment readiness benchmarks."
        canonical="/pricing"
        image={`https://tryblueprint.io${humanoidReadinessAssets.hostedDashboard}`}
      />

      <div className="bg-[#f6f1e8] text-[#111110]">
        <section className="relative overflow-hidden bg-[#111110] px-4 py-20 text-white sm:px-6 lg:px-10">
          <img
            src={humanoidReadinessAssets.hostedDashboard}
            alt="Illustrative hosted readiness dashboard"
            className="absolute inset-0 h-full w-full object-cover opacity-32"
          />
          <div className="absolute inset-0 bg-black/68" />
          <div className="relative mx-auto max-w-[88rem]">
            <p className="text-sm font-semibold uppercase tracking-normal text-[#d8bd8d]">
              Pricing
            </p>
            <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-none md:text-7xl">
              Price the readiness question before the pilot.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/78">
              Pick the smallest package that answers the first buyer decision:
              one site/task advisory, a hosted review room, or a private
              multi-site benchmark.
            </p>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[88rem] gap-4 lg:grid-cols-3">
            {plans.map((plan) => {
              const Icon = plan.icon;

              return (
                <article key={plan.name} className="border border-black/10 bg-white p-6 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <Icon className="h-6 w-6 text-[#8b6f42]" aria-hidden="true" />
                    <p className="text-xs font-semibold uppercase tracking-normal text-[#8b6f42]">
                      Planning range
                    </p>
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold leading-tight">
                    {plan.name}
                  </h2>
                  <p className="mt-4 text-3xl font-semibold">{plan.range}</p>
                  <p className="mt-4 text-sm leading-6 text-[#5f5a53]">
                    {plan.bestFor}
                  </p>
                  <ul className="mt-6 space-y-3">
                    {plan.includes.map((item) => (
                      <li key={item} className="flex gap-3 text-sm leading-6 text-[#4f4a43]">
                        <span className="mt-2 h-1.5 w-1.5 flex-none bg-[#8b6f42]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={plan.href}
                    className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 bg-[#111110] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2925]"
                  >
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white px-4 py-14 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[88rem] gap-8 lg:grid-cols-[0.38fr_0.62fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-[#8b6f42]">
                Which should I choose?
              </p>
              <h2 className="mt-3 text-4xl font-semibold leading-tight">
                Start with the decision that blocks field time.
              </h2>
            </div>
            <div className="grid gap-3">
              {choiceRows.map((row) => (
                <article key={row.title} className="border border-black/10 bg-[#f8f4ec] p-5">
                  <h3 className="text-xl font-semibold">{row.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#5f5a53]">{row.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-10">
          <div className="mx-auto grid max-w-[88rem] gap-6 border border-black/10 bg-[#111110] p-6 text-white md:grid-cols-[0.2fr_0.8fr] md:p-8">
            <ShieldCheck className="h-10 w-10 text-[#d8bd8d]" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-normal text-[#d8bd8d]">
                What pricing does not claim
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                A request is not a payment, entitlement, rights clearance, provider run, hosted fulfillment, or deployment verdict.
              </h2>
              <p className="mt-4 max-w-4xl text-sm leading-7 text-white/74">
                Public ranges help buyers plan. Availability, rights, package
                access, Stripe payment state, hosted-session availability,
                simulator traces, action logs, robot trials, safety review, and
                operational readiness are confirmed per site/request by the
                systems that own those facts.
              </p>
              <a
                href="/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=pricing-proof-boundary"
                className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 bg-[#d8bd8d] px-4 text-sm font-semibold text-[#111110] transition hover:bg-[#e8cfa1]"
              >
                Request scoped pricing
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
