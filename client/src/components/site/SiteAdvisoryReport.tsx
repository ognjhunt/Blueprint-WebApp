import type { SiteAdvisory } from "@/types/siteAdvisory";
/**
 * The site's view of its job assessment: where it stands, and how to reach
 * Blueprint. Never the assessment's open questions or proposed next steps:
 * the site sends its video and nothing else, and Blueprint resolves the rest
 * (founder direction, 2026-10-20). Staff see those in the job console.
 */
export function SiteAdvisoryReport({ advisory, compact = false }: { advisory: SiteAdvisory | null | undefined; compact?: boolean }) {
  if (!advisory || advisory.state === "authority_ended") return null;
  if (compact) return <section className="ws-task-assessment" aria-label="Job advisory assessment">
    <h2>Job assessment</h2>
    {advisory.state === "ready" ? <p>We have reviewed your video and job details.</p> : <p>{advisory.state === "queued" ? "Your video is saved. We are preparing the assessment. You do not need to do anything now."
      : advisory.state === "running" ? "We are reviewing your video and job details."
        : advisory.state === "needs_review" ? "We need to review an assessment issue. Keep your original video and contact Blueprint."
          : "We could not check the assessment. Reopen your job or contact Blueprint. Keep your original video."}</p>}
    <a className="ws-link" href="mailto:hello@tryblueprint.io">Contact Blueprint about this job</a>
    {advisory.correlationId && <details className="ws-task-reference"><summary>Support reference</summary><p>{advisory.correlationId}</p></details>}
  </section>;
  if (advisory.state !== "ready") return <section aria-label="Job advisory assessment">
    <h2>Your job assessment</h2>
    <p>{advisory.state === "queued" ? "Your video is saved. Blueprint is preparing your job assessment; nothing more is needed from you right now."
      : advisory.state === "running" ? "Your video is being reviewed against the job details."
        : advisory.state === "needs_review" ? "Blueprint needs to review an unresolved assessment issue. Keep your original video and contact Blueprint using this job reference."
          : "The current assessment could not be checked. Reopen your job or contact Blueprint using this job reference; keep your original video."}</p>
    {["needs_review", "unavailable"].includes(advisory.state) && <p><a href="mailto:hello@tryblueprint.io">Contact Blueprint about this job</a></p>}
    {advisory.correlationId && <small>Reference: {advisory.correlationId}</small>}
  </section>;
  return <section aria-label="Job advisory assessment">
    <h2>Your job assessment</h2>
    <p>Your video has been reviewed against the job details.</p>
    <p>Need to correct a detail? <a href="mailto:hello@tryblueprint.io">Contact Blueprint about this job</a>.</p>
    {["needs_review", "unavailable"].includes(advisory.state) && <p><a href="mailto:hello@tryblueprint.io">Contact Blueprint about this job</a></p>}
    {advisory.correlationId && <small>Reference: {advisory.correlationId}</small>}
  </section>;
}
