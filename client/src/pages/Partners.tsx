import { BareBack, BareFine, BareGroup, BareLabel, BareRows, BareScreen } from "@/components/bare/Bare";
import { SEO } from "@/components/SEO";
import { PartnerApplication } from "@/components/site/PartnerApplication";
import { FOR_DEPLOYMENT_COMPANIES, PARTNERS_SEO_DESCRIPTION } from "@/lib/publicCopy";

/**
 * For deployment companies, bare bones (frame of 2026-11-12): what a company gets for each job, how it is approved,
 * what it sends back, and the application form itself (folded in from the old `/partners/deployment` page). Every
 * permission a site has recorded so far keeps its video private, so the page says only what a summary carries: the
 * kind of job, the first look and the early trial's result where one exists, as the site approved it; never the
 * video or the simulation. No price is stated.
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
          <p>Each job comes as a summary: the kind of job, a first look at which robots could fit, and our early trial's result where one exists. You tell us whether you'd take it.</p>
        </BareGroup>
        <BareRows title="How it works" rows={[
          { key: "approval", label: "How to be approved", value: "Apply below. We approve each company by hand." },
          { key: "response", label: "What you send back", value: "Interested or not a fit, and why." },
          { key: "cost", label: "Cost", value: "Nothing is charged today." },
        ]} />
        <div id="partner-application" className="bare-group">
          <PartnerApplication role="deployment" />
        </div>
        <BareFine>A job summary is not a site visit or a safety check. Any work is agreed between you and the site.</BareFine>
      </BareScreen>
    </div>
  </>;
}
