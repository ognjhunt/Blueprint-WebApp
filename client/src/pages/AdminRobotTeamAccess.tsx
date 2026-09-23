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
