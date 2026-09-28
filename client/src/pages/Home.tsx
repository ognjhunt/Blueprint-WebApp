import { ArrowRight } from "lucide-react";
import { EmbodimentHero } from "@/components/site/EmbodimentHero";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "Blueprint helps a business turn one recurring task into a scoped, funded, measurable robot pilot and decide what happens afterward.";

export default function Home() {
  return (
    <>
      <SEO title="Blueprint | From one task to a measured robot pilot" description={description} canonical="/" jsonLd={webPageJsonLd({ path: "/", name: "Blueprint", description })} />
      <EmbodimentHero>
          <div className="ms-hero-copy">
            <h1 id="hero-title">One recurring task.<br />A measured robot pilot.</h1>
            <p className="ms-hero-description">Blueprint connects businesses that need work done with robot teams that can do it. Start with a description, photos or video.</p>
            <a className="ms-button ms-button-large" href="/contact/site-operator">Start a task assessment <ArrowRight size={25} strokeWidth={1.5} aria-hidden="true" /></a>
          </div>
      </EmbodimentHero>

      <section className="ms-method ms-container" id="how-it-works" aria-label="How it works">
        <ol className="ms-steps">
          <li><details><summary><span className="ms-step-number">01</span><span className="ms-step-rule" aria-hidden="true" /><span>Show us the task</span></summary><p>Describe the work, share phone footage, and set a pilot price and conditions if you know them. Otherwise share a target budget. Keep the ongoing price target separate.</p></details></li>
          <li><details><summary><span className="ms-step-number">02</span><span className="ms-step-rule" aria-hidden="true" /><span>Meet your match</span></summary><p>Robot teams evaluate your task for free. When one passes, fits your budget, and wants your pilot, we introduce you right away. No match, no fee.</p></details></li>
          <li><details><summary><span className="ms-step-number">03</span><span className="ms-step-rule" aria-hidden="true" /><span>Run the pilot</span></summary><p>You and the team agree the pilot directly, and Blueprint takes no cut. The provider installs and operates the robot. Measure the on-site trial against the success criteria you agreed.</p></details></li>
        </ol>
        <a className="ms-method-link" href="/how-it-works#evaluation-example">See an evaluation example <ArrowRight size={16} aria-hidden="true" /></a>
      </section>

      <section className="ms-team ms-container" aria-labelledby="team-title">
        <div><h2 id="team-title">Build robots?</h2><p>Spend less time on unsuitable opportunities. Tell us what your team can actually install and support for a scoped site task.</p></div>
        <a className="ms-text-link" href="/contact/robot-team">Apply for early access <ArrowRight size={24} strokeWidth={1.5} aria-hidden="true" /></a>
      </section>
    </>
  );
}
