/**
 * Two public entry points. Keep the application after a concise team invitation,
 * the site form before supporting details, and keep
 * assessment free and booking the recommended pilot as the one paid decision.
 */
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";

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
          description="Test your robot on real site jobs. Evaluate fit on a captured workspace and work toward a measured customer pilot. Free evaluations for invited teams."
          canonical="/contact/robot-team"
        />
        <section className="ms-beta-hero ms-container" aria-labelledby="robot-team-title">
          <div className="ms-beta-copy">
            <p className="ms-eyebrow">Robot-team beta</p>
            <h1 id="robot-team-title">Test your robot on real site jobs.</h1>
            <p>Evaluate fit on a captured workspace and work toward a measured customer pilot.</p>
            <a className="ms-button" href="#robot-team-access">Join the robot-team beta <ArrowRight size={20} aria-hidden="true" /></a>
            <p className="ms-beta-free">Free evaluations for invited teams.</p>
          </div>
          <div className="ms-beta-example">
            <figure>
              <img
                src="/illustrations/task-evaluation/03-humanoid-evaluation.webp"
                srcSet="/illustrations/task-evaluation/03-humanoid-evaluation-840.webp 840w, /illustrations/task-evaluation/03-humanoid-evaluation.webp 1672w"
                sizes="(max-width: 700px) calc(100vw - 40px), (max-width: 1000px) calc(100vw - 64px), (max-width: 1536px) 52vw, 734px"
                width={1672}
                height={941}
                fetchPriority="high"
                alt="Illustrative simulation view: a humanoid supports a blue case above the empty tray pocket in a digital cutaway of the same warehouse workstation."
              />
              <figcaption className="ms-imagery-caption">Illustrative simulation view · Robot configuration shown as an example.</figcaption>
            </figure>
          </div>
        </section>
        <section className="ms-container ms-task-page ms-beta-access" id="robot-team-access" aria-label="Robot-team access">
          <TaskBrowse />
          <details className="ms-task-interest ms-visitor-detail">
            <summary>What happens after applying?</summary>
            <p>We review your robot's capabilities, the work you want and where you can support a pilot, then email the next step. Approved teams can see shared job details; applying does not commit you to an integration or a pilot.</p>
            <p>You confirm the configuration, price, timing and site conditions before a customer sees your offer.</p>
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
        title="Show us a task | Blueprint"
          description="Describe one recurring job. Blueprint helps assess fit, scope a funded robot pilot, measure the trial, and decide what follows."
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
            Describe the work now. Add a phone video when you have recording permission. Starting is free; you do not need an approved budget.
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
