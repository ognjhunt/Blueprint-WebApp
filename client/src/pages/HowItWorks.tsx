import { ArrowRight } from "lucide-react";
import { EvaluationExample } from "@/components/site/EvaluationExample";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "Show Blueprint one recurring task, review a provider-backed robot pilot offer, then approve and measure the physical trial.";

export default function HowItWorks() {
  return <>
    <SEO title="How it works | Blueprint" description={description} canonical="/how-it-works" jsonLd={webPageJsonLd({ path: "/how-it-works", name: "How Blueprint works", description })} />
    <article className="ms-how ms-container">
      <header className="ms-how-intro"><p className="ms-eyebrow">How it works</p><h1>From one task to a measured pilot.</h1><p>Show us the work. Review a provider-approved offer. Buy a physical trial only if the scope, price, and evidence make sense.</p></header>
      <div className="ms-how-steps ms-how-preparation">
        <section><span className="ms-how-number" aria-hidden="true">01</span><div><h2>Show us the task.</h2><p>Describe the work and share photos or phone video. If you know the pilot price and conditions you would offer, post them. If costs are still uncertain, share a target budget. State the acceptable ongoing price separately.</p><span className="ms-how-result">One task brief with only decision-changing follow-ups.</span></div></section>
        <section><span className="ms-how-number" aria-hidden="true">02</span><div><h2>Review results, then an offer.</h2><p>Before we invite teams to evaluate, your authorized buyer agrees to Blueprint's fee if you buy a pilot from an introduced provider. Teams evaluate for free. You see anonymized results; each team sees its own. A promising team may accept your proposed terms, request changes, or decline. Evaluation alone is not a commitment to deploy. If both sides want to proceed, we introduce you privately and confirm the final offer.</p><span className="ms-how-result">One pilot offer you can accept or decline.</span></div></section>
      </div>
      <EvaluationExample />
      <div className="ms-how-steps">
        <section><span className="ms-how-number" aria-hidden="true">03</span><div><h2>Approve and measure the trial.</h2><p>You see the provider's price and Blueprint's agreed 5% fee, capped at $5,000, before buying. The provider or integrator installs and operates the robot. Blueprint records agreed outcomes, including failures, so you can decide whether to stop, change, or continue.</p><span className="ms-how-result">A purchasing decision grounded in physical results.</span></div></section>
      </div>
      <aside className="ms-how-open"><h2>One credible offer is enough.</h2><p>We begin with bounded parts-handling work and providers that can support a physical trial. If no one can commit, we explain the gap instead of presenting a speculative offer. Calls or site visits happen only to resolve specific uncertainties.</p></aside>
      <div className="ms-how-cta"><a className="ms-button ms-button-large" href="/contact/site-operator">Start a task assessment <ArrowRight size={20} aria-hidden="true" /></a><a className="ms-text-link" href="/contact/robot-team">Apply for early access <ArrowRight size={20} aria-hidden="true" /></a></div>
    </article>
  </>;
}
