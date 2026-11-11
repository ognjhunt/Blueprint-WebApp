/**
 * The owed answer emails kept on a job (review, 2026-11-11): pure helpers with no other dependency, so every code
 * that records an ending can write the entry inside its own transaction.
 */
import { createHash } from "node:crypto";

/**
 * Where an ending's answer email is owed until it is queued: one entry per email, under a digest of its key. Written
 * beside the ending, in the same transaction, by the code that records it, so a crash or a failed queue never loses it;
 * the outbox pump's reconcile (`reconcileWaitingAnswerNotices`) queues every entry, oldest first, by the key the
 * recorder would have used. It also holds an email while the video is still being read (at most 24 hours).
 */
export const ANSWER_NOTICES_WAITING_FIELD = "answer_notices_waiting";
export const ANSWER_NOTICES_WAITING_PENDING_FIELD = "answer_notices_waiting_pending";
/** The oldest entry's start, in ms; 0 when none. The reconcile reads entries in this order. */
export const ANSWER_NOTICES_WAITING_SINCE_FIELD = "answer_notices_waiting_since_ms";
/** How long an ending's email waits for the video's reading before it says there is no paper check. */
export const READING_WAIT_LIMIT_MS = 24 * 60 * 60 * 1000;
/** The plain parameters of a lifecycle notice (`enqueueTaskLifecycleNotification`), as stored while it is owed. */
export type WaitingNoticeParams = { requestId: string; milestone: string; eventId?: string; [field: string]: unknown };
export type WaitingEntry = { params: WaitingNoticeParams; since_iso: string };
const noticeKeyOf = (params: Pick<WaitingNoticeParams, "requestId" | "milestone" | "eventId">) => {
  const eventId = params.eventId?.trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  return `${params.requestId.trim()}:${params.milestone}${eventId ? `:${eventId}` : ""}`;
};
const noticeSlotId = (key: string) => createHash("sha256").update(key).digest("hex").slice(0, 32);
export const waitingMap = (record: Record<string, any> | undefined): Record<string, WaitingEntry> =>
  record?.[ANSWER_NOTICES_WAITING_FIELD] && typeof record[ANSWER_NOTICES_WAITING_FIELD] === "object" ? record[ANSWER_NOTICES_WAITING_FIELD] : {};
export function waitingSinceIso(record: Record<string, any> | undefined, params: WaitingNoticeParams): string | undefined {
  const entry = waitingMap(record)[noticeSlotId(noticeKeyOf(params))];
  return typeof entry?.since_iso === "string" ? entry.since_iso : undefined;
}
export const mapFields = (map: Record<string, WaitingEntry>) => {
  const starts = Object.values(map).map(entry => Date.parse(entry?.since_iso)).filter(Number.isFinite);
  return { [ANSWER_NOTICES_WAITING_FIELD]: map, [ANSWER_NOTICES_WAITING_PENDING_FIELD]: starts.length > 0,
    [ANSWER_NOTICES_WAITING_SINCE_FIELD]: starts.length ? Math.min(...starts) : 0 };
};
/**
 * The fields that keep an answer email owed: its parameters (plain values only) and when it started waiting, kept
 * from the first time. `record` must be the job as read in the same transaction as the write, so no other entry is
 * dropped.
 */
export function waitingAnswerNoticeFields(params: WaitingNoticeParams, nowIso: string, record?: Record<string, any>): Record<string, unknown> {
  const { siteAnswer: _answer, simulationProof: _proof, outlook: _outlook, ...plain } = params;
  const slot = noticeSlotId(noticeKeyOf(params));
  return mapFields({ ...waitingMap(record), [slot]: { params: JSON.parse(JSON.stringify(plain)),
    since_iso: waitingSinceIso(record, params) ?? nowIso } });
}
