/**
 * The two front doors.
 *
 * ## What came down
 *
 * The site page carried a six-question screen behind a disclosure and three
 * paragraphs before the first field; the robot page carried a six-question
 * application. Both screens are gone from the public site. The brief now
 * reads the description and the footage, the plan form asks the two facts
 * matching needs, and everything else those questions covered -- capacity,
 * timeline, budget -- belongs to the pilot conversation, where it is due
 * diligence rather than a queue.
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
          title="Find a task for your robot | Blueprint"
          description="Browse live and past site tasks. Connect your robot setup when you choose an evaluation."
          canonical="/contact/robot-team"
        />
        <section className="ms-container ms-task-page">
          <p className="ms-eyebrow">For robot teams</p>
          <h1>Find work your robot could do.</h1>
          <p>Choose a real site task, see what an evaluation of your robot would cost and tell you, then run it.</p>
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
        description="Describe a repetitive job, then share footage of the work area."
        canonical="/contact/site-operator"
        image="https://tryblueprint.io/images/site-led/workcell.webp"
      />
      <section className="ms-inquiry ms-container">
        <div className="ms-inquiry-intro">
          <a className="ms-back" href="/">
            <ArrowLeft size={16} aria-hidden="true" /> Back to Blueprint
          </a>
          <p className="ms-eyebrow">For site owners</p>
          <h1>Let’s start with your site.</h1>
          <p className="ms-inquiry-description">
            Describe a repetitive job, then share footage of the work area.
          </p>
        </div>
        <div className="ms-inquiry-forms">
          <SiteCaptureStart />
          <details className="ms-task-interest">
            <summary>How this works</summary>
            <p className="ms-field-hint">
              What the footage shows is what decides, so there is nothing to pass first. We read
              your description and your video, draft the task brief for you to correct, build the
              scene, and screen robot teams against it. Your link shows each step and when the next
              update is due.
            </p>
            <p className="ms-field-hint">
              Geography, plainly: sending a person is an Austin-metro thing; anywhere in the US you
              can record the walkthrough yourself; outside the US we set up transfer terms before
              anything is recorded.
            </p>
          </details>
          <p className="ms-field-hint" style={{ marginTop: "20px" }}>
            <a className="ms-text-link" href="/contact/robot-team">
              Building robots? Find a task <ArrowUpRight size={16} aria-hidden="true" />
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
