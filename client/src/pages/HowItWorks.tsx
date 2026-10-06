import { ArrowRight } from "lucide-react";
import { WarehousePilotSequence } from "@/components/site/WarehousePilotSequence";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "Show Blueprint one recurring job. Robot teams evaluate it for free, and we send you one recommended pilot to book. No pilot, no fee.";

export default function HowItWorks() {
  return <>
    <SEO title="How it works | Blueprint" description={description} canonical="/how-it-works" jsonLd={webPageJsonLd({ path: "/how-it-works", name: "How Blueprint works", description })} />
    <article className="ms-how ms-container">
      <header className="ms-how-intro"><p className="ms-eyebrow">How it works</p><h1>From one job to a measured pilot.</h1><p>Show us the task. Get our recommended pilot. Book it and test it on site.</p></header>
      <WarehousePilotSequence />
      <aside className="ms-how-open" id="job-fit"><h2>Is your job a fit?</h2><p>Start with repeatable parts handling: moving known, rigid objects between trays, fixtures or a conveyor in a fixed work area. Changing layouts, flexible objects or open-ended work need a separate fit check. A description is enough to start.</p></aside>
      <div className="ms-how-cta"><a className="ms-button ms-button-large" href="/contact/site-operator">Start a job assessment <ArrowRight size={20} aria-hidden="true" /></a><a className="ms-text-link" href="/contact/robot-team">Apply for early access <ArrowRight size={20} aria-hidden="true" /></a></div>
    </article>
  </>;
}
