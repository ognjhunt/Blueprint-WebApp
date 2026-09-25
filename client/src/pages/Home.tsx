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
            <p className="ms-hero-description">We help you scope the job, find a credible robot provider, agree on a funded physical trial, and decide what to do next. Start with a description, photos, or video.</p>
            <a className="ms-button ms-button-large" href="/contact/site-operator">Start a task assessment <ArrowRight size={25} strokeWidth={1.5} aria-hidden="true" /></a>
          </div>
      </EmbodimentHero>

      <section className="ms-method ms-container" id="how-it-works" aria-label="How it works">
        <ol className="ms-steps">
          <li><details><summary><span className="ms-step-number">01</span><span className="ms-step-rule" aria-hidden="true" /><span>Scope the task</span></summary><p>We record the current process, output target, budget range, timing, and decision owner. We check provider capability and tell you whether a trial is plausible, what must change, or why there is no credible fit yet.</p></details></li>
          <li><details><summary><span className="ms-step-number">02</span><span className="ms-step-rule" aria-hidden="true" /><span>Agree on a pilot</span></summary><p>For a suitable task, we help agree on a provider, pilot cost, responsibilities, success criteria, and measurement plan. You approve the scope and funding. The provider or integrator installs and operates the robot.</p></details></li>
          <li><details><summary><span className="ms-step-number">03</span><span className="ms-step-rule" aria-hidden="true" /><span>Decide what follows</span></summary><p>We stay involved through the physical trial, compare the results with the agreed targets, and help you decide whether to stop, change, extend, or deploy regularly. Simulation supports a decision when useful; physical results settle physical claims.</p></details></li>
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
