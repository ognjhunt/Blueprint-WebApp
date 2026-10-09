import type { SiteAdvisory } from "@/types/siteAdvisory";
export function SiteAdvisoryReport({ advisory }: { advisory: SiteAdvisory | null | undefined }) {
  if (!advisory || advisory.state === "authority_ended") return null;
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
