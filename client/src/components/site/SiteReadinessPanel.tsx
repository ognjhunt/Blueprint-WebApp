/**
 * The owner's robot readiness report on the job page, folded, with how many
 * kinds of robot fit in its title and a printable brief. It appears
 * once Blueprint shares it and asks the site nothing: the site sends its video
 * and nothing else (founder direction, 2026-10-20). Never a robot team.
 */
import { useEffect, useState } from "react";

import { SiteRobotFitView } from "@/components/site/SiteRobotFitSection";
import {
  READINESS_STATE_LABELS,
  STEP_STATE_LABELS,
  SUCCESS_FACTOR_WHERE_LABELS,
  type SiteReadinessReport,
  type SiteReadinessResponse,
  type Tracker,
} from "@/data/siteReadiness";

export function TrackerView({ tracker }: { tracker: Tracker }) {
  return (
    <>
      <ol className="ms-fit-list" aria-label="Steps to a pilot">
        {tracker.steps.map((step) => (
          <li key={step.id}>
            <p className="ms-fit-name">
              <span>{step.label}</span>
              <span className="ms-site-stage" style={{ marginLeft: "10px" }}>
                {STEP_STATE_LABELS[step.state]}
              </span>
            </p>
            {step.owner === "blueprint" ? <p className="ms-fit-test">Blueprint's step</p> : null}
          </li>
        ))}
      </ol>
      {tracker.meanwhile ? <p className="ms-field-hint" style={{ marginTop: "12px" }}>{tracker.meanwhile}</p> : null}
    </>
  );
}

export function ReadinessReportView({ report }: { report: SiteReadinessReport }) {
  return (
    <>
      <SiteRobotFitView fit={report.robotFit} />
      <ul className="ms-fit-list" aria-label="Getting your site ready">
        <li><h3 className="ms-fit-name">Getting your site ready</h3></li>
        {report.checklist.map((item) => (
          <li key={item.id}>
            <p className="ms-fit-name">
              <span>{item.title}</span>
              <span className="ms-site-stage" style={{ marginLeft: "10px" }}>{READINESS_STATE_LABELS[item.state]}</span>
            </p>
            <p className="ms-fit-test">{item.detail}</p>
          </li>
        ))}
      </ul>
      {report.successFactors.length ? (
        <ul className="ms-fit-list" aria-label="What decides success here">
          <li><h3 className="ms-fit-name">What decides success here</h3></li>
          {report.successFactors.map((factor) => (
            <li key={factor.id}>
              <p className="ms-fit-name">
                <span>{factor.title}</span>
                <span className="ms-site-stage" style={{ marginLeft: "10px" }}>{SUCCESS_FACTOR_WHERE_LABELS[factor.where]}</span>
              </p>
              <p className="ms-fit-test">{factor.detail}</p>
              <p className="ms-fit-failure">{factor.test}</p>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="ms-fit-list" aria-label="Safety">
        <li>
          <h3 className="ms-fit-name">Safety, in plain English</h3>
          {report.safety.map((line) => <p key={line} className="ms-fit-test">{line}</p>)}
        </li>
      </ul>
      {report.examples.length ? (
        <ul className="ms-fit-list" aria-label="Jobs like this on the public record">
          <li><h3 className="ms-fit-name">Jobs like this on the public record</h3></li>
          {report.examples.map((example) => (
            <li key={example.id}>
              <p className="ms-fit-name">{example.name}</p>
              <p className="ms-fit-failure">
                Source: {example.sources.map((source, index) => (
                  <span key={source.href}>{index ? "; " : ""}<a className="ms-text-link" href={source.href} target="_blank" rel="noreferrer">{source.label}</a></span>
                ))}
              </p>
            </li>
          ))}
          <li><p className="ms-fit-failure">{report.examplesFootnote}</p></li>
        </ul>
      ) : null}
      <p className="ms-field-hint" style={{ marginTop: "14px" }}>{report.robotFit.note}</p>
    </>
  );
}

/** The count of kinds of robot that fit, for the folded report's title. */
function robotCount(report: SiteReadinessReport) {
  const forms = report.robotFit.forms;
  const fits = forms.filter((form) => form.verdict === "fits").length;
  const possible = forms.filter((form) => form.verdict === "possible").length;
  if (fits) return `${fits} ${fits === 1 ? "kind of robot fits" : "kinds of robot fit"}`;
  return possible ? `${possible} ${possible === 1 ? "kind of robot may fit" : "kinds of robot may fit"}` : null;
}

/** The shared report, folded; nothing at all until Blueprint shares it. */
export function SiteReadinessPanel({ token }: { token: string }) {
  const [readiness, setReadiness] = useState<SiteReadinessResponse | null>(null);

  useEffect(() => {
    let current = true;
    setReadiness(null);
    fetch(`/api/site-task-brief/${encodeURIComponent(token)}/readiness`)
      .then((response) => (response.ok ? response.json() as Promise<SiteReadinessResponse> : null))
      .then((value) => { if (current && value?.report) setReadiness(value); })
      .catch(() => { /* Optional reading: the page works without it. */ });
    return () => { current = false; };
  }, [token]);

  const report = readiness?.report;
  if (!report) return null;
  const robots = robotCount(report);
  return (
    <details className="ms-task-interest">
      <summary>Your robot readiness report{robots ? ` · ${robots}` : ""}</summary>
      <ReadinessReportView report={report} />
      {readiness.briefPath ? (
        <p style={{ marginTop: "14px" }}>
          <a className="ms-text-link" href={readiness.briefPath} target="_blank" rel="noreferrer">Print or save the brief</a>
        </p>
      ) : null}
    </details>
  );
}
