import { ArrowUpRight } from "lucide-react";
import { SEO } from "@/components/SEO";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";

const description = "A free beta for real sites and recurring tasks. Sites start a job today; invited robot teams evaluate it in simulation, and Blueprint recommends one team whose evaluation passed.";

export default function Beta() {
  return (
    <>
      <SEO title="Beta program | Blueprint" description={description} canonical="/beta" jsonLd={[
        webPageJsonLd({ path: "/beta", name: "Blueprint beta program", description }),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Beta program", path: "/beta" }]),
      ]} />
      <article className="ms-legal ms-container">
        <p className="ms-eyebrow">Beta program</p>
        <h1>Start with one real task.</h1>
        <p>The beta is open to sites: anyone can start a job today, and we also onboard sites by hand. Robot teams join by invitation. Everything in the beta is free.</p>
        <section>
          <h2>What do I provide?</h2>
          <p>A recurring task at a real site, what a finished task looks like, and a short video you have permission to share, or a description to start. We may ask a few follow-up questions to fill gaps in the job brief.</p>
        </section>
        <section>
          <h2>What do I receive?</h2>
          <p>Invited robot teams evaluate your task in a simulation built from your capture. We recommend one team whose evaluation passed, with what the pilot tests, what you provide and when, and you book it in one step. You do not compare teams.</p>
          <p style={{ marginTop: "1em" }}>If no team has passed yet, we tell you so and what would change that.</p>
        </section>
        <section id="scope">
          <h2>What does it cost?</h2>
          <p>Nothing. The beta is free for sites and robot teams: submitting a job, screening, evaluation, our recommendation and booking the pilot. After you book, you and the robot team agree the physical pilot’s dates and terms directly. Blueprint takes no cut of the pilot and charges nothing for it.</p>
        </section>
        <section>
          <h2>What is experimental?</h2>
          <p>Evaluations run in simulation. A passed evaluation is an estimate, not proof of how a robot will perform at your site or a safety certification; the physical pilot is where that is measured. Job briefs and recommendations may need review or correction.</p>
        </section>
        <section>
          <h2>What about robot teams?</h2>
          <p>Robot teams join by invitation: apply, and once we approve you, we invite you to evaluate specific site jobs for free. A passed evaluation on a job is what makes a team eligible to be recommended. An invitation does not guarantee a recommendation or a pilot.</p>
          <p style={{ marginTop: "1em" }}><a className="ms-text-link" href="/contact/robot-team?source=beta">Apply as a robot team <ArrowUpRight size={16} aria-hidden="true" /></a></p>
        </section>
        <div className="ms-how-cta"><a className="ms-button" href="/contact/site-operator?source=beta">Show us a task</a></div>
      </article>
    </>
  );
}
