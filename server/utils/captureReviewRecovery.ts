import { randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { decryptFieldValue } from "./field-encryption";
import { draftBrief, getBrief, saveBrief } from "./siteTaskBrief";
import { readBriefFromDescription } from "./siteTaskBriefReading";
import { isSiteTaskBriefReadingEnabled } from "../config/env";

const MAX_ATTEMPTS = 3;
const LEASE_MS = 30 * 60 * 1000;
type Kind = "brief";
const workKey = (kind: Kind) => `${kind}ReviewWork`;
const pendingKey = (kind: Kind) => `${kind}ReviewPending`;

/** Every claim consumes one persisted attempt, including a process interruption. */
export async function recoverCaptureReviews({ limit = 25 }: { limit?: number } = {}) {
  const summary = { processedCount: 0, failedCount: 0 };
  if (!db) return summary;
  for (const kind of ["brief"] as const) {
    const rows = await db.collection("inboundRequests").where(pendingKey(kind), "==", true)
      .limit(Math.max(1, Math.min(limit, 100))).get();
    for (const doc of rows.docs) {
      const token = randomUUID();
      const claimed = await db.runTransaction(async transaction => {
        const record = (await transaction.get(doc.ref)).data();
        const work = record?.[workKey(kind)] || {};
        if (!record?.[pendingKey(kind)] || Number(work.dueAtMs || 0) > Date.now()) return null;
        if (Number(work.attempts || 0) >= MAX_ATTEMPTS) {
          transaction.set(doc.ref, { [pendingKey(kind)]: false,
            [workKey(kind)]: { ...work, state: "needs_review", lastError: "attempt_budget_exhausted" } }, { merge: true });
          return null;
        }
        transaction.set(doc.ref, { [workKey(kind)]: { ...work, token, state: "processing",
          attempts: Number(work.attempts || 0) + 1, dueAtMs: Date.now() + LEASE_MS } }, { merge: true });
        return { record, work };
      });
      if (!claimed) continue;
      let completed = false, errorCode = "review_unavailable";
      try {
        const request = claimed.record.request;
        const taskStatement = await decryptFieldValue(request.taskStatement);
        if (!(await getBrief(doc.id))) await saveBrief(draftBrief({ requestId: doc.id,
          summary: taskStatement, captureMode: request.capture_mode, proposed: [] }));
        completed = !isSiteTaskBriefReadingEnabled() || await readBriefFromDescription({ requestId: doc.id,
          taskStatement, captureMode: request.capture_mode,
          whatGoesWrong: request.whatGoesWrong ? await decryptFieldValue(request.whatGoesWrong) : null });
      } catch { errorCode = "review_failed"; }
      await db.runTransaction(async transaction => {
        const record = (await transaction.get(doc.ref)).data();
        const work = record?.[workKey(kind)];
        if (work?.token !== token) return;
        const blocked = work.attempts >= MAX_ATTEMPTS;
        transaction.set(doc.ref, { [pendingKey(kind)]: !completed && !blocked,
          [workKey(kind)]: { ...work, state: completed ? "completed" : blocked ? "needs_review" : "pending",
            dueAtMs: Date.now() + 5 * 60 * 1000, lastError: completed ? null : errorCode } }, { merge: true });
      });
      if (completed) summary.processedCount++; else summary.failedCount++;
    }
  }
  return summary;
}
