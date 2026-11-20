import { BareBig, BareScreen } from "@/components/bare/Bare";
import { SEO } from "@/components/SEO";
import { PartnerApplication } from "@/components/site/PartnerApplication";
import { FOR_DEPLOYMENT_COMPANIES, PARTNERS_SEO_DESCRIPTION, PARTNERS_TITLE } from "@/lib/publicCopy";

export default function Partners() {
  return <>
    <SEO title={`${FOR_DEPLOYMENT_COMPANIES} | Blueprint`} description={PARTNERS_SEO_DESCRIPTION} canonical="/partners" />
    <div className="bare-page bare-forms">
      <div className="bare-company">
        <BareScreen className="bare-company-intro">
          <BareBig as="h1" sub="Review real jobs with site videos and details. When a site asks to meet, we introduce you.">{PARTNERS_TITLE}</BareBig>
          <p className="bare-company-access">Already approved? <a href="/contact/robot-team">Browse jobs</a></p>
        </BareScreen>
        <BareScreen className="bare-company-application">
          <div id="partner-application">
            <PartnerApplication />
          </div>
        </BareScreen>
      </div>
    </div>
  </>;
}
