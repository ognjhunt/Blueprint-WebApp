import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, RefreshCw, Send, X } from "lucide-react";

import { Button, Card, Eyebrow, StatusChip } from "@/components/blueprint";
import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import { companyCheckReasonWords, type CompanyCheck } from "@/lib/companyCheck";

type Application = {
  id: string;
  name: string;
  email: string;
  company: string;
  partnerRole?: "deployment" | "technology" | null;
  supportedSystems?: string | null;
  website: string | null;
  /** Asked on applications before 2026-11-23 only; kept so old applications stay readable. */
  robot?: string | null;
  workWanted?: string | null;
  region?: string | null;
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
  /** The automatic check on a new application (owner direction 2026-11-23). */
  companyCheck?: CompanyCheck | null;
};

/** What the automatic check found, so the one-press decision has its reasoning in front of it. */
function CompanyCheckSummary({ check }: { check: CompanyCheck }) {
  return <div className="border border-runway-line bg-runway-black p-3 text-sm text-runway-body" aria-label="Automatic check">
    <p className="runway-meta">Automatic check · {new Date(check.checkedAtIso).toLocaleString()}</p>
    <p className="mt-1 text-runway-text">{check.outcome === "approved" ? "Approved by the published rule." : "Needs you."}</p>
    {check.reasons.length ? <ul className="mt-1 grid gap-1">{check.reasons.map(reason => <li key={reason}>✗ {companyCheckReasonWords(reason)}</li>)}</ul> : null}
    {check.modelReason ? <p className="mt-1"><span className="runway-meta">Model ({check.modelAnswer ?? "no answer"}): </span>{check.modelReason}</p> : null}
    {check.evidenceQuote ? <p className="mt-1"><span className="runway-meta">On the website: </span>“{check.evidenceQuote}”</p> : null}
  </div>;
}

function statusTone(status: Application["status"]) {
  if (status === "approved") return "proof" as const;
  if (status === "declined") return "block" as const;
  return "warn" as const;
}

/** Historical application rows are untrusted even after new intake validation. */
function ApplicationWebsite({ value }: { value: string | null }) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") {
      return <a href={url.href} rel="noreferrer noopener" target="_blank">{value}</a>;
    }
  } catch { /* Keep an invalid historical value readable without making it a link. */ }
  return <span>{value}</span>;
}

type Library = {
  listedTaskCount: number | null;
  autoApproveMinimumTasks: number | null;
  gated?: boolean;
};

/** The application the Slack bell links to (`?application=<id>`), if any. */
function linkedApplicationId(): string | null {
  const id = new URLSearchParams(window.location.search).get("application");
  return id && /^[a-f0-9]{64}$/.test(id) ? id : null;
}

function libraryLine(library: Library | undefined) {
  if (!library) return null;
  const listed = library.listedTaskCount === null ? "The task library could not be read" : `${library.listedTaskCount} site task${library.listedTaskCount === 1 ? "" : "s"} listed`;
  // No application is approved automatically: the server's `autoApproveMinimumTasks()` is always null.
  return `${listed}. No application is approved automatically; each is decided here.`;
}

/**
 * The outbound path: after a call, grant access to that email directly. The
 * link it sends only works for that verified address, so it cannot be passed
 * on like an invite code.
 */
function InviteTeam({ onInvited, send }: {
  onInvited: () => Promise<void>;
  send: (body: Record<string, unknown>) => Promise<Response>;
}) {
  const [state, setState] = useState<"idle" | "sending" | "queued" | "sent" | "needs_attention" | "error">("idle");
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
      const body = (await response.json()) as { notificationStatus?: "queued" | "sent" | "needs_attention" };
      setState(body.notificationStatus ?? "needs_attention");
      form.reset();
      await onInvited();
    } catch {
      setState("error");
    }
  }
  return (
    <Card pad="lg" className="mt-8">
      <h2 className="text-lg font-semibold text-runway-text">Invite a team you spoke with</h2>
      <p className="mt-1 text-sm text-runway-mute">Grants access to that work email and queues the sign-up email. Use it after a call.</p>
      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submit} aria-label="Invite a team">
        <label className="runway-meta flex flex-col gap-1">Name<input name="name" required maxLength={120} className="border border-line bg-transparent px-3 py-2 text-runway-text" /></label>
        <label className="runway-meta flex flex-col gap-1">Work email<input name="email" type="email" required maxLength={320} className="border border-line bg-transparent px-3 py-2 text-runway-text" /></label>
        <label className="runway-meta flex flex-col gap-1">Company<input name="company" required maxLength={160} className="border border-line bg-transparent px-3 py-2 text-runway-text" /></label>
        <label className="runway-meta flex flex-col gap-1">What they want to test (internal)<input name="note" maxLength={2000} className="border border-line bg-transparent px-3 py-2 text-runway-text" /></label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Button variant="secondary" iconLeft={<Send />} disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Invite"}</Button>
          <span role="status" className="text-sm text-runway-mute">
            {state === "queued" ? "Approval saved. Sign-up email queued." : state === "sent" ? "Approval saved. Sign-up email sent."
              : state === "needs_attention" ? "Approval saved. Invitation delivery needs attention; check the outbox before retrying."
                : state === "error" ? "The invitation could not be confirmed. Retry safely; an existing approval is preserved." : ""}
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
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
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

  const linkedId = linkedApplicationId();
  useEffect(() => {
    if (!linkedId || !query.data) return;
    document.getElementById(`application-${linkedId}`)?.scrollIntoView({ block: "start" });
  }, [linkedId, query.data]);

  async function sendInvite(body: Record<string, unknown>) {
    return fetch("/api/admin/robot-team-access/invites", {
      method: "POST",
      credentials: "include",
      headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({ "Content-Type": "application/json" })),
      body: JSON.stringify(body),
    });
  }

  async function refreshInvitation(application: Application) {
    setError(null);
    try {
      const response = await fetch(`/api/admin/robot-team-access/${application.id}/invitation`, { method: "POST", credentials: "include", headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({})) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not refresh the invitation.");
      setInvitationUrl(data.invitationUrl);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not refresh the invitation."); }
  }

  async function decide(application: Application, status: "approved" | "declined") {
    // Approve is one press. "Not yet" still asks for an internal reason (never sent).
    const note = status === "approved" ? "" : window.prompt("Reason (internal, never sent).", application.decisionNote ?? "");
    if (note === null) return;
    setUpdating(application.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/robot-team-access/${encodeURIComponent(application.id)}/decision`, {
        method: "POST",
        credentials: "include",
        headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({ "Content-Type": "application/json" })),
        body: JSON.stringify({ status, ...(note.trim() ? { note: note.trim() } : {}) }),
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
            <Eyebrow tone="brass" rule>Deployment companies</Eyebrow>
            <h1 className="mt-5 font-display text-4xl font-semibold tracking-[0.005em] text-runway-text">Company applications</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-runway-mute">
              Is this a real robot deployment company? If so, press Approve.
              Approved companies see only the site jobs shared with their team after signing in with a verified email.
            </p>
            {libraryLine(query.data?.library) ? <p className="mt-2 max-w-2xl text-sm text-runway-text">{libraryLine(query.data?.library)}</p> : null}
          </div>
          <Button variant="secondary" iconLeft={<RefreshCw />} onClick={() => query.refetch()}>Refresh</Button>
        </header>

        <InviteTeam send={sendInvite} onInvited={() => queryClient.invalidateQueries({ queryKey: ["admin-robot-team-access"] })} />

        {error ? <p className="py-4 text-runway-red" role="alert">{error}</p> : null}
        {query.isLoading ? <p className="py-12 text-runway-mute">Loading applications…</p> : null}
        {query.error ? <p className="py-12 text-runway-red">{(query.error as Error).message}</p> : null}
        {!query.isLoading && !query.error && !query.data?.applications.length ? (
          <Card pad="lg" className="mt-8"><p className="text-runway-mute">No applications yet.</p></Card>
        ) : null}

        {invitationUrl && <p role="status" className="mb-4 break-all text-sm"><a href={invitationUrl} className="underline">Open approved account invitation</a> · valid for seven days</p>}
        <section className="mt-8 grid gap-4" aria-label="Early-access applications">
          {query.data?.applications.map((application) => (
            <Card key={application.id} id={`application-${application.id}`} aria-current={application.id === linkedId ? "true" : undefined}
              pad="lg" className={`flex flex-col gap-5${application.id === linkedId ? " ring-2 ring-runway-signal" : ""}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-runway-text">{application.name} · {application.company}</h2>
                  <p className="mt-1 text-sm text-runway-mute">
                    {application.email}
                    {application.website ? <> · <ApplicationWebsite value={application.website} /></> : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {application.partnerRole ? <StatusChip tone="info" square>{application.partnerRole === "deployment" ? "deployment partner" : "technology provider"}</StatusChip> : null}
                  {application.source === "invite" ? <StatusChip tone="info" square>invited</StatusChip> : null}
                  {application.decidedBy?.startsWith("auto:") ? <StatusChip tone="info" square>auto-approved</StatusChip> : null}
                  <StatusChip tone={statusTone(application.status)} square>{application.status}</StatusChip>
                </div>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                {/* The application is four fields since 2026-11-23; an older one still shows what it said. */}
                {application.robot ? <div><dt className="runway-meta">{application.partnerRole === "deployment" ? "Delivery capabilities" : "System"}</dt><dd className="mt-1 text-runway-text">{application.robot}</dd></div> : null}
                {application.workWanted ? <div><dt className="runway-meta">{application.partnerRole === "deployment" ? "Jobs they can deliver" : "Work to assess"}</dt><dd className="mt-1 text-runway-text">{application.workWanted}</dd></div> : null}
                {application.region ? <div><dt className="runway-meta">Region</dt><dd className="mt-1 text-runway-text">{application.region}</dd></div> : null}
                <div><dt className="runway-meta">Applied</dt><dd className="mt-1 text-runway-text">{new Date(application.appliedAtIso).toLocaleDateString()}</dd></div>
              </dl>
              {application.supportedSystems ? <p className="text-sm text-runway-mute"><span className="runway-meta">Supported systems: </span>{application.supportedSystems}</p> : null}
              {application.pilotPackage ? (
                <p className="text-sm text-runway-text"><span className="runway-meta">{application.partnerRole === "deployment" ? "Delivery and support notes" : application.partnerRole === "technology" ? "Access and evaluation notes" : "Typical pilot · private, indicative"}</span> {application.pilotPackage}</p>
              ) : null}
              {application.testSite ? (
                <p className="text-sm text-runway-text"><span className="runway-meta">Site lead · would test at</span> {application.testSite}</p>
              ) : null}
              {application.fit ? (
                <ul className="grid gap-1 text-sm" aria-label="Work email and website">
                  {application.fit.checks.filter((check) => check.id !== "open_tasks_in_region").map((check) => (
                    <li key={check.id} className={check.passed ? "text-runway-text" : "text-runway-mute"}>
                      {check.passed ? "✓" : "✗"} {check.label}: {check.detail}
                    </li>
                  ))}
                </ul>
              ) : null}
              {application.companyCheck ? <CompanyCheckSummary check={application.companyCheck} /> : null}
              {application.decisionNote ? <p className="border border-runway-line bg-runway-black p-3 text-sm text-runway-body">{application.decisionNote}{application.decidedBy ? ` — ${application.decidedBy}` : ""}</p> : null}
              <div className="flex flex-wrap gap-3 border-t border-line pt-4">
                {application.status === "approved" && <Button variant="secondary" onClick={() => void refreshInvitation(application)}>Get invitation link</Button>}
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
