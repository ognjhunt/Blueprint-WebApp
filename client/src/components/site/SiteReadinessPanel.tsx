/**
 * The owner's readiness panel on the job page: an expert's first read of the
 * job, in the site's own numbers.
 *
 * From the start: the site rebuilt in 3D, the steps to a pilot, the next three
 * things (each opens the step on this page that answers it), how the job runs
 * today, and what it takes today. Once Blueprint shares it: the robot readiness
 * report, with what the job needs and every form of robot, getting the site
 * ready, what decides success, safety, and where robots already do this kind of
 * job, plus a printable one-page brief. It reads again whenever the
 * measurements step or the how-it-runs form saves. Never a robot team.
 */
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { SiteRobotFitView } from "@/components/site/SiteRobotFitSection";
import { SITE_MEASUREMENTS_SAVED_EVENT } from "@/data/robotFit";
import {
  DEPLOYMENT_STATUS_LABELS,
  MAX_TIMES_PER_DAY,
  NEXT_THING_ANCHORS,
  PEOPLE_NEARBY,
  PEOPLE_NEARBY_LABELS,
  READINESS_STATE_LABELS,
  SITE_OPERATIONS_SAVED_EVENT,
  STEP_STATE_LABELS,
  SUCCESS_FACTOR_WHERE_LABELS,
  type NextThing,
  type PeopleNearby,
  type SiteOperations,
  type SiteReadinessReport,
  type SiteReadinessResponse,
  type Tracker,
} from "@/data/siteReadiness";
import { withCsrfHeader } from "@/lib/csrf";

/** Open the step on this page that answers a next thing: expand it if it folds, then bring it into view. */
function openTarget(target: NextThing["target"]) {
  const element = document.getElementById(NEXT_THING_ANCHORS[target]);
  if (!element) return;
  if (element instanceof HTMLDetailsElement) element.open = true;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
  const focusable = element.querySelector<HTMLElement>("summary, button, input, select, textarea");
  focusable?.focus({ preventScroll: true });
}

export function TrackerView({ tracker }: { tracker: Tracker }) {
  return (
    <>
      <ol className="ms-fit-list" aria-label="Steps to a pilot">
        {tracker.steps.map((step) => (
          <li key={step.id}>
            <p className="ms-fit-name">
              <span>{step.label}</span>
              <span className="ms-site-stage" style={{ marginLeft: "10px" }}>
                {step.state === "partial" && step.detail ? step.detail : STEP_STATE_LABELS[step.state]}
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
            <p className="ms-fit-failure">{item.why}</p>
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
        <ul className="ms-fit-list" aria-label="Robots already do jobs like this">
          <li><h3 className="ms-fit-name">Robots already do jobs like this</h3></li>
          {report.examples.map((example) => (
            <li key={example.id}>
              <p className="ms-fit-name">
                <span>{example.name}</span>
                <span className="ms-site-stage" style={{ marginLeft: "10px" }}>{DEPLOYMENT_STATUS_LABELS[example.status]}</span>
              </p>
              <p className="ms-fit-test">{example.evidence}</p>
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

function OperationsForm({ token, operations }: { token: string; operations: SiteOperations }) {
  const [times, setTimes] = useState(operations.timesPerDay?.toString() ?? "");
  const [days, setDays] = useState(operations.daysPerWeek?.toString() ?? "");
  const [people, setPeople] = useState<PeopleNearby | "">(operations.peopleNearby ?? "");
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string }>({ kind: "idle" });

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === "saving") return;
    const timesPerDay = times.trim() ? Number(times) : null;
    const daysPerWeek = days ? Number(days) : null;
    if (timesPerDay !== null && (!Number.isInteger(timesPerDay) || timesPerDay < 1 || timesPerDay > MAX_TIMES_PER_DAY)) {
      setStatus({ kind: "error", message: "Enter how many times a day as a whole number, such as 120." });
      return;
    }
    setStatus({ kind: "saving" });
    try {
      const response = await fetch(`/api/site-task-brief/${encodeURIComponent(token)}/operations`, {
        method: "PUT",
        credentials: "include",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ timesPerDay, daysPerWeek, peopleNearby: people || null }),
      });
      const value = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setStatus({ kind: "error", message: value.error || "Your answers could not be saved. Try again." });
        return;
      }
      setStatus({ kind: "saved" });
      window.dispatchEvent(new Event(SITE_OPERATIONS_SAVED_EVENT));
    } catch {
      setStatus({ kind: "error", message: "Your answers could not be saved. Check your connection and try again." });
    }
  }

  return (
    // Our own check and wording, rather than the browser's generic number tooltip.
    <form className="ms-form" onSubmit={save} aria-label="How the job runs today" noValidate>
      <label>How many times a day is the job done?
        <input type="number" inputMode="numeric" min={1} max={MAX_TIMES_PER_DAY} step={1} value={times}
          onChange={(event) => setTimes(event.target.value)} />
      </label>
      <label>On how many days a week?
        <select value={days} onChange={(event) => setDays(event.target.value)}>
          <option value="">Not sure</option>
          {[1, 2, 3, 4, 5, 6, 7].map((value) => <option key={value} value={String(value)}>{value}</option>)}
        </select>
      </label>
      <fieldset>
        <legend>Do people work near this job?</legend>
        {PEOPLE_NEARBY.map((value) => (
          <label key={value} className="ms-check-row">
            <input type="radio" name="people-nearby" value={value} checked={people === value} onChange={() => setPeople(value)} />
            {PEOPLE_NEARBY_LABELS[value]}
          </label>
        ))}
      </fieldset>
      <p className="ms-field-hint">Every answer is optional. Leave blank what you don't know.</p>
      <button type="submit" className="ms-button" disabled={status.kind === "saving"}>
        {status.kind === "saving" ? "Saving…" : "Save answers"}
      </button>
      {status.kind === "saved" ? <p role="status" className="ms-field-hint">Saved. You can change these at any time.</p> : null}
      {status.kind === "error" ? <p role="alert">{status.message}</p> : null}
    </form>
  );
}

export function SiteReadinessPanel({ token, sceneViewUrl }: { token: string; sceneViewUrl: string | null }) {
  const [readiness, setReadiness] = useState<SiteReadinessResponse | null>(null);

  const read = useCallback((isCurrent: () => boolean) => {
    fetch(`/api/site-task-brief/${encodeURIComponent(token)}/readiness`)
      .then((response) => (response.ok ? response.json() as Promise<SiteReadinessResponse> : null))
      .then((value) => { if (isCurrent() && value?.tracker && Array.isArray(value.nextThings)) setReadiness(value); })
      .catch(() => { /* Optional reading: the page works without it, and keeps what it last showed. */ });
  }, [token]);

  useEffect(() => {
    let current = true;
    setReadiness(null);
    read(() => current);
    const refresh = () => read(() => current);
    window.addEventListener(SITE_MEASUREMENTS_SAVED_EVENT, refresh);
    window.addEventListener(SITE_OPERATIONS_SAVED_EVENT, refresh);
    return () => {
      current = false;
      window.removeEventListener(SITE_MEASUREMENTS_SAVED_EVENT, refresh);
      window.removeEventListener(SITE_OPERATIONS_SAVED_EVENT, refresh);
    };
  }, [read]);

  return (
    <>
      {sceneViewUrl ? (
        <section className="ms-task-interest" aria-label="Your site, rebuilt">
          <h2 style={{ marginTop: 0 }}>Your site, rebuilt</h2>
          <p>We rebuilt your work area in 3D from your video. Robot teams are evaluated in a simulation built from the same footage.</p>
          <p><a className="ms-button" href={sceneViewUrl} target="_blank" rel="noreferrer">Open your site in 3D</a></p>
        </section>
      ) : null}
      {readiness ? (
        <>
          <section className="ms-task-interest" aria-label="Steps to a pilot">
            <h2 style={{ marginTop: 0 }}>Steps to a pilot</h2>
            <TrackerView tracker={readiness.tracker} />
          </section>
          <section className="ms-task-interest" aria-label="Your next three things">
            <h2 style={{ marginTop: 0 }}>Your next three things</h2>
            {readiness.nextThings.length ? (
              <ol className="ms-fit-list">
                {readiness.nextThings.map((thing) => (
                  <li key={thing.id}>
                    <p className="ms-fit-name">
                      <button type="button" className="ms-text-link" onClick={() => openTarget(thing.target)}>
                        {thing.action}<span aria-hidden="true"> →</span>
                      </button>
                    </p>
                    <p className="ms-fit-test">{thing.why}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="ms-field-hint">You've given us everything we need for now.</p>}
          </section>
          <section className="ms-task-interest" aria-label="How the job runs today" id={NEXT_THING_ANCHORS.operations}>
            <h2 style={{ marginTop: 0 }}>How the job runs today</h2>
            <OperationsForm key={readiness.operations.updatedAtIso ?? "unanswered"} token={token} operations={readiness.operations} />
            {readiness.workload || readiness.speed || readiness.operations.timesPerDay ? (
              <div style={{ marginTop: "18px" }}>
                <h3 className="ms-fit-name">What this job takes today</h3>
                {readiness.workload ? (
                  <>
                    <p>{readiness.workload.sentence}</p>
                    <p className="ms-field-hint">{readiness.workload.basis}</p>
                  </>
                ) : readiness.operations.timesPerDay ? (
                  <p className="ms-field-hint">We work out the hours this job takes once a full cycle is measured from your video.</p>
                ) : null}
                {readiness.speed ? <p>{readiness.speed.sentence}</p> : null}
              </div>
            ) : null}
          </section>
          {readiness.report ? (
            <section className="ms-task-interest" aria-label="Robot readiness report">
              <h2 style={{ marginTop: 0 }}>Robot readiness report</h2>
              <ReadinessReportView report={readiness.report} />
              <p style={{ marginTop: "14px" }}>
                <a className="ms-text-link" href={`/capture-upload/${encodeURIComponent(token)}/brief`} target="_blank" rel="noreferrer">
                  Open your one-page robot readiness brief to print or share
                </a>
              </p>
            </section>
          ) : null}
        </>
      ) : null}
    </>
  );
}
