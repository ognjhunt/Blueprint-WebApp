import { SEO } from "@/components/SEO";
import { EditorialFaq, EditorialSectionIntro } from "@/components/site/editorial";
import { faqJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

export const faqItems = [
  { question: "What does Blueprint sell?", answer: "One customer-facing service: a Task Evaluation Run. It turns a real site-task into a maintained testbed, routes each decision-relevant claim to qualified evidence, and returns a bounded decision or explicit abstention." },
  { question: "Do robot teams and site operators use different products?", answer: "No. They are personas using the same request contract, workflow, result model, pricing concept, and call to action. Robot teams often bring policies or checkpoints; site operators may begin with the task and missing evidence." },
  { question: "Do I choose the simulation or world-model backend?", answer: "No. You describe the decision, site-task, claims, thresholds, false-safe consequence, evidence, budget, deadline, and restrictions. Pipeline owns method qualification and routing." },
  { question: "Does every run return a ranking or winner?", answer: "No. Valid outcomes include bounded positive or negative decisions, elimination of an incompatible candidate, partial decisions, explicit abstention, and a request for the next evidence needed." },
  { question: "What appears in a result?", answer: "The requested decision, per-claim outcomes, selected evidence methods and why, what was measured, validation envelope, coverage, uncertainty, disagreements, claim ceiling, next cheapest experiment, physical evidence needs, exact artifact provenance, and permitted evidence uses." },
  { question: "Can virtual evidence prove physical performance or safety?", answer: "Only within its qualified validation envelope. Estimates are not physical guarantees, safety approval remains external, and claims that cannot be supported virtually still require authoritative physical evidence." },
  { question: "Is post-training a separate product?", answer: "No. Evidence produced inside a run may be marked eligible for post-training use. An export or eligibility flag does not prove that training happened or that a policy improved." },
  { question: "How is a run priced?", answer: "Each run is quoted from its decision, evidence, candidates, scenarios, compute, deadline, rights, and physical requirements. Blueprint does not publish an unconfirmed fixed price." },
];

export default function FAQ() {
  return <><SEO title="Task Evaluation Run FAQ | Blueprint" description="How Blueprint scopes decisions, routes evidence, reports abstention, and maintains proof boundaries." canonical="/faq" jsonLd={[webPageJsonLd({ path: "/faq", name: "Task Evaluation Run FAQ", description: "Blueprint Task Evaluation Run questions and answers." }), faqJsonLd(faqItems)]} /><section className="bg-canvas"><div className="mx-auto max-w-[72rem] px-5 py-16 sm:px-8 lg:py-24"><EditorialSectionIntro eyebrow="FAQ" title="One product, explicit evidence boundaries." description="Blueprint makes the requested decision, unknowns, evidence strength, and next experiment inspectable." /><EditorialFaq className="mt-12" items={faqItems} /></div></section></>;
}
