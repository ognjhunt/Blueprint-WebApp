import { SEO } from "@/components/SEO";
import { EditorialFaq } from "@/components/site/editorial";
import { Reveal } from "@/components/site/motion";
import { Band, ClosingCta, Inner } from "@/components/site/publicSections";
import { faqJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

export const faqItems = [
  {
    question: "What does Blueprint do?",
    answer:
      "We help a business define one recurring task, check whether a robot provider can credibly support it, scope a funded physical pilot, measure the trial, and decide what happens next. A provider or integrator installs and operates the robot.",
  },
  {
    question: "Why is that useful?",
    answer:
      "Without Blueprint, every robot company redoes site discovery, modelling and early testing from scratch — and basic mismatches often surface only after engineers and hardware are already onsite. That is slow and expensive on both sides.",
  },
  {
    question: "Why call this months 0–2?",
    answer:
      "Agility's published timeline labels its first roughly two months as proof of technology: test the skills, confirm the task fits, and define the workflow — before the robot ever ships. That is the phase Blueprint does.",
  },
  {
    question: "Does Blueprint replace onsite integration?",
    answer:
      "No. The robot company still connects the robot, maps the space, integrates systems, trains the team, and completes safety and commissioning work.",
  },
  {
    question: "Does Blueprint replace the physical pilot?",
    answer:
      "No. We can help coordinate and measure an agreed physical pilot. Real hardware and the responsible site and provider teams are still required to establish onsite performance and safety.",
  },
  {
    question: "Do robot teams download the site twin?",
    answer:
      "No. Qualified teams run approved evaluations inside Blueprint's hosted environment. They never receive a downloadable copy of your site and never receive the walkthrough recording, and nothing they are sent is licensed for training unless a written agreement says so.",
  },
  {
    question: "What if a robot does not fit?",
    answer:
      "We explain the specific mismatch or missing capability and what might need to change. If no provider can credibly support the task, we do not recommend spending on a physical pilot.",
  },
  {
    question: "How is Blueprint paid?",
    answer:
      "Initial site assessment and evaluation are free for the site. Robot teams pay $99 per entry — one policy, on one embodiment, against one task at one site. Three policies on one task is $297; three policies on two tasks is $594. An entry has no later supplier commission. For a suitable physical pilot, Blueprint can separately quote a fixed site-paid fee for preparation, coordination, and measurement. The provider's installation and operation charges are separate and the site approves all commitments.",
  },
];

export default function FAQ() {
  return (
    <>
      <SEO
        title="FAQ | Robot evaluation and deployment | Blueprint"
        description="Plain answers about scoping a task, arranging a measured robot pilot, physical responsibilities, and pricing."
        canonical="/faq"
        jsonLd={[
          webPageJsonLd({
            path: "/faq",
            name: "Blueprint deployment preparation FAQ",
            description:
              "Plain-English questions and answers about Blueprint's managed robot pilot service.",
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
              We help turn one task into a measured pilot.
            </h1>
            <p className="mt-7 max-w-[44rem] text-body-l leading-8 text-runway-mute">
              Short answers. No jargon.
            </p>
          </Reveal>
          <Reveal delay={0.08} className="mt-14">
            <EditorialFaq title="Questions" items={faqItems} />
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
