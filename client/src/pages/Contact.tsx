/**
 * Two public entry points. Sites start a job openly (the form comes before the
 * supporting details); robot teams apply for an invitation. Everything in the
 * beta is free, and the physical pilot is agreed between site and team.
 */
import { useLocation } from "wouter";
import { useState } from "react";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";

import { SEO } from "@/components/SEO";
import { JobFitQuestions } from "@/components/site/JobFitQuestions";
import { RobotScene } from "@/components/site/PilotPreview";
import { SiteCaptureStart } from "@/components/site/SiteCaptureStart";
import { TaskBrowse } from "@/components/site/TaskBrowse";

const CONTACT_EMAIL = "hello@tryblueprint.io";

export default function Contact() {
  const [location] = useLocation();
  const isSite = location !== "/contact/robot-team";
  const [savedJob, setSavedJob] = useState(false);

  if (!isSite) {
    return (
      <>
        <SEO
          title="Early access for robot teams | Blueprint"
          description="Make your robot technology available for real customer jobs, or apply to deliver and support deployments. Partner access follows review."
          canonical="/contact/robot-team"
        />
        <section className="ms-beta-hero ms-container" aria-labelledby="robot-team-title">
          <div className="ms-beta-copy">
            <p className="ms-eyebrow">Robot-team beta</p>
            <h1 id="robot-team-title">Bring your capabilities to real jobs.</h1>
            <p>Make your robot or policy available for evaluation, or help sites install and support a suitable solution.</p>
            <a className="ms-button" href="#robot-team-access">Register interest <ArrowRight size={20} aria-hidden="true" /></a>
            <p className="ms-beta-free">Partner applications and evaluations are free during the beta.</p>
            <p><a className="ms-text-link" href="/partners">Explore deployment and technology partner roles <ArrowRight size={16} aria-hidden="true" /></a></p>
          </div>
          <div className="ms-beta-example">
            <figure>
              <RobotScene />
              <figcaption className="ms-imagery-caption">Illustrative scene · Robot configuration shown as an example.</figcaption>
            </figure>
            <p className="ms-beta-embodiments">Fixed arms, humanoids, wheeled humanoids and mobile manipulators are welcome. We confirm task fit and simulation compatibility for each job.</p>
          </div>
        </section>
        <section className="ms-container ms-task-page ms-beta-access" id="robot-team-access" aria-label="Robot-team access">
          <TaskBrowse />
          <details className="ms-task-interest ms-visitor-detail">
            <summary>What happens after applying?</summary>
            <p>We review your robot's capabilities against a real site task, then email the next step. Your application remains pending until manual approval. Applying or creating an account does not grant access. Approved teams see anonymized cards authorized when sites start a job; sites can edit or hide them afterward.</p>
            <p>Blueprint compares compatible robots and policies in a site simulation reconstructed from the site's video. Each evaluation is evidence for a bounded decision. Before any delivery recommendation, the provider confirms the configuration, timing, site conditions and support it can offer.</p>
            <p>Before an evaluation, confirm the task, robot and gripper, observation and action interfaces, and any adapter work. You serve your policy at one HTTPS URL that accepts a bearer token, and register it as a policy endpoint with that token; containers and private checkpoints are not admitted. Each evaluation is 200 hidden episodes.</p>
            <p>Evaluations are free during the beta. The customer chooses its delivery partner and agrees the physical pilot's scope, price, dates and terms with that company directly; Blueprint takes no cut. An invitation does not guarantee a run, a recommendation, or a deployment.</p>
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
        title="Submit a job | Blueprint"
          description="Send video of one recurring job at your site. Blueprint drafts the brief from it, builds a site simulation and compares compatible robots and policies. No budget is required to start."
          canonical="/contact/site-operator"
      />
      <section className={`ms-inquiry ms-container${savedJob ? " ms-intake-saved" : ""}`}>
        <div className="ms-inquiry-intro">
          <a className="ms-back" href="/">
            <ArrowLeft size={16} aria-hidden="true" /> Back to Blueprint
          </a>
          {!savedJob && <p className="ms-eyebrow">For site owners</p>}
          <h1>{savedJob ? "Your saved job" : "What work would you like automated?"}</h1>
          {!savedJob && <p className="ms-inquiry-description">
            Send video of one recurring job. We draft the description from it, build a site simulation and compare compatible robots and policies. You choose the delivery team for a measured pilot. Free during the beta; no budget is required to start.
          </p>}
        </div>
        <div className="ms-inquiry-forms">
          <SiteCaptureStart onSavedChange={setSavedJob} />
          <details className="ms-task-interest ms-visitor-detail">
            <summary>How this works</summary>
            {savedJob ? <p className="ms-field-hint">Your private job link shows the brief, progress, follow-up questions and the next decision. Keep it to return.</p> : <><p className="ms-field-hint">
              We analyze your video and draft a brief for you to correct.
              We then reconstruct your work area in simulation and test compatible robots and policies.
              Before proposals, we clarify the required result, budget and responsibilities. You choose the delivery partner and agree the pilot contract directly with them.
              Simulation is an estimate, not proof of physical performance or safety.
            </p>
            <p className="ms-field-hint">
              Geography, plainly: sending a person is an Austin-metro thing; anywhere in the US you
              can record the walkthrough yourself; outside the US we set up transfer terms before
              anything is recorded.
            </p></>}
          </details>
          {!savedJob && <details className="ms-task-interest ms-visitor-detail">
            <summary>What should I record?</summary>
            <p className="ms-field-hint">Show one complete task cycle, the objects and where they start and finish, then the surrounding work area. Existing footage is welcome. Avoid screens, paperwork and restricted areas, and get permission to record.</p>
            <p className="ms-field-hint">If filming needs approval, arrange permission first or contact us for help. We need video before the site assessment can continue. Have someone who knows the job review the brief we draft from it. <a href="/privacy">How footage is used</a>.</p>
          </details>}
          <p className="ms-field-hint" style={{ marginTop: "20px" }}>
            {!savedJob && <><a className="ms-text-link" href="/partners">
              Deliver or build robot systems? Become a partner <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            {" · "}</>}
            <a className="ms-text-link" href={`mailto:${CONTACT_EMAIL}`}>
              Talk to a person
            </a>
          </p>
        </div>
        {!savedJob && <section className="ms-inquiry-fit" aria-labelledby="inquiry-fit-title">
          <h2 id="inquiry-fit-title">Is your job a fit?</h2>
          <p>We start with bounded jobs, known objects and a work area that can be assessed. Not sure whether yours fits? Show us the work on video and we will assess the fit.</p>
          <JobFitQuestions />
          <a className="ms-text-link" href="/how-it-works#job-fit">Why each one matters <ArrowRight size={16} aria-hidden="true" /></a>
        </section>}
      </section>
    </>
  );
}
