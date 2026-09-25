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
        <section><span className="ms-how-number" aria-hidden="true">01</span><div><h2>Show us the task.</h2><p>Describe the work and share photos or phone video. Tell us the required output, location, timing, and rough economics. You can be exploring, have a budget, or be ready to buy; an exact approved budget is not required to start.</p><span className="ms-how-result">One task brief with only decision-changing follow-ups.</span></div></section>
        <section><span className="ms-how-number" aria-hidden="true">02</span><div><h2>Review results, then an offer.</h2><p>Qualified teams evaluate approved tasks for free without showing their business names to each other. You see anonymized results and uncertainties; each team sees its own results. If both sides want to discuss a pilot, we introduce you privately. The provider then confirms its scope, price, timing, and site conditions. You see one itemized offer including Blueprint's fee.</p><span className="ms-how-result">One pilot offer you can accept or decline.</span></div></section>
      </div>
      <EvaluationExample />
      <div className="ms-how-steps">
        <section><span className="ms-how-number" aria-hidden="true">03</span><div><h2>Approve and measure the trial.</h2><p>You approve the provider's scope and price plus Blueprint's fee before paid work. The provider or integrator installs and operates the robot. Blueprint coordinates the agreed plan and records outcomes, including failures, so you can decide whether to stop, change, or continue.</p><span className="ms-how-result">A purchasing decision grounded in physical results.</span></div></section>
      </div>
      <aside className="ms-how-open"><h2>One credible offer is enough.</h2><p>We begin with bounded parts-handling work and providers that can support a physical trial. If no one can commit, we explain the gap instead of presenting a speculative offer. Calls or site visits happen only to resolve specific uncertainties.</p></aside>
      <div className="ms-how-cta"><a className="ms-button ms-button-large" href="/contact/site-operator">Start a task assessment <ArrowRight size={20} aria-hidden="true" /></a><a className="ms-text-link" href="/contact/robot-team">Apply for early access <ArrowRight size={20} aria-hidden="true" /></a></div>
    </article>
  </>;
}
