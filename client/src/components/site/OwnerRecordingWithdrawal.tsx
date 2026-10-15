/**
 * Withdrawing recording permission from the private owner link.
 *
 * A site that never made an account holds only this link, so withdrawal has to
 * be reachable here, not only from the account workspace. The server performs
 * the same withdrawal either way (recordWebsiteCaptureWithdrawal). This panel
 * says only what that does: Blueprint stops further processing and use of the
 * recording, uploads are refused, the job pauses, queued evaluations are asked
 * to cancel, and robot teams can no longer see the job. Withdrawal is not
 * deletion: the raw capture is retained under the Pipeline's retention policy,
 * as the Privacy Policy describes, so the panel never says it was deleted.
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

const RETAINED = (
  <>Withdrawal is not deletion: a copy of the recording and any results already produced are retained, and handled
    as our <a href="/privacy">Privacy Policy</a> describes.</>
);

export function WithdrawalStatusMessage({ status }: { status: OwnerWithdrawalStatus }) {
  const requested = formatDate(status.requestedAtIso);
  return (
    <div role="status">
      <p><strong>Recording permission withdrawn.</strong></p>
      <p className="ms-field-hint">
        {requested ? `Withdrawn on ${requested}. ` : ""}Blueprint stops further processing and use of this recording: new uploads are refused,
        this job is paused, queued evaluations were asked to cancel and robot teams can no longer see the job.{" "}
        {status.pipelineAcknowledged
          ? "Our processing system has confirmed it will no longer process or serve the recording."
          : "Our processing system is being told to stop; this page updates when it confirms."}
      </p>
      <p className="ms-field-hint">{RETAINED}</p>
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
    if (!status || status.pipelineAcknowledged) return;
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
            Withdrawing stops Blueprint's further processing and use of this recording: new uploads are refused, this job
            is paused, queued evaluations are asked to cancel and robot teams can no longer see the job. {RETAINED}
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
                This cannot be undone from this page. Uploads stop now and Blueprint stops processing and using this
                recording. To add footage later, you would need to start a new job.
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
