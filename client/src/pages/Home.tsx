import { ArrowRight } from "lucide-react";
import { PilotPreview } from "@/components/site/PilotPreview";
import { SEO } from "@/components/SEO";
import { REPLY_TIMELINE } from "@/data/betaTimelines";
import { organizationJsonLd, webPageJsonLd, websiteJsonLd } from "@/lib/seoStructuredData";

const description = "Send video of one recurring job. Blueprint simulates your site, runs candidate robots and policies against the job itself, and shows you a bounded estimate of what works. Free during the beta.";

export default function Home() {
  return (
    <>
      <SEO title="Blueprint | Find the right way to automate your work" description={description} canonical="/" jsonLd={[organizationJsonLd(), websiteJsonLd(), webPageJsonLd({ path: "/", name: "Blueprint", description })]} />
      <section className="ms-task-hero ms-container" aria-labelledby="hero-title">
        <div className="ms-task-hero-intro">
          <h1 id="hero-title">Find the right way to automate your work.</h1>
          <div className="ms-task-hero-actions">
            <p>Show us one recurring job on video. We turn it into a simulation of your site, run many candidate robots and policies against the job, and show you a bounded estimate of what works. Then we work alongside a deployment company on your site.</p>
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
        <h2 className="mp-section-title" id="home-process-title">From a recurring job to a measured pilot.</h2>
        <ol className="ms-steps">
          <li><p className="ms-step-head"><span className="ms-step-number">01</span><span className="ms-step-rule" aria-hidden="true" /><span>Show us the work</span></p><p>Upload or record one task in its work area. We analyze the video and draft a job brief for you to correct.</p></li>
          <li><p className="ms-step-head"><span className="ms-step-number">02</span><span className="ms-step-rule" aria-hidden="true" /><span>Compare robots in simulation</span></p><p>We reconstruct the site and run candidate policies, policy APIs and robots against the job ourselves. You see a bounded estimate of what works, or “held” if we can’t simulate that kind of job yet.</p></li>
          <li><p className="ms-step-head"><span className="ms-step-number">03</span><span className="ms-step-rule" aria-hidden="true" /><span>Pilot it on your site</span></p><p>When an approach works in simulation, we work alongside a deployment company to run a pilot at your site and measure the result against your criteria.</p></li>
        </ol>
        <p className="mp-support-note">A simulation result is an estimate. The physical pilot measures performance at your site.</p>
        <a className="ms-method-link" href="/how-it-works#warehouse-task">See the warehouse walkthrough <ArrowRight size={16} aria-hidden="true" /></a>
      </section>

      <section className="ms-closing ms-container" aria-labelledby="closing-title">
        <h2 id="closing-title">What work would you like automated?</h2>
        <p>Send video of one recurring job. {REPLY_TIMELINE}</p>
        <p className="mp-support-note">You choose whether to proceed, and you agree any pilot&apos;s price and support directly with the deployment company. Blueprint is free during the beta. <a href="/beta">Costs and responsibilities</a></p>
        <p className="mp-support-note">Your recording and contact details stay private. You control how your job is shared. <a href="/privacy">Privacy</a></p>
        <a className="ms-button" href="/contact/site-operator">Submit a job <ArrowRight size={21} strokeWidth={1.5} aria-hidden="true" /></a>
      </section>
    </>
  );
}
