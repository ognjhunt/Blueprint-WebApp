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
      "Blueprint does the deployment homework before the robot arrives: capture one real workflow, recreate it as a secure testbed, test robot fit, and package the gaps and acceptance criteria for the onsite team.",
  },
  {
    question: "Why is that useful?",
    answer:
      "Without Blueprint, every robot company repeats site discovery, modeling, assumptions, and early testing. The answers are hard to compare, and basic mismatches are often found after engineers or hardware are already committed.",
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
      "Start with phone video, plans when available, object sizes and weights, cycle time, shifts, exceptions, layout and traffic, system interfaces, success criteria, and access or privacy rules. A guided scan can follow when useful.",
  },
  {
    question: "Does every site get a free professional scan?",
    answer:
      "No. Self-capture and automatic screening come first. Professional capture is funded only after the opportunity clears qualification or is backed by a refundable commitment deposit.",
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
      "Sites and robot teams start free. The contracting enterprise pays a success fee when the robot provider actually collects deployment revenue. Robot providers keep their full negotiated price; heavy compute and custom training are scoped separately.",
  },
];

export default function FAQ() {
  return (
    <>
      <SEO
        title="Robot deployment preparation FAQ | Blueprint"
        description="Plain-English answers about months 0–2, site capture, controlled evaluation, onsite integration, physical pilots, data access, and pricing."
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
            <h1 className="mt-6 max-w-[17ch] text-[clamp(2.8rem,5.5vw,5.4rem)] font-semibold leading-[0.96] tracking-[-0.055em] text-runway-text">
              The robot comes later. Blueprint does the homework first.
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
            title="Blueprint covers the highlighted phase."
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
        title="Show us the workflow."
        body="A short video and a plain-English description are enough to start the screening conversation."
        primaryHref="/signup/business?buyerType=site_operator&intent=pilot-opportunity&source=faq"
        primaryLabel="Submit a site task"
        secondaryHref="/contact/robot-team?source=faq"
        secondaryLabel="Talk as a robot team"
        imageSrc="/redesign/pov/route-scan.jpg"
        imageAlt="Captured route through a real facility"
      />
    </>
  );
}
