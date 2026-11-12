/**
 * Deployment companies, for staff, on the job console (package C1, 2026-11-12).
 *
 * V1 is by hand: the operator emails an approved deployment company the job's address in the job library from their
 * own mailbox, and records the send here. The product sends nothing to a company. A company answers in the library or
 * by email; an emailed answer is recorded here, only for a company the job was sent to. The site is told each send and
 * answer under an alias ("Company A") and a fixed label, never a company's name or words, and no note: anything else
 * for the site, the operator writes to it directly. "Stop showing this job to companies" holds the job back
 * from every company (the library card and the response form close, and the site's page says it is not visible right
 * now) until "Show again". Every write records who and when.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User as FirebaseUser } from "firebase/auth";

import { Button, StatusChip } from "@/components/blueprint";
import { COMPANY_RESPONSE_LABELS, COMPANY_RESPONSE_STATES, type CompanyResponseState } from "@/lib/companyResponses";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import type { AdminJobCompanies } from "@/types/jobCompanies";

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not recorded";
}

const SHARING_TONE = { shared_visible: "proof", shared_not_visible: "warn", not_shared: "neutral" } as const;

type Loaded = { status: "loading" } | { status: "failed"; message: string } | { status: "ready"; panel: AdminJobCompanies };

export function JobCompaniesConsole({ requestId, currentUser }: { requestId: string; currentUser: FirebaseUser | null }) {
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
      return true;
    } catch {
      setActionError(`${failure}. Check your connection and try again.`);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const panel = loaded.status === "ready" ? loaded.panel : null;
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
    <section aria-labelledby="job-companies-heading" className="grid gap-4">
      <h3 id="job-companies-heading" className="runway-rule-head runway-meta">Deployment companies</h3>
      {loaded.status === "loading" ? <p className="text-sm text-runway-mute">Loading deployment companies…</p> : null}
      {loaded.status === "failed" ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-runway-red">{loaded.message}</p>
          <Button type="button" size="sm" variant="secondary" onClick={() => void load()}>Try again</Button>
        </div>
      ) : null}
      {panel ? (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm text-runway-text">
            <StatusChip tone={SHARING_TONE[panel.sharing.state]} square>
              {panel.sharing.state === "shared_visible" ? "Shared and visible" : panel.sharing.state === "shared_not_visible" ? "Shared, not visible" : "Not shared"}
            </StatusChip>
            <span>{panel.sharing.words}</span>
          </p>
          <p className="text-xs text-runway-mute">
            The site is told each send and answer under an alias ("Company A"), never a company's name or its words. The
            product sends nothing to a company: you email the address below from your own mailbox.
          </p>

          <div className="grid gap-2">
            <p className="text-sm text-runway-body">The job in the job library (an approved company opens it signed in):</p>
            <p className="flex flex-wrap items-center gap-2">
              <code className="break-all text-xs text-runway-text" aria-label="Job library address">{panel.libraryUrl}</code>
              <Button type="button" size="sm" variant="secondary" onClick={() => void copyAddress(panel.libraryUrl)}>
                {copied ? "Copied" : "Copy address"}
              </Button>
            </p>
          </div>

          <div className="grid gap-2">
            {panel.hold ? (
              <>
                <p className="text-sm text-runway-red">
                  Not shown to any company since {dateLabel(panel.hold.atIso)}{panel.hold.by ? ` (by ${panel.hold.by})` : ""}
                  {panel.hold.reason ? `: ${panel.hold.reason}` : ""}. The site's page says its summary is not visible right now.
                </p>
                <div>
                  <Button type="button" size="sm" variant="secondary" disabled={busy}
                    onClick={() => void act("/hold", { held: false }, "The hold could not be changed")}>Show again</Button>
                </div>
              </>
            ) : (
              <form className="flex flex-wrap items-end gap-2" aria-label="Stop showing this job to companies"
                onSubmit={(event) => {
                  event.preventDefault();
                  const reason = String(new FormData(event.currentTarget).get("reason") || "").trim();
                  void act("/hold", reason ? { held: true, reason } : { held: true }, "The hold could not be changed");
                }}>
                <label className="grid gap-1 text-xs text-runway-mute">Reason (staff only, optional)
                  <input name="reason" maxLength={500} className="runway-input min-w-[16rem]" />
                </label>
                <Button type="submit" size="sm" variant="secondary" disabled={busy}>Stop showing this job to companies</Button>
              </form>
            )}
          </div>

          <form className="grid gap-2" aria-label="Record a send" onSubmit={(event) => void onSend(event)}>
            <h4 className="runway-label">Record a send</h4>
            {!visible ? <p className="text-xs text-runway-mute">A send can be recorded only while the job is shared and visible to companies.</p> : null}
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs text-runway-mute">Approved deployment company
                <select name="companyId" className="runway-input min-w-[16rem]" defaultValue="" disabled={!visible || panel.consentRevoked}>
                  <option value="" disabled>Choose a company</option>
                  {panel.companies.map((company) => <option key={company.id} value={company.id}>{company.company || company.email} · {company.email}</option>)}
                </select>
              </label>
              <Button type="submit" size="sm" disabled={busy || !visible || panel.consentRevoked}>Record the send</Button>
            </div>
            {!panel.companies.length ? <p className="text-xs text-runway-mute">No deployment company is approved yet.</p> : null}
          </form>

          <section aria-label="Sends" className="grid gap-2">
            <h4 className="runway-label">Sends</h4>
            {!panel.sends.length ? <p className="text-sm text-runway-mute">Not sent to any company yet.</p> : (
              <ul className="grid gap-2 text-sm text-runway-body">
                {panel.sends.map((send) => (
                  <li key={send.sendId} className="flex flex-wrap items-center gap-2">
                    <span className={send.voidedAtIso ? "line-through text-runway-mute" : undefined}>
                      {send.company ?? send.companyId}{send.alias ? ` (Company ${send.alias} to the site)` : ""} · {dateLabel(send.sentAtIso)}
                      {send.sentBy ? ` · by ${send.sentBy}` : ""}
                    </span>
                    {send.voidedAtIso ? <span className="text-xs text-runway-mute">Voided {dateLabel(send.voidedAtIso)}{send.voidedBy ? ` by ${send.voidedBy}` : ""}</span> : (
                      <Button type="button" size="sm" variant="secondary" disabled={busy}
                        onClick={() => void act(`/sends/${encodeURIComponent(send.sendId)}/void`, {}, "The send could not be voided")}>Void</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Responses" className="grid gap-2">
            <h4 className="runway-label">Responses</h4>
            {!panel.responses.length ? <p className="text-sm text-runway-mute">No company has answered yet.</p> : (
              <ul className="grid gap-3 text-sm text-runway-body">
                {panel.responses.map((row) => (
                  <li key={row.companyId} className="grid gap-1 border-t border-runway-line pt-2">
                    <p className="flex flex-wrap items-center gap-2 text-runway-text">
                      {row.company ?? row.email ?? row.companyId}{row.alias ? ` (Company ${row.alias} to the site)` : ""}
                      <StatusChip tone={row.state === "interested" ? "proof" : row.state === "declined" ? "neutral" : "warn"} square>
                        {row.state ? COMPANY_RESPONSE_LABELS[row.state] : "Unknown answer"}
                      </StatusChip>
                    </p>
                    {row.inputs ? <blockquote className="border-l-2 border-runway-line pl-3 text-xs text-runway-mute">“{row.inputs}”</blockquote> : null}
                    <p className="text-xs text-runway-faint">
                      {dateLabel(row.updatedAtIso)} · {row.recordedBy === "operator" ? "recorded by Blueprint from an email"
                        : row.recordedBy === "company" ? "answered in the job library"
                          : "answered before sites could see answers: never shown to the site"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form className="grid gap-2" aria-label="Record a response" onSubmit={(event) => void onResponse(event)}>
            <h4 className="runway-label">Record a response a company sent by email</h4>
            {!sentTo.length ? <p className="text-xs text-runway-mute">Record a send first: an answer is recorded only for a company the job was sent to.</p> : null}
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs text-runway-mute">Company (one this job was sent to)
                <select name="companyId" className="runway-input min-w-[16rem]" defaultValue="" disabled={panel.consentRevoked}>
                  <option value="" disabled>Choose a company</option>
                  {sentTo.map((company) => <option key={company.id} value={company.id}>{company.company || company.email} · {company.email}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs text-runway-mute">Answer
                <select name="state" className="runway-input" defaultValue="interested" disabled={panel.consentRevoked}>
                  {COMPANY_RESPONSE_STATES.map((state) => <option key={state} value={state}>{COMPANY_RESPONSE_LABELS[state]}</option>)}
                </select>
              </label>
            </div>
            <label className="grid gap-1 text-xs text-runway-mute">Their words (staff only, never shown to the site)
              <textarea name="inputs" maxLength={2000} className="runway-input" disabled={panel.consentRevoked} />
            </label>
            <div>
              <Button type="submit" size="sm" disabled={busy || panel.consentRevoked}>Record the response</Button>
            </div>
          </form>
          {panel.consentRevoked ? <p className="text-sm text-runway-red">The site withdrew its permission. Nothing is sent or recorded for this job.</p> : null}
          {actionError ? <p role="alert" className="text-sm text-runway-red">{actionError}</p> : null}
        </>
      ) : null}
    </section>
  );
}
