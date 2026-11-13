/**
 * When a withdrawn job's stored data may be destroyed. One predicate, used by the object deletion
 * (websiteCaptureDeletion.ts) and by the model-run redaction (websiteJobModelRunRedaction.ts), so the two can never
 * disagree:
 *   - never while a legal hold is set (the Pipeline's acknowledgement carries it);
 *   - otherwise only once the upload targets issued before the withdrawal have expired and the Pipeline has
 *     acknowledged the tombstone, or its acknowledgement timeout has passed;
 *   - always once the object deletion has itself deleted.
 */
/** Mirrors SIGNED_URL_TTL_MS in siteCaptureBundleService.ts. */
export const SIGNED_PUT_TARGET_TTL_MS = 30 * 60 * 1000;
export const CLOCK_MARGIN_MS = 5 * 60 * 1000;
const ACK_RECHECK_MS = 10 * 60 * 1000;

export type WithdrawalDeletionGate =
  | { state: "held" }
  | { state: "waiting"; untilMs: number }
  | { state: "allowed" };

export function withdrawalDeletionGate(withdrawal: Record<string, any>, requestedAtMs: number, now: number,
  ackTimeoutMs: number): WithdrawalDeletionGate {
  if (withdrawal.legalHold === true) return { state: "held" };
  const phase = withdrawal.webappDeletion?.phase;
  if (phase === "deleted" || phase === "awaiting_late_upload_sweep") return { state: "allowed" };
  const targetsExpiredAt = requestedAtMs + SIGNED_PUT_TARGET_TTL_MS + CLOCK_MARGIN_MS;
  const ackDeadline = requestedAtMs + ackTimeoutMs;
  const acknowledged = withdrawal.pipelineAcknowledged === true;
  if (now < targetsExpiredAt || (!acknowledged && now < ackDeadline)) {
    return { state: "waiting",
      untilMs: Math.max(targetsExpiredAt, acknowledged ? 0 : Math.min(ackDeadline, now + ACK_RECHECK_MS)) };
  }
  return { state: "allowed" };
}
