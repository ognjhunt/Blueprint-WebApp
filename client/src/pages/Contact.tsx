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
          description="Robot teams join Blueprint's free beta by invitation. Approved teams evaluate real site jobs in simulation, and a passed evaluation can lead to a recommended pilot."
          canonical="/contact/robot-team"
        />
        <section className="ms-beta-hero ms-container" aria-labelledby="robot-team-title">
          <div className="ms-beta-copy">
            <p className="ms-eyebrow">Robot-team beta</p>
            <h1 id="robot-team-title">Test your robot on real site jobs.</h1>
            <p>Tell us what your robot can do. Invited teams evaluate real site jobs in simulation, free during the beta.</p>
            <a className="ms-button" href="#robot-team-access">Register interest <ArrowRight size={20} aria-hidden="true" /></a>
            <p className="ms-beta-free">Task invitations follow manual review.</p>
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
            <p>Each evaluation runs your policy in a simplified simulation of the task, informed by the site's footage. Blueprint recommends a team only when its evaluation on that job passed and it wants the pilot; you confirm the configuration, timing and site conditions before the site sees the recommendation.</p>
            <p>Before an evaluation, confirm the task, robot and gripper, observation and action interfaces, and any adapter work. You serve your policy at one HTTPS URL that accepts a bearer token, and register it as a policy endpoint with that token; containers and private checkpoints are not admitted. Each evaluation is 200 hidden episodes.</p>
            <p>Evaluations are free during the beta. If a site books your recommended pilot, you and the site agree its dates and terms directly; Blueprint takes no cut. An invitation does not guarantee a run, a recommendation, or a deployment.</p>
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
          description="Describe or film one recurring job. Robot teams evaluate it in simulation, and Blueprint recommends one team whose evaluation passed for you to book. Free during the beta."
          canonical="/contact/site-operator"
      />
      <section className={`ms-inquiry ms-container${savedJob ? " ms-intake-saved" : ""}`}>
        <div className="ms-inquiry-intro">
          <a className="ms-back" href="/">
            <ArrowLeft size={16} aria-hidden="true" /> Back to Blueprint
          </a>
          {!savedJob && <p className="ms-eyebrow">For site owners</p>}
          <h1>{savedJob ? "Your saved job" : "Start with one task."}</h1>
          {!savedJob && <p className="ms-inquiry-description">
            Show us the work. Robot teams evaluate it in simulation, and we recommend one team whose evaluation passed for you to book. The beta is free; you agree the physical pilot’s dates and terms with the team directly.
          </p>}
          {!savedJob && <section className="ms-inquiry-fit" aria-labelledby="inquiry-fit-title">
            <h2 id="inquiry-fit-title">Is your job a fit?</h2>
            <p>We screen every job against four questions. Not sure about one? Start anyway, and we tell you which it misses and what it would take to pass.</p>
            <JobFitQuestions />
            <a className="ms-text-link" href="/how-it-works#job-fit">Why each one matters <ArrowRight size={16} aria-hidden="true" /></a>
          </section>}
        </div>
        <div className="ms-inquiry-forms">
          <SiteCaptureStart onSavedChange={setSavedJob} />
          <details className="ms-task-interest ms-visitor-detail">
            <summary>How this works</summary>
            {savedJob ? <p className="ms-field-hint">Your private job link shows progress, follow-up questions and, once a team&rsquo;s evaluation passes, your recommended pilot. Keep it to return.</p> : <><p className="ms-field-hint">
              Your job link shows progress and follow-ups. We draft a brief from the evidence for you to correct.
              Before we build the job&rsquo;s scene, you save the job to an account with your work email.
              Invited robot teams then evaluate the job in simulation, and we recommend one team whose evaluation passed.
              A simulated pass is an estimate; the physical pilot, agreed with the team, tests performance on site.
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
            <p className="ms-field-hint">If filming needs approval, submit the job description while you arrange permission. Have someone who knows the job review the brief; we ask for more footage or a call only to resolve missing details. <a href="/privacy">How footage is used</a>.</p>
          </details>}
          <p className="ms-field-hint" style={{ marginTop: "20px" }}>
            {!savedJob && <><a className="ms-text-link" href="/contact/robot-team">
              Building robots? Apply for early access <ArrowUpRight size={16} aria-hidden="true" />
            </a>
            {" · "}</>}
            <a className="ms-text-link" href={`mailto:${CONTACT_EMAIL}`}>
              Talk to a person
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
