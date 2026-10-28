import { useId, useState, type FormEvent } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { Button } from "@/components/blueprint";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import type { JobManagedEvidenceSummary } from "@/types/jobMarketplace";

/** One explicit owner decision on the prepared run, using the existing free admission route. */
export function AdmitBetaPolicyFinalistForm({ jobId, runId, finalist, currentUser, onAdmitted }: {
  jobId: string; runId: string; finalist: NonNullable<JobManagedEvidenceSummary["finalist"]>;
  currentUser: FirebaseUser | null; onAdmitted: () => void;
}) {
  const fieldId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [approved, setApproved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !currentUser || !finalist.planDigest) return;
    const cap = Number(new FormData(event.currentTarget).get("cap"));
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/admin/free-evaluations/${encodeURIComponent(jobId)}/admit`, {
        method: "POST", credentials: "include",
        headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({ "Content-Type": "application/json" })),
        body: JSON.stringify({ finalistId: runId, planDigest: finalist.planDigest, episodes: 200,
          sponsorCapUsd: cap, maxAttempts: 1, evidenceScope: "development_only",
          expiresAtIso: new Date(Date.now() + Math.floor(finalist.approvalTtlMs * 0.95)).toISOString() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(result.error || "Full scoring approval could not be recorded."));
      setApproved(true); onAdmitted();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Approval could not be sent. Try again.");
    } finally { setPending(false); }
  }
  if (approved) return <p role="status">Approval recorded for this exact run. The existing worker will continue it.</p>;
  return <form onSubmit={submit} className="grid gap-2" aria-label={`Approve full scoring for ${finalist.candidateId}`}>
    <p>Full scoring is prepared for {finalist.candidateId}: 200 episodes, one paid attempt, free to the site.</p>
    <label htmlFor={fieldId}>Blueprint compute cap (USD)</label>
    <input id={fieldId} name="cap" type="number" min={finalist.minimumCapUsd} max={finalist.approvalCapUsd} step="0.01"
      defaultValue={finalist.minimumCapUsd} className="runway-input" required />
    <p className="text-xs text-runway-mute break-all">Exact plan: {finalist.planDigest}. Approval expires after {Math.round(finalist.approvalTtlMs / 3_600_000 * 10) / 10} hours.</p>
    {error && <p role="alert">{error}</p>}
    <div><Button type="submit" size="sm" disabled={pending || !currentUser}>Approve full scoring</Button></div>
  </form>;
}
