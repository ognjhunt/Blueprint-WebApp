import type { SiteAdvisory } from "@/types/siteAdvisory";
const basis = { observed: "Video analysis", operator_stated: "Supplied site statement", published: "Published source", measured: "Sourced measurement" };
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
    {advisory.sections.map(section => <div key={section.title}><h3>{section.title}</h3>
      {section.claims.map((claim, index) => <div key={index}><strong>{basis[claim.basis]}</strong><p>{claim.text}</p>
        {claim.evidence.filter(item => item.kind === "video" && item.atSeconds !== null).map((item, at) => <small key={at}>Video at {item.atSeconds} s</small>)}
      </div>)}
    </div>)}
    <h3>What remains uncertain</h3>
    {advisory.unknowns.map(text => <p key={text}>{text}</p>)}
    {advisory.nextAction && <><h3>Next step</h3><p>{advisory.nextAction}</p></>}
    {["needs_review", "unavailable"].includes(advisory.state) && <p><a href="mailto:hello@tryblueprint.io">Contact Blueprint about this job</a></p>}
    {advisory.correlationId && <small>Reference: {advisory.correlationId}</small>}
  </section>;
}
