/**
 * Two public entry points. Keep the form before supporting details, and keep
 * assessment, match-fee authorization and buying a pilot as distinct actions.
 */
import { useLocation } from "wouter";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { SiteCaptureStart } from "@/components/site/SiteCaptureStart";
import { TaskBrowse } from "@/components/site/TaskBrowse";

const CONTACT_EMAIL = "hello@tryblueprint.io";

export default function Contact() {
  const [location] = useLocation();
  const isSite = location !== "/contact/robot-team";

  if (!isSite) {
    return (
      <>
        <SEO
          title="Early access for robot teams | Blueprint"
          description="Robot teams can bring documented capabilities to scoped site jobs and focus on physical trials they can support. Apply for early access."
          canonical="/contact/robot-team"
        />
        <section className="ms-container ms-task-page">
          <p className="ms-eyebrow">For robot teams</p>
          <h1>Find a job your robot can support.</h1>
          <p>Find relevant site jobs and evaluate them for free when invited. You confirm the configuration, price, timing and site conditions before a customer sees your offer.</p>
          <TaskBrowse />
          <details className="ms-task-interest ms-visitor-detail">
            <summary>What happens after applying?</summary>
            <p>We review your robot's capabilities, the work you want and where you can support a pilot, then email the next step. Approved teams can see shared job details; applying does not commit you to an integration or a pilot.</p>
            <p>Before an evaluation, confirm the task, robot and gripper, observation and action interfaces, and any adapter work. Executable submissions use a policy endpoint or container; compatibility must be checked for the specific task.</p>
            <p>During the beta, evaluate for a pilot for free when invited; the site sees those results. A physical on-site trial is agreed separately with the site.</p>
            <p><a href="/agent-access.openapi.json">Technical API reference</a> · <a href="mailto:hello@tryblueprint.io">Ask about job fit or integration</a></p>
          </details>
          <p className="ms-field-hint" style={{ marginTop: "24px" }}>
            <a className="ms-text-link" href="/contact/site-operator">
              Operate a site? Start here <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <SEO
        title="Start a job assessment | Blueprint"
          description="Describe one recurring job. Blueprint helps assess fit, scope a funded robot pilot, measure the trial, and decide what follows."
          canonical="/contact/site-operator"
      />
      <section className="ms-inquiry ms-container">
        <div className="ms-inquiry-intro">
          <a className="ms-back" href="/">
            <ArrowLeft size={16} aria-hidden="true" /> Back to Blueprint
          </a>
          <p className="ms-eyebrow">For site owners</p>
          <h1>Start with one recurring job.</h1>
          <p className="ms-inquiry-description">
            Describe the work and confirm recording permission. Add a phone video if you have one. Starting is free; you do not need an approved budget.
          </p>
        </div>
        <div className="ms-inquiry-forms">
          <SiteCaptureStart />
          <details className="ms-task-interest ms-visitor-detail">
            <summary>How this works</summary>
            <p className="ms-field-hint">
              Your job link shows progress and follow-ups. We draft a brief from the evidence for you to correct.
              Robot teams evaluate for free when invited. You review the results before deciding on a pilot.
              Simulation informs that choice; an agreed physical trial tests performance on site.
            </p>
            <p className="ms-field-hint">
              Geography, plainly: sending a person is an Austin-metro thing; anywhere in the US you
              can record the walkthrough yourself; outside the US we set up transfer terms before
              anything is recorded.
            </p>
          </details>
          <details className="ms-task-interest ms-visitor-detail">
            <summary>What should I record?</summary>
            <p className="ms-field-hint">Show one complete task cycle, the objects and where they start and finish, then the surrounding work area. Existing footage is welcome. Avoid screens, paperwork and restricted areas, and get permission to record.</p>
            <p className="ms-field-hint">If filming needs approval, <a href={`mailto:${CONTACT_EMAIL}`}>talk to us about the job</a> while you arrange permission. Have someone who knows the job review the brief; we ask for more footage or a call only to resolve missing details. <a href="/privacy">How footage is used</a>.</p>
          </details>
          <p className="ms-field-hint" style={{ marginTop: "20px" }}>
            <a className="ms-text-link" href="/contact/robot-team">
              Building robots? Apply for early access <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            {" · "}
            <a className="ms-text-link" href={`mailto:${CONTACT_EMAIL}`}>
              Talk to a person
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
