import { ArrowUpRight } from "lucide-react";
import { SEO } from "@/components/SEO";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import { REPLY_TIMELINE } from "@/data/betaTimelines";

const description = "Start with video of one recurring job. Blueprint's free beta builds a site simulation, runs candidate robots, policies and policy APIs against the job, and recommends the approach that wins plus deployment companies that support it.";

export default function Beta() {
  return (
    <>
      <SEO title="Beta program | Blueprint" description={description} canonical="/beta" jsonLd={[
        webPageJsonLd({ path: "/beta", name: "Blueprint beta program", description }),
        breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Beta program", path: "/beta" }]),
      ]} />
      <article className="ms-legal ms-container">
        <p className="ms-eyebrow">Beta program</p>
        <h1>Start with one real job.</h1>
        <p>Show us a recurring job at your site on video. We draft the brief from it, build a site simulation and run candidate robots, policies and policy APIs against the job. When an approach wins, we recommend it and the deployment companies that support it, then help you plan a measured pilot. Site sign-up is open; partners are reviewed before access to specific jobs.</p>
        <section>
          <h2>What do I provide?</h2>
          <p>Video of one complete task cycle and the surrounding work area. Upload existing footage or record it with our guidance. Video is required for the site assessment; we analyze it and draft the job description for you to correct. We ask for missing measurements or details only when they affect the evaluation.</p>
          <p style={{ marginTop: "1em" }}>You do not need to choose a robot or have an approved budget to start. Before delivery proposals, we discuss the output you need, installation and ongoing spending limits, and who can approve a pilot.</p>
        </section>
        <section>
          <h2>What do I receive?</h2>
          <p>A job brief and the results for the candidates we evaluated on your job, with clear evidence and remaining questions. When an approach wins, you get our recommendation, the deployment companies that support it and help comparing their delivery proposals. You choose whether to proceed and agree the physical pilot with your selected delivery partner.</p>
          <p style={{ marginTop: "1em" }}>We reconstruct your site from the video and run the candidates ourselves in simulation: accessible policies, policy APIs and robot configurations. Where a system needs access or an integration, its technology provider supplies it. Quick screening runs are diagnostic; a recommendation comes only from the finalists&apos; full scoring. Existing deployment evidence and physical testing help resolve questions the simulation cannot answer.</p>
          <p style={{ marginTop: "1em" }}>We do not turn a job away because of its type. If we cannot score yours in simulation yet, we accept it and hold it while we prepare its evaluation. If no candidate is suitable, we explain the gap and what would need to change. Your job page shows the current stage and the next action.</p>
        </section>
        <section>
          <h2>How long does it take?</h2>
          <p>{REPLY_TIMELINE} The next steps depend on the recording, evaluation scope and partner availability. We agree the next action with you; submission does not reserve equipment or guarantee a pilot date.</p>
        </section>
        <section id="scope">
          <h2>What does it cost?</h2>
          <p>The beta is free for sites and partners: submitting a job, assessment, evaluations, our recommendation and pilot coordination. Blueprint takes no cut of the pilot. Your deployment company quotes physical work, equipment and support; you approve those costs and agree the contract directly.</p>
          <p className="ms-field-hint">Paid for something before the free beta, or need to cancel a pilot? <a href="/refunds">Refunds and cancellations</a></p>
        </section>
        <section>
          <h2>What does the evidence show?</h2>
          <p>Every result has a scope and limitations. A simulation result is an estimate, not proof of physical performance or a safety certification. A supervised on-site pilot measures how the proposed system works in your environment. Job briefs and recommendations can be reviewed and corrected.</p>
        </section>
        <section>
          <h2>Who delivers the pilot?</h2>
          <p>The deployment company you select supplies and integrates the system and provides the support agreed in your contract. Blueprint defines the job with you, runs and compares the candidates, recommends deployment companies that support the winning approach, coordinates the decision and records the outcome. The customer approves the proposal and spending.</p>
        </section>
        <section id="workflow-details">
          <h2>How proposals and pilot reports work</h2>
          <p className="ms-field-hint">Operational clarification · October 21, 2026</p>
          <p>Delivery proposals supplement the job assessment. Selecting one records your preference; it does not sign a contract, authorize spending or book physical work. You and the provider separately agree the scope, price and terms. The beta remains free, with no Blueprint cut of the pilot.</p>
          <p style={{ marginTop: "1em" }}>This workflow does not expand permission to record, share footage or train models. Those permissions remain separate. Customer-reported pilot outcomes are identified as reports and kept separate from independently verified evaluation evidence.</p>
        </section>
        <section>
          <h2>How can partners participate?</h2>
          <p>Deployment companies can apply to deliver and support jobs. Hardware and policy providers can apply to make their systems available for assessment; Blueprint runs the assessment, and a provider supplies access or an integration when one is needed. We review fit, supported configurations, geography and access before a specific engagement. Applying does not guarantee an evaluation, recommendation or contract.</p>
          <p style={{ marginTop: "1em" }}><a className="ms-text-link" href="/partners">Explore partner roles <ArrowUpRight size={16} aria-hidden="true" /></a></p>
        </section>
        <div className="ms-how-cta"><a className="ms-button" href="/contact/site-operator?source=beta">Submit a job</a></div>
      </article>
    </>
  );
}
