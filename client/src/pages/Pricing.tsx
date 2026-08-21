import { Check } from "lucide-react";

import { SEO } from "@/components/SEO";
import { Button, ProofBoundary } from "@/components/blueprint";
import { EditorialFaq } from "@/components/site/editorial";
import { DeploymentNetworkPricing } from "@/components/site/DeploymentNetworkPricing";
import { OutcomeSpectrum } from "@/components/site/figures";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  Inner,
  NoteCards,
  PageHero,
  SectionHeader,
} from "@/components/site/publicSections";
import {
  homeOutcomes,
  pricingBoundaries,
  pricingHero,
  pricingIncluded,
} from "@/data/publicSiteCopy";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  webPageJsonLd,
} from "@/lib/seoStructuredData";

const siteOpportunityHref =
  "/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=pricing";

const freeAccess = [
  {
    label: "Sites",
    price: "$0",
    title: "Submit and screen the task",
    detail:
      "Upload workflow details, phone video, measurements, plans, systems context, and a guided scan when available. Automated screening decides whether deeper capture is justified.",
  },
  {
    label: "Robot teams",
    price: "$0",
    title: "Discover and evaluate",
    detail:
      "Join, browse permission-matched opportunities, receive compatible matches, express interest, and use a reasonable standard evaluation allowance without a listing or lead fee.",
  },
  {
    label: "Additional work",
    price: "At cost",
    title: "Pay only for exceptional load",
    detail:
      "Large parameter sweeps, thousands of reliability episodes, dedicated reserved compute, bespoke integration, and custom training are passed through or scoped separately.",
  },
] as const;

const faqItems = [
  {
    question: "What can a site do for free?",
    answer:
      "A site can join, describe a task, upload phone video, plans, measurements, throughput and shift data, provide a guided phone scan, and receive automated screening without paying. Most weak or incomplete opportunities should end there without triggering a human visit.",
  },
  {
    question: "Does free submission include a professional capture?",
    answer:
      "No. Blueprint may fund a focused professional capture after the opportunity passes automatic screening, attracts robot-team interest, represents meaningful rollout value, or otherwise clears the qualification policy. Marginal opportunities may require a refundable commitment deposit or a separately approved scope.",
  },
  {
    question: "What is free for robot teams?",
    answer:
      "Core access: joining, listings, matching, expressing interest, and a reasonable allowance of standardized evaluations. Robot teams pay at cost for unusually heavy compute and separately for bespoke work or custom training that creates provider-specific reusable value.",
  },
  {
    question: "What is the deployment-network fee?",
    answer:
      "If a qualified opportunity becomes a deployment recorded through Blueprint, the contracting enterprise pays 5% on the first $1 million of provider revenue collected in its account year, 3% on the next $9 million, and 1.5% above $10 million. Renewals are 1.5%. Each rate applies only to its own band.",
  },
  {
    question: "Are volume discounts calculated per deal or per site?",
    answer:
      "Neither. Volume aggregates across the contracting enterprise customer during its account year, across all robot providers, sites, and deployments. Ten $500,000 deployments therefore produce $5 million of annual volume and a $170,000 fee, rather than ten separate 5% resets.",
  },
  {
    question: "Who pays the network fee?",
    answer:
      "The contracting enterprise pays Blueprint separately. Robot providers receive their full negotiated deployment amounts. On $100,000 collected in the first annual band, the customer pays the provider $100,000 and Blueprint $5,000.",
  },
  {
    question: "Does the fee use the headline contract value?",
    answer:
      "No. It applies to cash actually collected. Refunds, reductions, and SLA credits reduce the applicable volume; expansions enter the active annual band when they are collected. A request, match, simulation candidate, or unsigned offer does not trigger a fee.",
  },
  {
    question: "What if the evaluation cannot answer the question?",
    answer:
      "Then it reports the open claims and the cheapest next test. Free standard evaluation access does not buy a flattering verdict, deployment approval, or safety guarantee, and expensive follow-up work is never launched without its own scope and authorization.",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Deployment network pricing | Blueprint"
        description="Sites and robot teams join free. Successful deployments use a site-paid 5% network fee with automatic enterprise-volume discounts."
        canonical="/pricing"
        jsonLd={[
          webPageJsonLd({
            path: "/pricing",
            name: "Blueprint deployment network pricing",
            description:
              "Free core access plus a site-paid, success-aligned deployment-network fee with automatic enterprise-volume discounts.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Pricing", path: "/pricing" },
          ]),
          faqJsonLd(faqItems),
        ]}
      />

      <PageHero
        eyebrow={pricingHero.eyebrow}
        title={pricingHero.title}
        body={pricingHero.body}
        chips={[
          "$0 opportunity submission",
          "$0 robot-team core",
          "5% success fee",
        ]}
        ctaHref={siteOpportunityHref}
        ctaLabel="Submit an opportunity"
        secondaryHref="/signup/business?buyerType=robot_team&source=pricing"
        secondaryLabel="Join as a robot team"
        imageSrc="/redesign/pov/factory-conveyor.jpg"
        imageAlt="An industrial line of the kind a site-task is captured from"
        imageCaption="Scoped per decision"
      />

      {/* Free core access */}
      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="Core access"
            title="Both sides enter the network for free."
            lede="The site supplies the opportunity. Robot teams supply scarce deployment capacity. Blueprint earns primarily when those two sides produce a real, paid deployment."
            onInk
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-md border border-white/15 bg-white/15 lg:grid-cols-3">
            {freeAccess.map((item, index) => (
              <Reveal key={item.label} delay={index * 0.05}>
                <div className="h-full bg-ink p-6 lg:p-7">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-micro font-semibold uppercase tracking-eyebrow text-brass">
                      {item.label}
                    </span>
                    <span className="font-mono text-title-m font-semibold text-[color:var(--text-on-ink)]">
                      {item.price}
                    </span>
                  </div>
                  <h3 className="mt-6 text-title-m font-semibold tracking-tight text-[color:var(--text-on-ink)]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-body-s leading-7 text-ink-300">
                    {item.detail}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Inner>
      </Band>

      {/* Qualification before human spend */}
      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="Professional capture and deeper work"
            title="Free access is staged, not an unconditional site visit."
            lede="Automated screening and self-capture come first. Blueprint funds focused professional capture for strong opportunities; marginal opportunities may need a refundable commitment deposit or a separately authorised scope."
          />
          <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <Reveal>
              <div className="rounded-lg border border-line bg-ink p-7 lg:p-9">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">
                  Qualification gate
                </p>
                <h3 className="mt-6 font-display text-[clamp(2.2rem,3.4vw,2.9rem)] font-medium leading-[1.02] tracking-[-0.04em] text-[color:var(--text-on-ink)]">
                  Professional capture is earned by the opportunity.
                </h3>
                <p className="mt-5 text-[14.5px] leading-[1.72] text-ink-300">
                  Expected contract value, intake completeness, robot-team
                  interest, repeat-site leverage, task fit, and customer
                  commitment determine whether Blueprint fronts the field work.
                  A deposit, when required, is credited against later network
                  fees rather than treated as the primary business model.
                </p>
                <Button asChild variant="brass" size="lg" className="mt-9">
                  <a href={siteOpportunityHref}>Submit an opportunity</a>
                </Button>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div>
                <p className="text-micro font-semibold uppercase tracking-eyebrow text-brass-deep">
                  Standard evaluation output
                </p>
                <ul className="mt-5 grid gap-y-3.5 sm:grid-cols-2 sm:gap-x-8">
                  {pricingIncluded.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 text-[14px] leading-[1.65] text-ink-700"
                    >
                      <Check
                        className="mt-[0.2rem] h-4 w-4 shrink-0 text-brass-deep"
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </Inner>
      </Band>

      {/* Successful deployment network */}
      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="If a deployment launches"
            title="5% to start. Lower automatically as volume grows."
            lede="Blueprint subsidizes core access and standard evaluation capacity. The deployment-network fee is paid by the contracting enterprise only when robot providers are actually collecting revenue through recorded agreements."
          />
          <DeploymentNetworkPricing />
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <ProofBoundary level="info" title="Success fee, not a lead fee">
              A submitted site, match, benchmark, simulation candidate, private
              offer, or unsigned quote does not trigger the fee. The fee follows
              cash actually collected under the accepted deployment record.
            </ProofBoundary>
            <ProofBoundary
              level="warn"
              title="Commercial state stays owner-backed"
            >
              This schedule does not turn an intake into a contract, reserve
              robot capacity, or prove payment. Agreements, amendments,
              invoices, collection, and settlement remain confirmed by their
              owning records.
            </ProofBoundary>
          </div>
        </Inner>
      </Band>

      {/* What you are and are not paying for */}
      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="04"
            eyebrow="What the network economics support"
            title="Subsidize the funnel. Keep the verdict independent."
            lede="Successful deployment fees fund automated screening, qualified capture, secure work packages, standard evaluations, contracting support, measurement, and the opportunities that never close. None of that changes the evidence threshold."
          />
          <div className="mt-14">
            <OutcomeSpectrum bands={homeOutcomes} />
          </div>
          <NoteCards items={pricingBoundaries} className="mt-16" />
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <Reveal>
              <ProofBoundary level="info" title="Pricing is server-owned">
                Customer identity, account-year volume, provider revenue,
                refunds, credits, authorisation, and any transaction stay tied
                to accepted server-owned records, not values posted from a
                browser.
              </ProofBoundary>
            </Reveal>
            <Reveal delay={0.08}>
              <ProofBoundary level="warn" title="No guaranteed outcome">
                Free access, a deposit, a compute payment, or a network fee does
                not purchase a ranking, winner, field recommendation, deployment
                approval, safety approval, or successful physical result.
              </ProofBoundary>
            </Reveal>
          </div>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner size="narrow" className="py-20 lg:py-28">
          <EditorialFaq
            title="Pricing questions"
            description="What stays free, when human work is funded, and how annual deployment volume is charged."
            items={faqItems}
          />
        </Inner>
      </Band>

      <ClosingCta
        eyebrow="Start free"
        title="Bring the task or bring the robot."
        body="Sites submit real work opportunities without paying. Robot teams join the private network and evaluate suitable opportunities without a listing or lead fee."
        primaryHref={siteOpportunityHref}
        primaryLabel="Submit an opportunity"
        secondaryHref="/signup/business?buyerType=robot_team&source=pricing-cta"
        secondaryLabel="Join as a robot team"
        imageSrc="/redesign/pov/laundry-folding.jpg"
        imageAlt="A commercial laundry line used as a real-site task context"
      />
    </>
  );
}
