/** Durable communication deadlines. Polling never pushes an overdue promise out. */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { decryptFieldValue } from "./field-encryption";
import { captureUploadUrlFor } from "./captureUploadToken";
import { enqueueOutbox, type OutboxEntry } from "./captureOutbox";

const WINDOW_MS = 48 * 60 * 60 * 1000;
const updateWindow = (decision?: string) => ["received", "footage_received", "screening"].includes(decision ?? "")
  ? 24 * 60 * 60 * 1000 : WINDOW_MS;
export const TASK_STATUS_UPDATES = "taskStatusUpdates";
const validDate = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));

export async function ensureTaskStatusUpdate(requestId: string, decision?: string): Promise<string | null> {
  if (!db) return null;
  const ref = db.collection("inboundRequests").doc(requestId);
  const queue = db.collection(TASK_STATUS_UPDATES).doc(requestId);
  const initial = await ref.get();
  if (!initial.exists) {
    await db.runTransaction(async transaction => {
      if (!(await transaction.get(ref)).exists) transaction.delete(queue);
    });
    return null;
  }
  const record = initial.data()!;
  const to = await decryptFieldValue(record.contact?.email ?? "");
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return null;
  return db.runTransaction(async transaction => {
    const [fresh, scheduled] = await Promise.all([transaction.get(ref), transaction.get(queue)]);
    if (!fresh.exists) return null;
    const data = fresh.data()!;
    // A delivered final assessment clears the commitment through commitTaskUpdate.
    if (data.site_task_last_decision?.kind === "assessment_ready" && data.site_task_next_update_iso === null) {
      if (scheduled.exists) transaction.delete(queue);
      return null;
    }
    const existing = data.site_task_next_update_iso;
    const queued = scheduled.data()?.dueAtIso;
    const intervalMs = decision ? updateWindow(decision) : scheduled.data()?.intervalMs ?? WINDOW_MS;
    const prior = validDate(existing) ? existing : validDate(queued) ? queued : null;
    const dueAtIso = new Date(prior ? Math.min(Date.parse(prior), Date.now() + intervalMs) : Date.now() + intervalMs).toISOString();
    if (existing !== dueAtIso) transaction.set(ref, { site_task_next_update_iso: dueAtIso }, { merge: true });
    if (queued !== dueAtIso || scheduled.data()?.to !== to || scheduled.data()?.intervalMs !== intervalMs) transaction.set(queue, { requestId, to, dueAtIso, dueAtMs: Date.parse(dueAtIso), intervalMs });
    return dueAtIso;
  });
}

/** Called by the existing worker outbox lane, as well as account-free status polls. */
export async function enqueueDueTaskStatusUpdates(limit: number): Promise<void> {
  if (!db) return;
  const due = await db.collection(TASK_STATUS_UPDATES).where("dueAtMs", "<=", Date.now())
    .orderBy("dueAtMs", "asc").limit(limit).get();
  for (const item of due.docs) {
    const queued = item.data();
    const snap = await db.collection("inboundRequests").doc(item.id).get();
    const record = snap.data();
    if (!record || record.site_task_next_update_iso !== queued.dueAtIso) {
      // A newer stage or completed assessment superseded this deadline.
      await ensureTaskStatusUpdate(item.id);
      continue;
    }
    const key = `${item.id}:progress_update:${queued.dueAtMs}`;
    const previous = await db.collection("captureOutbox").doc(key).get();
    if (previous.data()?.status === "sent") {
      await acknowledgeTaskStatusUpdate(previous.data() as OutboxEntry);
      continue;
    }
    await enqueueOutbox({
      idempotencyKey: `${item.id}:progress_update:${queued.dueAtMs}`,
      requestId: item.id, kind: "progress_update", to: queued.to,
      subject: "Your Blueprint task — scheduled update",
      body: `This is your scheduled assessment check-in. Open your task page for the latest footage review, scene and evaluation status:\n\n${captureUploadUrlFor(item.id)}\n\nIf the next step is yours, the page explains what is needed. If it is ours, you do not need to resubmit. Reply here for help. We will check in again within ${Math.round((queued.intervalMs ?? WINDOW_MS) / 3_600_000)} hours while the assessment remains open.`,
      replyTo: "ops@tryblueprint.io",
    });
  }
}

/** Advance only on confirmed delivery. Failed sends remain visibly overdue. */
export async function acknowledgeTaskStatusUpdate(entry: OutboxEntry): Promise<void> {
  if (!db || entry.kind !== "progress_update") return;
  const ref = db.collection("inboundRequests").doc(entry.requestId);
  const queue = db.collection(TASK_STATUS_UPDATES).doc(entry.requestId);
  await db.runTransaction(async transaction => {
    const [snap, scheduled] = await Promise.all([transaction.get(ref), transaction.get(queue)]);
    if (!snap.exists || !scheduled.exists) return;
    const data = scheduled.data()!;
    if (entry.idempotencyKey !== `${entry.requestId}:progress_update:${data.dueAtMs}`
      || snap.data()?.site_task_next_update_iso !== data.dueAtIso) return;
    const dueAtMs = Date.now() + (data.intervalMs ?? WINDOW_MS);
    const dueAtIso = new Date(dueAtMs).toISOString();
    transaction.set(ref, { site_task_next_update_iso: dueAtIso }, { merge: true });
    transaction.set(queue, { ...data, dueAtMs, dueAtIso });
  });
}

export async function taskStatusUpdateIsCurrent(entry: OutboxEntry): Promise<boolean> {
  if (!db || entry.kind !== "progress_update") return true;
  const snap = await db.collection("inboundRequests").doc(entry.requestId).get();
  const deadline = snap.data()?.site_task_next_update_iso;
  return validDate(deadline) && entry.idempotencyKey === `${entry.requestId}:progress_update:${Date.parse(deadline)}`;
}
