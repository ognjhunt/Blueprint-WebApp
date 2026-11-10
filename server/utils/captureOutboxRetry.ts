/**
 * When a capture-outbox email may be sent again, and when it may not.
 *
 * No I/O here: the pump (captureOutbox.ts), the monitor (betaOpsMonitor.ts)
 * and the admin status of a notice all read the same rules.
 *
 * Every send carries a provider idempotency key derived from the outbox
 * document id. Resend keeps a key for 24 hours and answers a repeat of the
 * same request with its first answer instead of sending again
 * (https://resend.com/docs/dashboard/emails/idempotency-keys, read
 * 2026-11-10). So a row whose outcome is unknown can be sent again with the
 * same key while that window is certainly still open, and never after it.
 */
import { createHash } from "node:crypto";

/** How long Resend keeps an idempotency key (documented; see above). */
export const PROVIDER_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;
/**
 * An unknown outcome is re-sent only within this long of the first dispatch
 * that carried the key: the provider's window less one hour for clock
 * difference and a request still in flight.
 */
export const RESEND_WINDOW_MS = PROVIDER_IDEMPOTENCY_WINDOW_MS - 60 * 60 * 1000;
/**
 * A row that was refused every time (nothing sent) stops being retried once it
 * is this old, fails and alerts. A Resend daily-quota lockout ends at midnight
 * UTC, so it lasts under 24 hours; 36 leaves several attempts after it.
 */
export const MAX_UNDELIVERED_AGE_MS = 36 * 60 * 60 * 1000;

const FIRST_RETRY_MS = 60 * 1000;
const LONGEST_RETRY_MS = 60 * 60 * 1000;

/** The key Resend sees: fixed per outbox document, header-safe and under 256 characters. */
export function providerIdempotencyKey(outboxId: string): string {
  return `capture-outbox/${createHash("sha256").update(outboxId).digest("hex")}`;
}

/**
 * Wait before try number `failures + 1`: 1, 2, 4 ... 60 minutes, each
 * shortened by up to half at random so rows refused together do not all
 * return together.
 */
export function retryDelayMs(failures: number, random: () => number = Math.random): number {
  const step = Math.min(LONGEST_RETRY_MS, FIRST_RETRY_MS * 2 ** Math.max(0, Math.min(failures, 16) - 1));
  return Math.round(step / 2 + random() * (step / 2));
}

/** The fields these rules read. A typed outbox entry and a raw stored document both fit. */
type Row = { status?: unknown; attempts?: unknown; createdAtIso?: unknown; nextAttemptAtMs?: unknown;
  deliveryRetryEnded?: unknown; deliveryKeyFirstUsedAtMs?: unknown; deliveryKeyAttempt?: unknown } | undefined;

/** Whether the row's next automatic try is due. A row with no time recorded is due now. */
export function attemptIsDue(row: Row, nowMs: number): boolean {
  return !(typeof row?.nextAttemptAtMs === "number" && row.nextAttemptAtMs > nowMs);
}

/** Age since the intent was written. A row with no readable time counts as past every bound. */
export function undeliveredAgeMs(row: Row, nowMs: number): number {
  const created = Date.parse(String(row?.createdAtIso || ""));
  return Number.isFinite(created) ? Math.max(0, nowMs - created) : Number.POSITIVE_INFINITY;
}

/**
 * What a row in `unknown` is owed.
 *
 * - retrying: its last dispatch carried the key and the window is open, so the
 *   pump sends it again with the same key.
 * - window_closed: the same, but the window has closed. Not sent again.
 * - needs_person: automatic sending has ended, or the last dispatch carried
 *   no key (every row that was `unknown` before keys existed). Not sent again.
 */
export function unknownRowState(row: Row, nowMs: number): "retrying" | "window_closed" | "needs_person" {
  if (!row || row.deliveryRetryEnded) return "needs_person";
  const first = row.deliveryKeyFirstUsedAtMs;
  if (typeof first !== "number" || typeof row.attempts !== "number" || row.deliveryKeyAttempt !== row.attempts) return "needs_person";
  return nowMs < first + RESEND_WINDOW_MS ? "retrying" : "window_closed";
}

/** Whether the pump still owes this row an automatic delivery. */
export function rowAwaitsDelivery(row: Row, nowMs: number): boolean {
  const status = row?.status;
  return status === "pending" || status === "claimed" || status === "dispatching"
    || (status === "unknown" && unknownRowState(row, nowMs) === "retrying");
}
