import { ArrowRight } from "lucide-react";
import { JobFitQuestions } from "@/components/site/JobFitQuestions";
import { WarehousePilotSequence } from "@/components/site/WarehousePilotSequence";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "From a video of your job to a measured robot pilot: Blueprint reconstructs your workspace, runs candidate robots and policies against the job in simulation itself, and shows you a bounded estimate of what works.";

export default function HowItWorks() {
  return <>
    <SEO title="How it works | Blueprint" description={description} canonical="/how-it-works" jsonLd={webPageJsonLd({ path: "/how-it-works", name: "How Blueprint works", description })} />
    <article className="ms-how ms-container">
      <header className="ms-how-intro">
        <p className="ms-eyebrow">How it works</p>
        <h1>Start with your task.</h1>
      </header>
      <WarehousePilotSequence />
      <section className="ms-how-open ms-how-fit" id="job-fit" aria-labelledby="job-fit-title"><div><h2 id="job-fit-title">Jobs we can assess first.</h2><p>Our initial focus is bounded manipulation: known objects and a stable work area. These questions help scope a useful evaluation. We do not turn a job away because of its type: if we cannot simulate yours yet, we accept it and hold it while we prepare its evaluation. Start with a video of the job; we draft the description from it.</p></div><JobFitQuestions withFailureModes /></section>
      <aside className="ms-how-open ms-how-robots" id="robot-fit"><h2>Choose the approach that fits the job.</h2><p>Robot form alone does not decide the answer. Fixed arms, humanoids, wheeled humanoids and mobile manipulators can be considered where the specific setup is compatible. We run the candidates on your job, then check hardware, software and deployment support with the deployment company before a pilot.</p></aside>
      <div className="ms-how-cta"><a className="ms-button ms-button-large" href="/contact/site-operator">Submit a job <ArrowRight size={20} aria-hidden="true" /></a><a className="ms-text-link" href="/partners">Become a partner <ArrowRight size={20} aria-hidden="true" /></a></div>
    </article>
  </>;
}
