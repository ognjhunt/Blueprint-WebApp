import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, RefreshCw, X } from "lucide-react";

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

/**
 * Robot-team early access. Approving grants the task library to that verified
 * email and sends one email with the next step; declining sends nothing, so a
 * person can reply in their own words.
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
      return response.json() as Promise<{ applications: Application[]; count: number }>;
    },
  });

  async function decide(application: Application, status: "approved" | "declined") {
    const note = window.prompt(
      status === "approved"
        ? "Optional note (internal). Approving emails them how to create their account."
        : "Reason (internal). Declining sends no email.",
      application.decisionNote ?? "",
    );
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
            <Eyebrow tone="brass" rule>Robot teams</Eyebrow>
            <h1 className="mt-5 font-display text-4xl font-semibold tracking-[0.005em] text-runway-text">Early-access applications</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-runway-mute">
              Approved teams see the site tasks sites have shared, once they sign in with the approved,
              verified email. Match them to sites by hand; the library is not a marketplace yet.
            </p>
          </div>
          <Button variant="secondary" iconLeft={<RefreshCw />} onClick={() => query.refetch()}>Refresh</Button>
        </header>

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
                <StatusChip tone={statusTone(application.status)} square>{application.status}</StatusChip>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div><dt className="runway-meta">Robot</dt><dd className="mt-1 text-runway-text">{application.robot}</dd></div>
                <div><dt className="runway-meta">Wants to test on</dt><dd className="mt-1 text-runway-text">{application.workWanted}</dd></div>
                <div><dt className="runway-meta">Region · applied</dt><dd className="mt-1 text-runway-text">{application.region || "Not given"} · {new Date(application.appliedAtIso).toLocaleDateString()}</dd></div>
              </dl>
              {application.decisionNote ? <p className="border border-runway-line bg-runway-black p-3 text-sm text-runway-body">{application.decisionNote}{application.decidedBy ? ` — ${application.decidedBy}` : ""}</p> : null}
              <div className="flex flex-wrap gap-3 border-t border-line pt-4">
                <Button variant="secondary" iconLeft={<Check />} disabled={updating === application.id || application.status === "approved"} onClick={() => decide(application, "approved")}>Approve</Button>
                <Button variant="danger" iconLeft={<X />} disabled={updating === application.id || application.status === "declined"} onClick={() => decide(application, "declined")}>Decline</Button>
                {updating === application.id ? <span className="inline-flex items-center gap-2 text-sm text-runway-mute"><Clock3 className="h-4 w-4" />Saving…</span> : null}
              </div>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
