import { useId, useState, type FormEvent } from "react";
import type { User as FirebaseUser } from "firebase/auth";

import { Button, StatusChip } from "@/components/blueprint";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";
import type { AdmissionCandidate, AdmissionDefaults } from "@/types/jobConsole";

/** Margin kept inside the reservation TTL so the server's clock still accepts the expiry. */
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

/** A `datetime-local` value (local time, minute precision) for a timestamp. */
export function toLocalInputValue(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function defaultExpiry(defaults: AdmissionDefaults, now = Date.now()): string {
  return toLocalInputValue(now + Math.max(defaults.reservationTtlMs - EXPIRY_MARGIN_MS, 60_000));
}

type Outcome = { runId: string; created: boolean } | null;

/**
 * Admit one free evaluation: the exact team and checkpoint, a Blueprint-paid
 * compute ceiling, and an expiry. Posts to the existing admission endpoint,
 * which re-checks every record; this form only prefills it.
 */
export function AdmitFreeEvaluationForm({
  candidate,
  defaults,
  currentUser,
  onAdmitted,
}: {
  candidate: AdmissionCandidate;
  defaults: AdmissionDefaults;
  currentUser: FirebaseUser | null;
  onAdmitted?: (outcome: { runId: string; created: boolean }) => void;
}) {
  const formId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<Outcome>(null);
  const checkpoints = candidate.matchingCheckpoints;
  const ttlHours = Math.round((defaults.reservationTtlMs / 3_600_000) * 10) / 10;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const values = new FormData(event.currentTarget);
    const expiresAt = new Date(String(values.get("expiresAt") || ""));
    if (!Number.isFinite(expiresAt.getTime())) {
      setError("Choose when this approval expires.");
      return;
    }
    const body = {
      teamId: String(values.get("teamId") || "").trim(),
      checkpointId: String(values.get("checkpointId") || "").trim(),
      episodes: Number(values.get("episodes")),
      sponsorCapUsd: Number(values.get("sponsorCapUsd")),
      expiresAtIso: expiresAt.toISOString(),
      maxAttempts: 1,
      evidenceScope: "development_only",
    };
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/free-evaluations/${encodeURIComponent(candidate.evaluationRequestId)}/admit`,
        {
          method: "POST",
          credentials: "include",
          headers: await withFirebaseAuthHeaders(
            currentUser,
            await withCsrfHeader({ "Content-Type": "application/json" }),
          ),
          body: JSON.stringify(body),
        },
      );
      const value = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(String(value.error || `Admission failed (${response.status}).`));
        return;
      }
      const result = { runId: String(value.runId), created: value.created === true };
      setOutcome(result);
      onAdmitted?.(result);
    } catch {
      setError("Admission could not be sent. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  if (outcome) {
    return (
      <div role="status" className="border border-runway-green-dim p-4 text-sm text-runway-body">
        <StatusChip tone="proof" square>{outcome.created ? "Admitted" : "Already admitted"}</StatusChip>
        <p className="mt-3">
          Run <span className="runway-num text-runway-text">{outcome.runId}</span>{" "}
          {outcome.created
            ? "is recorded. Execution starts through the normal dispatch; nothing has run yet."
            : "already holds this exact approval. No second run was created."}
        </p>
      </div>
    );
  }

  const field = (name: string) => `${formId}-${name}`;
  return (
    <form method="post" onSubmit={submit} className="grid gap-4" aria-label={`Admit free evaluation ${candidate.evaluationRequestId}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="runway-label" htmlFor={field("team")}>Team ID</label>
          <input id={field("team")} name="teamId" className="runway-input" required maxLength={192}
            defaultValue={candidate.team?.teamId ?? ""} />
        </div>
        <div>
          <label className="runway-label" htmlFor={field("checkpoint")}>Checkpoint</label>
          {checkpoints.length ? (
            <select id={field("checkpoint")} name="checkpointId" className="runway-input" required
              defaultValue={checkpoints[0].checkpointId}>
              {checkpoints.map((checkpoint) => (
                <option key={checkpoint.checkpointId} value={checkpoint.checkpointId}>
                  {checkpoint.label} · {checkpoint.runtime} · {checkpoint.status}
                </option>
              ))}
            </select>
          ) : (
            <input id={field("checkpoint")} name="checkpointId" className="runway-input" required maxLength={192}
              aria-describedby={field("checkpoint-hint")} />
          )}
          {!checkpoints.length ? (
            <p id={field("checkpoint-hint")} className="mt-2 text-xs text-runway-mute">
              No registered checkpoint matches this setup's reference yet. The team registers one in
              Settings → Robots &amp; policies.
            </p>
          ) : null}
        </div>
        <div>
          <label className="runway-label" htmlFor={field("episodes")}>Episodes</label>
          <input id={field("episodes")} name="episodes" type="number" className="runway-input" required min={1} step={1}
            defaultValue={defaults.episodes} />
        </div>
        <div>
          <label className="runway-label" htmlFor={field("cap")}>Sponsor cap (USD)</label>
          <input id={field("cap")} name="sponsorCapUsd" type="number" className="runway-input" required
            min={0.01} max={defaults.maxSponsorCapUsd} step={0.01} defaultValue={defaults.sponsorCapUsd}
            aria-describedby={field("cap-hint")} />
          <p id={field("cap-hint")} className="mt-2 text-xs text-runway-mute">
            Blueprint-paid compute ceiling for this run; the site and team pay nothing. Up to ${defaults.maxSponsorCapUsd}.
          </p>
        </div>
        <div>
          <label className="runway-label" htmlFor={field("expires")}>Approval expires</label>
          <input id={field("expires")} name="expiresAt" type="datetime-local" className="runway-input" required
            defaultValue={defaultExpiry(defaults)} aria-describedby={field("expires-hint")} />
          <p id={field("expires-hint")} className="mt-2 text-xs text-runway-mute">
            Must fall within {ttlHours} hours of now.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="runway-meta">Max attempts</dt><dd className="runway-num mt-1 text-runway-text">{defaults.maxAttempts}</dd></div>
          <div><dt className="runway-meta">Evidence scope</dt><dd className="mt-1 text-runway-text">{defaults.evidenceScope}</dd></div>
        </dl>
      </div>
      {error ? <p role="alert" className="text-sm text-runway-red">{error}</p> : null}
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Admitting…" : "Admit free evaluation"}</Button>
      </div>
    </form>
  );
}
