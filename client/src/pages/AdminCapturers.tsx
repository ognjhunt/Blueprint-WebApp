import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, RefreshCw, X } from "lucide-react";

import { Button, Card, Eyebrow, StatusChip } from "@/components/blueprint";
import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

type CapturerApplication = {
  id: string;
  name: string;
  email: string;
  market: string;
  equipment: string[];
  availability: string;
  application_status: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string;
};

type CapturerApplicationsResponse = {
  applications: CapturerApplication[];
  count: number;
};

function statusTone(status: string | null) {
  if (status === "approved") return "proof" as const;
  if (status === "rejected" || status === "paused") return "block" as const;
  return "warn" as const;
}

export default function AdminCapturers() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["admin-capturer-applications"],
    enabled: Boolean(currentUser),
    queryFn: async () => {
      const response = await fetch("/api/admin/field-ops/capturer-applications", {
        credentials: "include",
        headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({})),
      });
      if (!response.ok) throw new Error(`Failed to load capturer applications (${response.status})`);
      return response.json() as Promise<CapturerApplicationsResponse>;
    },
  });

  async function review(application: CapturerApplication, status: "approved" | "rejected") {
    const reviewNote = window.prompt(
      status === "approved" ? "Optional approval note" : "Record the rejection reason",
      application.review_note,
    );
    if (reviewNote === null) return;
    setUpdating(application.id);
    try {
      const response = await fetch(
        `/api/admin/field-ops/capturer-applications/${encodeURIComponent(application.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: await withFirebaseAuthHeaders(
            currentUser,
            await withCsrfHeader({ "Content-Type": "application/json" }),
          ),
          body: JSON.stringify({ status, review_note: reviewNote }),
        },
      );
      if (!response.ok) throw new Error(`Review update failed (${response.status})`);
      await queryClient.invalidateQueries({ queryKey: ["admin-capturer-applications"] });
    } finally {
      setUpdating(null);
    }
  }

  return (
    <main className="min-h-screen bg-canvas px-5 py-10 text-ink-900 md:px-8">
      <div className="mx-auto max-w-[88rem]">
        <header className="flex flex-col gap-4 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow tone="brass" rule>Field operations</Eyebrow>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight">Capturer applications</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-500">
              Review the real user application record. Approval changes the capturer's account state;
              it does not create an assignment, accepted capture, or payout.
            </p>
          </div>
          <Button variant="secondary" iconLeft={<RefreshCw />} onClick={() => query.refetch()}>
            Refresh
          </Button>
        </header>

        {query.isLoading ? <p className="py-12 text-ink-500">Loading applications…</p> : null}
        {query.error ? <p className="py-12 text-block-fg">{(query.error as Error).message}</p> : null}
        {!query.isLoading && !query.error && !query.data?.applications.length ? (
          <Card pad="lg" className="mt-8"><p className="text-ink-500">No capturer applications are recorded.</p></Card>
        ) : null}

        <section className="mt-8 grid gap-4" aria-label="Capturer application queue">
          {query.data?.applications.map((application) => (
            <Card key={application.id} pad="lg" className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{application.name}</h2>
                  <p className="mt-1 text-sm text-ink-500">{application.email || application.id}</p>
                </div>
                <StatusChip tone={statusTone(application.application_status)} square>
                  {application.application_status?.replace(/_/g, " ") || "Not recorded"}
                </StatusChip>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div><dt className="text-ink-400">Market</dt><dd className="mt-1 font-semibold">{application.market || "Not recorded"}</dd></div>
                <div><dt className="text-ink-400">Availability</dt><dd className="mt-1 font-semibold">{application.availability || "Not recorded"}</dd></div>
                <div><dt className="text-ink-400">Submitted</dt><dd className="mt-1 font-semibold">{application.submitted_at ? new Date(application.submitted_at).toLocaleString() : "Not recorded"}</dd></div>
              </dl>
              {application.review_note ? <p className="rounded-md bg-inset p-3 text-sm text-ink-600">{application.review_note}</p> : null}
              <div className="flex flex-wrap gap-3 border-t border-line pt-4">
                <Button variant="action" iconLeft={<Check />} disabled={updating === application.id || application.application_status === "approved"} onClick={() => review(application, "approved")}>
                  Approve
                </Button>
                <Button variant="secondary" iconLeft={<X />} disabled={updating === application.id || application.application_status === "rejected"} onClick={() => review(application, "rejected")}>
                  Reject
                </Button>
                {updating === application.id ? <span className="inline-flex items-center gap-2 text-sm text-ink-500"><Clock3 className="h-4 w-4" />Saving review…</span> : null}
              </div>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
