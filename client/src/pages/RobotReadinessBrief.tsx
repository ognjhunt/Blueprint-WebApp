/**
 * The one-page robot readiness brief, for the person who found Blueprint to
 * print or save as a PDF and hand to whoever has to agree: the job, where it
 * stands, what it takes today, and, once Blueprint has shared it, what the job
 * needs, which kinds of robot fit, getting the site ready, what decides
 * success, safety and where robots already do this kind of job. Then what is
 * left to check. It reads the owner's private link, so it is printed, never
 * forwarded as a link. Never a robot team.
 */
import { useEffect, useState } from "react";
import { Helmet } from "@/lib/helmet";
import { useRoute } from "wouter";

import { ReadinessReportView, TrackerView } from "@/components/site/SiteReadinessPanel";
import { READINESS_BRIEF_FOOTER, type SiteReadinessResponse } from "@/data/siteReadiness";

type Loaded = { status: "loading" } | { status: "failed"; message: string } | { status: "ready"; readiness: SiteReadinessResponse };

export default function RobotReadinessBrief() {
  const [, params] = useRoute("/capture-upload/:token/brief");
  const token = params?.token ?? "";
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });

  useEffect(() => {
    let current = true;
    setLoaded({ status: "loading" });
    fetch(`/api/site-task-brief/${encodeURIComponent(token)}/readiness`)
      .then(async (response) => {
        const value = await response.json().catch(() => ({})) as Partial<SiteReadinessResponse> & { error?: string };
        if (!current) return;
        if (!response.ok || !value.tracker) {
          setLoaded({ status: "failed", message: value.error || "This brief could not be loaded. Open it from your job page." });
          return;
        }
        setLoaded({ status: "ready", readiness: value as SiteReadinessResponse });
      })
      .catch(() => { if (current) setLoaded({ status: "failed", message: "This brief could not be loaded. Check your connection." }); });
    return () => { current = false; };
  }, [token]);

  const readiness = loaded.status === "ready" ? loaded.readiness : null;
  return (
    // The bare shell sits outside the site layouts, so the page carries the minimal-site theme itself.
    <div className="minimal-site">
      <Helmet>
        <title>Robot readiness brief | Blueprint</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <header className="ms-container ms-capture-header ms-print-hide" style={{ maxWidth: "760px" }}>
        <a className="ms-brand" href="/" aria-label="Blueprint home"><span className="ms-brand-mark" aria-hidden="true" />Blueprint</a>
      </header>
      <main className="ms-container ms-capture-body ms-brief-page" style={{ paddingBlock: "24px 48px", maxWidth: "760px" }}>
      <p className="ms-eyebrow">Blueprint · Robot readiness brief</p>
      <h1>{readiness?.summary ?? "Your robot readiness brief"}</h1>
      <p className="ms-field-hint">{new Date().toLocaleDateString()}</p>
      {loaded.status === "loading" ? <p>Loading your brief…</p> : null}
      {loaded.status === "failed" ? <p role="alert">{loaded.message}</p> : null}
      {readiness ? (
        <>
          <p className="ms-print-hide">
            <button type="button" className="ms-button" onClick={() => window.print()}>Print or save as PDF</button>
          </p>
          <section className="ms-task-interest" aria-label="Where things stand">
            <h2 style={{ marginTop: 0 }}>Where things stand</h2>
            <TrackerView tracker={readiness.tracker} />
          </section>
          {readiness.workload || readiness.speed ? (
            <section className="ms-task-interest" aria-label="What this job takes today">
              <h2 style={{ marginTop: 0 }}>What this job takes today</h2>
              {readiness.workload ? <p>{readiness.workload.sentence} <span className="ms-field-hint">{readiness.workload.basis}</span></p> : null}
              {readiness.speed ? <p>{readiness.speed.sentence}</p> : null}
            </section>
          ) : null}
          {readiness.report ? (
            <section className="ms-task-interest" aria-label="Robot readiness report">
              <h2 style={{ marginTop: 0 }}>Robot readiness report</h2>
              <ReadinessReportView report={readiness.report} full />
            </section>
          ) : (
            <section className="ms-task-interest" aria-label="Robot readiness report">
              <p className="ms-field-hint">Blueprint's read of which robots fit this job appears here once Blueprint has reviewed your job.</p>
            </section>
          )}
          {readiness.nextThings.length ? (
            <section className="ms-task-interest" aria-label="What is left to check">
              <h2 style={{ marginTop: 0 }}>What is left to check</h2>
              <ol className="ms-fit-list">
                {readiness.nextThings.map((thing) => (
                  <li key={thing.id}>
                    <p className="ms-fit-name">{thing.action}</p>
                    <p className="ms-fit-test">{thing.why}</p>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
          <p className="ms-field-hint" style={{ marginTop: "24px" }}>{READINESS_BRIEF_FOOTER}</p>
        </>
      ) : null}
      </main>
    </div>
  );
}
