import { Check } from "lucide-react";

import { SEO } from "@/components/SEO";
import { DeploymentNetworkPricing } from "@/components/site/DeploymentNetworkPricing";
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
  breadcrumbJsonLd,
  faqJsonLd,
  webPageJsonLd,
} from "@/lib/seoStructuredData";

const siteHref =
  "/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=pricing";
const robotHref = "/signup/business?buyerType=robot_team&source=pricing";

const freeAccess = [
  {
    who: "Sites",
    price: "$0",
    title: "Submit the workflow",
    body: "Share task details, phone video, measurements, plans, timing, exceptions, and access rules for automatic screening.",
  },
  {
    who: "Robot teams",
    price: "$0",
    title: "Discover and test fit",
    body: "Join, receive suitable matches, express interest, and use a reasonable allowance of standard evaluations.",
  },
  {
    who: "Heavy work",
    price: "At cost",
    title: "Pay for what is exceptional",
    body: "Large parameter sweeps, thousands of reliability episodes, reserved compute, custom integration, and bespoke training.",
  },
] as const;

const faqItems = [
  {
    question: "When does a site pay Blueprint?",
    answer:
      "Only when a deployment produces provider revenue collected through the recorded agreement. A submission, match, simulation candidate, or unsigned offer does not trigger the network fee.",
  },
  {
    question: "Is a capture visit free for every submission?",
    answer:
      "No submission is charged for capture, and not every submission gets one. Structured screening comes first and costs nothing; a capture visit follows only once the task clears the screen and matches a robot team we are in conversation with. Blueprint sends and funds the operator when that happens — the site is never asked to capture its own workcell or to deposit against a visit.",
  },
  {
    question: "Are the volume tiers per deal or per facility?",
    answer:
      "Neither. They aggregate across the contracting enterprise customer during its account year, across every provider, site, and deployment. Ten $500,000 deployments therefore produce a $170,000 fee, not ten separate 5% resets.",
  },
  {
    question: "Does Blueprint reduce the provider's payment?",
    answer:
      "No. The contracting enterprise pays Blueprint separately. The robot provider receives the full commercial price it negotiated.",
  },
  {
    question: "Does free evaluation include custom robot training?",
    answer:
      "No. Standard evaluation access is included. Heavy compute is passed through at cost, and custom training is scoped according to who requests it and who keeps the reusable capability.",
  },
  {
    question: "Is the fee based on the headline contract value?",
    answer:
      "No. It follows cash actually collected. Refunds, reductions, and SLA credits reduce the applicable volume; expansions enter the active band when collected.",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Pricing | Free to evaluate, paid when a robot is working"
        description="Sites submit jobs free. Robot teams evaluate free. The site pays a success fee only after a deployment produces collected provider revenue."
        canonical="/pricing"
        jsonLd={[
          webPageJsonLd({
            path: "/pricing",
            name: "Blueprint deployment network pricing",
            description:
              "Free core access plus a site-paid deployment success fee.",
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
        chips={["$0 site submission", "$0 robot-team core", "5% success fee"]}
        ctaHref={siteHref}
        ctaLabel="Submit a job"
        secondaryHref={robotHref}
        secondaryLabel="Join as a robot team"
        imageSrc="/redesign/pov/factory-conveyor.jpg"
        imageAlt="Factory workflow prepared for robot deployment"
        imageCaption="Success fee · not a lead fee"
      />

      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="Start free"
            title="Both sides get through months 0–2 without a platform fee."
            onInk
          />
          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-runway-line bg-runway-line lg:grid-cols-3">
            {freeAccess.map((item, index) => (
              <Reveal key={item.who} delay={index * 0.06}>
                <article className="h-full bg-runway-panel p-6 lg:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-micro font-semibold uppercase tracking-eyebrow text-runway-signal">
                      {item.who}
                    </span>
                    <span className="font-mono text-title-m font-semibold text-runway-text">
                      {item.price}
                    </span>
                  </div>
                  <h2 className="mt-6 text-title-m font-semibold tracking-tight text-runway-text">
                    {item.title}
                  </h2>
                  <p className="mt-3 text-body-s leading-7 text-runway-mute">
                    {item.body}
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
            eyebrow="Human capture"
            title="Free to submit does not mean free camera crew for everyone."
            lede="Blueprint reviews the self-captured task first. Professional capture is reserved for opportunities with credible value, complete intake, robot-team interest, repeat-site leverage, or a refundable commitment deposit."
          />
          <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-runway-line bg-runway-line sm:grid-cols-3">
            {[
              "Automatic screen passes",
              "Commercial intent is credible",
              "Focused workflow capture is justified",
            ].map((item) => (
              <div
                key={item}
                className="flex gap-3 bg-runway-panel p-6 text-body-s font-semibold text-runway-text"
              >
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-runway-signal"
                  aria-hidden="true"
                />
                {item}
              </div>
            ))}
          </div>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="When a deployment works"
            title="5% to start. Lower automatically as annual volume grows."
            lede="The site pays. Providers keep their negotiated price. Each rate applies only to its own annual band."
          />
          <DeploymentNetworkPricing />
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner size="narrow" className="py-20 lg:py-28">
          <EditorialFaq
            title="Pricing questions"
            description="The short version of what is free, what is gated, and when the success fee applies."
            items={faqItems}
          />
        </Inner>
      </Band>

      <ClosingCta
        eyebrow="Start free"
        title="Bring the job, or bring the robot."
        body="The site submits the workflow. The robot team tests fit. Blueprint earns when the deployment produces collected provider revenue."
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
