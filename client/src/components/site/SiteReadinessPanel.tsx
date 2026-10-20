/**
 * The owner's readiness panel on the job page: an expert's first read of the
 * job, in the site's own numbers, with as little text as the site needs.
 *
 * Shown by default: the next three things, each a link that opens the step on
 * this page that answers it. Folded until opened, with one number in each
 * title: how the job runs today (the hours it takes), and, once Blueprint
 * shares it, the robot readiness report (how many kinds of robot fit) with its
 * printable one-page brief. The brief carries the full steps to a pilot, the
 * reasons and what is still unknown. It reads again whenever the measurements
 * step or the how-it-runs form saves. Never a robot team.
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

export function ReadinessReportView({ report, full = false }: { report: SiteReadinessReport; full?: boolean }) {
  return (
    <>
      <SiteRobotFitView fit={report.robotFit} showUnknowns={full} />
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

/** The count of kinds of robot that fit, for the folded report's title. */
function robotCount(report: SiteReadinessReport | null) {
  if (!report) return null;
  const forms = report.robotFit.forms;
  const fits = forms.filter((form) => form.verdict === "fits").length;
  const possible = forms.filter((form) => form.verdict === "possible").length;
  if (fits) return `${fits} ${fits === 1 ? "kind of robot fits" : "kinds of robot fit"}`;
  return possible ? `${possible} ${possible === 1 ? "kind of robot may fit" : "kinds of robot may fit"}` : null;
}

/**
 * As little as the site needs: its next steps, and two folded sections whose
 * titles carry the one number worth seeing (the hours the job takes, how many
 * kinds of robot fit). Everything else waits until the site opens it.
 */
export function SiteReadinessPanel({ token }: { token: string }) {
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

  if (!readiness) return null;
  const robots = robotCount(readiness.report);
  return (
    <>
      <section className="ms-task-interest" aria-label="Your next steps">
        <h2 style={{ marginTop: 0 }}>Your next steps</h2>
        {readiness.nextThings.length ? (
          <ol className="ms-fit-list">
            {readiness.nextThings.map((thing) => (
              <li key={thing.id}>
                <button type="button" className="ms-text-link" onClick={() => openTarget(thing.target)}>
                  {thing.action}<span aria-hidden="true"> →</span>
                </button>
              </li>
            ))}
          </ol>
        ) : <p>Nothing is needed from you right now.</p>}
      </section>
      <details id={NEXT_THING_ANCHORS.operations} className="ms-task-interest">
        <summary>How the job runs today{readiness.workload ? ` · ${readiness.workload.headline}` : " (optional)"}</summary>
        <OperationsForm key={readiness.operations.updatedAtIso ?? "unanswered"} token={token} operations={readiness.operations} />
        {readiness.workload ? <p className="ms-field-hint">{readiness.workload.sentence} {readiness.workload.basis}</p>
          : readiness.operations.timesPerDay ? <p className="ms-field-hint">We work out the hours this job takes once a full cycle is measured from your video.</p> : null}
        {readiness.speed ? <p className="ms-field-hint">{readiness.speed.sentence}</p> : null}
      </details>
      {readiness.report ? (
        <details className="ms-task-interest">
          <summary>Your robot readiness report{robots ? ` · ${robots}` : ""}</summary>
          <ReadinessReportView report={readiness.report} />
          <p style={{ marginTop: "14px" }}>
            <a className="ms-text-link" href={`/capture-upload/${encodeURIComponent(token)}/brief`} target="_blank" rel="noreferrer">
              Print or save a one-page brief
            </a>
          </p>
        </details>
      ) : null}
    </>
  );
}
