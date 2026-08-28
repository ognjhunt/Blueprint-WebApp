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
import {
  deploymentFee,
  evaluationFee,
  formatUsd,
  freeTier,
  privateProcurement,
  settlement,
} from "@/lib/deploymentPricing";
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
    question: "What does Blueprint charge?",
    answer:
      "$1,000 to evaluate a site-task. $10,000 in total if you win it — the same $1,000 plus $9,000 on award. Sites pay nothing.",
  },
  {
    question: "Is there anything else?",
    answer:
      "No. No percentage, no per-robot rate, nothing recurring. Growing a deployment from five robots to fifty costs nothing further.",
  },
  {
    question: "Why no percentage of the contract?",
    answer:
      "It is not collectible unless we control invoicing — a contract can be understated, split across agreements, or written off-platform. Two flat numbers need no visibility into anyone's contract.",
  },
  {
    question: "What if we evaluate three tasks and win one?",
    answer:
      "$12,000: $10,000 for the win, $1,000 each for the two you did not. Losing evaluations are not refunded.",
  },
  {
    question: "Why does the site pay nothing?",
    answer:
      "It contributes the floor, the access and the task data — the scarce side. The one exception is a private, exclusive procurement, priced separately.",
  },
  {
    question: "Are these rates fixed?",
    answer:
      "They are starting terms we intend to test, not an industry rate. No independent source establishes a market price for this yet.",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Two charges. The site pays nothing."
        description="Robot teams pay $1,000 to evaluate a site-task. Win it and the total is $10,000. Lose and it stays $1,000. Sites pay nothing."
        canonical="/pricing"
        jsonLd={[
          webPageJsonLd({
            path: "/pricing",
            name: "Blueprint deployment network pricing",
            description:
              "$1,000 to evaluate a site-task, $10,000 in total if you win it. Sites pay nothing.",
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
        chips={["$0 for sites", "$1,000 to evaluate", "$10,000 if you win"]}
        ctaHref={siteHref}
        ctaLabel="Submit a job"
        secondaryHref={robotHref}
        secondaryLabel="Join as a robot team"
        imageSrc="/redesign/pov/factory-conveyor.jpg"
        imageAlt="Factory workflow prepared for robot deployment"
        imageCaption="Two charges · no contract percentage"
      />

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="Free"
            title="Sites pay nothing. Ever."
            lede="The site contributes the floor, the access and the task data. Charging for that would suppress supply."
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
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <p className="text-[13.5px] leading-[1.7] text-runway-mute">
              <strong className="font-semibold text-runway-text">{privateProcurement.label}.</strong>{" "}
              {privateProcurement.detail}
            </p>
            <p className="text-[13.5px] leading-[1.7] text-runway-mute">
              <strong className="font-semibold text-runway-text">Later, if a percentage ever fits.</strong>{" "}
              {settlement.later}
            </p>
          </div>
        
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="Worked example"
            title="One warehouse, three tasks, four teams."
            lede="Nobody discloses a contract. The warehouse never pays."
          />
          <ol className="mt-12 grid gap-px border border-runway-line bg-runway-line">
            {[
              {
                when: "Listing",
                what: "A warehouse lists three site-tasks.",
                money: "Warehouse pays $0",
              },
              {
                when: "Evaluation",
                what: "Four teams each evaluate all three — twelve evaluations.",
                money: "$12,000 to Blueprint",
              },
              {
                when: "Selection",
                what: "Team A is selected for one task. Its total is $10,000, less the $1,000 it already paid.",
                money: "$9,000 more from Team A",
              },
              {
                when: "Team A's bill",
                what: "One win at $10,000, two losses at $1,000 each.",
                money: "$12,000 from Team A",
              },
              {
                when: "Afterwards",
                what: "Team A grows the deployment, renews, and pays the warehouse $20,000 to host.",
                money: "Nothing further",
              },
            ].map((row) => (
              <li
                key={row.when}
                className="grid gap-2 bg-runway-panel p-5 sm:grid-cols-[136px_minmax(0,1fr)_200px] sm:items-baseline sm:gap-6 lg:p-6"
              >
                <span className="runway-meta">{row.when}</span>
                <span className="text-[14px] leading-[1.65] text-runway-body">{row.what}</span>
                <span className="runway-num text-[13px] text-runway-signal sm:text-right">
                  {row.money}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-[14px] leading-[1.7] text-runway-mute">
            Blueprint collects {formatUsd(21_000)}. The warehouse pays {formatUsd(0)}.
          </p>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="The two numbers"
            title="Lose and it stays $1,000. Win and it is $10,000."
            lede="Nothing depends on a contract we cannot see. Nothing keeps accruing."
          />
          <DeploymentPricingModel />
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner size="narrow" className="py-20 lg:py-28">
          <EditorialFaq
            title="Pricing questions"
            description="Two numbers, who pays them, and why neither depends on a contract Blueprint cannot see."
            items={faqItems}
          />
        </Inner>
      </Band>

      <ClosingCta
        eyebrow="Start free"
        title="Bring the job, or bring the robot."
        body="The site submits the workflow and pays nothing. Robot teams pay $1,000 to evaluate, and $10,000 in total if they win the work."
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
