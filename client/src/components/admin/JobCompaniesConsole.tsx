/**
 * Deployment companies, the staff tool on the admin job page (package C1, 2026-11-12): the sends and answers on record,
 * read only, and the one staff write: stop showing the job to every company, with a reason, or show it again. Staff no
 * longer record a send, void one or record an emailed answer (2026-11-22): sends are automatic and companies answer on
 * the job's page.
 *
 * "Stop showing this job to companies" is the staff stop for a privacy or rights problem: it holds the job back from
 * every company (the library card and the response form close, and the site's page says it is not visible right now)
 * until "Show again". Every write records who and when.
 */
import { useEffect, useRef, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";

import { COMPANY_RESPONSE_LABELS, elapsedSince } from "@/lib/companyResponses";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import type { AdminJobCompanies } from "@/types/jobCompanies";

function dateLabel(value: string | null | undefined) {
  if (!value) return "time not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "time not recorded";
}

type Loaded = { status: "loading" } | { status: "failed"; message: string } | { status: "ready"; panel: AdminJobCompanies };

/** `onChanged`: called after every write that succeeded, so the job's page re-reads what the write changed. */
export function JobCompaniesConsole({ requestId, currentUser, onChanged }: {
  requestId: string; currentUser: FirebaseUser | null; onChanged?: () => void;
}) {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const base = `/api/admin/jobs/${encodeURIComponent(requestId)}/companies`;
  // Only the latest read is applied: an older read that finishes late never replaces what an action just wrote.
  const latestLoad = useRef(0);

  async function authorized(init: RequestInit = {}, json = false): Promise<RequestInit> {
    return { ...init, credentials: "include",
      headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader(json ? { "Content-Type": "application/json" } : {})) };
  }

  async function load(quiet = false) {
    const ticket = ++latestLoad.current;
    if (!quiet) setLoaded({ status: "loading" });
    try {
      const response = await fetch(base, await authorized());
      const value = await response.json().catch(() => ({})) as Partial<AdminJobCompanies> & { error?: string };
      if (ticket !== latestLoad.current) return;
      if (!response.ok || !value.sharing) {
        if (!quiet) setLoaded({ status: "failed", message: String(value.error || `Request failed (${response.status})`) });
        return;
      }
      setLoaded({ status: "ready", panel: value as AdminJobCompanies });
    } catch {
      if (!quiet && ticket === latestLoad.current) setLoaded({ status: "failed", message: "Deployment companies could not be loaded." });
    }
  }

  useEffect(() => { if (currentUser) void load(); }, [requestId, currentUser?.uid]);

  async function act(path: string, body: unknown, failure: string): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setActionError("");
    try {
      const response = await fetch(`${base}${path}`, await authorized({ method: "POST", body: JSON.stringify(body) }, true));
      const value = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setActionError(String(value.error || `${failure} (${response.status}).`));
        return false;
      }
      await load(true);
      onChanged?.();
      return true;
    } catch {
      setActionError(`${failure}. Check your connection and try again.`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const panel = loaded.status === "ready" ? loaded.panel : null;
  const firstResponseElapsed = elapsedSince(panel?.startedAtIso, panel?.firstAnswerAtIso);

  return (
    <section aria-label="Deployment companies" className="admin-job-tool">
      {loaded.status === "loading" ? <p className="bare-helper" role="status">Loading deployment companies…</p> : null}
      {loaded.status === "failed" ? <>
        <p className="bare-notice" role="alert">{loaded.message}</p>
        <button type="button" className="bare-quiet-button" onClick={() => void load()}>Try again</button>
      </> : null}
      {panel ? <>
        <p>{panel.sharing.words}</p>
        {panel.startedAtIso && <p className="bare-helper">Draft started {dateLabel(panel.startedAtIso)}.</p>}
        {panel.firstAnswerAtIso && <p className="bare-helper">First response recorded {dateLabel(panel.firstAnswerAtIso)}
          {firstResponseElapsed ? ` · ${firstResponseElapsed} after starting` : ""}.</p>}
        {panel.consentRevoked ? <p className="bare-notice">The site withdrew its permission. Nothing is sent or recorded for this job.</p> : null}

        {panel.hold ? <div>
          <p>Not shown to any company since {dateLabel(panel.hold.atIso)}{panel.hold.by ? ` (by ${panel.hold.by})` : ""}{panel.hold.reason ? `: ${panel.hold.reason}` : ""}.</p>
          <button type="button" className="bare-quiet-button" disabled={busy}
            onClick={() => void act("/hold", { held: false }, "The hold could not be changed")}>Show again</button>
        </div> : <form className="ms-form" aria-label="Stop showing this job to companies" onSubmit={event => {
          event.preventDefault();
          const reason = String(new FormData(event.currentTarget).get("reason") || "").trim();
          void act("/hold", { held: true, reason }, "The hold could not be changed");
        }}>
          <label>Why (staff only)<input name="reason" required maxLength={500} /></label>
          <button type="submit" className="ms-button" disabled={busy}>Stop showing this job to companies</button>
        </form>}

        <section aria-label="Sends">
          <h4 className="bare-rows-title">Sends</h4>
          {!panel.sends.length ? <p className="bare-helper">Not sent to any company yet.</p> : <ul className="admin-job-list">
            {panel.sends.map(send => <li key={send.sendId}>
              <span className={send.voidedAtIso ? "admin-job-voided" : undefined}>
                {send.company ?? send.companyId}{send.alias ? ` (Company ${send.alias} to the site)` : ""}, {dateLabel(send.sentAtIso)}
                {send.sentBy === "system" ? ", automatic" : send.sentBy ? `, by ${send.sentBy}` : ""}
              </span>
              {send.voidedAtIso ? <span className="bare-helper"> Voided {dateLabel(send.voidedAtIso)}{send.voidedBy ? ` by ${send.voidedBy}` : ""}</span> : null}
            </li>)}
          </ul>}
        </section>

        <section aria-label="Responses">
          <h4 className="bare-rows-title">Answers</h4>
          {!panel.responses.length ? <p className="bare-helper">No company has answered yet.</p> : <ul className="admin-job-list">
            {panel.responses.map(row => <li key={row.companyId}>
              {row.company ?? row.email ?? row.companyId}{row.alias ? ` (Company ${row.alias} to the site)` : ""}:{" "}
              <strong>{row.state ? COMPANY_RESPONSE_LABELS[row.state] : "An answer this page cannot read"}</strong>
              {row.inputs ? <span className="bare-helper"> “{row.inputs}”</span> : null}
              <span className="bare-helper"> {dateLabel(row.updatedAtIso)}, {row.recordedBy === "operator" ? "recorded by Blueprint from an email"
                : row.recordedBy === "company" ? "answered on the job's page" : "answered before sites could see answers; never shown to the site"}.</span>
            </li>)}
          </ul>}
        </section>

        {actionError ? <p role="alert" className="bare-notice">{actionError}</p> : null}
      </> : null}
    </section>
  );
}
