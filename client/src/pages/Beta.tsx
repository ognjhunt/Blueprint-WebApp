import { ArrowUpRight } from "lucide-react";
import { SEO } from "@/components/SEO";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import { REPLY_TIMELINE } from "@/data/betaTimelines";

const description = "Start with an email and a video of one recurring job. In Blueprint's free beta, we build a simulation of your site, test robots and policies on the job and show you an estimate of what's likely to work.";

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
        <p>Send an email and a video of a recurring job at your site. We draft the job brief from the video, build a simulation of your site and test robots and policies (the AI software that controls a robot) on the job ourselves. You see an estimate of what&apos;s likely to work, or &ldquo;held&rdquo; if we can&apos;t simulate that kind of job yet. Then we work alongside a deployment company on your real site.</p>
        <section>
          <h2>What do I provide?</h2>
          <p>An email address and a video of one complete task cycle and the surrounding work area. Upload existing footage or record it with our guidance. We analyze the video and draft the job description for you to correct. We only ask for measurements or other details when they affect the simulation.</p>
          <p style={{ marginTop: "1em" }}>You do not need to choose a robot or have an approved budget to start.</p>
        </section>
        <section>
          <h2>What do I receive?</h2>
          <p>A job brief and a simulation estimate of which robots and policies are likely to work on your job, with the evidence behind it and any open questions.</p>
          <p style={{ marginTop: "1em" }}>We reconstruct your site from the video and run every candidate ourselves in simulation, including policies served through APIs and different robot configurations. If a system needs access or an integration, its technology provider supplies it.</p>
          <p style={{ marginTop: "1em" }}>We do not turn a job away because of its type. If we can&apos;t simulate yours yet, we mark it &ldquo;held&rdquo; and count it as demand for that kind of job. If no candidate works, we explain the gap. Your job page shows the current stage and the next action.</p>
        </section>
        <section>
          <h2>How long does it take?</h2>
          <p>{REPLY_TIMELINE} The next steps depend on the recording and the candidates available for your job. Submission does not reserve equipment or guarantee a pilot date.</p>
        </section>
        <section id="scope">
          <h2>What does it cost?</h2>
          <p>The beta is free for sites and partners: submitting a job, the simulation and its result. Blueprint takes no cut of the pilot. The deployment company quotes the on-site work, equipment and support; you approve those costs and agree the contract directly.</p>
          <p className="ms-field-hint">Paid for something before the free beta, or need to cancel a pilot? <a href="/refunds">Refunds and cancellations</a></p>
        </section>
        <section>
          <h2>What does the evidence show?</h2>
          <p>Every result states what it covers and what it doesn&apos;t. A simulation result is an estimate; it never certifies physical performance or safety. A supervised pilot at your site measures how the system actually performs there. You can review and correct your job brief.</p>
        </section>
        <section>
          <h2>Who delivers the pilot?</h2>
          <p>A deployment company supplies and integrates the system and provides the support agreed in your contract. Blueprint works alongside them on your site. You choose whether to proceed and approve the spending.</p>
        </section>
        <section>
          <h2>How can partners participate?</h2>
          <p>Deployment companies can apply to deliver and support jobs. Hardware and policy providers can apply to give Blueprint access to a system or an integration; Blueprint runs it in its own simulations. Applying does not guarantee a run or a contract.</p>
          <p style={{ marginTop: "1em" }}><a className="ms-text-link" href="/partners">Explore partner roles <ArrowUpRight size={16} aria-hidden="true" /></a></p>
        </section>
        <div className="ms-how-cta"><a className="ms-button" href="/contact/site-operator?source=beta">Submit a job</a></div>
      </article>
    </>
  );
}
