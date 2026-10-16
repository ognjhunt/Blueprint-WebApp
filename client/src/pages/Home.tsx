import { ArrowRight } from "lucide-react";
import { PilotPreview } from "@/components/site/PilotPreview";
import { SEO } from "@/components/SEO";
import { organizationJsonLd, webPageJsonLd, websiteJsonLd } from "@/lib/seoStructuredData";

const description = "Could a robot take over a repetitive task at your site? Show us the task. Robot teams evaluate it in simulation, and we recommend one team whose evaluation passed. Free during the beta.";

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Start with one real task"
        description={description}
        canonical="/"
        jsonLd={[organizationJsonLd(), websiteJsonLd(), webPageJsonLd({ path: "/", name: "Blueprint", description })]}
      />
      <section className="ms-task-hero ms-container" aria-labelledby="hero-title">
          <div className="ms-task-hero-intro">
            <h1 id="hero-title">Could a robot take over a repetitive task at your site?</h1>
            <div className="ms-task-hero-actions">
              <p>Show us the task. Robot teams evaluate it in simulation, and we recommend the one whose evaluation passed. You book the pilot in one step.</p>
              <div className="ms-task-hero-links">
                <a className="ms-button" href="/contact/site-operator">Show us a task <ArrowRight size={21} strokeWidth={1.5} aria-hidden="true" /></a>
              </div>
              <p className="ms-task-hero-start">Free during the beta, for sites and robot teams.</p>
            </div>
          </div>
          <PilotPreview />
      </section>

      <section className="ms-method ms-container" id="how-it-works" aria-label="How it works">
        <ol className="ms-steps">
          <li><p className="ms-step-head"><span className="ms-step-number">01</span><span className="ms-step-rule" aria-hidden="true" /><span>Show us the task</span></p><p>Describe it or film it on your phone.</p></li>
          <li><p className="ms-step-head"><span className="ms-step-number">02</span><span className="ms-step-rule" aria-hidden="true" /><span>Robot teams evaluate it</span></p><p>Invited teams test it in a simplified simulation of your task, informed by your footage.</p></li>
          <li><p className="ms-step-head"><span className="ms-step-number">03</span><span className="ms-step-rule" aria-hidden="true" /><span>Book the recommended pilot</span></p><p>One team whose evaluation passed. You agree dates and terms with them.</p></li>
        </ol>
        <p className="ms-method-note">A simulated evaluation is an estimate, not proof of how a robot performs on site or of its safety. The pilot measures that.</p>
        <a className="ms-method-link" href="/how-it-works#warehouse-task">See the warehouse walkthrough <ArrowRight size={16} aria-hidden="true" /></a>
      </section>
    </>
  );
}
