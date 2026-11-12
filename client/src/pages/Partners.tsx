import { BareBack, BareFine, BareGroup, BareLabel, BareRows, BareScreen } from "@/components/bare/Bare";
import { SEO } from "@/components/SEO";
import { PartnerApplication } from "@/components/site/PartnerApplication";
import { FOR_DEPLOYMENT_COMPANIES, PARTNERS_SEO_DESCRIPTION } from "@/lib/publicCopy";

/**
 * For deployment companies, bare bones (frame of 2026-11-12): what a company gets for each job, how it is approved,
 * what it sends back, and the application form itself (folded in from the old `/partners/deployment` page). Sharing is
 * the service (2026-11-12): an approved company sees the job packet of each job sent under the current statement. A
 * site's name and contact details reach a company only through an introduction the site asks for. No price is stated.
 */
export default function Partners() {
  return <>
    <SEO title={`${FOR_DEPLOYMENT_COMPANIES} | Blueprint`} description={PARTNERS_SEO_DESCRIPTION} canonical="/partners" />
    <div className="bare-page bare-forms">
      <BareScreen>
        <BareBack href="/" />
        <BareGroup>
          <BareLabel>{FOR_DEPLOYMENT_COMPANIES}</BareLabel>
          <h1 id="partner-title">Real jobs from real sites.</h1>
          <p>Each job comes as a job packet: the site's description of the job, its video without sound, a first look at which robots could fit, the simulation of the site when it is ready, and our early trial's result where one exists. You answer in a minute.</p>
        </BareGroup>
        <BareRows title="How it works" rows={[
          { key: "approval", label: "How to be approved", value: "Apply below. We approve each company by hand." },
          { key: "response", label: "What you send back", value: "Interested, not a fit, or would need something." },
          { key: "introduction", label: "Meeting the site", value: "If you answer Interested and the site asks for an introduction, we give each of you the other's details." },
          { key: "cost", label: "Cost", value: "Nothing is charged today." },
        ]} />
        <div id="partner-application" className="bare-group">
          <PartnerApplication role="deployment" />
        </div>
        <BareFine>A job packet is not a site visit or a safety check. Any work is agreed between you and the site.</BareFine>
      </BareScreen>
    </div>
  </>;
}
