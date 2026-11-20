import type { SiteAdvisory } from "@/types/siteAdvisory";
import type { ReactNode } from "react";
/**
 * The site's view of its job assessment: where it stands, and how to reach
 * Blueprint. Never the assessment's open questions or proposed next steps:
 * the site sends its video and nothing else, and Blueprint resolves the rest
 * (founder direction, 2026-10-20). Staff see those in the job console.
 */
export function SiteAdvisoryReport({ advisory, compact = false, children }: { advisory: SiteAdvisory | null | undefined; compact?: boolean; children?: ReactNode }) {
  // The per-job site assessment has ended (2026-11-11): only an older job's finished result is shown. Any other
  // state (a job queued at cutover now reads as retired or unavailable) shows nothing: no spinner, no error.
  if (!advisory || advisory.state !== "ready") return null;
  // Its reference stays in the admin job console: the site's job link is how it reaches us about the job.
  return <details className={compact ? "ws-task-assessment" : "job-planning-details"} aria-label="Earlier video notes">
    <summary>Earlier video notes</summary>
    <p>These notes are from an earlier check of your video and job details.</p>
    {children}
    <a className={compact ? "ws-link" : "ms-text-link"} href="mailto:hello@tryblueprint.io">Contact Blueprint about this job</a>
  </details>;
}
