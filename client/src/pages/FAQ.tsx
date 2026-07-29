import { SEO } from "@/components/SEO";
import { CinematicMedia, Reveal } from "@/components/site/motion";
import {
  Accent,
  BigCta,
  Section,
  SectionHead,
} from "@/components/site/publicSections";
import { faqJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const faqGroups = [
  {
    index: "01",
    heading: "The service",
    items: [
      {
        question: "What does Blueprint sell?",
        answer:
          "One customer-facing service: a Task Evaluation Run. It turns a real site-task into a maintained testbed, routes each decision-relevant claim to qualified evidence, and returns a bounded decision or explicit abstention.",
      },
      {
        question: "Do robot teams and site operators use different products?",
        answer:
          "No. They are personas using the same request contract, workflow, result model, pricing concept, and call to action. Robot teams often bring policies or checkpoints; site operators may begin with the task and missing evidence.",
      },
      {
        question: "Do I choose the simulation or world-model backend?",
        answer:
          "No. You describe the decision, site-task, claims, thresholds, false-safe consequence, evidence, budget, deadline, and restrictions. Pipeline owns method qualification and routing.",
      },
    ],
  },
  {
    index: "02",
    heading: "The evidence",
    items: [
      {
        question: "Does every run return a ranking or winner?",
        answer:
          "No. Valid outcomes include bounded positive or negative decisions, elimination of an incompatible candidate, partial decisions, explicit abstention, and a request for the next evidence needed.",
      },
      {
        question: "What appears in a result?",
        answer:
          "The requested decision, per-claim outcomes, selected evidence methods and why, what was measured, validation envelope, coverage, uncertainty, disagreements, claim ceiling, next cheapest experiment, physical evidence needs, exact artifact provenance, and permitted evidence uses.",
      },
      {
        question: "Can virtual evidence prove physical performance or safety?",
        answer:
          "Only within its qualified validation envelope. Estimates are not physical guarantees, safety approval remains external, and claims that cannot be supported virtually still require authoritative physical evidence.",
      },
      {
        question: "Is post-training a separate product?",
        answer:
          "No. Evidence produced inside a run may be marked eligible for post-training use. An export or eligibility flag does not prove that training happened or that a policy improved.",
      },
    ],
  },
  {
    index: "03",
    heading: "The commercial terms",
    items: [
      {
        question: "How is a run priced?",
        answer:
          "Each run is quoted from its decision, evidence, candidates, scenarios, compute, deadline, rights, and physical requirements. Blueprint does not publish an unconfirmed fixed price.",
      },
    ],
  },
] as const;

// Kept as a flat export: structured data and the prerender path both consume it.
export const faqItems = faqGroups.flatMap((group) =>
  group.items.map((item) => ({ question: item.question, answer: item.answer })),
);

export default function FAQ() {
  return (
    <>
      <SEO
        title="Task Evaluation Run FAQ | Blueprint"
        description="How Blueprint scopes decisions, routes evidence, reports abstention, and maintains proof boundaries."
        canonical="/faq"
        jsonLd={[
          webPageJsonLd({
            path: "/faq",
            name: "Task Evaluation Run FAQ",
            description: "Blueprint Task Evaluation Run questions and answers.",
          }),
          faqJsonLd(faqItems),
        ]}
      />

      <section className="relative isolate overflow-hidden bg-ink">
        <div aria-hidden className="bp-evidence-grid absolute inset-0 opacity-[0.12]" />
        <div className="relative mx-auto grid max-w-[88rem] gap-12 px-5 pb-16 pt-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:items-center lg:px-10 lg:pb-20 lg:pt-24">
          <Reveal y="1.75rem">
            <div className="flex items-center gap-4">
              <span aria-hidden className="h-px w-10 bg-brass/70" />
              <span className="font-mono text-[10px] uppercase tracking-[0.26em] text-brass">
                FAQ
              </span>
            </div>
            <h1 className="mt-7 max-w-[26ch] font-display text-[clamp(2.5rem,5vw,4.4rem)] font-medium leading-[1] tracking-[-0.045em] text-[color:var(--text-on-ink)]">
              One product, and the boundaries printed on it.
            </h1>
            <p className="mt-7 max-w-[38rem] text-[1.0625rem] leading-[1.75] text-white/70">
              What we sell, what a result contains, what it will never contain, and how a run gets
              priced. If a question here reads like a hedge, it is because the honest answer is a
              limit rather than a promise.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <CinematicMedia
              src="/redesign/pov/dishwasher.jpg"
              alt="Real kitchen task environment used as a site-task example"
              caption="Site-task · kitchen line"
              meta="Illustrative"
              wash="soft"
              className="aspect-[4/3] w-full"
            />
          </Reveal>
        </div>
      </section>

      {faqGroups.map((group, groupIndex) => (
        <Section
          key={group.heading}
          tone={groupIndex % 2 === 0 ? "canvas" : "paper"}
          divider={groupIndex === 0}
          innerClassName="py-16 lg:py-20"
        >
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)] lg:gap-16">
            <SectionHead
              index={group.index}
              eyebrow={group.heading}
              title={
                groupIndex === 0 ? (
                  <>
                    What you are <Accent>actually buying</Accent>.
                  </>
                ) : groupIndex === 1 ? (
                  <>
                    What the evidence <Accent>can and cannot carry</Accent>.
                  </>
                ) : (
                  <>
                    How the <Accent>number is arrived at</Accent>.
                  </>
                )
              }
              className="lg:sticky lg:top-28 lg:self-start"
            />

            <dl className="divide-y divide-line">
              {group.items.map((item) => (
                <div key={item.question} className="py-6 first:pt-0">
                  <dt className="font-display text-[1.3rem] font-medium leading-snug tracking-[-0.02em] text-ink-900">
                    {item.question}
                  </dt>
                  <dd className="mt-3 max-w-[46rem] text-[14.5px] leading-7 text-ink-500">
                    {item.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Section>
      ))}

      <BigCta
        eyebrow="Still deciding"
        title={
          <>
            The fastest way to find out <br className="hidden sm:block" />
            is to state the decision.
          </>
        }
        body="Describe the site-task and what you need to know. If the evidence cannot support the answer you need, we will tell you that during scoping — not after you have paid for it."
        imageSrc="/redesign/pov/inspection-bench.jpg"
        imageAlt="Inspection bench in a real site-task environment"
        primaryHref="/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=faq"
        primaryLabel="Request a Task Evaluation Run"
        secondaryHref="/how-it-works"
        secondaryLabel="How a run works"
      />
    </>
  );
}
