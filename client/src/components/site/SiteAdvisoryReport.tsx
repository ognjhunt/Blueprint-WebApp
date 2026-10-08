import type { SiteAdvisory } from "@/types/siteAdvisory";
const basis = { observed: "Video analysis", operator_stated: "Supplied site statement", published: "Published source", measured: "Sourced measurement" };
export function SiteAdvisoryReport({ advisory }: { advisory: SiteAdvisory | null | undefined }) {
  if (!advisory || advisory.state === "authority_ended") return null;
  if (advisory.state !== "ready") return <section aria-label="Job advisory assessment">
    <h2>Your job assessment</h2>
    <p>{advisory.state === "queued" ? "Your video is saved and its job assessment is queued."
      : advisory.state === "running" ? "Your video is being reviewed against the job details."
        : advisory.state === "needs_review" ? "Your assessment needs a check. Keep your original video; Blueprint can help with the next step."
          : "The current assessment could not be checked. Keep your original video and try again shortly."}</p>
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
    {advisory.correlationId && <small>Reference: {advisory.correlationId}</small>}
  </section>;
}
