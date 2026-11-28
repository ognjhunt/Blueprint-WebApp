import { useEffect, useState } from "react";
import { ArrowRight, Cog, Layers, Package, Truck, Wrench, type LucideIcon } from "lucide-react";
import type { PublicLiveJob } from "@/types/taskBrowse";

export const LIVE_JOBS_HEADING = "Live jobs";
export const LIVE_JOBS_LEAD = "Jobs sites have posted. Open one to apply; approved deployment companies see its video and description, and its simulation when one has been built.";
export const LIVE_JOB_OPEN = "See job";
/** Said when the list was read and holds no live job (outreach playbook fix 12, 2026-11-27). */
export const LIVE_JOBS_EMPTY = "No live jobs right now. New jobs appear here when a site posts one.";

/** A simple picture for each kind of job, in place of a thumbnail: the thumbnail is the site's own, for approved companies. */
const KIND_ICONS: Readonly<Record<PublicLiveJob["kindKey"], LucideIcon>> = {
  pick_and_place: Package, palletizing: Layers, machine_tending: Cog, transport: Truck, other: Wrench,
};

const day = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
};

const isRef = (value: unknown): value is string => typeof value === "string" && /^l-[a-f0-9]{32}$/.test(value);

/**
 * The live jobs anyone may see on /jobs (owner, 2026-11-23), from `/api/public/live-jobs`: each job's kind, country,
 * the day it was posted and whether its simulation is ready, nothing a site said, with a picture for its kind. Each row
 * opens the job's page: an approved company reads the job there, and anyone else is asked to apply and comes back to
 * that job once approved. Says plainly when the list was read and holds no live job; shows nothing when it cannot be read.
 */
export function LiveJobs() {
  const [jobs, setJobs] = useState<PublicLiveJob[] | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/public/live-jobs").then(response => response.ok ? response.json() : null)
      .then((data: { jobs?: unknown } | null) => {
        if (!active || !Array.isArray(data?.jobs)) return;
        setJobs(data.jobs.filter((job): job is PublicLiveJob => Boolean(job) && typeof job.kind === "string"
          && typeof job.postedOn === "string" && typeof job.simulationReady === "boolean"));
      }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  if (!jobs) return null;
  if (!jobs.length) return <section className="live-jobs" aria-labelledby="live-jobs-heading">
    <h2 id="live-jobs-heading">{LIVE_JOBS_HEADING}</h2>
    <p className="live-jobs-lead">{LIVE_JOBS_EMPTY}</p>
  </section>;
  return <section className="live-jobs" aria-labelledby="live-jobs-heading">
    <h2 id="live-jobs-heading">{LIVE_JOBS_HEADING}</h2>
    <p className="live-jobs-lead">{LIVE_JOBS_LEAD}</p>
    <ul>
      {jobs.map((job, index) => {
        const Icon = KIND_ICONS[job.kindKey] ?? Wrench;
        const meta = [job.country, day(job.postedOn) && `Posted ${day(job.postedOn)}`, job.simulationReady ? "Simulation ready" : null]
          .filter(Boolean).join(" · ");
        const body = <>
          <span className="live-job-icon" aria-hidden="true"><Icon size={22} strokeWidth={1.6} /></span>
          <span className="live-job-text"><strong>{job.kind}</strong><span>{meta}</span></span>
        </>;
        return <li key={job.ref ?? `${job.postedOn}-${index}`}>
          {isRef(job.ref)
            ? <a className="live-job" href={`/jobs/${job.ref}`}>{body}
              <span className="live-job-open">{LIVE_JOB_OPEN}<ArrowRight size={16} aria-hidden="true" /></span></a>
            : <div className="live-job">{body}</div>}
        </li>;
      })}
    </ul>
    <p><a href="#partner-application">Apply to see jobs</a></p>
  </section>;
}
