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
      "$1,000 to evaluate a site-task. If you are selected for the pilot or deployment on that task, $10,000 in total — so $9,000 more. A team that loses pays $1,000. A team that wins pays $10,000. The site pays nothing.",
  },
  {
    question: "Is there anything else?",
    answer:
      "No. No percentage of the contract, no per-robot rate, no monthly charge, no renewal fee. Growing the deployment from five robots to fifty costs nothing further. Two numbers is the whole model.",
  },
  {
    question: "Why is there no percentage of the contract?",
    answer:
      "Because it is not reliably collectible unless Blueprint controls invoicing. A contract can be understated, or split so hardware, software and services sit in separate agreements, or written off-platform entirely — and high-value, low-frequency deals are where that pressure is strongest. Two flat numbers need no visibility into anyone's contract. If a percentage ever makes sense it needs a payment rail that withholds the fee automatically; until that is mandatory, Blueprint is not priced on reported contract value.",
  },
  {
    question: "Is the $1,000 a compute markup?",
    answer:
      "No. It buys a captured task, a standardised test, and a scored result: up to 500 episodes against the twin, the analysis, and the full capture package. The compute is a small part of it. What you are paying for is that somebody already found the customer, qualified the budget, captured the workflow and wrote the acceptance test.",
  },
  {
    question: "What if we evaluate three tasks and win one?",
    answer:
      "You pay $12,000: $10,000 for the task you won, and $1,000 each for the two you did not. Evaluations on tasks you do not win are not refunded — they consumed a real captured asset and real site access.",
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
                when: "Selection",
                what: "Team A is selected for one task. That task's total is $10,000, and Team A already paid $1,000 to evaluate it.",
                money: "$9,000 more from Team A",
              },
              {
                when: "Team A's bill",
                what: "Three evaluations, one win: $10,000 for the task it won, $1,000 each for the two it did not.",
                money: "$12,000 from Team A",
              },
              {
                when: "Afterwards",
                what: "Team A grows the deployment, renews, and pays the warehouse $20,000 to host. None of it changes what Blueprint is owed.",
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
            Blueprint collects {formatUsd(21_000)} in total. The warehouse pays {formatUsd(0)}, and
            no one has to show anyone a contract.
          </p>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="The two numbers"
            title="Lose and it stays $1,000. Win and it is $10,000."
            lede="Two flat numbers, so nothing depends on a contract Blueprint cannot see — and nothing keeps accruing after the deal is done."
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
