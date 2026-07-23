import { SEO } from "@/components/SEO";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
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
import {
  blueprintPositioning,
  rankingOutcomeCategories,
  robotPolicyEvaluationBeachhead,
} from "@/data/robotPolicyEvaluationClaims";
import { ArrowRight, Check } from "lucide-react";

type Campaign = {
  name: string;
  buyer: string;
  price: string;
  unit: string;
  tagline: string;
  features: string[];
  note: string;
  cta: string;
  href: string;
};

// The two — and only two — ways to buy the core service. Both are a single
// fixed-price campaign that returns a shortlist for an onsite pilot. Everything
// else on this page is infrastructure or a participation path, not another offer.
const campaigns: Campaign[] = [
  {
    name: "Policy Shortlist",
    buyer: "For robot teams",
    price: "$3,000",
    unit: "/ campaign",
    tagline:
      "Already have a site and several candidate policies? Blueprint evaluates them against the same captured site and task, then identifies the two or three strongest candidates for field testing.",
    features: [
      "One site and deployment task",
      "Up to five policies or checkpoints",
      "Confidence-aware comparative evaluation",
      "Failure patterns and review media",
      "Onsite pilot recommendation",
    ],
    note: "Capture of a normal local site is included. Nonstandard travel, private-site legal work, or custom policy engineering is quoted separately.",
    cta: "Rank my policies",
    href: "/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-shortlist&requestedOutputs=Policy%20Shortlist&source=pricing",
  },
  {
    name: "Robot Match",
    buyer: "For site operators",
    price: "$5,000",
    unit: "/ campaign",
    tagline:
      "Want to pilot robots but do not know which teams belong onsite? Blueprint turns your workflow into a shared evaluation challenge, compares compatible robot teams against the same captured site, and recommends the two or three strongest for a field pilot.",
    features: [
      "Site and workflow assessment",
      "Up to five qualified robot teams",
      "Comparable site-specific evaluation",
      "Integration and failure analysis",
      "Shortlist and pilot brief",
    ],
    note: "Robot-team participation is free during a sponsored campaign. Requirements discovery, candidate qualification, and coordinating several teams are why Robot Match is priced above Policy Shortlist.",
    cta: "Find robot teams for my site",
    href: "/contact/site-operator?buyerType=site_operator&interest=robot-match&requestedOutputs=Robot%20Match&source=pricing",
  },
];

type Participation = {
  name: string;
  price: string;
  unit: string;
  body: string;
  stage?: string;
};

// How robot teams enter a site operator's Robot Match. Free while campaigns are
// sponsored; a small, uniform later fee once a site benchmark is established.
const participation: Participation[] = [
  {
    name: "Sponsored participation",
    price: "Free",
    unit: "/ qualified submission",
    body: "During a sponsored Robot Match, compatible robot teams enter one qualified submission at no cost. Keeping entry free protects competition — placement is never pay-to-play.",
  },
  {
    name: "Open-benchmark submission",
    price: "$250–500",
    unit: "/ submission",
    body: "Once a site benchmark is established, later teams can submit to the same challenge for a small, uniform fee. The fee never affects ranking or placement.",
    stage: "Later",
  },
];

const faqItems = [
  {
    question: "Which campaign is for me?",
    answer:
      "If you are a robot team that already has a prospective site and several candidate policies or checkpoints, start with a Policy Shortlist. If you are a site operator who wants to automate a workflow but does not know which robot teams belong onsite, start with a Robot Match. Both return the two or three strongest candidates for an onsite pilot.",
  },
  {
    question: "What is in the shortlist report?",
    answer:
      "The top two or three candidates, with confidence and uncertainty, the major failure patterns, scenario-level performance, review media, and a recommended onsite pilot plan. A Robot Match also includes capability and integration gaps for each team.",
  },
  {
    question: "What if no candidate is strong enough?",
    answer:
      "The result may be “ranking inconclusive” or “no candidate met the threshold.” Blueprint reports that honestly and never manufactures a winner. You can extend the episode budget, narrow the scenario, or stop — you are buying a better pilot decision, not a guaranteed one.",
  },
  {
    question: "Do robot teams pay to join a Robot Match?",
    answer:
      "No. Robot-team participation is free during a sponsored campaign. Later, once a site benchmark is established, teams can submit to it for a small, uniform $250–500 fee that never affects ranking or placement.",
  },
  {
    question: "Are these prices fixed?",
    answer:
      "They are launch prices held for the first ten paid campaigns, then reviewed against real delivery cost, integration hours, compute per candidate, inconclusive-ranking rate, and the share of campaigns that advance to an onsite pilot. Running repeated campaigns? Volume pricing is privately negotiated — for example, four campaigns for $10,000.",
  },
  {
    question: "Who captures the site, and who owns the rights?",
    answer:
      "Blueprint captures the relevant area under approved windows, or reuses an existing rights-approved capture. Provenance, rights, and privacy travel with the package and stay operator-controlled. No access is granted until the operator approves it.",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Blueprint"
        description="Blueprint pricing: two fixed-price campaigns that rank candidates against the site where they may deploy. Policy Shortlist ($3,000) for robot teams; Robot Match ($5,000) for site operators. Each returns the two or three strongest candidates for an onsite pilot."
        canonical="/pricing"
        jsonLd={[
          webPageJsonLd({
            path: "/pricing",
            name: "Blueprint Pricing",
            description:
              "Two fixed-price site-specific ranking campaigns: Policy Shortlist ($3,000/campaign) for robot teams and Robot Match ($5,000/campaign) for site operators. Each returns the two or three strongest candidates for an onsite pilot.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
          faqJsonLd(faqItems),
        ]}
      />

      {/* Hero */}
      <section className="bg-canvas">
        <div className="mx-auto grid max-w-[88rem] gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_0.85fr] lg:items-center lg:px-10 lg:py-24">
          <div>
            <Eyebrow tone="brass" rule>
              Pricing
            </Eyebrow>
            <h1 className="mt-5 font-display text-[clamp(2.6rem,5vw,4.4rem)] font-medium leading-[1.02] tracking-[-0.045em] text-ink-900">
              Priced per campaign, not per seat.
            </h1>
            <p className="mt-5 max-w-[34rem] text-[1.05rem] leading-[1.7] text-ink-500">
              {blueprintPositioning}
            </p>
            <p className="mt-4 max-w-[34rem] text-[0.95rem] leading-[1.65] text-ink-400">
              You are buying a shortlist before an expensive onsite pilot — one
              fixed-price campaign, one clear decision. Never a deployment
              guarantee, a safety certification, or a readiness claim.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <ProofChip>Fixed-price campaigns</ProofChip>
              <ProofChip>Top two or three, or none</ProofChip>
              <ProofChip>Better pilot decision, not a guarantee</ProofChip>
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

      {/* Two campaigns */}
      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <EditorialSectionIntro
            eyebrow="The two ways to buy"
            title="One service. Two ways to start a campaign."
            description="A robot team ranks its own policies for a known site, or a site operator compares compatible robot teams for a desired deployment. Both end in the same place: the two or three candidates that deserve an onsite pilot."
          />

          <TileGrid cols={2} className="mt-12 rounded-lg">
            {campaigns.map((campaign) => (
              <article
                key={campaign.name}
                className="flex h-full flex-col bg-white p-6 lg:p-8"
              >
                <div className="flex items-center justify-between gap-3">
                  <Eyebrow tone="muted">{campaign.buyer}</Eyebrow>
                  <StatusChip tone="info" square dot={false}>
                    Campaign
                  </StatusChip>
                </div>

                <h3 className="mt-5 text-title-l font-semibold tracking-tight text-ink-900">
                  {campaign.name}
                </h3>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-mono text-[2.4rem] font-medium leading-none tracking-[-0.02em] text-ink-900">
                    {campaign.price}
                  </span>
                  <span className="font-mono text-[0.9rem] text-ink-400">
                    {campaign.unit}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-[1.65] text-ink-500">
                  {campaign.tagline}
                </p>

                <ul className="mt-5 flex flex-col gap-2.5">
                  {campaign.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-brass"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span className="text-[13px] leading-[1.5] text-ink-700">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-5 border-t border-line-soft pt-4 text-[12px] leading-[1.5] text-ink-400">
                  {campaign.note}
                </p>

                <div className="mt-auto pt-6">
                  <Button asChild variant="brass" size="md" full>
                    <a href={campaign.href}>
                      {campaign.cta}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </Button>
                </div>
              </article>
            ))}
          </TileGrid>

          {/* Repeat campaigns — no subscription until a real cadence exists */}
          <div className="mt-8 flex flex-col gap-3 border border-line bg-inset p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Eyebrow tone="muted">Repeat campaigns</Eyebrow>
              <h3 className="mt-2 text-title-s font-semibold tracking-tight text-ink-900">
                Volume pricing is negotiated, not subscribed.
              </h3>
              <p className="mt-1 max-w-[46rem] text-sm leading-[1.6] text-ink-500">
                Teams running repeated campaigns get privately negotiated volume
                pricing — for example, four campaigns for $10,000 or a quarterly
                commitment. Blueprint introduces a subscription only after a
                customer shows a real recurring cadence.
              </p>
            </div>
            <Button asChild variant="secondary" size="md">
              <a href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=volume-campaigns&requestedOutputs=Volume%20Campaigns&source=pricing">
                Discuss volume
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Robot-team participation in a Robot Match */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <EditorialSectionIntro
            eyebrow="For robot teams joining a Match"
            title="Getting compared on a site costs a robot team nothing today."
            description="Site operators pay for the Robot Match campaign. Robot teams enter the shared evaluation for free while campaigns are sponsored, so rankings never look pay-to-play."
          />

          <TileGrid cols={2} className="mt-12">
            {participation.map((tier) => (
              <div key={tier.name} className="flex h-full flex-col gap-3 bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-title-m font-semibold tracking-tight text-ink-900">
                    {tier.name}
                  </h3>
                  <span className="inline-flex items-center gap-2 border border-line bg-inset px-[0.6rem] py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-600">
                    <span
                      aria-hidden="true"
                      className="h-[0.4rem] w-[0.4rem] shrink-0 rounded-full bg-brass"
                    />
                    {tier.price} {tier.unit}
                  </span>
                </div>
                {tier.stage ? (
                  <span className="inline-flex w-fit items-center border border-brass/50 bg-transparent px-[0.6rem] py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-brass">
                    {tier.stage}
                  </span>
                ) : null}
                <p className="text-sm leading-[1.65] text-ink-500">{tier.body}</p>
              </div>
            ))}
          </TileGrid>

          <div className="mt-8 flex flex-col gap-3 border border-line bg-inset p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[52rem] text-sm leading-[1.6] text-ink-500">
              To be compared, a candidate provides one standard interface — a
              Blueprint-compatible policy API, a sealed container implementing the
              evaluation contract, or an approved private runner exposing the same
              observation and action interface. No source code is required.
            </p>
            <Button asChild variant="secondary" size="md">
              <a href="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=robot-match-participation&requestedOutputs=Robot%20Match%20Participation&source=pricing">
                Join a Match
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Methodology & honesty */}
      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <EditorialSectionIntro
            eyebrow="How the ranking is called"
            title="A confidence-aware verdict — not a guessed order."
            description="Blueprint runs candidates against paired scenarios and seeds, spends more episodes only where the ranking is close, and stops when the result is confident or the campaign cap is reached. Every candidate receives one verdict."
          />

          <div className="mt-12 grid gap-px overflow-hidden rounded-md border border-line bg-[#ded7c8] sm:grid-cols-2 xl:grid-cols-3">
            {rankingOutcomeCategories.map((row) => (
              <div key={row.label} className="flex flex-col gap-2 bg-white p-6">
                <h3 className="text-title-s font-semibold tracking-tight text-ink-900">
                  {row.label}
                </h3>
                <p className="text-sm leading-[1.6] text-ink-500">{row.body}</p>
              </div>
            ))}
            <div className="flex flex-col justify-center gap-2 bg-inset p-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-brass-deep">
                Where the evidence is strongest today
              </p>
              <p className="text-sm leading-[1.6] text-ink-600">
                {robotPolicyEvaluationBeachhead}
              </p>
            </div>
          </div>

          <ProofBoundary level="info" title="What you're buying" className="mt-10">
            <p>
              Every campaign buys a capture-backed comparison against the real
              site where a robot may deploy — the two or three best-supported
              candidates for an onsite pilot, with failure patterns and review
              media. The result can be &ldquo;ranking inconclusive&rdquo; or
              &ldquo;no candidate met the threshold.&rdquo; Blueprint never
              manufactures a winner.
            </p>
            <p className="mt-3 font-mono text-[13px] text-ink-700">
              The report separates the ranking inside Blueprint&rsquo;s configured
              evaluator from estimated suitability for an onsite pilot — and from
              unproven physical performance, safety, reliability, and deployment
              readiness. You are buying a better pilot decision, not a deployment
              guarantee.
            </p>
          </ProofBoundary>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <EditorialFaq
            title="Pricing FAQ"
            description="The two campaigns, what a shortlist includes, and what the numbers do and do not promise."
            items={faqItems}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-[88rem] px-5 pb-20 sm:px-8 lg:px-10 lg:pb-28">
          <EditorialCtaBand
            eyebrow="Start a campaign"
            title="Get to a shortlist before you spend a pilot season."
            description="Tell us the site, the task, and the candidates — policies you already have, or robot teams you want compared. We come back with a scoped campaign and the fixed price for it."
            imageSrc="/redesign/pov/loading-dock.jpg"
            imageAlt="Warehouse loading dock — mobile-base navigation and rigid tote handling"
            primaryHref="/contact/robot-team?persona=robot-team&buyerType=robot_team&interest=policy-shortlist&source=pricing"
            primaryLabel="Rank my policies"
            secondaryHref="/for-site-operators"
            secondaryLabel="Find robot teams for my site"
          />
        </div>
      </section>
    </>
  );
}
