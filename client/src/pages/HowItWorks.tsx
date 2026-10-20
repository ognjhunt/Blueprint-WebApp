import { ArrowRight } from "lucide-react";
import { JobFitQuestions } from "@/components/site/JobFitQuestions";
import { WarehousePilotSequence } from "@/components/site/WarehousePilotSequence";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "From one recurring task to a measured robot pilot: capture the task, invited robot teams evaluate it in simulation, and Blueprint recommends one team whose evaluation passed. Free during the beta.";

export default function HowItWorks() {
  return <>
    <SEO title="How it works | Blueprint" description={description} canonical="/how-it-works" jsonLd={webPageJsonLd({ path: "/how-it-works", name: "How Blueprint works", description })} />
    <article className="ms-how ms-container">
      <header className="ms-how-intro">
        <p className="ms-eyebrow">How it works</p>
        <h1>Start with your task.</h1>
      </header>
      <WarehousePilotSequence />
      <section className="ms-how-open ms-how-fit" id="job-fit" aria-labelledby="job-fit-title">
        <div>
          <h2 id="job-fit-title">Is your job a fit?</h2>
          <p>We screen every job against four questions. They are our own criteria, not an industry standard. If a job misses one, we tell you which and what it would take to pass.</p>
        </div>
        <JobFitQuestions withFailureModes />
      </section>
      <aside className="ms-how-open ms-how-robots" id="robot-fit">
        <h2>Any robot that fits the task can take part.</h2>
        <p>Fixed arms, humanoids, wheeled humanoids and mobile manipulators are welcome. A team can bring multiple robots, policies or checkpoints. We assess task fit and simulation compatibility for each job. Start with one recurring task at your site. A description is enough to start. We confirm what the evaluation can measure and what the physical pilot needs to test.</p>
      </aside>
      <div className="ms-how-cta"><a className="ms-button ms-button-large" href="/contact/site-operator">Show us a task <ArrowRight size={20} aria-hidden="true" /></a><a className="ms-text-link" href="/contact/robot-team">Apply for early access <ArrowRight size={20} aria-hidden="true" /></a></div>
    </article>
  </>;
}
