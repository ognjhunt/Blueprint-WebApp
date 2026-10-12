import type { SiteAdvisory } from "@/types/siteAdvisory";
export function SiteAdvisoryReport({ advisory, compact = false }: { advisory: SiteAdvisory | null | undefined; compact?: boolean }) {
  if (!advisory || advisory.state === "authority_ended") return null;
  if (compact) return <section className="ws-task-assessment" aria-label="Job advisory assessment">
    <h2>Job assessment</h2>
    {advisory.state === "ready" ? <>
      {advisory.nextAction && <p>{advisory.nextAction.replace(/^Recommended next step \(proposal\):\s*/, "")}</p>}
      <p className="ws-note">Suggested next step. Robot performance still needs to be tested.</p>
      {advisory.unknowns.length > 0 && <details>
        <summary>Open questions ({advisory.unknowns.length})</summary>
        <ul>{advisory.unknowns.map(text => <li key={text}>{text.replace(/^(Question to resolve:|Unresolved:)\s*/, "")}</li>)}</ul>
      </details>}
    </> : <p>{advisory.state === "queued" ? "Your video is saved. We are preparing the assessment. You do not need to do anything now."
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
    {advisory.unknowns.length > 0 && <div><h3>What we still need to know</h3><ul>
      {advisory.unknowns.map(text => <li key={text}>{text.replace(/^(Question to resolve:|Unresolved:)\s*/, "")}</li>)}
    </ul></div>}
    {advisory.nextAction && <div><h3>Next step to consider</h3><p>{advisory.nextAction.replace(/^Recommended next step \(proposal\):\s*/, "")}</p>
      <small>This is a proposed next step, not a recorded outcome.</small></div>}
    <p>Need to correct a detail? <a href="mailto:hello@tryblueprint.io">Contact Blueprint about this job</a>.</p>
    {["needs_review", "unavailable"].includes(advisory.state) && <p><a href="mailto:hello@tryblueprint.io">Contact Blueprint about this job</a></p>}
    {advisory.correlationId && <small>Reference: {advisory.correlationId}</small>}
  </section>;
}
