import { ArrowRight } from "lucide-react";
import { EmbodimentHero } from "@/components/site/EmbodimentHero";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "Blueprint tests robot teams against your real site task and tells you which one deserves a physical pilot. Free for sites.";

export default function Home() {
  return (
    <>
      <SEO title="Blueprint | A pilot worth running." description={description} canonical="/" jsonLd={webPageJsonLd({ path: "/", name: "Blueprint", description })} />
      <EmbodimentHero>
          <div className="ms-hero-copy">
            <h1 id="hero-title">Your site.<br />The right robot.<br />A pilot worth running.</h1>
            {/* Input-neutral on purpose. The recording is how most assessments end
                up being done, not the price of starting one -- a description is
                enough to get a task brief back, and footage they already hold
                gets reused rather than re-shot. */}
            <p className="ms-hero-description">Start with a description, photos, or video.<br className="ms-desktop-break" /> We define the task and what deserves a physical pilot.</p>
            <a className="ms-button ms-button-large" href="/contact/site-operator">Start a task assessment <ArrowRight size={25} strokeWidth={1.5} aria-hidden="true" /></a>
          </div>
      </EmbodimentHero>

      <section className="ms-method ms-container" id="how-it-works" aria-label="How it works">
        <ol className="ms-steps">
          <li><details><summary><span className="ms-step-number">01</span><span className="ms-step-rule" aria-hidden="true" /><span>Define the task</span></summary><p>We define your task, what success looks like, your budget, and your pilot window. With your approval, robot teams can then see a card for the task.</p></details></li>
          <li><details><summary><span className="ms-step-number">02</span><span className="ms-step-rule" aria-hidden="true" /><span>Compare candidates</span></summary><p>Robot teams test their robots, policies, and checkpoints against your task. We run every entry the same way, so the results can be compared.</p></details></li>
          <li><details><summary><span className="ms-step-number">03</span><span className="ms-step-rule" aria-hidden="true" /><span>Choose the pilot</span></summary><p>Get a practical shortlist, a pilot recommendation, expected failure points, and a physical test plan—or a clear reason to pause. Your site and robot team run the physical pilot.</p></details></li>
        </ol>
        <a className="ms-method-link" href="/how-it-works#evaluation-example">See an evaluation example <ArrowRight size={16} aria-hidden="true" /></a>
      </section>

      <section className="ms-team ms-container" aria-labelledby="team-title">
        <div><h2 id="team-title">Build robots?</h2><p>Bring your embodiments, policies, and checkpoints to a real task.</p></div>
        <a className="ms-text-link" href="/contact/robot-team">Find a task for your robot <ArrowRight size={24} strokeWidth={1.5} aria-hidden="true" /></a>
      </section>
    </>
  );
}
