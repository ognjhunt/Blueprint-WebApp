/**
 * "What kind of robot fits this job" on the owner's job page.
 *
 * Shown only once Blueprint has shared it. It says what the job needs from a
 * robot, then how every form of robot measures up: one arm, two arms, an arm
 * on a wheeled base, wheeled and walking humanoids and legged robots. Every
 * sentence is fixed copy filled with the site's own measurements and answers.
 * It never names a robot team, because the site does not compare teams: it
 * approves the one Blueprint recommends, whose evaluation of the job passed.
 * It reads again whenever the measurements step below saves, since its
 * unknowns point there. Renders nothing otherwise.
 */
import { useCallback, useEffect, useState } from "react";

import {
  FIT_VERDICT_LABELS,
  SITE_MEASUREMENTS_SAVED_EVENT,
  type SiteRobotFit,
  type SiteRobotFitResponse,
} from "@/data/robotFit";

export function SiteRobotFitSection({ token }: { token: string }) {
  const [fit, setFit] = useState<SiteRobotFit | null>(null);

  const read = useCallback((isCurrent: () => boolean) => {
    fetch(`/api/site-task-brief/${encodeURIComponent(token)}/robot-fit`)
      .then((response) => (response.ok ? response.json() as Promise<SiteRobotFitResponse> : null))
      .then((value) => { if (isCurrent()) setFit(value?.robotFit ?? null); })
      .catch(() => { /* Optional reading: the page works without it, and keeps what it last showed. */ });
  }, [token]);

  useEffect(() => {
    let current = true;
    setFit(null);
    read(() => current);
    const refresh = () => read(() => current);
    window.addEventListener(SITE_MEASUREMENTS_SAVED_EVENT, refresh);
    return () => {
      current = false;
      window.removeEventListener(SITE_MEASUREMENTS_SAVED_EVENT, refresh);
    };
  }, [read]);

  if (!fit) return null;
  return (
    <section className="ms-task-interest" aria-label="What kind of robot fits this job">
      <h2 style={{ marginTop: 0 }}>What kind of robot fits this job</h2>
      {fit.needs.length ? (
        <ul className="ms-fit-list" aria-label="What this job needs from a robot">
          <li>
            <h3 className="ms-fit-name">What this job needs from a robot</h3>
            {fit.needs.map((line) => <p key={line} className="ms-fit-test">{line}</p>)}
          </li>
        </ul>
      ) : null}
      {fit.forms.length ? (
        <ul className="ms-fit-list" aria-label="Robot forms">
          {fit.forms.map((form) => (
            <li key={form.id}>
              <p className="ms-fit-name">
                <span>{form.label}</span>
                <span className="ms-site-stage" style={{ marginLeft: "10px" }}>{FIT_VERDICT_LABELS[form.verdict]}</span>
              </p>
              <p className="ms-fit-test">{form.description}</p>
              {form.reasons.map((reason) => <p key={reason} className="ms-fit-failure">{reason}</p>)}
            </li>
          ))}
        </ul>
      ) : null}
      {fit.unknowns.length ? (
        <ul className="ms-fit-list" aria-label="What we don't know yet">
          <li>
            <h3 className="ms-fit-name">What we don't know yet</h3>
            {fit.unknowns.map((line) => <p key={line} className="ms-fit-test">{line}</p>)}
          </li>
        </ul>
      ) : null}
      <p className="ms-field-hint" style={{ marginTop: "14px" }}>{fit.note}</p>
    </section>
  );
}
