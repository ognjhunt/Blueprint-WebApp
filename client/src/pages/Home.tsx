import { ArrowRight } from "lucide-react";
import { PilotPreview } from "@/components/site/PilotPreview";
import { SEO } from "@/components/SEO";
import { REPLY_TIMELINE } from "@/data/betaTimelines";
import { organizationJsonLd, webPageJsonLd, websiteJsonLd } from "@/lib/seoStructuredData";

const description = "Could a robot take over a repetitive task at your site? Show us the task. Robot teams evaluate it in simulation, and we recommend one team whose evaluation passed. Free during the beta.";

export default function Home() {
  return (
    <>
      <SEO
        title="Blueprint | Start with one real task"
        description={description}
        canonical="/"
        jsonLd={[organizationJsonLd(), websiteJsonLd(), webPageJsonLd({ path: "/", name: "Blueprint", description })]}
      />
      <section className="ms-task-hero ms-container" aria-labelledby="hero-title">
          <div className="ms-task-hero-intro">
            <h1 id="hero-title">Could a robot take over a repetitive task at your site?</h1>
            <div className="ms-task-hero-actions">
              <p>Show us the task. Robot teams evaluate it in simulation, and we recommend the one whose evaluation passed. You book the pilot in one step.</p>
              <div className="ms-task-hero-links">
                <a className="ms-button" href="/contact/site-operator">Show us a task <ArrowRight size={21} strokeWidth={1.5} aria-hidden="true" /></a>
              </div>
              <p className="ms-task-hero-start">Free during the beta, for sites and robot teams.</p>
            </div>
          </div>
          <PilotPreview />
      </section>

      <section className="ms-method ms-container" id="how-it-works" aria-label="How it works">
        <ol className="ms-steps">
          <li><p className="ms-step-head"><span className="ms-step-number">01</span><span className="ms-step-rule" aria-hidden="true" /><span>Show us the task</span></p><p>Describe it or film it on your phone.</p></li>
          <li><p className="ms-step-head"><span className="ms-step-number">02</span><span className="ms-step-rule" aria-hidden="true" /><span>Robot teams evaluate it</span></p><p>Invited teams test it in a simplified simulation of your task, informed by your footage.</p></li>
          <li><p className="ms-step-head"><span className="ms-step-number">03</span><span className="ms-step-rule" aria-hidden="true" /><span>Book the recommended pilot</span></p><p>One team whose evaluation passed. You agree dates and terms with them.</p></li>
        </ol>
        <p className="ms-method-note">A simulated evaluation is an estimate, not proof of how a robot performs on site or of its safety. The pilot measures that.</p>
        <a className="ms-method-link" href="/how-it-works#warehouse-task">See the warehouse walkthrough <ArrowRight size={16} aria-hidden="true" /></a>
      </section>

      <section className="ms-faq ms-container" aria-labelledby="faq-title">
        <h2 id="faq-title">Questions sites ask</h2>
        <div className="ms-faq-items">
          <div>
            <h3>Why not call robot vendors myself?</h3>
            <p>Each vendor pitches its own robot, and judging them against each other takes robotics expertise most sites don&rsquo;t have in-house. We do that part. Invited robot teams evaluate your task in the same simulation, built from your site, against the same success criteria, and we recommend one team whose evaluation passed. You start from results on your task, not a sales pitch, instead of committing to the first vendor you called.</p>
          </div>
          <div>
            <h3>Is it really free?</h3>
            <p>Yes. During the beta, Blueprint charges sites and robot teams nothing for submitting a job, screening, evaluations, our recommendation or booking the pilot, and takes no cut of the pilot. The robot team quotes the physical pilot; you agree its price and dates with them directly.</p>
          </div>
          <div>
            <h3>What if no robot team passes?</h3>
            <p>We tell you, and what would change that. Your job page shows what it is waiting on, and we email you when every evaluation so far has finished without a pass.</p>
          </div>
          <div>
            <h3>Who is responsible for the on-site pilot?</h3>
            <p>You and the robot team. Blueprint is not a party to the pilot: you agree its scope, dates and terms with the team, and the team or its integrator contracts for the physical work. A passed simulation is not a safety assessment.</p>
          </div>
          <div>
            <h3>What happens to my footage?</h3>
            <p>Robot teams never receive your recording. Blueprint and our listed processing providers use it to draft the job brief and rebuild the work area. A team&rsquo;s robot software is sent images rendered from the rebuilt scene, which can show layout and equipment, and those images are shared on the same terms as the scene. We do not use your footage to train AI models without your written agreement. <a href="/privacy">Privacy Policy</a></p>
          </div>
        </div>
      </section>

      <section className="ms-closing ms-container" aria-labelledby="closing-title">
        <h2 id="closing-title">Start with one recurring task.</h2>
        <p>A phone video or a short description is enough. {REPLY_TIMELINE}</p>
        <a className="ms-button" href="/contact/site-operator">Show us a task <ArrowRight size={21} strokeWidth={1.5} aria-hidden="true" /></a>
      </section>
    </>
  );
}
