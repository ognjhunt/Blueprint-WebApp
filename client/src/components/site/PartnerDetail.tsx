import { ArrowLeft, ArrowRight } from "lucide-react";
import { SEO } from "@/components/SEO";
import { PartnerApplication, type PartnerRole } from "./PartnerApplication";

export function PartnerDetail({ role }: { role: PartnerRole }) {
  const deployment = role === "deployment";
  const title = deployment ? "Deliver and support customer jobs." : "Make your system available for assessment.";
  const description = deployment
    ? "Apply to deliver Blueprint customer jobs. Share the work, regions and robot systems your team can install and support."
    : "Make your robot hardware, policy or model API available for assessment on real site jobs. Blueprint runs the assessment; you supply access or the integration. Compatibility and access are reviewed for each setup.";
  return <>
    <SEO title={deployment ? "Deployment partners | Blueprint" : "Robot technology providers | Blueprint"} description={description} canonical={`/partners/${role}`} />
    <section className="ms-partner-intro ms-container" aria-labelledby="partner-title">
      <a className="ms-back" href="/partners"><ArrowLeft size={16} aria-hidden="true" /> All partners</a>
      <p className="ms-eyebrow">{deployment ? "Deployment partners" : "Robot technology providers"}</p>
      <h1 id="partner-title">{title}</h1>
      <p className="ms-partner-lead">{deployment
        ? "Bring your integration and service expertise. Blueprint scopes the job and tests robots and policies on it in simulation. When an approach you support wins for a site, we may invite you to propose what your team can deliver."
        : "Bring hardware, a policy or a model API. Blueprint runs the assessment itself; you supply access or the integration needed to run your system. We agree which jobs and robot configurations it can be assessed on before arranging access."}</p>
      <a className="ms-button" href="#partner-application">{deployment ? "Apply as a deployment partner" : "Make your system available"}<ArrowRight size={18} aria-hidden="true" /></a>
      <p className="ms-field-hint">Free during the beta. Applications are reviewed; access and job invitations are confirmed separately.</p>
    </section>
    <section className="ms-partner-body ms-container" aria-label="Partner application">
      <div className="ms-partner-explainer">
        <h2>{deployment ? "A clear scope before a proposal." : "A clear test before an integration."}</h2>
        <p>{deployment
          ? "Review the required output, site conditions, available evidence and budget assumptions. Your proposal sets out equipment, installation, ongoing costs, timing and support. The customer decides whether to proceed and contracts with you directly."
          : "We review supported hardware, observations, actions and access arrangements. Existing deployment evidence, simulation and physical trials answer different questions; the evaluation scope states what each result supports."}</p>
        <h3>{deployment ? "Who does what" : "What we need to understand"}</h3>
        <ul>{(deployment ? [
          "Blueprint: the job brief, the simulation, the candidate evaluations and their results (estimates, not guarantees), and working alongside you on site.",
          "Your team: the equipment and implementation you quote, commissioning and agreed support.",
          "The customer: site access, the contract decision and acceptance against agreed criteria.",
        ] : [
          "Which tasks and robot configurations your system supports today.",
          "How it can be accessed and the integration needed to run it.",
          "Evidence, commercial terms and data-use conditions for the proposed assessment.",
        ]).map(item => <li key={item}>{item}</li>)}</ul>
        <p className="ms-partner-note">{deployment
          ? "Being first to respond does not award a contract. We consider task fit, evidence, total cost, availability and support. A pilot's scope and price are agreed before it starts."
          : "Any robot form can be considered. Admission depends on the exact setup and job; a submitted reference is not a completed evaluation or proof of physical performance."}</p>
        {!deployment && <details className="ms-partner-technical"><summary>Current policy evaluation interface</summary><p>Invited policy evaluations use an HTTPS endpoint with a bearer token. Observation and action interfaces, robot and gripper, and any adapter work are agreed before a run. Applying does not start an evaluation or admit uploaded weights or containers.</p><a href="/agent-access.openapi.json">Technical API reference</a></details>}
        <p className="ms-partner-note">{deployment ? "Also building hardware or policies?" : "Also install or operate systems?"} <a href={deployment ? "/partners/technology" : "/partners/deployment"}>{deployment ? "Technology provider path" : "Deployment partner path"}</a>. Tell us about both roles in your application.</p>
      </div>
      <div className="ms-partner-application" id="partner-application">
        <h2>Tell us what you can {deployment ? "deliver" : "provide"}.</h2>
        <p className="ms-field-hint">Start with your company and capabilities. We follow up on the details needed for a suitable job.</p>
        <PartnerApplication role={role} />
      </div>
    </section>
  </>;
}
