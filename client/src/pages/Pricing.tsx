import { ArrowRight, Check } from "lucide-react";

import { SEO } from "@/components/SEO";
import { Button, Eyebrow, ProofBoundary } from "@/components/blueprint";
import { EditorialCtaBand, EditorialFaq, EditorialSectionIntro, ProofChip } from "@/components/site/editorial";
import { TileGrid } from "@/components/site/TileGrid";
import { blueprintPositioning } from "@/data/robotPolicyEvaluationClaims";
import { breadcrumbJsonLd, faqJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const included = [
  "One decision-oriented request for a real site-task",
  "A versioned Site-Task Testbed reference",
  "Claim, threshold, false-safe, budget, and deadline scoping",
  "Pipeline-qualified evidence plan and per-claim outcomes",
  "Decision, partial decision, or explicit abstention",
  "Validation envelope, uncertainty, disagreements, and claim ceiling",
  "Next cheapest experiment and physical-evidence requirements",
  "Exact evidence provenance and permitted-use eligibility",
];

const faqItems = [
  {
    question: "How is a Task Evaluation Run priced?",
    answer: "Each run is quoted from the decision, evidence already available, number of candidates and scenarios, compute, deadline, rights constraints, and any physical work required. Blueprint does not publish an invented fixed price.",
  },
  {
    question: "Do robot teams and site operators buy different products?",
    answer: "No. They are two personas using the same Task Evaluation Run, request contract, workflow, result model, and intake. A robot team may bring policies; a site operator may begin with the task and missing evidence.",
  },
  {
    question: "Does every run return a ranking or winner?",
    answer: "No. Valid outcomes include bounded positive or negative decisions, elimination of an incompatible candidate, partial decisions, explicit abstention, or a request for the next evidence needed.",
  },
  {
    question: "Is post-training a separate add-on?",
    answer: "No. A qualifying evidence artifact may be marked eligible for evaluation or post-training use inside a run. Eligibility does not prove that training occurred or that a policy improved.",
  },
];

export default function Pricing() {
  return (
    <>
      <SEO
        title="Task Evaluation Run pricing | Blueprint"
        description="One scoped Task Evaluation Run, quoted according to the decision, evidence, candidates, scenarios, compute, timing, rights, and physical requirements."
        canonical="/pricing"
        jsonLd={[
          webPageJsonLd({ path: "/pricing", name: "Task Evaluation Run pricing", description: "One scoped Task Evaluation Run with request-for-quote pricing." }),
          breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }]),
          faqJsonLd(faqItems),
        ]}
      />

      <section className="bg-canvas">
        <div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <Eyebrow tone="brass" rule>One product · scoped engagement</Eyebrow>
          <h1 className="mt-5 max-w-4xl font-display text-[clamp(2.6rem,5vw,4.4rem)] font-medium leading-[1.02] tracking-[-0.045em] text-ink-900">Price the decision and evidence it actually requires.</h1>
          <p className="mt-5 max-w-3xl text-[1.05rem] leading-[1.7] text-ink-500">{blueprintPositioning}</p>
          <div className="mt-7 flex flex-wrap gap-2"><ProofChip>One Task Evaluation Run</ProofChip><ProofChip>Quote before authorization</ProofChip><ProofChip>Decision or abstention</ProofChip></div>
        </div>
      </section>

      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <EditorialSectionIntro eyebrow="Engagement model" title="One scoped run. No separate package, submission fee, or subscription." description="The quote reflects only what is needed to answer the requested decision at the required evidence strength." />
          <TileGrid cols={2} className="mt-12 rounded-lg">
            <article className="bg-ink p-7 text-paper lg:p-9">
              <Eyebrow tone="onInk">Task Evaluation Run</Eyebrow>
              <h2 className="mt-5 text-title-l font-semibold">Scoped quote</h2>
              <p className="mt-4 text-sm leading-7 text-paper/75">Decision, claims, candidates, evidence gaps, compute, deadline, access, privacy, and physical requirements determine scope.</p>
              <Button asChild variant="brass" size="lg" className="mt-8"><a href="/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=pricing">Request a Task Evaluation Run <ArrowRight className="h-4 w-4" /></a></Button>
            </article>
            <article className="bg-white p-7 lg:p-9">
              <h2 className="text-title-l font-semibold text-ink-900">What the scope covers</h2>
              <ul className="mt-5 space-y-3">{included.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-ink-700"><Check className="mt-1 h-4 w-4 shrink-0 text-brass" />{item}</li>)}</ul>
            </article>
          </TileGrid>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <ProofBoundary level="info" title="Server-authoritative commercial scope">The website records budget and timing constraints, but it does not accept a client-supplied price as authoritative. Authorization and any transaction remain tied to server-owned records.</ProofBoundary>
            <ProofBoundary level="warn" title="No guaranteed outcome">A quote authorizes the work, not a ranking, winner, field recommendation, deployment, safety approval, or successful physical result.</ProofBoundary>
          </div>
        </div>
      </section>

      <section className="bg-canvas"><div className="mx-auto max-w-[70rem] px-5 py-16 sm:px-8 lg:py-24"><EditorialFaq items={faqItems} /></div></section>
      <section className="mx-auto max-w-[88rem] px-5 py-16 sm:px-8 lg:px-10 lg:py-20"><EditorialCtaBand eyebrow="Start with the decision" title="Request a Task Evaluation Run." description="Describe the site-task, the decision you need, thresholds, consequences, evidence, budget, timing, and restrictions. Blueprint scopes the evidence plan with you." imageSrc="/redesign/pov/factory-conveyor.jpg" imageAlt="Real industrial site used to define a task evaluation" primaryHref="/contact/robot-team?interest=task-evaluation-run&requestedOutputs=Task%20Evaluation%20Run&source=pricing-cta" primaryLabel="Request a Task Evaluation Run" secondaryHref="/how-it-works" secondaryLabel="See how it works" /></section>
    </>
  );
}
