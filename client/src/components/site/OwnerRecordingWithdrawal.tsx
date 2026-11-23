/**
 * Withdrawing recording permission from the private owner link.
 *
 * A site that never made an account holds only this link, so withdrawal has to
 * be reachable here, not only from the account workspace. The server performs
 * the same withdrawal either way (recordWebsiteCaptureWithdrawal). This panel
 * says only what that does: Blueprint stops further processing and use of the
 * recording, uploads are refused, the job leaves every deployment company's view
 * at once, and each company it was sent to is asked to delete any copy it saved
 * (`withdrawalCompanyNotice.ts`). Withdrawal is not
 * deletion: the raw capture is retained under the Pipeline's retention policy,
 * as the Privacy Policy describes, so the panel never says it was deleted.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { withCsrfHeader } from "@/lib/csrf";
import { STOP_USING_VIDEO_LABEL } from "@/lib/jobOutlook";

export const OWNER_WITHDRAWAL_CONFIRMATION = "withdraw_recording_permission";

export type OwnerWithdrawalStatus = {
  state: string;
  descriptionOnly?: boolean;
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

/** A copy a company already saved cannot be taken back: each company the job was sent to is asked to delete it. */
export const WITHDRAWN_COMPANY_COPIES = "Each company it was sent to is asked to delete any copy it saved.";

const RETAINED = (
  <>We keep a copy of the video and any results already made, as our <a href="/privacy">Privacy Policy</a> describes.</>
);

export function WithdrawalStatusMessage({ status }: { status: OwnerWithdrawalStatus }) {
  const requested = formatDate(status.requestedAtIso);
  if (status.descriptionOnly) return <div role="status">
    <p><strong>Job withdrawn.</strong></p>
    <p className="ms-field-hint">{requested ? `Withdrawn on ${requested}. ` : ""}Approved deployment companies can no longer see your job.</p>
  </div>;
  return (
    <div role="status">
      <p><strong>Video withdrawn.</strong></p>
      <p className="ms-field-hint">
        {requested ? `Withdrawn on ${requested}. ` : ""}Your job has left every company's view, and no new uploads are accepted.
        {" "}{WITHDRAWN_COMPANY_COPIES}{" "}
        {status.pipelineAcknowledged
          ? "We have stopped using your video."
          : "We're stopping our use of your video now; this page updates when that's done."}
      </p>
      <p className="ms-field-hint">{RETAINED}</p>
    </div>
  );
}

export function OwnerRecordingWithdrawal({ token, onWithdrawn, onStatus, descriptionOnly = false, summaryLabel = STOP_USING_VIDEO_LABEL }: { token: string; onWithdrawn?: () => void;
  /** The row's words where it sits in a settings list ("Stop using my video"). */
  summaryLabel?: string;
  descriptionOnly?: boolean;
  /** Told when a recorded withdrawal is read back, so the page stops offering footage, edits and sharing. */
  onStatus?: () => void }) {
  const [status, setStatus] = useState<OwnerWithdrawalStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const disclosure = useRef<HTMLDetailsElement>(null);
  // Held in a ref so a new callback each render never re-reads the status.
  const statusSeen = useRef(onStatus);
  statusSeen.current = onStatus;
  const endpoint = `/api/self-capture/uploads/${encodeURIComponent(token)}/withdrawal`;

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.withdrawn === true && data.withdrawal) { setStatus(data.withdrawal as OwnerWithdrawalStatus); statusSeen.current?.(); }
    } catch {
      // Status stays as last known; nothing is claimed from a failed read.
    }
  }, [endpoint]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!status || status.descriptionOnly || status.pipelineAcknowledged) return;
    const timer = setInterval(() => { void refresh(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [status, refresh]);
  useEffect(() => { if (open) confirmButton.current?.focus(); }, [open]);

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
      onWithdrawn?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not record your withdrawal. Nothing changed. Try again shortly.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-label={descriptionOnly || status?.descriptionOnly ? "Job withdrawal" : "Recording permission"} className="owner-withdrawal">
      {status ? <WithdrawalStatusMessage status={status} /> : (
        // Two taps: opening the row asks the one confirming question at once (ledger AL43).
        <details className="ms-task-interest" ref={disclosure}
          onToggle={event => { const opened = (event.currentTarget as HTMLDetailsElement).open; setOpen(opened); if (opened) setError(null); }}>
          <summary>{summaryLabel}</summary>
          {descriptionOnly ? <p>Withdrawing removes your job from the deployment companies' view.</p> : <p>
            We stop using your video and take your job out of every company's view at once. No new uploads are accepted.
            {" "}{WITHDRAWN_COMPANY_COPIES} {RETAINED}
          </p>}
          {open && (
            <div role="alertdialog" aria-modal="false" aria-labelledby="withdraw-confirm-title" aria-describedby="withdraw-confirm-body">
              <h3 id="withdraw-confirm-title">{descriptionOnly ? "Withdraw your job?" : "Stop using your video?"}</h3>
              <p id="withdraw-confirm-body">
                {descriptionOnly ? "Companies stop seeing your job at once. To post it again later, start a new job."
                  : "This cannot be undone from this page. Uploads stop now, and we stop using your video. To send a video later, you would need to start a new job."}
              </p>
              <button ref={confirmButton} type="button" className="ms-button" disabled={submitting} onClick={() => void withdraw()}>
                {submitting ? "Withdrawing…" : descriptionOnly ? "Yes, withdraw job" : "Yes, stop using my video"}
              </button>{" "}
              <button type="button" disabled={submitting} onClick={() => { if (disclosure.current) disclosure.current.open = false; setOpen(false); }}
                style={{ minHeight: "44px", padding: "12px 23px", background: "transparent", color: "inherit",
                  border: "1px solid currentColor", borderRadius: "3px", fontSize: "14px" }}>
                Cancel
              </button>
            </div>
          )}
          {error && <p role="alert">{error}</p>}
        </details>
      )}
    </section>
  );
}
