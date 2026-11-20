import { BareBig, BareScreen } from "@/components/bare/Bare";
import { SEO } from "@/components/SEO";
import { PartnerApplication } from "@/components/site/PartnerApplication";
import { SampleJob } from "@/components/site/SampleJob";
import { FIND_JOBS_PATH, PARTNERS_PAGE_NAME, PARTNERS_SEO_DESCRIPTION, PARTNERS_TITLE } from "@/lib/publicCopy";

/**
 * Find jobs (/jobs; /partners shows the same page): what an approved deployment company gets, shown with one sample
 * job, and the one application. The header's "Find jobs" link lands here (owner, 2026-11-20).
 */
export default function Partners() {
  return <>
    <SEO title={`${PARTNERS_PAGE_NAME} | Blueprint`} description={PARTNERS_SEO_DESCRIPTION} canonical={FIND_JOBS_PATH} />
    <div className="bare-page bare-forms">
      <div className="bare-company">
        <BareScreen className="bare-company-intro">
          <BareBig as="h1" sub="Review real jobs, each with the site's video and description. When a site asks to meet, we introduce you.">{PARTNERS_TITLE}</BareBig>
          {/* DEMO: invented counts for the internal showing; not read from any data. Never merge. */}
          <p className="bare-company-access">42 open jobs · 18 approved deployment companies</p>
          <p className="bare-company-access"><a href="#sample-job">See a sample job</a></p>
          <p className="bare-company-access">Already approved? <a href="/contact/robot-team">See jobs</a>.</p>
        </BareScreen>
        <BareScreen className="bare-company-application">
          <div id="partner-application">
            <PartnerApplication />
          </div>
        </BareScreen>
        <SampleJob />
      </div>
    </div>
  </>;
}
