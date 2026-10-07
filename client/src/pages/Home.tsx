import { ArrowRight } from "lucide-react";
import { TaskEvaluationPair } from "@/components/site/TaskEvaluationPair";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "Could a robot do your recurring job? Show Blueprint the work. We check robot fit with robot teams and send you one recommended pilot to book. Free to start. No pilot, no fee.";

export default function Home() {
  return (
    <>
      <SEO title="Blueprint | From one job to a measured robot pilot" description={description} canonical="/" jsonLd={webPageJsonLd({ path: "/", name: "Blueprint", description })} />
      <section className="ms-task-hero ms-container" aria-labelledby="hero-title">
          <div className="ms-task-hero-intro">
            <h1 id="hero-title">Could a robot do your recurring job?</h1>
            <div className="ms-task-hero-actions">
              <p>Show us the work. We check robot fit with robot teams and send you one recommended pilot to book.</p>
              <div className="ms-task-hero-links">
                <a className="ms-button" href="/contact/site-operator">Start a job assessment <ArrowRight size={21} strokeWidth={1.5} aria-hidden="true" /></a>
              </div>
              <p className="ms-task-hero-start">Free to start. No pilot, no fee.</p>
            </div>
          </div>
          <TaskEvaluationPair />
      </section>

      <section className="ms-method ms-container" id="how-it-works" aria-label="How it works">
        <ol className="ms-steps">
          <li><p className="ms-step-head"><span className="ms-step-number">01</span><span className="ms-step-rule" aria-hidden="true" /><span>Show us the job</span></p><p>Describe it, add photos or a phone video.</p></li>
          <li><p className="ms-step-head"><span className="ms-step-number">02</span><span className="ms-step-rule" aria-hidden="true" /><span>We check robot fit</span></p><p>We evaluate it with robot teams and pick one.</p></li>
          <li><p className="ms-step-head"><span className="ms-step-number">03</span><span className="ms-step-rule" aria-hidden="true" /><span>Book your recommended pilot</span></p><p>One click; we coordinate the rest.</p></li>
        </ol>
        <a className="ms-method-link" href="/how-it-works#warehouse-task">See the warehouse walkthrough <ArrowRight size={16} aria-hidden="true" /></a>
      </section>
    </>
  );
}
