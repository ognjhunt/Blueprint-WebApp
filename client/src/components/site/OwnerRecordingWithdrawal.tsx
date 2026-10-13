/**
 * Withdrawing recording permission from the private owner link.
 *
 * A site that never made an account holds only this link, so withdrawal has to
 * be reachable here, not only from the account workspace. The server performs
 * the same withdrawal either way. This panel says only what the server has
 * recorded: uploads stop at once; stored footage is deleted by a background
 * worker, and the panel says it is deleted only once the server confirms it.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { withCsrfHeader } from "@/lib/csrf";

export const OWNER_WITHDRAWAL_CONFIRMATION = "withdraw_recording_permission";

export type OwnerWithdrawalStatus = {
  state: string;
  requestedAtIso: string | null;
  pipelineAcknowledged: boolean;
  deletionConfirmed: boolean;
  legalHold: boolean;
  storageDeletion: {
    state: "pending" | "retrying" | "deleted" | "deleted_late_upload_check_pending";
    deletedObjectCount: number;
    lateUploadCheckAtIso: string | null;
    completedAtIso: string | null;
  };
};

const POLL_MS = 60_000;

function formatDate(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function WithdrawalStatusMessage({ status }: { status: OwnerWithdrawalStatus }) {
  if (status.deletionConfirmed) {
    return (
      <div role="status">
        <p><strong>Recording permission withdrawn. Your stored footage has been deleted.</strong></p>
        <p className="ms-field-hint">
          Deletion was confirmed{formatDate(status.storageDeletion.completedAtIso) ? ` on ${formatDate(status.storageDeletion.completedAtIso)}` : ""}.
          Results already produced may be retained as described in our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    );
  }
  const detail = status.legalHold
    ? "Deletion is on hold because some records must be kept for a legal reason. We will tell you what we kept and why."
    : status.storageDeletion.state === "deleted_late_upload_check_pending"
      ? `Stored footage has been removed. A final check for app uploads that were already under way runs${formatDate(status.storageDeletion.lateUploadCheckAtIso) ? ` on ${formatDate(status.storageDeletion.lateUploadCheckAtIso)}` : " within a week"}; we confirm deletion after it.`
      : status.storageDeletion.state === "deleted"
        ? "Stored footage has been removed. We confirm deletion once our processing system acknowledges the withdrawal."
        : "This page will show when deletion is confirmed.";
  return (
    <div role="status">
      <p><strong>Uploads stopped. Deletion of stored footage is in progress.</strong></p>
      <p className="ms-field-hint">This job is paused and queued evaluations have been asked to cancel. {detail}</p>
    </div>
  );
}

export function OwnerRecordingWithdrawal({ token, onWithdrawn }: { token: string; onWithdrawn?: () => void }) {
  const [status, setStatus] = useState<OwnerWithdrawalStatus | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const endpoint = `/api/self-capture/uploads/${encodeURIComponent(token)}/withdrawal`;

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.withdrawn === true && data.withdrawal) setStatus(data.withdrawal as OwnerWithdrawalStatus);
    } catch {
      // Status stays as last known; nothing is claimed from a failed read.
    }
  }, [endpoint]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!status || status.deletionConfirmed) return;
    const timer = setInterval(() => { void refresh(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [status, refresh]);
  useEffect(() => { if (confirming) confirmButton.current?.focus(); }, [confirming]);

  async function withdraw() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({ confirm: OWNER_WITHDRAWAL_CONFIRMATION }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.withdrawal) throw new Error(data?.error || "We could not record your withdrawal. Nothing changed. Try again shortly.");
      setStatus(data.withdrawal as OwnerWithdrawalStatus);
      setConfirming(false);
      onWithdrawn?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not record your withdrawal. Nothing changed. Try again shortly.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-label="Recording permission" style={{ marginTop: "28px" }}>
      {status ? <WithdrawalStatusMessage status={status} /> : (
        <details className="ms-task-interest">
          <summary>Withdraw recording permission</summary>
          <p>
            Withdrawing stops new uploads for this job, pauses it, and asks for any queued evaluations to be cancelled.
            Blueprint then deletes the footage stored for this job. Results already produced may be retained as described in our <a href="/terms">Terms</a>.
          </p>
          {!confirming && (
            <button type="button" className="ms-button" onClick={() => { setError(null); setConfirming(true); }}>
              Withdraw permission…
            </button>
          )}
          {confirming && (
            <div role="alertdialog" aria-modal="false" aria-labelledby="withdraw-confirm-title" aria-describedby="withdraw-confirm-body">
              <h3 id="withdraw-confirm-title">Withdraw recording permission?</h3>
              <p id="withdraw-confirm-body">
                This cannot be undone from this page. Uploads stop now and stored footage for this job will be deleted.
                To add footage later, you would need to start a new job.
              </p>
              <button ref={confirmButton} type="button" className="ms-button" disabled={submitting} onClick={() => void withdraw()}>
                {submitting ? "Withdrawing…" : "Yes, withdraw permission"}
              </button>{" "}
              <button type="button" disabled={submitting} onClick={() => setConfirming(false)}
                style={{ minHeight: "44px", padding: "12px 23px", background: "transparent", color: "inherit",
                  border: "1px solid currentColor", borderRadius: "3px", fontSize: "14px" }}>
                Keep permission
              </button>
            </div>
          )}
          {error && <p role="alert">{error}</p>}
        </details>
      )}
    </section>
  );
}
