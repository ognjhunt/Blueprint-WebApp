/**
 * Two public entry points, bare bones (2026-11-11). Sites start a job (the start form owns its screens); companies
 * apply to see the jobs sites send (sharing is the service, 2026-11-12: a site does not choose to share), and approved,
 * signed-in companies see the job library here. The application form itself is on `/partners`; this page points there.
 */
import { useState } from "react";
import { useLocation } from "wouter";

import { BareBack, BareGroup, BareLabel, BareScreen } from "@/components/bare/Bare";
import { SEO } from "@/components/SEO";
import { SiteCaptureStart } from "@/components/site/SiteCaptureStart";
import { TaskBrowse } from "@/components/site/TaskBrowse";
import { ROBOT_TEAM_SEO_DESCRIPTION, START_SEO_DESCRIPTION } from "@/lib/publicCopy";

/** What the page is, for a visitor who may apply, and for an approved company (or staff) the library is shown to. */
const ROBOT_TEAM_INTRO = {
  apply: { title: "Apply to see jobs",
    lead: "We approve each company by hand and email you. Approved companies see the jobs sites send us, and answer." },
  library: { title: "Job library", lead: "The jobs sites send us. Approved deployment companies see them and answer." },
} as const;

export default function Contact() {
  const [location] = useLocation();
  const isSite = location !== "/contact/robot-team";
  // The heading follows the library: an approved, signed-in company is not asked to apply.
  const [library, setLibrary] = useState(false);
  const intro = ROBOT_TEAM_INTRO[library ? "library" : "apply"];

  if (!isSite) {
    return (
      <>
        <SEO title={`${intro.title} | Blueprint`} description={ROBOT_TEAM_SEO_DESCRIPTION} canonical="/contact/robot-team" />
        <div className="bare-page bare-forms">
          <BareScreen>
            <BareBack href="/partners" />
            <BareGroup>
              <BareLabel>For deployment companies</BareLabel>
              <h1 id="robot-team-title">{intro.title}</h1>
              <p>{intro.lead}</p>
            </BareGroup>
            <section className="bare-group ms-beta-access" id="robot-team-access" aria-label="Robot-team access">
              <TaskBrowse onLibrary={setLibrary} />
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
