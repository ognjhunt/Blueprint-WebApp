import { ArrowRight } from "lucide-react";
import { EVERYDAY_ANSWERS, SAMPLE_JOB, TESTED_ANSWERS } from "@/lib/publicCopy";

/**
 * One sample job on the Find jobs page (owner, 2026-11-20), laid out as an approved company sees a live job
 * (`CompanyJob.tsx`), so a company knows what it is applying for. It is stock footage (Mixkit, free license; the record
 * is `public/licenses/sample-job/README.txt`), labelled "Sample job" and "not a live job" where it starts: no site
 * filmed it and nothing on it is a site's answer. The facts are only what the video shows; a live job's simulation and
 * first look are named, never imitated.
 */
export function SampleJob() {
  return <section className="bare-screen company-job company-job-ready sample-job" id="sample-job" aria-labelledby="sample-job-title">
    <p className="bare-example-tag">{SAMPLE_JOB.tag}</p>
    <h2 id="sample-job-title">{SAMPLE_JOB.title}</h2>
    <p className="opportunity-meta"><span>{SAMPLE_JOB.notLive}</span></p>

    <div className="company-job-grid">
      <div className="company-job-overview">
        <section aria-label="The job">
          <h3>The job, in the site's words</h3>
          <blockquote>{SAMPLE_JOB.sentence}</blockquote>
          <div className="company-job-success"><h3>What counts as done</h3><p>{SAMPLE_JOB.done}</p></div>
          <ul aria-label="What the video shows">{SAMPLE_JOB.facts.map(line => <li key={line}>{line}</li>)}</ul>
        </section>
        <section aria-label="The video">
          <h3>The video</h3>
          <video src="/samples/sample-job-parcels.mp4" poster="/samples/sample-job-parcels.jpg" controls muted playsInline
            preload="none" width={960} height={540} aria-label="Sample video, without sound" />
          <p className="ms-field-hint">{SAMPLE_JOB.credit}</p>
        </section>
      </div>

      <div className="company-job-overview sample-job-live">
        <section aria-label="On a live job">
          <h3>A live job can also include</h3>
          <ul>{SAMPLE_JOB.liveAlso.map(line => <li key={line}>{line}</li>)}</ul>
          <h3>How you answer</h3>
          <p>{`Answer ${EVERYDAY_ANSWERS}. Once you can download the simulation, you can also answer ${TESTED_ANSWERS}.`}</p>
          <p>{SAMPLE_JOB.introduction}</p>
          <p><a className="ms-button" href="#partner-application">{SAMPLE_JOB.cta}<ArrowRight size={18} aria-hidden="true" /></a></p>
        </section>
      </div>
    </div>
  </section>;
}
