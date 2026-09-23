/**
 * The retired timed check-in, and the clean-up that retires it.
 *
 * A site used to get a "scheduled update" email every 24 or 48 hours whether
 * or not anything had happened. It was filler standing in for real news. Every
 * real event on a task now sends its own email (`taskLifecycleNotifications`),
 * so nothing is scheduled any more.
 *
 * What remains here removes what the timer left behind: a scheduled deadline
 * on a request, a queued check-in, or a check-in already sitting in the outbox.
 * The function names are the ones callers already use, so every surface that
 * used to schedule a check-in now clears one instead.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { OutboxEntry } from "./captureOutbox";

export const TASK_STATUS_UPDATES = "taskStatusUpdates";

/**
 * Clear any timed check-in for this request. Always returns null: there is no
 * next scheduled update, because updates follow events.
 */
export async function ensureTaskStatusUpdate(requestId: string, _decision?: string): Promise<null> {
  if (!db) return null;
  const ref = db.collection("inboundRequests").doc(requestId);
  const queue = db.collection(TASK_STATUS_UPDATES).doc(requestId);
  const [record, scheduled] = await Promise.all([ref.get(), queue.get()]);
  if (scheduled.exists) await queue.delete();
  if (record.exists && record.data()?.site_task_next_update_iso) {
    await ref.set({ site_task_next_update_iso: null }, { merge: true });
  }
  return null;
}

/** Drain check-ins that were scheduled before the timer was retired, sending none. */
export async function enqueueDueTaskStatusUpdates(limit: number): Promise<void> {
  if (!db) return;
  const due = await db.collection(TASK_STATUS_UPDATES).limit(limit).get();
  for (const item of due.docs) await ensureTaskStatusUpdate(item.id);
}

/** Nothing to advance: no check-in is sent any more. */
export async function acknowledgeTaskStatusUpdate(_entry: OutboxEntry): Promise<void> {}

/** A check-in already queued before retirement is cancelled, never sent. */
export async function taskStatusUpdateIsCurrent(entry: OutboxEntry): Promise<boolean> {
  return entry.kind !== "progress_update";
}
