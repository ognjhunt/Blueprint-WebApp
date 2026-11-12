/**
 * Two public entry points, bare bones (2026-11-11). Sites start a job (the start form owns its screens); companies
 * apply to see the jobs sites share, and approved, signed-in companies see the job library here. Blueprint runs the
 * evaluations itself; everything in the beta is free.
 */
import { useLocation } from "wouter";

import { BareBack, BareGroup, BareLabel, BareScreen } from "@/components/bare/Bare";
import { SEO } from "@/components/SEO";
import { SiteCaptureStart } from "@/components/site/SiteCaptureStart";
import { TaskBrowse } from "@/components/site/TaskBrowse";
import { ROBOT_TEAM_SEO_DESCRIPTION, START_SEO_DESCRIPTION } from "@/lib/publicCopy";

export default function Contact() {
  const [location] = useLocation();
  const isSite = location !== "/contact/robot-team";

  if (!isSite) {
    return (
      <>
        <SEO title="Apply to see jobs | Blueprint" description={ROBOT_TEAM_SEO_DESCRIPTION} canonical="/contact/robot-team" />
        <div className="bare-page bare-forms">
          <BareScreen>
            <BareBack href="/partners" />
            <BareGroup>
              <BareLabel>For deployment companies</BareLabel>
              <h1 id="robot-team-title">Apply to see jobs</h1>
              <p>We approve each company by hand and email you. Approved companies see the jobs sites choose to share.</p>
            </BareGroup>
            <section className="bare-group ms-beta-access" id="robot-team-access" aria-label="Robot-team access">
              <TaskBrowse />
            </section>
            <p className="bare-fine">Nothing is charged today. Operate a site? <a href="/contact/site-operator">Start a job</a>.</p>
          </BareScreen>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO title="Start a job | Blueprint" description={START_SEO_DESCRIPTION} canonical="/contact/site-operator" />
      <div className="bare-page">
        <SiteCaptureStart />
      </div>
    </>
  );
}
