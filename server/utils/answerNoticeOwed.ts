/**
 * The owed answer emails kept on a job (review, 2026-11-11): pure helpers with no other dependency, so every code
 * that records an ending can write the entry inside its own transaction.
 */
import { createHash } from "node:crypto";

/**
 * Where an ending's answer email is owed until its row exists: one entry per email, under a digest of its key. Written
 * beside the ending, in the same transaction, by the code that records it, so a crash or a failed queue never loses it.
 * The outbox pump's reconcile (`reconcileWaitingAnswerNotices`) takes the jobs whose next try is due, earliest first;
 * an entry that cannot go now is tried again later (with a growing back-off), so it never blocks the others, and every
 * entry reaches a final outcome within `OWED_LIMIT_MS`: its row exists, it is settled (no longer due), or it is closed
 * with a typed reason and an alert. It also holds an email while the video is still being read (at most 24 hours).
 */
export const ANSWER_NOTICES_WAITING_FIELD = "answer_notices_waiting";
export const ANSWER_NOTICES_WAITING_PENDING_FIELD = "answer_notices_waiting_pending";
/** When the job's earliest owed entry is next due, in ms; 0 when none. The reconcile reads jobs in this order. */
export const ANSWER_NOTICES_WAITING_SINCE_FIELD = "answer_notices_next_ms";
/** Entries closed without a row, each with its typed reason, for ops. */
export const ANSWER_NOTICES_CLOSED_FIELD = "answer_notices_closed";
/** How long an ending's email waits for the video's reading before it says there is no paper check. */
export const READING_WAIT_LIMIT_MS = 24 * 60 * 60 * 1000;
/** Every owed entry reaches a final outcome within this: past it, one still not sent is closed with an alert. */
export const OWED_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
/** The back-off before an entry that could not go is tried again: doubling from 5 minutes, at most 6 hours. */
export const owedRetryDelayMs = (attempts: number) => Math.min(5 * 60 * 1000 * 2 ** Math.max(0, attempts - 1), 6 * 60 * 60 * 1000);
/** The plain parameters of a lifecycle notice (`enqueueTaskLifecycleNotification`), as stored while it is owed. */
export type WaitingNoticeParams = { requestId: string; milestone: string; eventId?: string; [field: string]: unknown };
export type WaitingEntry = { params: WaitingNoticeParams; since_iso: string; next_ms: number; attempts: number };
export const noticeKeyOf = (params: Pick<WaitingNoticeParams, "requestId" | "milestone" | "eventId">) => {
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
  const due = Object.values(map).map(entry => Number(entry?.next_ms)).filter(Number.isFinite);
  return { [ANSWER_NOTICES_WAITING_FIELD]: map, [ANSWER_NOTICES_WAITING_PENDING_FIELD]: due.length > 0,
    [ANSWER_NOTICES_WAITING_SINCE_FIELD]: due.length ? Math.max(1, Math.min(...due)) : 0 };
};
/**
 * The fields that keep an answer email owed: its parameters (plain values only), when it started waiting (kept from
 * the first time) and when it is next due. `record` must be the job as read in the same transaction as the write, so
 * no other entry is dropped.
 */
export function waitingAnswerNoticeFields(params: WaitingNoticeParams, nowIso: string, record?: Record<string, any>): Record<string, unknown> {
  const { siteAnswer: _answer, simulationProof: _proof, outlook: _outlook, ...plain } = params;
  const slot = noticeSlotId(noticeKeyOf(params));
  const existing = waitingMap(record)[slot];
  return mapFields({ ...waitingMap(record), [slot]: { params: JSON.parse(JSON.stringify(plain)),
    since_iso: existing?.since_iso ?? nowIso, next_ms: Number.isFinite(existing?.next_ms) ? existing!.next_ms : Date.parse(nowIso),
    attempts: Number.isFinite(existing?.attempts) ? existing!.attempts : 0 } });
}
