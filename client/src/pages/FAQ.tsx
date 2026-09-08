import { SEO } from "@/components/SEO";
import { EditorialFaq } from "@/components/site/editorial";
import { Reveal } from "@/components/site/motion";
import { Band, ClosingCta, Inner } from "@/components/site/publicSections";
import { faqJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

export const faqItems = [
  {
    question: "What does Blueprint do?",
    answer:
      "We record one real job, rebuild it as a test every robot takes, find out which robots can do it, and hand the gaps and the pass mark to the team doing the install. We only take sites that want a pilot and have budget for one.",
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
      "No. Simulation can filter and focus the trip. Real hardware is still required to prove uptime, throughput, reliability and safety at the actual site.",
  },
  {
    question: "Do robot teams download the site twin?",
    answer:
      "No. Qualified teams run approved evaluations inside Blueprint's hosted environment. They never receive a downloadable copy of your site, and training rights are separate.",
  },
  {
    question: "What if a robot does not fit?",
    answer:
      "That is a useful result — and often the most valuable one, because it stops a pilot that would have failed. Blueprint reports the mismatch and what would have to change. It never invents a winner.",
  },
  {
    question: "How is Blueprint paid?",
    answer:
      "Two numbers, both paid by robot teams: $1,000 to evaluate a site-task, and $10,000 in total if that team wins the work. Nothing recurring. Sites pay nothing.",
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
