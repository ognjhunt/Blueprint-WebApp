/**
 * What a site's job needs from a robot and how every form of robot measures
 * up: one arm, two arms, an arm on a wheeled base, wheeled and walking
 * humanoids and legged robots. Every sentence is fixed copy filled with the
 * site's own data: what its video shows, what Blueprint estimates from it, and
 * anything the site told us. It never names a robot team, because the site
 * does not compare teams: it approves the one Blueprint recommends, whose
 * evaluation of the job passed. Presentational and kept short: the readiness
 * panel and the printable brief pass it what Blueprint shared.
 */
import { FIT_VERDICT_LABELS, type SiteRobotFit } from "@/data/robotFit";

export function SiteRobotFitView({ fit }: { fit: SiteRobotFit }) {
  return (
    <>
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
              {form.reasons.map((reason) => <p key={reason} className="ms-fit-failure">{reason}</p>)}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
