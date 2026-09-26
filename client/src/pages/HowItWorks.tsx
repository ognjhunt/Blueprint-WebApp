import { ArrowRight } from "lucide-react";
import { EvaluationExample } from "@/components/site/EvaluationExample";
import { SEO } from "@/components/SEO";
import { formatPrice, matchFeeUsd } from "@/lib/evaluationPricing";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "Show Blueprint one recurring task. Robot teams evaluate it for free, and when one matches, we introduce you. No match, no fee.";

export default function HowItWorks() {
  return <>
    <SEO title="How it works | Blueprint" description={description} canonical="/how-it-works" jsonLd={webPageJsonLd({ path: "/how-it-works", name: "How Blueprint works", description })} />
    <article className="ms-how ms-container">
      <header className="ms-how-intro"><p className="ms-eyebrow">How it works</p><h1>From one task to a measured pilot.</h1><p>Show us the work. Meet the robot teams that match. Run a pilot only if the price and evidence make sense.</p></header>
      <div className="ms-how-steps ms-how-preparation">
        <section><span className="ms-how-number" aria-hidden="true">01</span><div><h2>Show us the task.</h2><p>Describe the work and share photos or phone video. If you know the pilot price and conditions you would offer, post them. If costs are still uncertain, share a target budget. State the acceptable ongoing price separately.</p><span className="ms-how-result">One task brief with only decision-changing follow-ups.</span></div></section>
        <section><span className="ms-how-number" aria-hidden="true">02</span><div><h2>Meet your match.</h2><p>When you approve your task brief, you can open it to pilot proposals. That is when you agree to our fee: {formatPrice(matchFeeUsd)} per task, only if we find a match. No match, no fee. Robot teams evaluate your task for free. When one passes the evaluation, fits your budget, and wants your pilot, we introduce you right away and send our invoice. Teams that don't match stay anonymous.</p><span className="ms-how-result">Every team that matches, with its results and a pilot brief.</span></div></section>
      </div>
      <EvaluationExample />
      <div className="ms-how-steps">
        <section><span className="ms-how-number" aria-hidden="true">03</span><div><h2>Run the pilot.</h2><p>You and the team agree the pilot's price and terms directly. Blueprint takes no cut of the pilot or any deployment that follows. The provider or integrator installs and operates the robot, and the pass mark in your task brief shows whether it worked.</p><span className="ms-how-result">A decision grounded in physical results.</span></div></section>
      </div>
      <aside className="ms-how-open"><h2>One credible match is enough.</h2><p>We begin with bounded parts-handling work and robot teams that can support a physical trial. If no team matches, we explain the gap, and you pay nothing. Calls or site visits happen only to resolve specific uncertainties.</p></aside>
      <div className="ms-how-cta"><a className="ms-button ms-button-large" href="/contact/site-operator">Start a task assessment <ArrowRight size={20} aria-hidden="true" /></a><a className="ms-text-link" href="/contact/robot-team">Apply for early access <ArrowRight size={20} aria-hidden="true" /></a></div>
    </article>
  </>;
}
