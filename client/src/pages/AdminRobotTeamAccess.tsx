import type { User } from "firebase/auth";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, RefreshCw, Send, X } from "lucide-react";

import { Button, Card, Eyebrow, StatusChip } from "@/components/blueprint";
import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

type Application = {
  id: string;
  name: string;
  email: string;
  company: string;
  website: string | null;
  robot: string;
  workWanted: string;
  region: string | null;
  pilotPackage?: string | null;
  testSite?: string | null;
  source?: "application" | "invite";
  fit?: {
    checks: Array<{ id: string; label: string; passed: boolean; detail: string }>;
    clearFit: boolean;
    listedTaskCount: number;
  } | null;
  status: "applied" | "approved" | "declined";
  appliedAtIso: string;
  decidedAtIso: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
};

function statusTone(status: Application["status"]) {
  if (status === "approved") return "proof" as const;
  if (status === "declined") return "block" as const;
  return "warn" as const;
}

type Library = {
  listedTaskCount: number | null;
  autoApproveMinimumTasks: number | null;
  gated?: boolean;
  openSuggestedAtTasks?: number;
};

/** Once browsing is worth it on its own, say so: opening is one Render variable. */
function openLibraryLine(library: Library | undefined) {
  if (!library?.gated || library.listedTaskCount === null || !library.openSuggestedAtTasks) return null;
  if (library.listedTaskCount < library.openSuggestedAtTasks) return null;
  return `${library.listedTaskCount} site tasks are listed, enough for teams to browse on their own. You can open the library to every robot team by setting BLUEPRINT_ROBOT_TEAM_EARLY_ACCESS=0 on Render.`;
}

function libraryLine(library: Library | undefined) {
  if (!library) return null;
  const listed = library.listedTaskCount === null ? "The task library could not be read" : `${library.listedTaskCount} site task${library.listedTaskCount === 1 ? "" : "s"} listed`;
  if (library.autoApproveMinimumTasks === null) return `${listed}. Auto-approval is off; every application is decided here.`;
  return library.listedTaskCount !== null && library.listedTaskCount >= library.autoApproveMinimumTasks
    ? `${listed}. Clear fits (work email, website on the same domain) are approved automatically; the rest wait here.`
    : `${listed}. Auto-approval starts at ${library.autoApproveMinimumTasks}; until then every application is decided here and each team gets a personal reply.`;
}

/**
 * The outbound path: after a call, grant access to that email directly. The
 * link it sends only works for that verified address, so it cannot be passed
 * on like an invite code.
 */
function InviteTeam({ onInvited, send }: {
  onInvited: () => Promise<void>;
  send: (body: Record<string, string>) => Promise<Response>;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "already" | "error">("idle");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const read = (key: string) => String(data.get(key) ?? "").trim();
    setState("sending");
    try {
      const response = await send({
        name: read("name"), email: read("email"), company: read("company"),
        ...(read("note") ? { note: read("note") } : {}),
      });
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { alreadyApproved?: boolean };
      setState(body.alreadyApproved ? "already" : "sent");
      form.reset();
      await onInvited();
    } catch {
      setState("error");
    }
  }
  return (
    <Card pad="lg" className="mt-8">
      <h2 className="text-lg font-semibold text-runway-text">Invite a team you spoke with</h2>
      <p className="mt-1 text-sm text-runway-mute">Grants access to that work email and sends the sign-up email. Use it after a call.</p>
      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submit} aria-label="Invite a team">
        <label className="runway-meta flex flex-col gap-1">Name<input name="name" required maxLength={120} className="border border-line bg-transparent px-3 py-2 text-runway-text" /></label>
        <label className="runway-meta flex flex-col gap-1">Work email<input name="email" type="email" required maxLength={320} className="border border-line bg-transparent px-3 py-2 text-runway-text" /></label>
        <label className="runway-meta flex flex-col gap-1">Company<input name="company" required maxLength={160} className="border border-line bg-transparent px-3 py-2 text-runway-text" /></label>
        <label className="runway-meta flex flex-col gap-1">What they want to test (internal)<input name="note" maxLength={2000} className="border border-line bg-transparent px-3 py-2 text-runway-text" /></label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button variant="secondary" iconLeft={<Send />} disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Invite"}</Button>
          <span role="status" className="text-sm text-runway-mute">
            {state === "sent" ? "Invited. They have the sign-up email." : state === "already" ? "Already approved; nothing sent." : state === "error" ? "The invite was not saved." : ""}
          </span>
        </div>
      </form>
    </Card>
  );
}

/**
 * Robot-team early access. Approving grants the task library to that verified
 * email and sends one email with the next step; "not yet" sends one polite
 * email unless you would rather reply yourself.
 */
export default function AdminRobotTeamAccess() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["admin-robot-team-access"],
    enabled: Boolean(currentUser),
    queryFn: async () => {
      const response = await fetch("/api/admin/robot-team-access", {
        credentials: "include",
        headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({})),
      });
      if (!response.ok) throw new Error(`Could not load applications (${response.status})`);
      return response.json() as Promise<{ applications: Application[]; count: number; library?: Library }>;
    },
  });

  async function sendInvite(body: Record<string, string>) {
    return fetch("/api/admin/robot-team-access/invites", {
      method: "POST",
      credentials: "include",
      headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({ "Content-Type": "application/json" })),
      body: JSON.stringify(body),
    });
  }

  async function decide(application: Application, status: "approved" | "declined") {
    const note = window.prompt(
      status === "approved"
        ? "Optional note (internal). Approving emails them how to create their account."
        : "Reason (internal, never sent).",
      application.decisionNote ?? "",
    );
    if (note === null) return;
    const notify = status === "declined"
      ? window.confirm("Send the standard \"not yet\" email? Cancel to decline without an email and reply yourself.")
      : undefined;
    setUpdating(application.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/robot-team-access/${encodeURIComponent(application.id)}/decision`, {
        method: "POST",
        credentials: "include",
        headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({ "Content-Type": "application/json" })),
        body: JSON.stringify({ status, ...(note.trim() ? { note: note.trim() } : {}), ...(notify === undefined ? {} : { notify }) }),
      });
      if (!response.ok) throw new Error(`The decision was not saved (${response.status})`);
      await queryClient.invalidateQueries({ queryKey: ["admin-robot-team-access"] });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The decision was not saved");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <main className="min-h-screen bg-canvas px-5 py-10 text-ink-900 md:px-8">
      <div className="mx-auto max-w-[88rem]">
        <header className="flex flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow tone="brass" rule>Robot teams</Eyebrow>
            <h1 className="mt-5 font-display text-4xl font-semibold tracking-[0.005em] text-runway-text">Early-access applications</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-runway-mute">
              Approved teams see the site tasks sites have shared, once they sign in with the approved,
              verified email. Calls are optional: teams reply with the site they would test at, and book one only if it helps.
            </p>
            {libraryLine(query.data?.library) ? <p className="mt-2 max-w-2xl text-sm text-runway-text">{libraryLine(query.data?.library)}</p> : null}
            {openLibraryLine(query.data?.library) ? <p role="status" className="mt-2 max-w-2xl text-sm text-runway-text">{openLibraryLine(query.data?.library)}</p> : null}
          </div>
          <Button variant="secondary" iconLeft={<RefreshCw />} onClick={() => query.refetch()}>Refresh</Button>
        </header>

        <PilotProposalReview user={currentUser} />
        <InviteTeam send={sendInvite} onInvited={() => queryClient.invalidateQueries({ queryKey: ["admin-robot-team-access"] })} />

        {error ? <p className="py-4 text-runway-red" role="alert">{error}</p> : null}
        {query.isLoading ? <p className="py-12 text-runway-mute">Loading applications…</p> : null}
        {query.error ? <p className="py-12 text-runway-red">{(query.error as Error).message}</p> : null}
        {!query.isLoading && !query.error && !query.data?.applications.length ? (
          <Card pad="lg" className="mt-8"><p className="text-runway-mute">No applications yet.</p></Card>
        ) : null}

        <section className="mt-8 grid gap-4" aria-label="Early-access applications">
          {query.data?.applications.map((application) => (
            <Card key={application.id} pad="lg" className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-runway-text">{application.name} · {application.company}</h2>
                  <p className="mt-1 text-sm text-runway-mute">
                    {application.email}
                    {application.website ? <> · <a href={application.website} rel="noreferrer noopener" target="_blank">{application.website}</a></> : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {application.source === "invite" ? <StatusChip tone="info" square>invited</StatusChip> : null}
                  {application.decidedBy?.startsWith("auto:") ? <StatusChip tone="info" square>auto-approved</StatusChip> : null}
                  <StatusChip tone={statusTone(application.status)} square>{application.status}</StatusChip>
                </div>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div><dt className="runway-meta">Robot</dt><dd className="mt-1 text-runway-text">{application.robot}</dd></div>
                <div><dt className="runway-meta">Wants to test on</dt><dd className="mt-1 text-runway-text">{application.workWanted}</dd></div>
                <div><dt className="runway-meta">Region · applied</dt><dd className="mt-1 text-runway-text">{application.region || "Not given"} · {new Date(application.appliedAtIso).toLocaleDateString()}</dd></div>
              </dl>
              {application.pilotPackage ? (
                <p className="text-sm text-runway-text"><span className="runway-meta">Typical pilot · private, indicative</span> {application.pilotPackage}</p>
              ) : null}
              {application.testSite ? (
                <p className="text-sm text-runway-text"><span className="runway-meta">Site lead · would test at</span> {application.testSite}</p>
              ) : null}
              {application.fit ? (
                <ul className="grid gap-1 text-sm" aria-label="Fit checklist">
                  {application.fit.checks.map((check) => (
                    <li key={check.id} className={check.passed ? "text-runway-text" : "text-runway-mute"}>
                      {check.passed ? "✓" : "✗"} {check.label}: {check.detail}
                    </li>
                  ))}
                </ul>
              ) : null}
              {application.decisionNote ? <p className="border border-runway-line bg-runway-black p-3 text-sm text-runway-body">{application.decisionNote}{application.decidedBy ? ` — ${application.decidedBy}` : ""}</p> : null}
              <div className="flex flex-wrap gap-3 border-t border-line pt-4">
                <Button variant="secondary" iconLeft={<Check />} disabled={updating === application.id || application.status === "approved"} onClick={() => decide(application, "approved")}>Approve</Button>
                <Button variant="danger" iconLeft={<X />} disabled={updating === application.id || application.status === "declined"} onClick={() => decide(application, "declined")}>Not yet</Button>
                {updating === application.id ? <span className="inline-flex items-center gap-2 text-sm text-runway-mute"><Clock3 className="h-4 w-4" />Saving…</span> : null}
              </div>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}

const proposalFields: Array<[string, string]> = [["purpose", "Job and pilot scope"], ["successCondition", "Measurable success condition"], ["exclusions", "Exclusions"], ["siteProvides", "Site responsibilities"], ["teamProvides", "Team responsibilities"], ["pilotCost", "Provider cost (Blueprint beta support is free)"], ["costBasis", "Quote source and cost basis"], ["window", "Proposed timing; never reserved by a proposal"], ["sitePreparation", "Site preparation to agree"], ["humanWork", "Human setup, supervision and safety work"], ["capabilityBasis", "Demonstrated evidence vs capability hypothesis"], ["providerCommitment", "Provider interest, availability and commitment evidence"], ["uncertainties", "Unknowns / one blocking question"], ["alternative", "Alternative, if useful"]];
function PilotProposalReview({ user }: { user: User | null }) {
  const [requestId, setRequestId] = useState("");
  const [loadedId, setLoadedId] = useState("");
  const [job, setJob] = useState<any>(null);
  const [plan, setPlan] = useState<Record<string, string>>({});
  const [decision, setDecision] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function request(path: string, body?: unknown) {
    const response = await fetch(`/api/admin/robot-teams/recommendations/${encodeURIComponent(loadedId || requestId.trim())}${path}`, {
      method: body ? "POST" : "GET", credentials: "include", headers: await withFirebaseAuthHeaders(user, await withCsrfHeader({ "Content-Type": "application/json" })), ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "The action was not confirmed."); return result;
  }
  async function load(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      // Bind edits to the job actually loaded, even if the lookup text changes.
      const response = await fetch(`/api/admin/robot-teams/recommendations/${encodeURIComponent(requestId.trim())}`, { headers: await withFirebaseAuthHeaders(user) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setJob(result); setLoadedId(requestId.trim()); setPlan({ ...result.draft, ...(result.recommendation ?? {}), teamId: result.recommendation?.teamId ?? "" });
      setDecision({ ...(result.decision ?? {}), questionText: result.decision?.question?.text ?? "", questionReason: result.decision?.question?.reason ?? "" });
    } catch (error) { setMessage(error instanceof Error ? error.message : "Job unavailable"); }
    finally { setBusy(false); }
  }
  async function propose(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage("");
    try { const fields = Object.fromEntries(["teamId", ...proposalFields.map(([key]) => key)].map(key => [key, plan[key] ?? ""]));
      const result = await request("", { ...fields, briefRevision: job.briefRevision }); setJob({ ...job, recommendation: { ...fields, id: result.id } });
      setMessage("Proposal saved on the existing job. Its fixed transactional notice is queued; provider capacity and dates remain unconfirmed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Proposal unavailable"); } finally { setBusy(false); }
  }
  async function saveDecision(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage("");
    try {
      await request("/decision", { sourceDigest: job.decisionSourceDigest,
        recommendation: decision.recommendation ?? "", why: decision.why ?? "",
        decisiveUncertainty: decision.decisiveUncertainty ?? "", nextAction: decision.nextAction ?? "",
        question: decision.questionText ? { text: decision.questionText, reason: decision.questionReason ?? "" } : null });
      setJob(await request(""));
      setMessage("Reviewed recommendation saved on this job. No message, model call or commitment was made.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Decision was not saved"); }
    finally { setBusy(false); }
  }
  async function schedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget), value = (key: string) => String(data.get(key) || "").trim();
    setBusy(true); setMessage("");
    try { const result = await request("/coordination", { recommendationId: job.recommendation.id, calendarEventId: value("calendarEventId"),
      providerAgreement: { agreedBy: value("providerAgreedBy"), evidenceRef: value("providerEvidence") },
      siteAgreement: { agreedBy: value("siteAgreedBy"), evidenceRef: value("siteEvidence") }, sitePreparation: value("sitePreparation"), verifiedAgreements: data.get("verified") === "on" });
      setJob({ ...job, coordination: result.coordination }); setMessage("Existing agreements and Calendar date verified; one scheduled notice recorded.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Coordination unavailable"); } finally { setBusy(false); }
  }
  async function reconcile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget), value = (key: string) => String(data.get(key) || "").trim();
    try { await request("/reconcile", { recommendationId: job.recommendation.id, briefRevision: job.briefRevision,
      providerAgreement: { agreedBy: value("providerAgreedBy"), evidenceRef: value("providerEvidence") },
      siteAgreement: { agreedBy: value("siteAgreedBy"), evidenceRef: value("siteEvidence") }, verifiedUnchangedScope: data.get("verified") === "on" });
      setJob({ ...job, recommendation: { ...job.recommendation, reviewRequired: false } }); setMessage("Updated job reconciled with the unchanged accepted scope. Original price and terms retained.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Reconciliation unavailable"); } finally { setBusy(false); }
  }
  return <Card pad="lg" className="mt-8"><h2 className="text-lg font-semibold">Prepare a pilot from an existing job</h2>
    <form onSubmit={load} className="ms-form"><label>Job reference<input value={requestId} onChange={event => setRequestId(event.target.value)} required /></label><button className="ms-button" disabled={busy}>Load existing brief and assessment</button></form>
    {job && <><p>Job {loadedId}. Assessment: {job.assessment?.state ?? "unavailable"}. {job.coordination?.nextAction}</p>
      <p className="ms-field-hint">Prefills: {job.sources.purpose}; success: {job.sources.successCondition ?? "unknown — ask for the target before proposing"}. Private job information is for staff review; this action does not authorize sharing footage.</p>
      <p role="note">{job.dependency}</p>
      <p role="note">New beta proposals have no Blueprint fee. Owner action: reconcile the published $2,500 booking terms before relying on a new commercial agreement. Existing accepted fees and terms remain unchanged; provider costs require the actual quote and approval.</p>
      {job.interests?.map((interest: any) => <p key={interest.submittedBy}>{interest.company}: {interest.state} — {interest.inputs}</p>)}
      {job.customerConversation?.map((answer: any) => <p key={answer.messageId}>Customer answer ({answer.receivedAt}): {answer.text}</p>)}
      {job.customerClarification && <p>Customer answer on the job page: {job.customerClarification.explanation} — Blueprint review required.</p>}
      <form onSubmit={saveDecision} className="ms-form" aria-label="Reviewed job recommendation"><h3>Return a decision and own the next step</h3>
        {[["recommendation", "What we recommend"], ["why", "Why the evidence supports it"], ["decisiveUncertainty", "Decision-changing uncertainty, if any"], ["nextAction", "Smallest next action Blueprint owns"], ["questionText", "One consequential question, if needed"], ["questionReason", "Why that answer changes the next decision"]].map(([key, label]) => <label key={key}>{label}<textarea value={decision[key] ?? ""} required={["recommendation", "why", "nextAction"].includes(key)} maxLength={key.startsWith("question") ? 1000 : 2000} onChange={event => setDecision({ ...decision, [key]: event.target.value })} /></label>)}
        <button className="ms-button" disabled={busy}>Save reviewed recommendation</button>
      </form>
      <JobCommunications key={loadedId} user={user} requestId={loadedId} />
      <form onSubmit={propose} className="ms-form"><label>Admitted provider<select value={plan.teamId} onChange={event => setPlan({ ...plan, teamId: event.target.value })} required><option value="">Select a team; no automatic match</option>{job.teams.map((team: any) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        {proposalFields.map(([key, label]) => <label key={key}>{label}<textarea value={plan[key] ?? ""} required={!["alternative", "uncertainties"].includes(key)} maxLength={["pilotCost", "window"].includes(key) ? 120 : ["purpose", "siteProvides", "teamProvides", "uncertainties", "alternative"].includes(key) ? 400 : ["costBasis", "providerCommitment"].includes(key) ? 600 : 1000} onChange={event => setPlan({ ...plan, [key]: event.target.value })} /></label>)}
        <button className="ms-button" disabled={busy || Boolean(job.coordination)}>Send reviewed proposal notice</button></form>
      {job.recommendation?.reviewRequired && job.coordination && <details><summary>Reconcile the updated job with the accepted scope</summary><form onSubmit={reconcile} className="ms-form">
        {[["providerAgreedBy", "Provider representative"], ["providerEvidence", "Provider unchanged-scope agreement evidence URL"], ["siteAgreedBy", "Site representative"], ["siteEvidence", "Site unchanged-scope agreement evidence URL"]].map(([key, label]) => <label key={key}>{label}<input name={key} required type={key.endsWith("Evidence") ? "url" : "text"} /></label>)}
        <label className="ms-check-row"><input name="verified" type="checkbox" required />Both parties agreed the updated job is covered by the unchanged accepted scope, costs and terms. Any amendment needs separate applicable approval.</label><button className="ms-button" disabled={busy}>Record unchanged-scope reconciliation</button>
      </form></details>}
      {job.coordination && !job.recommendation?.reviewRequired && <details><summary>Record an already agreed Calendar date</summary><p>No invitations or personalized correspondence are sent here. Evidence must establish both parties' agreement to this proposal, this Calendar date and the preparation responsibilities. Completed preparation is required only if their agreement says so.</p><form onSubmit={schedule} className="ms-form">
        {[["calendarEventId", "Existing Calendar event ID"], ["providerAgreedBy", "Provider representative with commitment authority"], ["providerEvidence", "Provider agreement evidence URL"], ["siteAgreedBy", "Site representative with authority"], ["siteEvidence", "Site agreement evidence URL"], ["sitePreparation", "Agreed preparation responsibilities"]].map(([key, label]) => <label key={key}>{label}<input name={key} required type={key.endsWith("Evidence") ? "url" : "text"} /></label>)}
        <label className="ms-check-row"><input name="verified" type="checkbox" required />I verified the recorded agreements, applicable authority, date, scope, costs and preparation responsibilities. Recording them does not grant new authority.</label><button className="ms-button" disabled={busy}>Verify existing date and record scheduled status</button>
      </form></details>}
    </>}{message && <p role="status">{message}</p>}
  </Card>;
}

/** Staff use the actual communications agent; loading never drafts or sends. */
export function JobCommunications({ user, requestId }: { user: User | null; requestId: string }) {
  const [loaded, setLoaded] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [approved, setApproved] = useState<Record<string, boolean>>({});
  const [instruction, setInstruction] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [purpose, setPurpose] = useState("question");
  async function action(path = "", body?: unknown) {
    const response = await fetch(`/api/admin/robot-teams/jobs/${encodeURIComponent(requestId)}/communications${path}`, {
      method: body ? "POST" : "GET", credentials: "include",
      headers: await withFirebaseAuthHeaders(user, await withCsrfHeader({ "Content-Type": "application/json" })),
      ...(body ? { body: JSON.stringify(body) } : {}) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || "Communications action unavailable"); return result;
  }
  async function run(work: () => Promise<void>) {
    if (busy) return; setBusy(true); setMessage("");
    try { await work(); } catch (error) { setMessage(error instanceof Error ? error.message : "Communications action unavailable"); }
    finally { setBusy(false); }
  }
  return <details><summary>Customer conversation · actual communications agent</summary>
    <p>Ask one consequential question, return the reviewed recommendation or coordinate an agreed next step. The customer can reply naturally by email; Blueprint imports the answer onto this job and owns follow-through.</p>
    <button type="button" className="ms-button" disabled={busy} onClick={() => void run(async () => { setLoaded(await action()); setApproved({}); })}>Load current customer context and drafts</button>
    {loaded && <><p>Recipient: {loaded.context.recipient}. Drafting: {loaded.draftingEnabled ? "existing authority enabled" : "disabled by current configuration"}. Sending: {loaded.deliveryEnabled ? "enabled for an explicitly reviewed message" : "disabled by current configuration"}.</p>
      <details><summary>Exact customer context to review</summary><pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(loaded.context, null, 2)}</pre></details>
      {loaded.context.assessment && <section><h4>Assessment follow-up</h4>
        <p>Preparation can continue where authorized while the site answers the remaining questions.</p>
        {loaded.context.assessment.unknowns.filter((text: string) => text.startsWith("Question to resolve:")).map((text: string) =>
          <p key={text}>{text} <button type="button" disabled={busy} onClick={() => {
            setPurpose("question");
            setInstruction(`Ask this unresolved assessment question in a natural customer message: ${text}`.slice(0, 1200));
            setDecisionReason("Clarify the specific decision identified by the current assessment; preserve unknowns and explain which preparation can continue.");
          }}>Use this question in the agent draft</button></p>)}
      </section>}
      <form className="ms-form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget), read = (key: string) => String(data.get(key) || "").trim();
        void run(async () => { await action("/draft", { purpose: read("purpose"), instruction: read("instruction"), decisionReason: read("reason"), expectedContextDigest: loaded.contextDigest,
          reviewedCustomerContext: data.get("reviewed") === "on", ...(read("threadId") ? { threadId: read("threadId"), inboundMessageId: read("inboundMessageId") } : {}) });
          setLoaded(await action()); setApproved({}); setMessage("Agent draft prepared for exact review. Nothing has been sent."); }); }}>
        <label>Purpose<select name="purpose" value={purpose} onChange={event => setPurpose(event.target.value)}><option value="question">Consequential question</option><option value="recommendation">Reviewed recommendation</option><option value="coordination">Authorized coordination</option></select></label>
        <label>What the agent should communicate<textarea name="instruction" value={instruction} onChange={event => setInstruction(event.target.value)} minLength={8} maxLength={1200} required /></label>
        <label>Why this matters to the next decision<textarea name="reason" value={decisionReason} onChange={event => setDecisionReason(event.target.value)} minLength={8} maxLength={800} required /></label>
        <label>Existing customer thread ID, if replying<input name="threadId" maxLength={160} /></label><label>Exact inbound message ID, if replying<input name="inboundMessageId" maxLength={160} /></label>
        <label className="ms-check-row"><input name="reviewed" type="checkbox" required />I reviewed this bounded customer context and have the applicable authority to prepare this agent draft.</label>
        <button className="ms-button" disabled={busy || !loaded.draftingEnabled}>Prepare agent draft for review</button>
      </form>
      {loaded.communications.map((row: any) => <section key={row.id}><h4>{row.purpose}: {row.state}</h4>
        {row.output && <><p>{row.output.subject}</p><p style={{ whiteSpace: "pre-wrap" }}>{row.output.body}</p></>}
        {row.failureCode && <p role="alert">{row.failureCode}</p>}
        {row.state === "needs_review" && <><label className="ms-check-row"><input type="checkbox" checked={approved[row.id] ?? false} onChange={event => setApproved({ ...approved, [row.id]: event.target.checked })} />I reviewed this exact recipient and message and have authority to send it. No new disclosure, cost or commitment is authorized by this control.</label>
          <button type="button" className="ms-button" disabled={busy || !loaded.deliveryEnabled || !approved[row.id]} onClick={() => void run(async () => {
            await action(`/${encodeURIComponent(row.id)}/approve-send`, { expectedOutputDigest: row.outputDigest, expectedContextDigest: loaded.contextDigest, reviewedSend: true });
            setLoaded(await action()); setApproved({}); setMessage("Send acknowledged by the communications integration. Check the recorded receipt."); })}>Send exact reviewed agent message</button></>}
        {row.sendReceipt && <button type="button" className="ms-button" disabled={busy} onClick={() => void run(async () => {
          const result = await action(`/${encodeURIComponent(row.id)}/replies`, {}); setLoaded(await action());
          setMessage(`Customer thread checked; ${result.saved ?? 0} new answers saved to this job for Blueprint review.`); })}>Read customer replies into this job</button>}
      </section>)}
    </>}{message && <p role="status">{message}</p>}
  </details>;
}
