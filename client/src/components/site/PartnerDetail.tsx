import { BareBack, BareFine, BareGroup, BareLabel, BareRows, BareScreen } from "@/components/bare/Bare";
import { SEO } from "@/components/SEO";
import { PartnerApplication, type PartnerRole } from "./PartnerApplication";

/** A partner's application, bare bones: who it is for, the form, then who does what in short rows. */
export function PartnerDetail({ role }: { role: PartnerRole }) {
  const deployment = role === "deployment";
  const description = deployment
    ? "Apply to set robots up for Blueprint's site jobs. Tell us the work, regions and robot systems your team can install and support. Free during the beta."
    : "Make your robot, control software or model API available for Blueprint to test on real site jobs in simulation. Blueprint runs it; you supply access.";
  return <>
    <SEO title={deployment ? "Deployment partners | Blueprint" : "Robot technology providers | Blueprint"} description={description} canonical={`/partners/${role}`} />
    <div className="bare-page bare-forms">
      <BareScreen>
        <BareBack href="/partners" />
        <BareGroup>
          <BareLabel>{deployment ? "Companies that set robots up" : "Robot and software makers"}</BareLabel>
          <h1 id="partner-title">{deployment ? "Set robots up for sites." : "Tell us about your robot or software."}</h1>
          <p>{deployment
            ? "When a site shares its job, approved companies see a summary of it, without the site's name. The site agrees any work with you directly."
            : "We test the top AI robots on each job in a simulation of the site. You give us access; we run it."}</p>
        </BareGroup>
        <div id="partner-application" className="bare-group">
          <PartnerApplication role={role} />
        </div>
        <BareRows title="Who does what" rows={deployment ? [
          { key: "blueprint", label: "Blueprint", value: "The job description, the answer, the simulation and the job card. Estimates, never certified." },
          { key: "you", label: "You", value: "The equipment and set-up you quote, and the support you agree." },
          { key: "site", label: "The site", value: "Site access, the contract and acceptance." },
        ] : [
          { key: "jobs", label: "Jobs", value: "Which tasks and robot set-ups your system supports today." },
          { key: "access", label: "Access", value: <>An HTTPS endpoint with a bearer token; interfaces agreed before a run. <a href="/agent-access.openapi.json">API reference</a></> },
          { key: "terms", label: "Terms", value: "Evidence, commercial terms and data use for the test." },
        ]} />
        <BareFine>{deployment ? "Applying does not award a job; the site chooses who to work with." : "Applying does not start a test or admit uploaded weights or containers."}</BareFine>
      </BareScreen>
    </div>
  </>;
}
