import { ArrowRight } from "lucide-react";
import { PilotPreview } from "@/components/site/PilotPreview";
import { SEO } from "@/components/SEO";
import { REPLY_TIMELINE } from "@/data/betaTimelines";
import { organizationJsonLd, webPageJsonLd, websiteJsonLd } from "@/lib/seoStructuredData";

const description = "Show us one recurring job. Blueprint helps you assess suitable automation, test where needed, compare delivery proposals and choose a team for a measured pilot. Free during the beta.";

const supportedJobs = [
  { title: "Transfer known items", text: "Move a defined range of rigid objects between a tote, tray or fixed workstation." },
  { title: "Load or unload a station", text: "Place known parts into a fixture or remove them from one repeated operation." },
  { title: "Open or close a fixture", text: "Operate a drawer, door or similar mechanism within a clearly defined work area." },
];



export default function Home() {
  return (
    <>
      <SEO title="Blueprint | Find the right way to automate your work" description={description} canonical="/" jsonLd={[organizationJsonLd(), websiteJsonLd(), webPageJsonLd({ path: "/", name: "Blueprint", description })]} />
      <section className="ms-task-hero ms-container" aria-labelledby="hero-title">
        <div className="ms-task-hero-intro">
          <h1 id="hero-title">Find the right way to automate your work.</h1>
          <div className="ms-task-hero-actions">
            <p>Show us one recurring job. Blueprint helps you assess suitable solutions, test where needed, and choose a team to deliver a measured pilot.</p>
            <div className="ms-task-hero-links">
              <a className="ms-button" href="/contact/site-operator">Submit a job <ArrowRight size={21} strokeWidth={1.5} aria-hidden="true" /></a>
              <a className="ms-text-link" href="/how-it-works">See how it works</a>
            </div>
            <p className="ms-task-hero-start">Free during the beta. A description is enough to start; video is optional.</p>
          </div>
        </div>
        <p className="mp-current-scope">Starting with bounded manipulation jobs: known objects, a fixed work area and a clear measure of success. <a href="#jobs-we-support">See jobs we support</a></p>
        <PilotPreview />
      </section>

      <section className="ms-method ms-container" id="how-it-works" aria-labelledby="home-process-title">
        <h2 className="mp-section-title" id="home-process-title">From a recurring job to a measured pilot.</h2>
        <ol className="ms-steps">
          <li><p className="ms-step-head"><span className="ms-step-number">01</span><span className="ms-step-rule" aria-hidden="true" /><span>Describe the work</span></p><p>Tell us what happens today and what a good result looks like. We help fill in the gaps and agree a job brief.</p></li>
          <li><p className="ms-step-head"><span className="ms-step-number">02</span><span className="ms-step-rule" aria-hidden="true" /><span>Assess suitable options</span></p><p>Check what could work, what needs testing and which delivery partners can supply and support it.</p></li>
          <li><p className="ms-step-head"><span className="ms-step-number">03</span><span className="ms-step-rule" aria-hidden="true" /><span>Choose and measure a pilot</span></p><p>Review comparable proposals, agree the pilot with your chosen partner and measure the result against your criteria.</p></li>
        </ol>
        <p className="mp-support-note">A simulation result is an estimate. The physical pilot measures performance at your site.</p>
        <a className="ms-method-link" href="/how-it-works">The process, responsibilities and costs <ArrowRight size={16} aria-hidden="true" /></a>
      </section>

      <section className="mp-section ms-container" id="jobs-we-support" aria-labelledby="supported-jobs-title">
        <div className="mp-section-intro"><h2 id="supported-jobs-title">Start with one well-defined job.</h2><p>One repeated operation, a known range of objects and room to test under supervision. We confirm the scope before any evaluation.</p></div>
        <div className="mp-job-types">{supportedJobs.map(job => <article key={job.title}><h3>{job.title}</h3><p>{job.text}</p></article>)}</div>
        <p className="mp-support-note">Have a different job? Describe it and we will assess the fit. On-site capture visits are available in the Austin metro; US sites can record their own work.</p>
      </section>

      <section className="ms-closing ms-container" aria-labelledby="closing-title">
        <h2 id="closing-title">What work would you like automated?</h2>
        <p>Start with one recurring job. {REPLY_TIMELINE}</p>
        <p className="mp-support-note">You choose whether to proceed. You choose the delivery partner and agree its price and support directly. Blueprint is free during the beta. <a href="/beta">Costs and responsibilities</a></p>
        <p className="mp-support-note">Your recording and contact details stay private. You control how your job is shared. <a href="/privacy">Privacy</a></p>
        <a className="ms-button" href="/contact/site-operator">Submit a job <ArrowRight size={21} strokeWidth={1.5} aria-hidden="true" /></a>
      </section>
    </>
  );
}
