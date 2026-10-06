import { ArrowRight } from "lucide-react";
import { TaskEvaluationPair } from "@/components/site/TaskEvaluationPair";
import { SEO } from "@/components/SEO";
import { webPageJsonLd } from "@/lib/seoStructuredData";

const description = "Blueprint helps a business turn one recurring job into a scoped, funded, measurable robot pilot and decide what happens afterward.";

export default function Home() {
  return (
    <>
      <SEO title="Blueprint | From one job to a measured robot pilot" description={description} canonical="/" jsonLd={webPageJsonLd({ path: "/", name: "Blueprint", description })} />
      <section className="ms-task-hero ms-container" aria-labelledby="hero-title">
          <div className="ms-task-hero-intro">
            <h1 id="hero-title">One recurring job.<br />A measured robot pilot.</h1>
            <div className="ms-task-hero-actions">
              <p>Show us the work. We help evaluate robot fit and prepare a measured pilot with a robot team.</p>
              <div className="ms-task-hero-links">
                <a className="ms-button" href="/contact/site-operator">Start a job assessment <ArrowRight size={21} strokeWidth={1.5} aria-hidden="true" /></a>
                <a className="ms-text-link" href="/contact/robot-team">Join the robot-team beta <ArrowRight size={19} strokeWidth={1.5} aria-hidden="true" /></a>
              </div>
              <p className="ms-task-hero-start">Start with a description, photos or a short phone video.</p>
            </div>
          </div>
          <TaskEvaluationPair />
      </section>

      <section className="ms-method ms-container" id="how-it-works" aria-label="How it works">
        <ol className="ms-steps">
          <li><details><summary><span className="ms-step-number">01</span><span className="ms-step-rule" aria-hidden="true" /><span>Show us the job</span></summary><p>Describe the work, share phone footage, and set a pilot price and conditions if you know them. Otherwise share a target budget. Keep the ongoing price target separate.</p></details></li>
          <li><details><summary><span className="ms-step-number">02</span><span className="ms-step-rule" aria-hidden="true" /><span>Check robot fit</span></summary><p>Blueprint works with relevant robot teams to evaluate your actual job for free. We pick the team that passed, fits your budget, and wants your pilot, and send you one recommended pilot to book. No pilot, no fee.</p></details></li>
          <li><details><summary><span className="ms-step-number">03</span><span className="ms-step-rule" aria-hidden="true" /><span>Run the pilot</span></summary><p>Book it in one step and we coordinate the rest. Blueprint takes no cut of the pilot. The provider installs and operates the robot. Measure the on-site trial against the success criteria you agreed.</p></details></li>
        </ol>
        <a className="ms-method-link" href="/how-it-works#warehouse-task">See the warehouse walkthrough <ArrowRight size={16} aria-hidden="true" /></a>
      </section>

      <section className="ms-team ms-container" aria-labelledby="team-title">
        <div><h2 id="team-title">Working toward your next customer pilot?</h2><p>Explore suitable site jobs and what a measured pilot would require.</p><p className="ms-team-free">Free evaluations for invited robot teams.</p></div>
        <a className="ms-text-link" href="/contact/robot-team">Apply for early access <ArrowRight size={24} strokeWidth={1.5} aria-hidden="true" /></a>
      </section>
    </>
  );
}
