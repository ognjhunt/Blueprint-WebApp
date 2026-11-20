/**
 * Two public entry points, bare bones (2026-11-11). Sites start a job (the start form owns its screens); companies
 * apply to see the jobs sites send (sharing is the service, 2026-11-12: a site does not choose to share), and approved,
 * signed-in companies see the job library here. The application form itself is on `/partners`; this page points there.
 */
import { useState } from "react";
import { useLocation } from "wouter";

import { BareBack, BareScreen } from "@/components/bare/Bare";
import { SEO } from "@/components/SEO";
import { SiteCaptureStart } from "@/components/site/SiteCaptureStart";
import { TaskBrowse } from "@/components/site/TaskBrowse";
import { ROBOT_TEAM_SEO_DESCRIPTION, START_SEO_DESCRIPTION } from "@/lib/publicCopy";
import { BROWSE_JOBS_PATH, BROWSE_JOBS_TITLE } from "@/lib/robotTeamAccess";
import { useOptionalAuth } from "@/contexts/AuthContext";

/** What the page is, for a visitor who may apply, and for an approved company (or staff) the library is shown to. */
const ROBOT_TEAM_INTRO = { apply: "Apply to see jobs", library: BROWSE_JOBS_TITLE } as const;

export default function Contact() {
  const [location] = useLocation();
  const isSite = location !== BROWSE_JOBS_PATH;
  // The heading follows the library: an approved, signed-in company is not asked to apply.
  const auth = useOptionalAuth();
  const [accessResolved, setLibrary] = useState<boolean | null>(null);
  const library = accessResolved ?? Boolean(auth?.currentUser);
  const intro = ROBOT_TEAM_INTRO[library ? "library" : "apply"];

  if (!isSite) {
    return (
      <>
        <SEO title={`${intro} | Blueprint`} description={ROBOT_TEAM_SEO_DESCRIPTION} canonical={BROWSE_JOBS_PATH} />
        <div className="bare-page bare-forms">
          <BareScreen className={library ? "opportunities-page" : undefined}>
            {!library && <BareBack href="/jobs" />}
            <h1 id="robot-team-title">{intro}</h1>
            <div className="bare-group ms-beta-access" id="robot-team-access">
              <TaskBrowse onLibrary={setLibrary} />
            </div>
            {!library && <p className="bare-fine">Nothing is charged today. Have a job to automate? <a href="/contact/site-operator">Start a job</a>.</p>}
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
