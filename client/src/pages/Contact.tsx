/**
 * The two front doors.
 *
 * ## What came down
 *
 * The site page carried a six-question screen behind a disclosure and three
 * paragraphs before the first field; the robot page carried a six-question
 * application. Both screens are gone from the public site. The brief now
 * reads the description and the footage, the plan form asks the two facts
 * matching needs, and budget, timing, and decision authority are confirmed
 * during task scoping before anyone agrees to a paid pilot.
 *
 * The API paths behind those screens stay for agents and legacy posters; what
 * left is the page asking a person to answer them before seeing anything.
 *
 * ## The order on a phone
 *
 * Heading, one line, the form. The explanation lives in a closed disclosure
 * under the form, so the first field is on the first screen rather than
 * fourteen hundred pixels down.
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
          description="Robot teams can bring documented capabilities to scoped site tasks and focus on physical trials they can support. Apply for early access."
          canonical="/contact/robot-team"
        />
        <section className="ms-container ms-task-page">
          <p className="ms-eyebrow">For robot teams</p>
          <h1>Find a task your robot can support.</h1>
          <p>Tell us what your robot can do and what a standard pilot includes. We bring you suitable tasks and evaluation evidence. Confirm the configuration, price, timing, and site conditions before a customer sees your offer.</p>
          <TaskBrowse />
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
        title="Start a task assessment | Blueprint"
          description="Describe one recurring task. Blueprint helps assess fit, scope a funded robot pilot, measure the trial, and decide what follows."
          canonical="/contact/site-operator"
      />
      <section className="ms-inquiry ms-container">
        <div className="ms-inquiry-intro">
          <a className="ms-back" href="/">
            <ArrowLeft size={16} aria-hidden="true" /> Back to Blueprint
          </a>
          <p className="ms-eyebrow">For site owners</p>
          <h1>Start with one recurring task.</h1>
          <p className="ms-inquiry-description">
            Describe the work and share photos or phone video. Rough economics help, but you do not need an approved budget to start.
          </p>
        </div>
        <div className="ms-inquiry-forms">
          <SiteCaptureStart />
          <details className="ms-task-interest">
            <summary>How this works</summary>
            <p className="ms-field-hint">
              We turn your description and footage into a task brief for you to correct, then check
              which providers can credibly support it. We use evaluation when helpful. If a provider
              confirms a pilot offer, you see its scope, price, timing, and uncertainties alongside
              Blueprint's fee before you approve any paid work. Your task link
              shows each step and the next update.
            </p>
            <p className="ms-field-hint">
              Geography, plainly: sending a person is an Austin-metro thing; anywhere in the US you
              can record the walkthrough yourself; outside the US we set up transfer terms before
              anything is recorded.
            </p>
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
