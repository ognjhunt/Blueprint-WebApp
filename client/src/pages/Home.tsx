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
            {/* Input-neutral on purpose. The recording is how most assessments end
                up being done, not the price of starting one -- a description is
                enough to get a task brief back, and footage they already hold
                gets reused rather than re-shot. */}
            <p className="ms-hero-description">Show us one recurring task. We help turn it into a provider-backed pilot offer with a clear price, scope, and way to measure the result. Start with a description, photos, or video.</p>
            <a className="ms-button ms-button-large" href="/contact/site-operator">Start a task assessment <ArrowRight size={25} strokeWidth={1.5} aria-hidden="true" /></a>
          </div>
      </EmbodimentHero>

      <section className="ms-method ms-container" id="how-it-works" aria-label="How it works">
        <ol className="ms-steps">
          <li><details><summary><span className="ms-step-number">01</span><span className="ms-step-rule" aria-hidden="true" /><span>Show us the task</span></summary><p>Describe the work, share phone footage, and tell us what a pilot and an ongoing service would need to cost. Exploring is fine; we label the funding status clearly.</p></details></li>
          <li><details><summary><span className="ms-step-number">02</span><span className="ms-step-rule" aria-hidden="true" /><span>Review results and an offer</span></summary><p>Teams evaluate approved tasks for free. You see anonymized results first. If both sides want a pilot discussion, we make a private introduction and the provider confirms its offer. You see the evidence and one itemized total.</p></details></li>
          <li><details><summary><span className="ms-step-number">03</span><span className="ms-step-rule" aria-hidden="true" /><span>Approve and measure</span></summary><p>You decide whether to buy the trial. The provider installs and operates the robot; Blueprint coordinates the agreed plan and records the results so you can decide what follows.</p></details></li>
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
