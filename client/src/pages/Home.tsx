import { ArrowRight } from "lucide-react";
import { PilotPreview } from "@/components/site/PilotPreview";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "Could a robot take over a repetitive task at your site? Show us the task. We assess the evidence and help you decide what to explore next. Free initial assessment for invited beta participants.";

export default function Home() {
  return (
    <>
      <SEO title="Blueprint | Start with one real task" description={description} canonical="/" jsonLd={webPageJsonLd({ path: "/", name: "Blueprint", description })} />
      <section className="ms-task-hero ms-container" aria-labelledby="hero-title">
          <div className="ms-task-hero-intro">
            <h1 id="hero-title">Could a robot take over a repetitive task at your site?</h1>
            <div className="ms-task-hero-actions">
              <p>Show us the task. We assess the evidence and help you decide what to explore next.</p>
              <div className="ms-task-hero-links">
                <a className="ms-button" href="/contact/site-operator">Show us a task <ArrowRight size={21} strokeWidth={1.5} aria-hidden="true" /></a>
              </div>
              <p className="ms-task-hero-start">Free initial assessment for invited beta participants.</p>
            </div>
          </div>
          <PilotPreview />
      </section>

      <section className="ms-method ms-container" id="how-it-works" aria-label="How it works">
        <ol className="ms-steps">
          <li><p className="ms-step-head"><span className="ms-step-number">01</span><span className="ms-step-rule" aria-hidden="true" /><span>Show us the task</span></p><p>Describe it or film it on your phone.</p></li>
          <li><p className="ms-step-head"><span className="ms-step-number">02</span><span className="ms-step-rule" aria-hidden="true" /><span>Review the evidence</span></p><p>Understand what it supports and what is still unknown.</p></li>
          <li><p className="ms-step-head"><span className="ms-step-number">03</span><span className="ms-step-rule" aria-hidden="true" /><span>Agree on the next step</span></p><p>Any later work has a separately agreed scope and cost.</p></li>
        </ol>
        <a className="ms-method-link" href="/how-it-works#warehouse-task">See the warehouse walkthrough <ArrowRight size={16} aria-hidden="true" /></a>
      </section>
    </>
  );
}
