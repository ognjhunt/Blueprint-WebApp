import { SEO } from "@/components/SEO";
import { EditorialFaq } from "@/components/site/editorial";
import { OutcomeSpectrum } from "@/components/site/figures";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  Inner,
  NoteCards,
  SectionHeader,
} from "@/components/site/publicSections";
import { closingCta, homeLimits, homeOutcomes } from "@/data/publicSiteCopy";
import { faqJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

export const faqItems = [
  {
    question: "What does Blueprint sell?",
    answer:
      "One service: a Task Evaluation Run. It turns a real job at a real site into a testbed we maintain, tests the claims your decision rests on, and returns an answer with the conditions it holds under — or tells you the evidence will not carry it yet.",
  },
  {
    question: "Do robot teams and site operators use different products?",
    answer:
      "No. Two audiences, one service. They get their own explanation pages because they arrive with different things — a robot team usually has candidates, a site operator usually has a job and no candidates — but the intake, workflow, result model, pricing model, and call to action are identical.",
  },
  {
    question: "Do I choose the simulator or world model?",
    answer:
      "No, and you should not want to. You describe the decision, the task, the claims, the threshold, what a wrong yes would cost, your budget, your deadline, and any restrictions. Which method is qualified for which claim is the judgement you are paying us for.",
  },
  {
    question: "Does every run produce a ranking?",
    answer:
      "No. A run can support a call, rule an option out, settle some claims and not others, or decline to answer. Comparing raw scores to manufacture a winner after the evidence has declined to produce one is exactly the thing this service will not do.",
  },
  {
    question: "What is in a result?",
    answer:
      "The decision you asked about, an outcome per claim, which evidence method was used and why, what it measured, the conditions the answer holds under, coverage, uncertainty, any disagreement between methods, the strongest claim the evidence permits, the cheapest next test, whether physical evidence is required, exact artifact provenance, and what each artifact may be used for.",
  },
  {
    question: "Can virtual evidence prove physical performance or safety?",
    answer:
      "Only inside the conditions it was qualified for, and never as a guarantee. Safety approval is external and stays with you. Claims that cannot be settled virtually still need evidence from real hardware, and the run will say when that is the case.",
  },
  {
    question: "Is post-training a separate product?",
    answer:
      "No. Evidence produced inside a run may be marked eligible for evaluation or post-training use. That flag is permission, not proof — it does not mean training happened or that a policy got better.",
  },
  {
    question: "How is a run priced?",
    answer:
      "Per run, quoted from the decision, the evidence already available, the number of candidates and conditions, compute, deadline, rights constraints, and any physical work. There is no published fixed price, and the old fixed campaign prices are gone.",
  },
  {
    question: "What happened to the other products?",
    answer:
      "Policy Shortlist, Robot Match, Policy Improvement Runs, and separate post-training packages are no longer offered as current products. Existing records, transactions, URLs, and entitlements stay readable, and legacy requests are translated into the current model rather than dropped.",
  },
];

export default function FAQ() {
  return (
    <>
      <SEO
        title="Task Evaluation Run FAQ | Blueprint"
        description="What Blueprint sells, how runs are scoped and priced, what a result contains, and where the evidence stops."
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

      <Band tone="canvas">
        <Inner size="narrow" className="pb-16 pt-20 lg:pb-20 lg:pt-28">
          <Reveal>
            <p className="inline-flex items-center gap-[0.6rem] text-[11px] font-semibold uppercase tracking-[0.2em] leading-none text-brass-deep">
              <span aria-hidden="true" className="h-px w-6 shrink-0 bg-current opacity-50" />
              FAQ
            </p>
            <h1 className="mt-6 max-w-[22ch] font-display text-[clamp(2.6rem,5vw,4.4rem)] font-medium leading-[0.98] tracking-[-0.045em] text-ink-900">
              One service, and the limits printed on it.
            </h1>
            <p className="mt-7 max-w-[46ch] text-[1.05rem] leading-[1.75] text-ink-600">
              The questions below are the ones worth asking before you spend
              anything — including the ones whose honest answer is a no.
            </p>
          </Reveal>
          <Reveal delay={0.1} className="mt-14">
            <EditorialFaq
              title="Questions"
              description="If yours is not here, it is a good first line in a run request."
              items={faqItems}
            />
          </Reveal>
        </Inner>
      </Band>

      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-24">
          <SectionHeader
            eyebrow="For reference"
            title="The five ways a run can end."
            lede="Worth reading once, because four of them are not a winner and all five are valid deliveries."
          />
          <div className="mt-14">
            <OutcomeSpectrum bands={homeOutcomes} />
          </div>
        </Inner>
      </Band>

      <Band tone="ink">
        <Inner className="py-20 lg:py-24">
          <SectionHeader eyebrow="Where we stop" title="The limits, stated plainly." onInk />
          <NoteCards items={homeLimits} onInk className="mt-14" />
        </Inner>
      </Band>

      <ClosingCta
        eyebrow={closingCta.eyebrow}
        title={closingCta.title}
        body={closingCta.body}
        primaryHref="/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=faq-cta"
        primaryLabel="Request a Task Evaluation Run"
        secondaryHref="/how-it-works"
        secondaryLabel="See how it works"
        imageSrc="/redesign/pov/machine-tending.jpg"
        imageAlt="A machine-tending station in a working facility"
      />
    </>
  );
}
