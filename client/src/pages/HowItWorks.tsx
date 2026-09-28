import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { EvaluationExample } from "@/components/site/EvaluationExample";
import { SEO } from "@/components/SEO";
import { formatPrice, matchFeeUsd } from "@/lib/evaluationPricing";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "Show Blueprint one recurring job. Robot teams evaluate it for free, and when one matches, we introduce you. No match, no fee.";

export default function HowItWorks() {
  const matchPackage = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    let frame: number | undefined;
    const revealPackage = () => {
      if (window.location.hash !== "#match-package" || !matchPackage.current) return;
      matchPackage.current.open = true;
      frame = requestAnimationFrame(() => matchPackage.current?.scrollIntoView());
    };
    revealPackage();
    window.addEventListener("hashchange", revealPackage);
    return () => {
      window.removeEventListener("hashchange", revealPackage);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);
  return <>
    <SEO title="How it works | Blueprint" description={description} canonical="/how-it-works" jsonLd={webPageJsonLd({ path: "/how-it-works", name: "How Blueprint works", description })} />
    <article className="ms-how ms-container">
      <header className="ms-how-intro"><p className="ms-eyebrow">How it works</p><h1>From one job to a measured pilot.</h1><p>Start with repeatable parts handling in a fixed work area. Find a robot team and decide whether to run a pilot.</p></header>
      <div className="ms-how-steps ms-how-preparation">
        <section><span className="ms-how-number" aria-hidden="true">01</span><div><h2>Show us the job.</h2><p>Describe the work. Start with what you have: a description, photos, or phone video. We draft a brief for you to correct, including the job, budget and success criteria.</p><span className="ms-how-result">Start free. No approved budget needed.</span></div></section>
        <section><span className="ms-how-number" aria-hidden="true">02</span><div><h2>Meet your match.</h2><p>Approve your brief and choose whether to open it to proposals. That is when you authorize the {formatPrice(matchFeeUsd)} match fee. Robot teams evaluate for free; a match passes the evaluation, fits your budget and wants your pilot. We introduce you and invoice then, even if you do not buy the pilot.</p><span className="ms-how-result">No match, no fee. One fee per job.</span></div></section>
      </div>
      <div className="ms-how-steps">
        <section><span className="ms-how-number" aria-hidden="true">03</span><div><h2>Run the pilot.</h2><p>You and the team agree the pilot's price and terms directly. Blueprint takes no cut of the pilot or any deployment that follows. The provider or integrator installs and operates the robot. Agree how the on-site trial will be measured before it begins.</p><span className="ms-how-result">Simulation informs the choice. The physical trial tests it.</span></div></section>
      </div>
      <details className="ms-task-interest ms-visitor-detail" id="match-package" ref={matchPackage}>
        <summary>See what a match includes</summary>
        <p>Each introduction comes with the team's evaluation results and a shared pilot brief. The team confirms its offer before you see it.</p>
        <h2>Pilot brief · example format</h2>
        <p className="ms-field-hint">Illustrative format, not a customer result or an available provider offer.</p>
        <dl className="ms-legal-rows">
          <div><dt>Job</dt><dd>Move rigid parts from a tray into a fixture. Record the objects, work area, cycle target and exceptions.</dd></div>
          <div><dt>Evaluation</dt><dd>Recorded attempts, measured results, conditions tested and remaining uncertainties. Simulation results are labeled separately from physical results.</dd></div>
          <div><dt>Provider offer</dt><dd>The team's name, robot configuration, pilot scope, price, timing and site requirements, confirmed by that team.</dd></div>
          <div><dt>On-site acceptance</dt><dd>The success criteria to agree before the pilot: cycle time, completed tasks, interventions and who measures them. Physical results are added only after a real trial.</dd></div>
        </dl>
        <p className="ms-field-hint">The pilot is a separate agreement. <a href="/pricing#match-fee">See when the match fee is due and the replacement policy.</a></p>
      </details>
      <EvaluationExample />
      <aside className="ms-how-open"><h2>Is your job a fit?</h2><p>Start with repeatable parts handling: moving known, rigid objects between trays, fixtures or a conveyor in a fixed work area. Changing layouts, flexible objects or open-ended work need a separate fit check. A description is enough to start.</p></aside>
      <div className="ms-how-cta"><a className="ms-button ms-button-large" href="/contact/site-operator">Start a job assessment <ArrowRight size={20} aria-hidden="true" /></a><a className="ms-text-link" href="/contact/robot-team">Apply for early access <ArrowRight size={20} aria-hidden="true" /></a></div>
    </article>
  </>;
}
