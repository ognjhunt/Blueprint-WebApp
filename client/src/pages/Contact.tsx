/**
 * Two public entry points. Keep the application after a concise team invitation,
 * the site form before supporting details, and keep
 * the invited initial assessment free, with later scope and cost agreed separately.
 */
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { RobotScene } from "@/components/site/PilotPreview";
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
          description="Register interest in real site tasks. Applications remain pending until manual approval; later evaluation scope and cost are agreed separately."
          canonical="/contact/robot-team"
        />
        <section className="ms-beta-hero ms-container" aria-labelledby="robot-team-title">
          <div className="ms-beta-copy">
            <p className="ms-eyebrow">Robot-team beta</p>
            <h1 id="robot-team-title">Test your robot on real site jobs.</h1>
            <p>Tell us what your robot can do and which real site tasks you can support.</p>
            <a className="ms-button" href="#robot-team-access">Register interest <ArrowRight size={20} aria-hidden="true" /></a>
            <p className="ms-beta-free">Task invitations follow manual review.</p>
          </div>
          <div className="ms-beta-example">
            <figure>
              <RobotScene />
              <figcaption className="ms-imagery-caption">Illustrative scene · Robot configuration shown as an example.</figcaption>
            </figure>
          </div>
        </section>
        <section className="ms-container ms-task-page ms-beta-access" id="robot-team-access" aria-label="Robot-team access">
          <TaskBrowse />
          <details className="ms-task-interest ms-visitor-detail">
            <summary>What happens after applying?</summary>
            <p>We review your robot's capabilities against a real site task, then email the next step. Your application remains pending until manual approval. Applying or creating an account does not grant access. Approved teams see anonymized cards authorized when sites start a job; sites can edit or hide them afterward.</p>
            <p>You confirm the configuration, price, timing and site conditions before a customer sees your offer.</p>
            <p>Before an evaluation, confirm the task, robot and gripper, observation and action interfaces, and any adapter work. Executable submissions use a policy endpoint or container; compatibility must be checked for the specific task.</p>
            <p>Any later evaluation, integration, or physical pilot has its scope and cost agreed separately before proceeding. An invitation does not guarantee a run, introduction, or deployment.</p>
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
        title="Show us a task | Blueprint"
          description="Describe one recurring job for an initial evidence-backed assessment. The initial assessment is free for invited beta participants; later scope and cost are agreed separately."
          canonical="/contact/site-operator"
      />
      <section className="ms-inquiry ms-container">
        <div className="ms-inquiry-intro">
          <a className="ms-back" href="/">
            <ArrowLeft size={16} aria-hidden="true" /> Back to Blueprint
          </a>
          <p className="ms-eyebrow">For site owners</p>
          <h1>Start with one task.</h1>
          <p className="ms-inquiry-description">
            Show us the work. We’ll investigate, ask only what matters, and come back with a recommendation or concrete pilot plan. Blueprint beta support is free; any provider cost or new commitment is agreed separately.
          </p>
        </div>
        <div className="ms-inquiry-forms">
          <SiteCaptureStart />
          <details className="ms-task-interest ms-visitor-detail">
            <summary>How this works</summary>
            <p className="ms-field-hint">
              Your job link shows progress and follow-ups. We draft a brief from the evidence for you to correct.
              Any later evaluation, integration, or physical pilot has its scope and cost agreed separately before proceeding.
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
            <p className="ms-field-hint">If filming needs approval, submit the job description while you arrange permission. Have someone who knows the job review the brief; we ask for more footage or a call only to resolve missing details. <a href="/privacy">How footage is used</a>.</p>
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
