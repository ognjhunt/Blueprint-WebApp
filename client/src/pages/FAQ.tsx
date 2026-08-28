import { SEO } from "@/components/SEO";
import { EditorialFaq } from "@/components/site/editorial";
import { DeploymentPipelineChart } from "@/components/site/runway/figures";
import { FigureFrame } from "@/components/site/runway/shell";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  Inner,
  SectionHeader,
} from "@/components/site/publicSections";
import { deploymentPipelineMeta } from "@/data/deploymentMarket";
import { faqJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

export const faqItems = [
  {
    question: "What does Blueprint do?",
    answer:
      "Blueprint evaluates robots for real sites and prepares the deployment. We record one real job, rebuild it as a secure test, find out which robots can do it, and hand the gaps and acceptance criteria to the team doing the install. We only take sites that want a pilot or deployment and have budget for one.",
  },
  {
    question: "Why is that useful?",
    answer:
      "Without Blueprint, every robot company repeats site discovery, modeling, assumptions, and early testing. The answers are hard to compare, and basic mismatches are often found after engineers or hardware are already committed.",
  },
  {
    question: "Do you work with any site that asks?",
    answer:
      "No. We only run evaluations for sites that want a pilot or deployment and are prepared to pay for one. Before a job becomes an evaluation, the site names the work, a budget range, an internal owner, a pilot area, timing, and how it actually buys. That is our admission bar — it is not a signed order, verified funding, or a promise that the site will purchase.",
  },
  {
    question: "Why does that matter to a robot team?",
    answer:
      "Because you are testing against demand instead of a demo. Every job you see on Blueprint already carries a budget, a named owner, and a procurement path, so the qualifying work is done before your deployment engineers spend a day on it.",
  },
  {
    question: "Why call this months 0–2?",
    answer:
      "Agility's published Customer Acceleration Program labels its first roughly two months as Proof of Tech: test skills, confirm use-case fit, gather first KPIs, and define the workflow. Agility also says it recreates customer conditions in simulation and physically at its own facility during this phase.",
  },
  {
    question: "Does Blueprint replace onsite integration?",
    answer:
      "No. The robot provider still connects the real robot, maps the work area, integrates systems, handles site-specific adjustments, trains onsite teams, and completes safety and commissioning work.",
  },
  {
    question: "Does Blueprint replace the physical pilot?",
    answer:
      "No. Simulation can filter and focus the trip. Real hardware is still required to prove uptime, throughput, reliability, safety, and business impact at the actual site.",
  },
  {
    question: "What does a site need to submit?",
    answer:
      "Answers, not artifacts. Six questions about the room decide whether a robot could work there today, and a description of the task in your own words does the rest. Object weights, cycle time, volume, and your acceptance threshold are dropdowns. Nothing has to be measured, drawn, or exported first. If you already have a short video of the task being done, you can point us at it — useful, and optional. Alongside the job we also ask the commercial side: a budget range, a named internal owner, and the procurement path.",
  },
  {
    question: "Do we have to capture the site ourselves?",
    answer:
      "No. Blueprint sends a trained capture operator with a 360 camera and phone rig, and nobody at your site captures anything. Your team supplies an escort, the task objects, and the person who can say what counts as success.",
  },
  {
    question: "Does every site get a capture visit?",
    answer:
      "No, and not because of cost. A capture is the last step of qualification: we screen the task, then check it against the robot teams we are actually in conversation with, and only send an operator once there is a match. We do not capture speculatively — a captured site with no interested robot team costs us money and tells you something false about demand.",
  },
  {
    question: "Do robot teams download the site twin?",
    answer:
      "No. They receive progressive access. Qualified teams can run approved evaluations in Blueprint's controlled environment without receiving unrestricted raw site files. Training rights are negotiated separately.",
  },
  {
    question: "What if a robot does not fit?",
    answer:
      "That is a useful result. Blueprint reports the mismatch, the evidence behind it, and what would have to change. It does not invent a winner or call the site deployment-ready.",
  },
  {
    question: "How is Blueprint paid?",
    answer:
      "Two numbers, both paid by robot teams. $1,000 to evaluate a site-task, which buys a captured task, a standardised test and a scored result. If that team is then selected for the pilot or deployment, the total for that task is $10,000. A team that loses pays $1,000; a team that wins pays $10,000. Nothing else — no percentage, no per-robot rate, nothing recurring. Sites pay nothing, because they contribute the floor, the access and the task data.",
  },
];

export default function FAQ() {
  return (
    <>
      <SEO
        title="FAQ | Robot evaluation and deployment | Blueprint"
        description="Plain answers about how we record a job, test robots against it, hand off the deployment, and what we charge."
        canonical="/faq"
        jsonLd={[
          webPageJsonLd({
            path: "/faq",
            name: "Blueprint deployment preparation FAQ",
            description:
              "Plain-English questions and answers about Blueprint's months 0–2 use case.",
          }),
          faqJsonLd(faqItems),
        ]}
      />

      <Band tone="canvas">
        <Inner size="narrow" className="pb-16 pt-20 lg:pb-24 lg:pt-28">
          <Reveal>
            <p className="text-micro font-semibold uppercase tracking-eyebrow text-runway-signal">
              Plain English
            </p>
            <h1 className="mt-6 max-w-[17ch] font-display uppercase text-[clamp(2.8rem,5.5vw,5.4rem)] font-semibold leading-[0.96] tracking-[0.005em] text-runway-text">
              We find the robot that can do the job, then help you deploy it.
            </h1>
            <p className="mt-7 max-w-[44rem] text-body-l leading-8 text-runway-mute">
              Ten short answers. No simulation jargon required.
            </p>
          </Reveal>
          <Reveal delay={0.08} className="mt-14">
            <EditorialFaq title="Questions" items={faqItems} />
          </Reveal>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            eyebrow="Keep the boundary visible"
            title="We cover the highlighted phase."
          />
          <Reveal className="mt-14">
            <FigureFrame
              label="Fig. 01"
              title="Path to scaled deployment"
              basis="illustrative"
              sources={[deploymentPipelineMeta.source, deploymentPipelineMeta.processSource]}
              caveat={deploymentPipelineMeta.caveat}
            >
              <DeploymentPipelineChart />
            </FigureFrame>
          </Reveal>
        </Inner>
      </Band>

      <ClosingCta
        eyebrow="Still have a question?"
        title="Show us the job."
        body="A short video and a plain-English description are enough to start the screening conversation."
        primaryHref="/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=faq"
        primaryLabel="Submit a job"
        secondaryHref="/contact/robot-team?source=faq"
        secondaryLabel="Talk as a robot team"
        imageSrc="/redesign/pov/route-scan.jpg"
        imageAlt="Captured route through a real facility"
      />
    </>
  );
}
