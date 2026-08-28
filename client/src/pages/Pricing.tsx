import { Check } from "lucide-react";

import { SEO } from "@/components/SEO";
import { DeploymentPricingModel } from "@/components/site/DeploymentPricingModel";
import { EditorialFaq } from "@/components/site/editorial";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  Inner,
  PageHero,
  SectionHeader,
} from "@/components/site/publicSections";
import { pricingHero } from "@/data/publicSiteCopy";
import { commitmentGate, evaluationCredit, freeTier } from "@/lib/deploymentPricing";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  webPageJsonLd,
} from "@/lib/seoStructuredData";

const siteHref =
  "/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=pricing";
const robotHref = "/signup/business?buyerType=robot_team&source=pricing";



const faqItems = [
  {
    question: "What does Blueprint charge for, in one line?",
    answer:
      "Discovery is free. An evaluation credit is due before a robot team receives named-site detail or a bespoke run, and it is returned in full against the deployment fee if that team deploys. After that Blueprint bills an activation fee once and an active robot-month while robots are working.",
  },
  {
    question: "Why not simply take a percentage of the robot contract?",
    answer:
      "Because neither party can verify it. A percentage of a confidential contract is disputable, needs audit rights to collect, and gives both sides a shared reason to route around Blueprint. An activated site-task and an active robot-month are countable from the deployment record by either party. Where Blueprint does control invoicing or receives audited reporting, a 1–2% first-year rate is available instead.",
  },
  {
    question: "Is the evaluation credit an extra cost if we win the work?",
    answer:
      "No. The credit is returned in full against activation and the first year of robot-months, so a team that deploys pays nothing additional for having evaluated. It is only retained when a team consumes named-site access and does not deploy.",
  },
  {
    question: "Does Blueprint take over our deployment?",
    answer:
      "No. Robot teams keep the deployment and the data loop — recreating the workcell, generating task data, installing, configuring and tuning on site is where their advantage compounds, and several of them say so publicly. Blueprint removes the work in front of that: finding the site, qualifying it, capturing the evidence, and packaging the handoff.",
  },
  {
    question: "Is a capture visit free for every submission?",
    answer:
      "No submission is charged for capture, and not every submission gets one. A capture visit consumes an operator relationship and a slot on a working floor, so it follows a verified project budget, a signed pilot-intent document, or a refundable commitment — never expressed interest alone.",
  },
  {
    question: "Are these rates fixed?",
    answer:
      "They are starting terms Blueprint intends to test, not an industry rate. No independent source establishes a market price for this service: the robotics-data benchmarks that circulate publicly are published by vendors selling data services, and the one customer-paid deployment fee on the public record is an illustrative figure from a single company's own investor model.",
  },
  {
    question: "What stops a site and a robot team going around Blueprint?",
    answer:
      "Mostly that it stops being worth it. The recurring fee buys a maintained testbed, a versioned acceptance test, re-evaluation when the robot or the workcell changes, an independent deployment record, expansion screening and incident evidence. Both parties also sign an opportunity-specific acknowledgment covering attribution, reporting and audit before identifiable detail is released — but that is the backstop, not the defence.",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Free to discover, paid when robots work"
        description="Discovery and one standard evaluation are free. An evaluation credit is due before named-site access and returned in full against deployment. Blueprint then bills activation and active robot-months."
        canonical="/pricing"
        jsonLd={[
          webPageJsonLd({
            path: "/pricing",
            name: "Blueprint deployment network pricing",
            description:
              "Free discovery, a refundable evaluation credit, then activation and active robot-months.",
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
        chips={["$0 discovery", "Credit returned on deploy", "Billed per robot-month"]}
        ctaHref={siteHref}
        ctaLabel="Submit a job"
        secondaryHref={robotHref}
        secondaryLabel="Join as a robot team"
        imageSrc="/redesign/pov/factory-conveyor.jpg"
        imageAlt="Factory workflow prepared for robot deployment"
        imageCaption="Observable units · not a contract percentage"
      />

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="Free"
            title="Discovery costs nothing, because it costs us nothing."
            lede="Anonymous listings, automated fit screening, one standardised evaluation and site qualification are free. They run on a record Blueprint already holds, and rationing them would slow the market more than it would earn."
            onInk
          />
          <div className="mt-14 grid gap-px overflow-hidden border border-runway-line bg-runway-line sm:grid-cols-2">
            {freeTier.map((item, index) => (
              <Reveal key={item.id} delay={index * 0.06}>
                <article className="h-full bg-runway-panel p-6 lg:p-8">
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="font-display text-title-m font-semibold uppercase tracking-[0.005em] text-runway-text">
                      {item.label}
                    </h2>
                    <span className="runway-num shrink-0 text-title-m text-runway-green">$0</span>
                  </div>
                  <p className="mt-3 text-body-s leading-7 text-runway-mute">{item.detail}</p>
                  <p className="mt-4 border-t border-runway-line-soft pt-4 text-[12.5px] leading-6 text-runway-faint">
                    {item.rationale}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="The line"
            title="Payment starts where scarce work does."
            lede="Named-site detail, the full capture artefacts and a bespoke run are where Blueprint starts spending something it cannot get back: operator goodwill, floor time and identifiable opportunity information. The evaluation credit is charged at that line — and returned in full if that team deploys."
          />
          <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="runway-panel p-6 lg:p-8">
              <p className="runway-eyebrow">Evaluation credit · {evaluationCredit.unit}</p>
              <p className="mt-4 font-display text-[clamp(1.9rem,3.2vw,2.6rem)] font-semibold uppercase leading-none tracking-[0.005em] text-runway-text">
                Charged here, returned on deploy
              </p>
              <p className="mt-4 text-body-s leading-7 text-runway-mute">Due before any of:</p>
              <ul className="mt-3 grid gap-2">
                {evaluationCredit.triggers.map((trigger) => (
                  <li key={trigger} className="flex gap-3 text-[13.5px] leading-6 text-runway-mute">
                    <Check className="mt-[3px] h-4 w-4 shrink-0 text-runway-signal" aria-hidden="true" />
                    {trigger}
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-runway-line-soft pt-4 text-[12.5px] leading-6 text-runway-faint">
                Billed separately: {evaluationCredit.billedSeparately.join(", ").toLowerCase()}.
              </p>
            </div>
            <div className="border border-runway-line p-6 lg:p-8">
              <p className="runway-eyebrow">Before Blueprint funds a capture visit</p>
              <p className="mt-4 text-body-s leading-7 text-runway-mute">
                A capture visit spends an operator relationship and a slot on a working floor.
                Expressed interest does not buy one. At least one of these has to be true:
              </p>
              <ul className="mt-4 grid gap-4">
                {commitmentGate.map((gate) => (
                  <li key={gate.id} className="border-t border-runway-line-soft pt-4">
                    <p className="text-[14px] font-semibold text-runway-text">{gate.label}</p>
                    <p className="mt-1 text-[13px] leading-6 text-runway-mute">{gate.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="When robots are working"
            title="Billed on units both sides can count."
            lede="An activated site-task, then an active robot-month. A robot that stops working stops billing, and the evaluation credit comes off the total."
          />
          <DeploymentPricingModel />
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner size="narrow" className="py-20 lg:py-28">
          <EditorialFaq
            title="Pricing questions"
            description="What is free, where payment starts, and why the fee is a robot-month rather than a percentage."
            items={faqItems}
          />
        </Inner>
      </Band>

      <ClosingCta
        eyebrow="Start free"
        title="Bring the job, or bring the robot."
        body="The site submits the workflow. The robot team tests fit. Blueprint earns when robots are actually deployed and stay working."
        primaryHref={siteHref}
        primaryLabel="Submit a job"
        secondaryHref={robotHref}
        secondaryLabel="Join as a robot team"
        imageSrc="/redesign/pov/laundry-folding.jpg"
        imageAlt="Commercial workflow considered for robot deployment"
      />
    </>
  );
}
