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
    question: "What does Blueprint charge, in one line?",
    answer:
      "Two things, both paid by robot teams. $1,000 to evaluate a site-task. Then, if you win that task, the greater of $10,000 or $2,000 per robot deployed on it — less the $1,000 you already paid to evaluate the task you won. Sites pay nothing.",
  },
  {
    question: "Why is there no percentage of the contract?",
    answer:
      "Because it is not reliably collectible unless Blueprint controls invoicing. A contract can be understated, or split so hardware, software and services sit in separate agreements, or written off-platform entirely — and high-value, low-frequency deals are where that pressure is strongest. Robot count is different: it is visible in the deployment and acceptance record, and both the site and Blueprint can verify it. If a percentage ever makes sense it needs a payment rail that withholds the fee automatically; until that is mandatory, Blueprint is not priced on reported contract value.",
  },
  {
    question: "Is the evaluation fee a compute markup?",
    answer:
      "No. It buys a captured task, a standardised test, and a scored result: up to 500 episodes against the twin, the analysis, and the full capture package. The compute is a small part of it. What you are paying for is that somebody already found the customer, qualified the budget, captured the workflow and wrote the acceptance test.",
  },
  {
    question: "What if we evaluate three tasks and win one?",
    answer:
      "You pay $3,000 to evaluate and only the winning task's $1,000 is credited against the deployment fee. Evaluations on tasks you do not win are not refunded — they consumed a real captured asset and real site access.",
  },
  {
    question: "Why does the site pay nothing?",
    answer:
      "The site contributes the floor, the operational access and the task data, which are the hardest things in this market to get. Charging the scarce side would suppress the supply everybody needs. The one exception is a site that separately hires Blueprint to run a private, exclusive procurement — a different engagement from the open board.",
  },
  {
    question: "Can a robot team pay the site to host a pilot?",
    answer:
      "Yes, and it is common. That is a separate payment for access, disruption or data, it stays between the two parties, and Blueprint takes none of it. It does not replace Blueprint's fee either.",
  },
  {
    question: "Who invoices whom?",
    answer:
      "The site and the robot team contract and pay each other directly. Blueprint invoices its two fees separately and stays out of the commercial agreement between them.",
  },
  {
    question: "Are these rates fixed?",
    answer:
      "They are starting terms Blueprint intends to test, not an industry rate. No independent source establishes a market price for this service: the robotics-data benchmarks that circulate publicly are published by vendors selling data services, and the one customer-paid deployment fee on the public record is an illustrative figure inside a single company's own investor model.",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Two charges. The site pays nothing."
        description="Robot teams pay $1,000 to evaluate a site-task and, if they win it, the greater of $10,000 or $2,000 per robot deployed. Sites pay nothing."
        canonical="/pricing"
        jsonLd={[
          webPageJsonLd({
            path: "/pricing",
            name: "Blueprint deployment network pricing",
            description:
              "Two charges, both paid by robot teams: an evaluation fee and a deployment fee. Sites pay nothing.",
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
        chips={["$0 for sites", "$1,000 to evaluate", "Paid again only if you win"]}
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
            lede="The site contributes the floor, the operational access and the task data — the hardest things in this market to get. Charging for them would suppress the supply everybody needs."
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
            lede="The whole model in one arithmetic. Nobody discloses a contract, and the warehouse never pays Blueprint."
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
                what: "Four robot teams each evaluate all three tasks — twelve evaluations at $1,000.",
                money: "$12,000 to Blueprint",
              },
              {
                when: "Award",
                what: "Team A wins one task and starts a five-robot deployment. Five robots does not clear the floor, so the fee is $10,000, less the $1,000 it paid to evaluate that task.",
                money: "$9,000 more from Team A",
              },
              {
                when: "Expansion",
                what: "Team A later grows the same task to twenty robots. At $2,000 each the total becomes $40,000, and the fee tops up rather than restarting.",
                money: "$30,000 more from Team A",
              },
              {
                when: "Side deal",
                what: "Team A also pays the warehouse $20,000 to host the pilot — for access, disruption and data. Supported, and separate.",
                money: "Blueprint takes none of it",
              },
            ].map((row) => (
              <li
                key={row.when}
                className="grid gap-2 bg-runway-panel p-5 sm:grid-cols-[128px_minmax(0,1fr)_200px] sm:items-baseline sm:gap-6 lg:p-6"
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
            Blueprint collects {formatUsd(12_000 + 9_000 + 30_000)} across the life of that
            relationship. The warehouse pays {formatUsd(0)}, and no one has to show anyone a
            contract.
          </p>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="The two charges"
            title="Evaluate for $1,000. Pay again only if you win."
            lede="Robot count is visible in the deployment record, so the fee never depends on a number only one party can see."
          />
          <DeploymentPricingModel />
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner size="narrow" className="py-20 lg:py-28">
          <EditorialFaq
            title="Pricing questions"
            description="Two charges, who pays them, and why neither depends on a contract Blueprint cannot see."
            items={faqItems}
          />
        </Inner>
      </Band>

      <ClosingCta
        eyebrow="Start free"
        title="Bring the job, or bring the robot."
        body="The site submits the workflow and pays nothing. Robot teams pay to evaluate, and pay again only when they win the work."
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
