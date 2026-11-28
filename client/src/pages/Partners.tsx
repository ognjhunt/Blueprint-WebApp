import { useEffect } from "react";
import { BareBig, BareScreen } from "@/components/bare/Bare";
import { SEO } from "@/components/SEO";
import { PartnerApplication } from "@/components/site/PartnerApplication";
import { SampleJob } from "@/components/site/SampleJob";
import { LiveJobs } from "@/components/site/LiveJobs";
import { PILOT_OFFER_FIND_JOBS_LINE } from "@/lib/pilotOffers";
import { FIND_JOBS_PATH, PARTNERS_PAGE_NAME, PARTNERS_SEO_DESCRIPTION, PARTNERS_TITLE } from "@/lib/publicCopy";

/**
 * Find jobs (/jobs; /partners shows the same page): the live jobs, as anyone may see them (`LiveJobs`), what an
 * approved deployment company gets, shown with one sample job, then the one application. The header's "Find jobs" link lands here (owner, 2026-11-20).
 */
export default function Partners() {
  // The page loads after the browser has looked for the anchor, so /jobs#sample-job opens on the sample here.
  useEffect(() => {
    if (window.location.hash === "#sample-job") document.getElementById("sample-job")?.scrollIntoView?.({ block: "start" });
  }, []);
  return <>
    <SEO title={`${PARTNERS_PAGE_NAME} | Blueprint`} description={PARTNERS_SEO_DESCRIPTION} canonical={FIND_JOBS_PATH} />
    <div className="bare-page bare-forms">
      <div className="bare-company">
        <BareScreen className="bare-company-intro">
          <BareBig as="h1" sub="Review real jobs, each with the site's video and description. Apply to the ones you can do; when a site accepts you, we introduce you both.">{PARTNERS_TITLE}</BareBig>
          <p className="bare-company-access"><a href="#sample-job">See a sample job</a></p>
          <p className="bare-company-access">Already approved? <a href="/contact/robot-team">See jobs</a>.</p>
          <p className="bare-company-access">{PILOT_OFFER_FIND_JOBS_LINE}</p>
        </BareScreen>
        <LiveJobs />
        <SampleJob />
        <BareScreen className="bare-company-application">
          <div id="partner-application">
            <PartnerApplication />
          </div>
        </BareScreen>
      </div>
    </div>
  </>;
}
