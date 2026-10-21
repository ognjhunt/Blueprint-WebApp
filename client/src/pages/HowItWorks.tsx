import { ArrowRight } from "lucide-react";
import { JobFitQuestions } from "@/components/site/JobFitQuestions";
import { WarehousePilotSequence } from "@/components/site/WarehousePilotSequence";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "From a video of your job to a measured robot pilot: Blueprint reconstructs your workspace, compares suitable robots and policies in simulation, and helps you choose a deployment partner.";

export default function HowItWorks() {
  return <>
    <SEO title="How it works | Blueprint" description={description} canonical="/how-it-works" jsonLd={webPageJsonLd({ path: "/how-it-works", name: "How Blueprint works", description })} />
    <article className="ms-how ms-container">
      <header className="ms-how-intro">
        <p className="ms-eyebrow">How it works</p>
        <h1>Start with your task.</h1>
      </header>
      <WarehousePilotSequence />
      <section className="ms-how-open ms-how-fit" id="job-fit" aria-labelledby="job-fit-title"><div><h2 id="job-fit-title">Jobs we can assess first.</h2><p>Our initial focus is bounded manipulation: known objects and a stable work area. These questions help scope a useful evaluation. Start with a video of the job; we draft the description from it.</p></div><JobFitQuestions withFailureModes /></section>
      <aside className="ms-how-open ms-how-robots" id="robot-fit"><h2>Choose the approach that fits the job.</h2><p>Robot form alone does not decide the answer. Fixed arms, humanoids, wheeled humanoids and mobile manipulators can be considered where the specific setup is compatible. We check hardware, software, task fit and a delivery partner&apos;s support before recommending a pilot.</p></aside>
      <div className="ms-how-cta"><a className="ms-button ms-button-large" href="/contact/site-operator">Submit a job <ArrowRight size={20} aria-hidden="true" /></a><a className="ms-text-link" href="/partners">Become a partner <ArrowRight size={20} aria-hidden="true" /></a></div>
    </article>
  </>;
}
