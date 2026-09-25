import { SEO } from "@/components/SEO";
import { EditorialFaq } from "@/components/site/editorial";
import { Reveal } from "@/components/site/motion";
import { Band, ClosingCta, Inner } from "@/components/site/publicSections";
import { entryPrice, formatPrice, pilotIntroductionFeeCapUsd } from "@/lib/evaluationPricing";
import { faqJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

export const faqItems = [
  {
    question: "What does Blueprint do?",
    answer:
      "We turn one recurring task into a provider-backed pilot offer when a credible fit exists. We use evaluation where it improves that offer, record the trial's physical results, and help the site decide what follows. The provider or integrator installs and operates the robot.",
  },
  {
    question: "Why is that useful?",
    answer:
      "Without Blueprint, every robot company redoes site discovery, modelling and early testing from scratch — and basic mismatches often surface only after engineers and hardware are already onsite. That is slow and expensive on both sides.",
  },
  {
    question: "How do you find a robot team for my task?",
    answer:
      "We match your task to participating teams' configurations and run supported evaluations on tasks you approve for access. You see anonymized results first; each team sees its own results. A promising team can accept your proposed pilot terms, suggest changes, or decline. If both sides want to proceed, we make a private introduction. Evaluation alone does not commit either side to a pilot.",
  },
  {
    question: "Do I need to book a call or host Blueprint onsite?",
    answer:
      "No. Start with a task description and phone footage. We collect missing details and approvals in writing. A call may help with an unusual scope, while the robot provider or integrator handles the physical work onsite.",
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
    question: "Can we set the pilot price and conditions?",
    answer:
      "Yes. For a defined task, propose what you would pay and what the pilot must include. A provider can accept, suggest changes, or decline. If costs are still uncertain, mark the number as a target budget instead. A posted price is not a purchase order. Blueprint shows its separate 5% fee, capped at $5,000, before you buy.",
  },
  {
    question: "How is Blueprint paid?",
    answer:
      `Task submission and initial screening are free. Before teams are invited to evaluate, an authorized site buyer agrees to a task-specific fee: 5% of an introduced provider's purchased physical pilot, capped at ${formatPrice(pilotIntroductionFeeCapUsd)}. The fee applies even if you contract directly with that provider; no pilot purchase means no Blueprint fee. Invited robot-team evaluations are free. Optional self-directed runs cost ${formatPrice(entryPrice)} per entry, with no later supplier commission on that entry.`,
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
