import { ArrowRight } from "lucide-react";
import { JobFitQuestions } from "@/components/site/JobFitQuestions";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "Describe a recurring job, assess suitable automation, compare delivery proposals and agree a measured pilot. Blueprint makes the decision clear, with evaluation where needed.";

const steps = [
  { title: "Describe the job", text: "Tell us what happens today, how often it happens and what a good result looks like. A description is enough to start. Add video or photos when you have permission to share them.", result: "A draft job brief for you to review." },
  { title: "Agree the brief", text: "We fill in the important details: objects, dimensions, variation, quality, operating hours and exceptions. Discuss installation and ongoing spending limits when you know them; no approved budget is needed to start exploring.", result: "One shared scope and a clear measure of success." },
  { title: "Assess suitable options", text: "We check mechanical fit, useful existing evidence, likely economics and who can deliver and support the approach. We shortlist plausible configurations before spending time on detailed tests.", result: "Suitable options and the questions still to answer." },
  { title: "Test what matters", text: "Use prior deployment evidence, simulation or physical tests where they help resolve a decision. Blueprint runs comparisons where compatible access is available and works with technology teams when their participation is needed.", result: "Evidence, its limits and any remaining uncertainty." },
  { title: "Compare delivery proposals", text: "Suitable deployment partners quote against the same brief. Compare equipment, installation, ongoing cost, human assistance, timing and support. We explain our recommendation; you choose the partner and agree the pilot price and terms directly.", result: "A defined pilot with an accountable delivery partner." },
  { title: "Measure the result", text: "The delivery partner installs and operates the agreed pilot. Measure completed work, quality, cycle time and interventions against the acceptance criteria. Use the result to expand, change the approach or stop.", result: "A recorded outcome and an informed next decision." },
];

export default function HowItWorks() {
  return <>
    <SEO title="How it works | Blueprint" description={description} canonical="/how-it-works" jsonLd={webPageJsonLd({ path: "/how-it-works", name: "How Blueprint works", description })} />
    <article className="ms-how ms-container mp-how">
      <header className="ms-how-intro"><p className="ms-eyebrow">How it works</p><h1>Start with the work. Get a clear next step.</h1><p className="mp-how-lead">From one recurring job to a suitable approach, a delivery proposal and a measured pilot.</p></header>
      <ol className="mp-process-list">{steps.map((step, index) => <li key={step.title}><span className="mp-process-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div><h2>{step.title}</h2><p>{step.text}</p><p className="mp-process-result"><span>You get</span> {step.result}</p></div></li>)}</ol>

      <section className="mp-how-section" id="evaluation" aria-labelledby="evaluation-title"><h2 id="evaluation-title">The right amount of evaluation.</h2><p>A job does not automatically need a new simulation. Familiar conditions may already have useful evidence. New objects, contact behavior or an unfamiliar setup may need targeted testing. We explain what the chosen evidence can and cannot answer.</p><p>Simulation results are bounded estimates. They do not establish physical performance or safety. The on-site pilot measures the actual result, and the delivery partner owns the safety and integration work agreed in its contract.</p></section>

      <section className="mp-how-section" id="costs" aria-labelledby="costs-title"><h2 id="costs-title">Agree a budget early. Fix a price before the pilot.</h2><p>Your budget helps identify sensible options. A provider commits to a price once the scope, responsibilities and acceptance criteria are clear. Proposals should separate installation and equipment from recurring software, support and human assistance.</p><p>Blueprint assessment, evaluations, recommendations and coordination are free during the beta, with no cut of the pilot. You approve spending and contract for physical work directly with your chosen delivery partner.</p></section>

      <section className="mp-how-section" id="responsibilities" aria-labelledby="responsibilities-title"><h2 id="responsibilities-title">Know who is responsible.</h2><dl className="mp-decision-list"><div><dt>Blueprint</dt><dd>Help define the job, assess options, explain the evidence, coordinate proposals and record the outcome.</dd></div><div><dt>Your deployment partner</dt><dd>Supply and integrate the system, commission the pilot, train operators and provide the support you agree.</dd></div><div><dt>Your site</dt><dd>Review the brief, approve information sharing and spending, provide agreed site access and accept the result against the criteria.</dd></div></dl></section>

      <section className="mp-how-section" id="warehouse-task" aria-labelledby="example-title"><p className="ms-eyebrow">Illustrative job</p><h2 id="example-title">Place cases from a tote into a tray.</h2><p>Start with the objects, work area and required placement quality. Check whether suitable equipment can reach and handle the cases. Test uncertain placements or object variations, then ask a delivery partner to quote a pilot with agreed throughput, intervention limits and support.</p><p className="mp-support-note">This describes a process example, not a measured customer result or an available deployment offer.</p></section>

      <section className="ms-how-open ms-how-fit" id="job-fit" aria-labelledby="job-fit-title"><div><h2 id="job-fit-title">Jobs we can assess first.</h2><p>Our initial focus is bounded manipulation: known objects and a stable work area. These questions help scope a useful evaluation. If you are unsure, describe the job and we will help assess it.</p></div><JobFitQuestions withFailureModes /></section>
      <aside className="ms-how-open ms-how-robots" id="robot-fit"><h2>Choose the approach that fits the job.</h2><p>Robot form alone does not decide the answer. Fixed arms, humanoids, wheeled humanoids and mobile manipulators can be considered where the specific setup is compatible. We check hardware, software, task fit and a delivery partner&apos;s support before recommending a pilot.</p></aside>
      <div className="ms-how-cta"><a className="ms-button" href="/contact/site-operator">Submit a job <ArrowRight size={20} aria-hidden="true" /></a><a className="ms-text-link" href="/partners">Become a partner <ArrowRight size={20} aria-hidden="true" /></a></div>
    </article>
  </>;
}
