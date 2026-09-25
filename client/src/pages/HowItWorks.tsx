import { ArrowRight } from "lucide-react";
import { EvaluationExample } from "@/components/site/EvaluationExample";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "How Blueprint scopes one recurring task, helps arrange a funded physical robot pilot, measures the result, and supports the next purchasing decision.";

export default function HowItWorks() {
  return <>
    <SEO title="How it works | Blueprint" description={description} canonical="/how-it-works" jsonLd={webPageJsonLd({ path: "/how-it-works", name: "How Blueprint works", description })} />
    <article className="ms-how ms-container">
      <header className="ms-how-intro"><p className="ms-eyebrow">How it works</p><h1>From one task to a measured pilot.</h1><p>Blueprint helps your business define one recurring job, check whether a robot can credibly do it, run a bounded paid trial, and decide what to buy afterward.</p></header>
      <div className="ms-how-steps ms-how-preparation">
        <section><span className="ms-how-number" aria-hidden="true">01</span><div><h2>Scope the job.</h2><p>Describe a recurring task and share photos or phone video. We collect missing details in writing: the current process, output target, budget range, pilot timing, decision owner, and site conditions. You approve the task brief online.</p><span className="ms-how-result">A defined job with a budget and an owner.</span></div></section>
        <section><span className="ms-how-number" aria-hidden="true">02</span><div><h2>Check whether a pilot makes sense.</h2><p>With your approval, approved robot teams see a task card, never your footage, and can express interest. We check what each team can actually supply and support before deeper evaluation. Where useful, a controlled evaluation helps expose gaps; it does not prove physical performance.</p><span className="ms-how-result">Ready for a trial, specific changes needed, or no credible fit yet.</span></div></section>
      </div>
      <EvaluationExample />
      <div className="ms-how-steps">
        <section><span className="ms-how-number" aria-hidden="true">03</span><div><h2>Agree on a paid physical trial.</h2><p>For a credible fit, Blueprint helps put the supplier, scope, costs, success criteria, responsibilities, and measurement plan in one place. You approve the commitment. The provider or integrator handles installation and operation; the site and delivery parties approve the safety plan.</p><span className="ms-how-result">A bounded pilot with agreed measures.</span></div></section>
        <section><span className="ms-how-number" aria-hidden="true">04</span><div><h2>Decide what to do next.</h2><p>We stay involved through the trial, collect operating results against the agreed targets, and help you decide to stop, modify, extend, or deploy regularly. Any further work and fee are agreed separately.</p><span className="ms-how-result">A purchasing decision grounded in physical results.</span></div></section>
      </div>
      <aside className="ms-how-open"><h2>Start with a task a provider can support.</h2><p>We begin with bounded parts-handling work and expand by demonstrated capability. Robot teams can apply with the hardware, software, human support, installation, and service they can actually provide. If no one fits, we name the missing capability instead of recommending a pilot.</p></aside>
      <div className="ms-how-cta"><a className="ms-button ms-button-large" href="/contact/site-operator">Start a task assessment <ArrowRight size={20} aria-hidden="true" /></a><a className="ms-text-link" href="/contact/robot-team">Apply for early access <ArrowRight size={20} aria-hidden="true" /></a></div>
    </article>
  </>;
}
