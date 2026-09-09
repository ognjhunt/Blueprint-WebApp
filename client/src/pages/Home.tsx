import { ArrowRight } from "lucide-react";
import { EmbodimentHero } from "@/components/site/EmbodimentHero";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "Turn a real workcell into a clear robotics pilot decision. Blueprint helps site owners define the task, compare two candidates, and decide what to test on site.";

export default function Home() {
  return (
    <>
      <SEO title="Blueprint | A pilot worth running." description={description} canonical="/" image="https://tryblueprint.io/images/site-led/workcell.webp" jsonLd={webPageJsonLd({ path: "/", name: "Blueprint", description })} />
      <EmbodimentHero>
          <div className="ms-hero-copy">
            <h1 id="hero-title">Your site.<br />The right robot.<br />A pilot worth running.</h1>
            <p className="ms-hero-description">Compare robots and policies on your real task.<br className="ms-desktop-break" /> Decide what deserves a physical pilot.</p>
            <a className="ms-button ms-button-large" href="/contact/site-operator">Discuss your site <ArrowRight size={25} strokeWidth={1.5} aria-hidden="true" /></a>
          </div>
      </EmbodimentHero>

      <section className="ms-method ms-container" id="how-it-works" aria-label="How it works">
        <ol className="ms-steps">
          <li><details><summary><span className="ms-step-number">01</span><span className="ms-step-rule" aria-hidden="true" /><span>Define the task</span></summary><p>We capture your workcell and agree on success criteria, evaluation scope, budget, and a pilot window.</p></details></li>
          <li><details><summary><span className="ms-step-number">02</span><span className="ms-step-rule" aria-hidden="true" /><span>Compare candidates</span></summary><p>We evaluate two compatible systems or configurations against the same task and conditions.</p></details></li>
          <li><details><summary><span className="ms-step-number">03</span><span className="ms-step-rule" aria-hidden="true" /><span>Choose the pilot</span></summary><p>Get a recommendation, expected failure points, and a physical test plan—or a clear reason to pause. Your site and robot team run the physical pilot.</p></details></li>
        </ol>
        <a className="ms-method-link" href="/how-it-works">How the evaluation works <ArrowRight size={16} aria-hidden="true" /></a>
      </section>

      <section className="ms-team ms-container" aria-labelledby="team-title">
        <div><h2 id="team-title">Build robots?</h2><p>Any embodiment. Bring your system to a real task.</p></div>
        <a className="ms-text-link" href="/contact/robot-team">Apply as a robot team <ArrowRight size={24} strokeWidth={1.5} aria-hidden="true" /></a>
      </section>
    </>
  );
}
