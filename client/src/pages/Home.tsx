import { ArrowRight } from "lucide-react";
import { PilotPreview } from "@/components/site/PilotPreview";
import { SEO } from "@/components/SEO";
import { REPLY_TIMELINE } from "@/data/betaTimelines";
import { organizationJsonLd, webPageJsonLd, websiteJsonLd } from "@/lib/seoStructuredData";

const description = "Send a video of one recurring job. Blueprint checks real robots against it by their published specifications, tests control policies on it in a simulation of your site and tells you how sure it is. Free during the beta.";

export default function Home() {
  return (
    <>
      <SEO title="Blueprint | Find the right way to automate your work" description={description} canonical="/" jsonLd={[organizationJsonLd(), websiteJsonLd(), webPageJsonLd({ path: "/", name: "Blueprint", description })]} />
      <section className="ms-task-hero ms-container" aria-labelledby="hero-title">
        <div className="ms-task-hero-intro">
          <h1 id="hero-title">Find the right way to automate your work.</h1>
          <div className="ms-task-hero-actions">
            <p>Send us a video of one recurring job. We check real robot models against it by their published specifications and show you which one most likely fits and how sure we are. Then we test control policies, the software that drives a robot, on the job in a simulation of your site. When you’re ready, you can share the job with deployment companies we’ve approved.</p>
            <div className="ms-task-hero-links">
              <a className="ms-button" href="/contact/site-operator">Submit a job <ArrowRight size={21} strokeWidth={1.5} aria-hidden="true" /></a>
              <a className="ms-text-link" href="/how-it-works">See how it works</a>
            </div>
            <p className="ms-task-hero-start">Free during the beta. Start with a video; we draft the job description from it.</p>
          </div>
        </div>
        <PilotPreview />
      </section>

      <section className="ms-method ms-container" id="how-it-works" aria-labelledby="home-process-title">
        <h2 className="mp-section-title" id="home-process-title">From one video to a robot that fits.</h2>
        <ol className="ms-steps">
          <li><p className="ms-step-head"><span className="ms-step-number">01</span><span className="ms-step-rule" aria-hidden="true" /><span>Send a video of the job</span></p><p>An email and a video of one recurring job, filmed in its work area. We draft the job description from the video for you to correct.</p></li>
          <li><p className="ms-step-head"><span className="ms-step-number">02</span><span className="ms-step-rule" aria-hidden="true" /><span>See which robot fits</span></p><p>We check real robot models against your job by their published specifications. You see the robot that most likely fits, a runner-up, what was ruled out and why, who already uses those robots for work like this, with sources, and how sure we are.</p></li>
          <li><p className="ms-step-head"><span className="ms-step-number">03</span><span className="ms-step-rule" aria-hidden="true" /><span>Proof in simulation</span></p><p>We build a simulation of your site from the video and test control policies on the job. You see which did best and how much that result can be trusted, or “held” if we can’t simulate that kind of job yet.</p></li>
          <li><p className="ms-step-head"><span className="ms-step-number">04</span><span className="ms-step-rule" aria-hidden="true" /><span>Find a deployment company</span></p><p>Share an anonymised job card, with the answer and the proof, with deployment companies Blueprint has approved. You agree any pilot directly with one of them.</p></li>
        </ol>
        <p className="mp-support-note">A simulation result is an estimate. The physical pilot measures performance at your site.</p>
        <a className="ms-method-link" href="/how-it-works#warehouse-task">See the warehouse walkthrough <ArrowRight size={16} aria-hidden="true" /></a>
      </section>

      <section className="ms-closing ms-container" aria-labelledby="closing-title">
        <h2 id="closing-title">What work would you like automated?</h2>
        <p>Send a video of one recurring job. {REPLY_TIMELINE}</p>
        <p className="mp-support-note">You choose whether to proceed, and you agree any pilot&apos;s price and support directly with the deployment company. Blueprint is free during the beta. <a href="/beta">Costs and responsibilities</a></p>
        <p className="mp-support-note">Your recording and contact details stay private. You control how your job is shared. <a href="/privacy">Privacy</a></p>
        <a className="ms-button" href="/contact/site-operator">Submit a job <ArrowRight size={21} strokeWidth={1.5} aria-hidden="true" /></a>
      </section>
    </>
  );
}
