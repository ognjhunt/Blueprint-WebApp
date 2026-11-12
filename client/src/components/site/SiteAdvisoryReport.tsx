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
  return <details className={compact ? "ws-task-assessment" : "job-planning-details"} aria-label="Processing details">
    <summary>Processing details</summary>
    <p>{advisory.state === "ready" ? "Blueprint reviewed your video and job details."
      : advisory.state === "needs_review" ? "Blueprint is reviewing a processing issue."
        : advisory.state === "unavailable" ? "The latest processing update is unavailable."
          : "Blueprint is processing your recording. No action is needed from you."}</p>
    {advisory.correlationId && <p>Reference: {advisory.correlationId}</p>}
    {children}
    <a className={compact ? "ws-link" : "ms-text-link"} href="mailto:hello@tryblueprint.io">Contact Blueprint about this job</a>
  </details>;
}
