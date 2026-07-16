import { SEO } from "@/components/SEO";
import {
  Button,
  Eyebrow,
  ProofBoundary,
  StatusChip,
} from "@/components/blueprint";
import {
  EditorialCtaBand,
  EditorialFaq,
  EditorialSectionIntro,
  MonochromeMedia,
  ProofChip,
} from "@/components/site/editorial";
import { TileGrid } from "@/components/site/TileGrid";
import { ArrowRight, Check } from "lucide-react";

type Tier = {
  name: string;
  price: string;
  unit: string;
  tagline: string;
  features: string[];
  note: string;
  cta: string;
  href: string;
  highlighted?: boolean;
};

const tiers: Tier[] = [
  {
    name: "Quick-look eval",
    price: "$5–8k",
    unit: "/ eval",
    tagline: "A low-friction first comparison before any subscription decision.",
    features: [
      "~50 episodes on one packaged site",
      "1–2 policies or checkpoints",
      "Ranking-only report",
      "Review-support media included",
    ],
    note: "Failure taxonomy and calibration stay in subscription scope.",
    cta: "Request a quick-look",
    href: "/contact?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&requestedOutputs=Quick-Look%20Eval&episodeCount=50&source=pricing",
  },
  {
    name: "Robot-team subscription",
    price: "$15k",
    unit: "/ mo",
    tagline: "Recurring comparison infrastructure for active policy development.",
    features: [
      "Compare team, checkpoint, and vendor policies",
      "Unlimited eval cycles up to policy cap",
      "Failure taxonomy and regression tracking",
      "Overage pricing above the cap",
      "Priority capture and recapture routing",
    ],
    note: "Overage pricing applies above the agreed policy cap.",
    cta: "Start a subscription",
    href: "/contact?persona=robot-team&buyerType=robot_team&interest=policy-evaluation-run&requestedOutputs=Robot%20Team%20Subscription&source=pricing",
    highlighted: true,
  },
  {
    name: "Site supply",
    price: "$5k",
    unit: "/ site",
    tagline: "A supply-side path for operators with useful sites to make available.",
    features: [
      "Facility, access, and privacy review",
      "Capture and commercialization posture",
      "Rights packet drafted with the operator",
      "Payout terms set before any buyer use",
    ],
    note: "No deployment or rights guarantee until the site is reviewed.",
    cta: "Start a site review",
    href: "/contact/site-operator?buyerType=site_operator&requestedOutputs=Site%20Supply%20Review&source=pricing",
  },
  {
    name: "Site monitoring",
    price: "$30–40k",
    unit: "/ site / yr",
    tagline: "Annual monitoring when a site needs repeated policy-update checks.",
    features: [
      "Multiple scoped checks up to annual cap",
      "Internal-team and vendor comparisons",
      "Per-site report card for change management",
      "Lower per-check price than one-off evals",
    ],
    note: "Still bounded to the reviewed site, task, and access scope.",
    cta: "Discuss monitoring",
    href: "/contact/site-operator?buyerType=site_operator&requestedOutputs=Site%20Monitoring%20Subscription&source=pricing",
  },
];

type AddOn = {
  name: string;
  meter: string;
  body: string;
};

const addOns: AddOn[] = [
  {
    name: "Per-task deep probe (PTDP)",
    meter: "per_task · +$2.5k",
    body: "An expanded probe on a single Task Card — more episodes and scenario variations to harden the ranking on the cases that matter most.",
  },
  {
    name: "Hosted review session",
    meter: "per_session · +$1.2k",
    body: "A guided walk through a run's rank-fidelity output, failure clusters, and review media with the Blueprint evaluation team.",
  },
  {
    name: "Generated media pack",
    meter: "per_pack · +$800",
    body: "Rendered support clips that help reviewers reason about a run. Always labeled as review support, never as real-world proof of an outcome.",
  },
  {
    name: "Validated data package",
    meter: "per_export · +$3k",
    body: "An export-ready data package with provenance, rights packet, and coverage flags attached, scoped to your access window.",
  },
];

const faqItems = [
  {
    question: "Why is the subscription the primary tier?",
    answer:
      "Most value shows up when comparing policies is part of the development loop, not a one-off. Quick-look evals and single-site reviews exist as the ramp into the subscription, where regression tracking and failure taxonomy live.",
  },
  {
    question: "What exactly am I paying for in an eval?",
    answer:
      "A rank-fidelity comparison of policies against a real captured site — episode runs, failure clusters, and review media. It is an estimate of relative readiness, not a guarantee of field success or a deployment-ready claim.",
  },
  {
    question: "How does site supply pricing work?",
    answer:
      "Operators start with a $5k supply review covering facility, access, privacy, and commercialization posture. Rights and payout terms are confirmed before any robot-team use. Monitoring is a separate, recurring option.",
  },
  {
    question: "Is generated media ever counted as proof?",
    answer:
      "No. Generated and simulated media are review support only and are always labeled as such. The raw capture is the single source of ground truth across every tier and add-on.",
  },
  {
    question: "Are episode counts and prices fixed?",
    answer:
      "The figures here are illustrative ranges. Final episode counts, policy caps, and pricing are set per engagement against the reviewed site, task, robot profile, and access scope.",
  },
  {
    question: "What happens after an eval?",
    answer:
      "Every run ends in an actionable decision: export the data package, request a recapture, narrow the scenario, or move toward a field pilot — with the proof boundary attached.",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description="Priced as evaluation infrastructure: quick-look evals, a robot-team subscription, site supply reviews, and yearly site monitoring — bounded to the reviewed site, task, and access scope."
        canonical="/pricing"
      />

      {/* Hero */}
      <section className="bg-canvas">
        <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:px-10 lg:py-24">
          <div>
            <Eyebrow tone="brass" rule>
              Pricing
            </Eyebrow>
            <h1 className="mt-5 font-display text-[clamp(2.6rem,5vw,4.4rem)] font-medium leading-[1.02] tracking-[-0.045em] text-ink-900">
              Priced as evaluation infrastructure.
            </h1>
            <p className="mt-5 max-w-[34rem] text-[1.05rem] leading-[1.7] text-ink-500">
              Robot teams subscribe when comparing policies becomes part of the
              development loop. Quick-look evals and single-site reviews are the ramp in.
              Operators start with a supply review and add monitoring only when a site
              needs repeated checks.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <ProofChip>Capture-backed comparisons</ProofChip>
              <ProofChip>Rank fidelity, not guarantees</ProofChip>
              <ProofChip>Scope-bounded access</ProofChip>
            </div>
          </div>
          <MonochromeMedia
            src="/redesign/pov/factory-conveyor.jpg"
            alt="Factory conveyor line"
            loading="eager"
            radius="lg"
            overlay="soft"
            className="aspect-[16/11] w-full border border-line"
          />
        </div>
      </section>

      {/* Tiers */}
      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <EditorialSectionIntro
            eyebrow="Tiers"
            title="Four ways to engage."
            description="One subscription for active robot teams, plus lighter on-ramps and the operator supply path. All figures are illustrative ranges, set per engagement."
          />

          <TileGrid cols={4} className="mt-12 rounded-lg">
            {tiers.map((tier) => {
              const onInk = tier.highlighted;
              return (
                <article
                  key={tier.name}
                  className={
                    onInk
                      ? "flex h-full flex-col bg-ink p-6 text-[color:var(--text-on-ink)]"
                      : "flex h-full flex-col bg-white p-6"
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <Eyebrow tone={onInk ? "onInk" : "muted"}>Tier</Eyebrow>
                    {onInk ? (
                      <StatusChip
                        tone="ink"
                        square
                        dot={false}
                        className="border-brass/50 bg-transparent text-brass"
                      >
                        Primary
                      </StatusChip>
                    ) : null}
                  </div>

                  <h3
                    className={
                      onInk
                        ? "mt-5 text-title-m font-semibold tracking-tight text-[color:var(--text-on-ink)]"
                        : "mt-5 text-title-m font-semibold tracking-tight text-ink-900"
                    }
                  >
                    {tier.name}
                  </h3>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span
                      className={
                        onInk
                          ? "font-mono text-[2rem] font-medium leading-none tracking-[-0.02em] text-[color:var(--text-on-ink)]"
                          : "font-mono text-[2rem] font-medium leading-none tracking-[-0.02em] text-ink-900"
                      }
                    >
                      {tier.price}
                    </span>
                    <span
                      className={
                        onInk
                          ? "font-mono text-[0.9rem] text-ink-300"
                          : "font-mono text-[0.9rem] text-ink-400"
                      }
                    >
                      {tier.unit}
                    </span>
                  </div>

                  <p
                    className={
                      onInk
                        ? "mt-4 text-sm leading-[1.6] text-[color:var(--text-on-ink)] opacity-80"
                        : "mt-4 text-sm leading-[1.6] text-ink-500"
                    }
                  >
                    {tier.tagline}
                  </p>

                  <ul className="mt-5 flex flex-col gap-2.5">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-brass"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        <span
                          className={
                            onInk
                              ? "text-[13px] leading-[1.5] text-[color:var(--text-on-ink)] opacity-90"
                              : "text-[13px] leading-[1.5] text-ink-700"
                          }
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <p
                    className={
                      onInk
                        ? "mt-5 border-t border-white/10 pt-4 text-[12px] leading-[1.5] text-ink-300"
                        : "mt-5 border-t border-line-soft pt-4 text-[12px] leading-[1.5] text-ink-400"
                    }
                  >
                    {tier.note}
                  </p>

                  <div className="mt-auto pt-6">
                    <Button
                      asChild
                      variant={onInk ? "brass" : "secondary"}
                      size="md"
                      full
                    >
                      <a href={tier.href}>
                        {tier.cta}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </a>
                    </Button>
                  </div>
                </article>
              );
            })}
          </TileGrid>
        </div>
      </section>

      {/* Add-ons */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <EditorialSectionIntro
            eyebrow="Add-ons"
            title="Extend a run when you need more depth."
            description="Optional units layered onto any tier. Each is metered and priced per use, with the proof boundary intact."
          />

          <TileGrid cols={2} className="mt-12">
            {addOns.map((addOn) => (
              <div key={addOn.name} className="flex h-full flex-col gap-3 bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-title-m font-semibold tracking-tight text-ink-900">
                    {addOn.name}
                  </h3>
                  <span className="inline-flex items-center gap-2 border border-line bg-inset px-[0.6rem] py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-600">
                    <span
                      aria-hidden="true"
                      className="h-[0.4rem] w-[0.4rem] shrink-0 rounded-full bg-brass"
                    />
                    {addOn.meter}
                  </span>
                </div>
                <p className="text-sm leading-[1.65] text-ink-500">{addOn.body}</p>
              </div>
            ))}
          </TileGrid>

          <ProofBoundary
            level="info"
            title="What you're buying"
            className="mt-10"
          >
            <p>
              Every tier and add-on buys a capture-backed comparison against a real,
              packaged site — rank fidelity, failure clusters, and review-support media.
              It is an estimate of relative readiness, not a deployment-ready claim or a
              guarantee of field success.
            </p>
            <p className="mt-3 font-mono text-[13px] text-ink-700">
              All access is bounded to the reviewed site, task, robot profile,
              policy-access mode, and proof boundary. Figures shown are illustrative
              ranges (e.g. RUN-2049 · 100/500 episodes · $6.5k/$15k).
            </p>
          </ProofBoundary>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <EditorialFaq
            title="Pricing FAQ"
            description="The model, the boundaries, and what the numbers do and do not promise."
            items={faqItems}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-[88rem] px-5 pb-20 sm:px-8 lg:px-10 lg:pb-28">
          <EditorialCtaBand
            eyebrow="Pick your on-ramp"
            title="Start with a quick-look or scope a subscription."
            description="Tell us the site, task, and policies you want to compare. We'll come back with episode counts, a policy cap, and pricing for your scope."
            imageSrc="/redesign/pov/packing-cell.jpg"
            imageAlt="Robotic packing cell"
            primaryHref="/contact?persona=robot-team&interest=policy-evaluation-run&source=pricing"
            primaryLabel="Request evaluation"
            secondaryHref="/how-it-works"
            secondaryLabel="See how it works"
          />
        </div>
      </section>
    </>
  );
}
