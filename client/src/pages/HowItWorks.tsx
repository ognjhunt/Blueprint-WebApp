import { ArrowRight } from "lucide-react";
import { WarehousePilotSequence } from "@/components/site/WarehousePilotSequence";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "Show Blueprint one recurring job for an initial evidence-backed assessment. Invited beta participants start free; later work is agreed separately.";

export default function HowItWorks() {
  return <>
    <SEO title="How it works | Blueprint" description={description} canonical="/how-it-works" jsonLd={webPageJsonLd({ path: "/how-it-works", name: "How Blueprint works", description })} />
    <article className="ms-how ms-container">
      <header className="ms-how-intro">
        <p className="ms-eyebrow">How it works</p>
        <h1>Start with your task.</h1>
      </header>
      <WarehousePilotSequence />
      <aside className="ms-how-open" id="job-fit"><h2>Is your job a fit?</h2><p>Start with repeatable parts handling: moving known, rigid objects between trays, fixtures or a conveyor in a fixed work area. Changing layouts, flexible objects or open-ended work need a separate fit check. A description is enough to start.</p></aside>
      <div className="ms-how-cta"><a className="ms-button ms-button-large" href="/contact/site-operator">Show us a task <ArrowRight size={20} aria-hidden="true" /></a><a className="ms-text-link" href="/contact/robot-team">Apply for early access <ArrowRight size={20} aria-hidden="true" /></a></div>
    </article>
  </>;
}
