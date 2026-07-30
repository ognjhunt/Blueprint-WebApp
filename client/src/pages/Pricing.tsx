import { Check } from "lucide-react";

import { SEO } from "@/components/SEO";
import { Button, ProofBoundary } from "@/components/blueprint";
import { EditorialFaq } from "@/components/site/editorial";
import { OutcomeSpectrum } from "@/components/site/figures";
import { Reveal } from "@/components/site/motion";
import {
  Band,
  ClosingCta,
  Inner,
  NoteCards,
  PageHero,
  SectionHeader,
} from "@/components/site/publicSections";
import {
  closingCta,
  homeOutcomes,
  pricingBoundaries,
  pricingDrivers,
  pricingHero,
  pricingIncluded,
} from "@/data/publicSiteCopy";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const runHref =
  "/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=pricing";

const faqItems = [
  {
    question: "Why is there no price on this page?",
    answer:
      "Because two runs that sound identical can need very different evidence. A decision resting on an existing testbed with prior evidence costs a fraction of a cold start on a contact-heavy task with a hard deadline. Publishing one number would mean overcharging the first or underdelivering the second.",
  },
  {
    question: "Do robot teams and site operators buy different things?",
    answer:
      "No. Same service, same intake, same workflow, same result model. A robot team usually arrives with candidates; a site operator usually arrives with a job and no candidates yet. Neither is a different product.",
  },
  {
    question: "What if the run cannot answer my question?",
    answer:
      "Then it says so, tells you which claims stayed open and why, and names the cheapest test that would settle them. That is a valid delivered result — a quote pays for the work and an honest answer, not for a particular verdict.",
  },
  {
    question: "Is post-training something I buy separately?",
    answer:
      "No. Evidence produced inside a run can be marked eligible for evaluation or post-training use. That flag records permission, not an outcome — it does not mean training happened or that a policy improved.",
  },
  {
    question: "Can I set the price by naming my budget?",
    answer:
      "Your budget and deadline are real inputs to scoping and we want them early. But the site does not treat a client-supplied number as authoritative — scope, price, and authorisation stay on our side of the boundary.",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Task Evaluation Run pricing | Blueprint"
        description="One scoped Task Evaluation Run, quoted from the decision, the evidence it needs, the candidates and conditions, the deadline, rights, and any physical work."
        canonical="/pricing"
        jsonLd={[
          webPageJsonLd({
            path: "/pricing",
            name: "Task Evaluation Run pricing",
            description: "One scoped Task Evaluation Run, quoted per decision.",
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
        chips={["One thing to buy", "Quoted before you authorise", "No tiers, no add-ons"]}
        ctaHref={runHref}
        ctaLabel="Request a Task Evaluation Run"
        secondaryHref="/how-it-works"
        secondaryLabel="How it works"
        imageSrc="/redesign/pov/factory-conveyor.jpg"
        imageAlt="An industrial line of the kind a site-task is captured from"
        imageCaption="Scoped per decision"
      />

      {/* What moves the number */}
      <Band tone="ink">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="01"
            eyebrow="What moves the number"
            title="Six things, and none of them is a tier."
            lede="Fixed campaign prices are gone. They implied every decision needs the same evidence, which was never true — and it made the cheap runs expensive."
            onInk
          />
          <div className="mt-14 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {pricingDrivers.map((driver, index) => (
              <Reveal key={driver.label} delay={index * 0.05}>
                <div className="border-t border-white/15 pt-5">
                  <span className="font-mono text-[11px] tracking-[0.2em] text-brass">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3.5 text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--text-on-ink)]">
                    {driver.label}
                  </h3>
                  <p className="mt-2.5 max-w-[40ch] text-[14px] leading-[1.7] text-ink-300">
                    {driver.detail}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Inner>
      </Band>

      {/* What the scope covers */}
      <Band tone="canvas">
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="02"
            eyebrow="What a quote covers"
            title="One scoped run, and everything needed to read it."
          />
          <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <Reveal>
              <div className="rounded-lg border border-line bg-ink p-7 lg:p-9">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">
                  Task Evaluation Run
                </p>
                <h3 className="mt-6 font-display text-[clamp(2.2rem,3.4vw,2.9rem)] font-medium leading-[1.02] tracking-[-0.04em] text-[color:var(--text-on-ink)]">
                  Scoped quote
                </h3>
                <p className="mt-5 text-[14.5px] leading-[1.72] text-ink-300">
                  We scope the decision with you, price the evidence it needs, and
                  send the quote before anything is authorised. You will know what
                  the run can and cannot settle before you commit to it.
                </p>
                <Button asChild variant="brass" size="lg" className="mt-9">
                  <a href={runHref}>Request a Task Evaluation Run</a>
                </Button>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <ul className="grid gap-y-3.5 sm:grid-cols-2 sm:gap-x-8">
                {pricingIncluded.map((item) => (
                  <li key={item} className="flex gap-3 text-[14px] leading-[1.65] text-ink-700">
                    <Check className="mt-[0.2rem] h-4 w-4 shrink-0 text-brass-deep" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </Inner>
      </Band>

      {/* What you are and are not paying for */}
      <Band tone="paper" rule>
        <Inner className="py-20 lg:py-28">
          <SectionHeader
            index="03"
            eyebrow="What the money buys"
            title="An answer. Not necessarily the answer you were hoping for."
            lede="Five outcomes are in scope for every run, and a quote does not privilege the flattering ones."
          />
          <div className="mt-14">
            <OutcomeSpectrum bands={homeOutcomes} />
          </div>
          <NoteCards items={pricingBoundaries} className="mt-16" />
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <Reveal>
              <ProofBoundary level="info" title="Pricing is server-owned">
                Budget and timing are recorded as constraints. Authorisation and any
                transaction stay tied to server-owned records, not to values posted
                from a browser.
              </ProofBoundary>
            </Reveal>
            <Reveal delay={0.08}>
              <ProofBoundary level="warn" title="No guaranteed outcome">
                A quote authorises work. It does not purchase a ranking, a winner, a
                field recommendation, a deployment, a safety approval, or a
                successful physical result.
              </ProofBoundary>
            </Reveal>
          </div>
        </Inner>
      </Band>

      <Band tone="canvas">
        <Inner size="narrow" className="py-20 lg:py-28">
          <EditorialFaq
            title="Pricing questions"
            description="The ones that come up before a first run is scoped."
            items={faqItems}
          />
        </Inner>
      </Band>

      <ClosingCta
        eyebrow={closingCta.eyebrow}
        title={closingCta.title}
        body={closingCta.body}
        primaryHref="/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=pricing-cta"
        primaryLabel="Request a Task Evaluation Run"
        secondaryHref="/how-it-works"
        secondaryLabel="See how it works"
        imageSrc="/redesign/pov/laundry-folding.jpg"
        imageAlt="A commercial laundry line used as a real-site task context"
      />
    </>
  );
}
