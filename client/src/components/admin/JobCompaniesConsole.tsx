/**
 * Deployment companies, the staff tool on the admin job page (package C1, 2026-11-12): the writes that exist nowhere
 * else. Record a send made by hand from staff's own mailbox (with the job's library address to paste), void a
 * mistaken one, record an answer a company sent by email, and stop showing the job to every company, or show it again.
 * Where the job stands with companies, and every send, answer and introduction with its time, are on the page itself.
 *
 * The site is told each send and answer under an alias ("Company A") and a fixed label, with the company's words with
 * its name and contact details taken out, never its name. An answer recorded here is shown to the site like any other,
 * with "Introduce us" beside Interested. "Stop showing this job to companies" holds the job back from every company
 * (the library card and the response form close, and the site's page says it is not visible right now) until "Show
 * again". Every write records who and when.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User as FirebaseUser } from "firebase/auth";

import { COMPANY_RESPONSE_LABELS, COMPANY_RESPONSE_STATES, elapsedSince, TESTED_RESPONSE_STATES, type CompanyResponseState } from "@/lib/companyResponses";
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
  const [copied, setCopied] = useState(false);
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
  const visible = panel?.sharing.state === "shared_visible";
  // An emailed answer is recorded only for a company with a standing (not voided) send; the route refuses any other.
  const sentTo = panel ? panel.companies.filter(company => panel.sends.some(send => send.companyId === company.id && !send.voidedAtIso)) : [];

  async function onSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const companyId = String(new FormData(form).get("companyId") || "");
    if (!companyId) { setActionError("Choose an approved deployment company."); return; }
    if (await act("/sends", { companyId }, "The send could not be recorded")) form.reset();
  }

  async function onResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const companyId = String(data.get("companyId") || "");
    const state = String(data.get("state") || "") as CompanyResponseState;
    if (!companyId) { setActionError("Choose the company that answered."); return; }
    if (await act("/responses", { companyId, state, inputs: String(data.get("inputs") || "") },
      "The answer could not be recorded")) form.reset();
  }

  async function copyAddress(url: string) {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); }
  }

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
          void act("/hold", reason ? { held: true, reason } : { held: true }, "The hold could not be changed");
        }}>
          <label>Why (staff only, optional)<input name="reason" maxLength={500} /></label>
          <button type="submit" className="ms-button" disabled={busy}>Stop showing this job to companies</button>
        </form>}

        <form className="ms-form" aria-label="Record a send" onSubmit={event => void onSend(event)}>
          <h4 className="bare-rows-title">Record a send made by hand</h4>
          <p className="ms-field-hint">
            The job's page, to paste in your email (a company opens it signed in):{" "}
            <code aria-label="Job library address">{panel.libraryUrl}</code>{" "}
            <button type="button" className="bare-quiet-button" onClick={() => void copyAddress(panel.libraryUrl)}>{copied ? "Copied" : "Copy"}</button>
          </p>
          {!visible ? <p className="ms-field-hint">A send can be recorded only while the job is shared and visible to companies.</p> : null}
          {!panel.companies.length ? <p className="ms-field-hint">No deployment company is approved yet.</p> : null}
          <label>Approved deployment company
            <select name="companyId" defaultValue="" disabled={!visible || panel.consentRevoked}>
              <option value="" disabled>Choose a company</option>
              {panel.companies.map(company => <option key={company.id} value={company.id}>{company.company || company.email} · {company.email}</option>)}
            </select>
          </label>
          <button type="submit" className="ms-button" disabled={busy || !visible || panel.consentRevoked}>Record the send</button>
        </form>

        <section aria-label="Sends">
          <h4 className="bare-rows-title">Sends</h4>
          {!panel.sends.length ? <p className="bare-helper">Not sent to any company yet.</p> : <ul className="admin-job-list">
            {panel.sends.map(send => <li key={send.sendId}>
              <span className={send.voidedAtIso ? "admin-job-voided" : undefined}>
                {send.company ?? send.companyId}{send.alias ? ` (Company ${send.alias} to the site)` : ""}, {dateLabel(send.sentAtIso)}
                {send.sentBy === "system" ? ", automatic" : send.sentBy ? `, by ${send.sentBy}` : ""}
              </span>
              {send.voidedAtIso ? <span className="bare-helper"> Voided {dateLabel(send.voidedAtIso)}{send.voidedBy ? ` by ${send.voidedBy}` : ""}</span>
                : <> <button type="button" className="bare-quiet-button" disabled={busy}
                  onClick={() => void act(`/sends/${encodeURIComponent(send.sendId)}/void`, {}, "The send could not be voided")}>Void</button></>}
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

        <form className="ms-form" aria-label="Record a response" onSubmit={event => void onResponse(event)}>
          <h4 className="bare-rows-title">Record an answer a company sent by email</h4>
          {!sentTo.length ? <p className="ms-field-hint">Record a send first: an answer is recorded only for a company the job was sent to.</p> : null}
          <label>Company (one this job was sent to)
            <select name="companyId" defaultValue="" disabled={panel.consentRevoked}>
              <option value="" disabled>Choose a company</option>
              {sentTo.map(company => <option key={company.id} value={company.id}>{company.company || company.email} · {company.email}</option>)}
            </select>
          </label>
          <label>Answer
            <select name="state" defaultValue="interested" disabled={panel.consentRevoked}>
              {/* A tested answer is the company's own, on the job's page, after downloading the simulation (E9). */}
              {COMPANY_RESPONSE_STATES.filter(state => !TESTED_RESPONSE_STATES.includes(state)).map(state =>
                <option key={state} value={state}>{COMPANY_RESPONSE_LABELS[state]}</option>)}
            </select>
          </label>
          <label>Their words (the site reads them, with the company's name and contact details taken out)
            <textarea name="inputs" maxLength={2000} disabled={panel.consentRevoked} />
          </label>
          <button type="submit" className="ms-button" disabled={busy || panel.consentRevoked}>Record the answer</button>
        </form>
        {actionError ? <p role="alert" className="bare-notice">{actionError}</p> : null}
      </> : null}
    </section>
  );
}
