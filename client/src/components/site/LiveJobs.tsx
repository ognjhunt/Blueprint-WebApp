import { useEffect, useState } from "react";
import type { PublicLiveJob } from "@/types/taskBrowse";

export const LIVE_JOBS_HEADING = "Live jobs";
export const LIVE_JOBS_LEAD = "Jobs sites have posted. Approved deployment companies see each job's video, description and simulation.";

const day = (value: string) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
};

/**
 * The live jobs anyone may see on /jobs (owner, 2026-11-23), from `/api/public/live-jobs`: each job's kind, country,
 * the day it was posted and whether its simulation is ready, nothing a site said. Shows nothing while there are no
 * live jobs or the list cannot be read.
 */
export function LiveJobs() {
  const [jobs, setJobs] = useState<PublicLiveJob[]>([]);
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
  if (!jobs.length) return null;
  return <section className="live-jobs" aria-labelledby="live-jobs-heading">
    <h2 id="live-jobs-heading">{LIVE_JOBS_HEADING}</h2>
    <p className="live-jobs-lead">{LIVE_JOBS_LEAD}</p>
    <ul>
      {jobs.map((job, index) => <li key={`${job.postedOn}-${index}`}>
        <strong>{job.kind}</strong>
        <span>{[job.country, day(job.postedOn) && `Posted ${day(job.postedOn)}`, job.simulationReady ? "Simulation ready" : null]
          .filter(Boolean).join(" · ")}</span>
      </li>)}
    </ul>
    <p><a href="#partner-application">Apply to see jobs</a></p>
  </section>;
}
