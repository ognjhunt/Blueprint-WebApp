import { randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { decryptFieldValue } from "./field-encryption";
import { draftBrief, getBrief, saveBrief } from "./siteTaskBrief";
import { readBriefFromDescription } from "./siteTaskBriefReading";
import { reviewCaptureCoverage } from "./captureCoverageReview";
import { hasCurrentRecordingConsent } from "./recordingConsent";
import { isSiteTaskBriefReadingEnabled, isSiteVideoEvidenceEnabled } from "../config/env";

const MAX_ATTEMPTS = 3;
const LEASE_MS = 30 * 60 * 1000;
type Kind = "brief" | "coverage";
const workKey = (kind: Kind) => `${kind}ReviewWork`;
const pendingKey = (kind: Kind) => `${kind}ReviewPending`;

/** Called before the completion marker. Retry never resets a source's budget. */
export async function queueCoverageReview(params: { requestId: string; sceneId: string; captureId: string }) {
  if (!db) throw new Error("capture_review_store_unavailable");
  const ref = db.collection("inboundRequests").doc(params.requestId);
  await db.runTransaction(async transaction => {
    const record = (await transaction.get(ref)).data();
    const privacy = record?.capture_privacy_source_bound_decision;
    if (!record || !hasCurrentRecordingConsent(record.request?.consent_attestation)
      || privacy?.proceeded !== true || !privacy.producer_source?.key || privacy.capture_id !== params.captureId)
      throw new Error("capture_review_current_clearance_required");
    if (record.coverageReviewWork?.sourceKey === privacy.producer_source.key) return;
    transaction.set(ref, { coverageReviewPending: true, coverageReviewWork: {
      ...params, sourceKey: privacy.producer_source.key, state: "pending", attempts: 0, dueAtMs: 0,
    } }, { merge: true });
  });
}

/** Every claim consumes one persisted attempt, including a process interruption. */
export async function recoverCaptureReviews({ limit = 25 }: { limit?: number } = {}) {
  const summary = { processedCount: 0, failedCount: 0 };
  if (!db) return summary;
  for (const kind of ["brief", "coverage"] as const) {
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
        // Provider-disabled work waits without consuming retries or initiating spend.
        if (kind === "coverage" && !isSiteVideoEvidenceEnabled()) return null;
        transaction.set(doc.ref, { [workKey(kind)]: { ...work, token, state: "processing",
          attempts: Number(work.attempts || 0) + 1, dueAtMs: Date.now() + LEASE_MS } }, { merge: true });
        return { record, work };
      });
      if (!claimed) continue;
      let completed = false, errorCode = "review_unavailable";
      try {
        if (kind === "brief") {
          const request = claimed.record.request;
          const taskStatement = await decryptFieldValue(request.taskStatement);
          if (!(await getBrief(doc.id))) await saveBrief(draftBrief({ requestId: doc.id,
            summary: taskStatement, captureMode: request.capture_mode, proposed: [] }));
          completed = !isSiteTaskBriefReadingEnabled() || await readBriefFromDescription({ requestId: doc.id,
            taskStatement, captureMode: request.capture_mode,
            whatGoesWrong: request.whatGoesWrong ? await decryptFieldValue(request.whatGoesWrong) : null });
        } else {
          const privacy = claimed.record.capture_privacy_source_bound_decision;
          if (!hasCurrentRecordingConsent(claimed.record.request?.consent_attestation)
              || privacy?.proceeded !== true || privacy.producer_source?.key !== claimed.work.sourceKey) {
            errorCode = "recording_permission_or_source_changed";
          } else {
            completed = Boolean(await reviewCaptureCoverage({ requestId: doc.id,
              sceneId: claimed.work.sceneId, captureId: claimed.work.captureId,
              expectedSourceKey: claimed.work.sourceKey }));
          }
        }
      } catch { errorCode = "review_failed"; }
      await db.runTransaction(async transaction => {
        const record = (await transaction.get(doc.ref)).data();
        const work = record?.[workKey(kind)];
        if (work?.token !== token) return;
        const blocked = work.attempts >= MAX_ATTEMPTS || errorCode === "recording_permission_or_source_changed";
        transaction.set(doc.ref, { [pendingKey(kind)]: !completed && !blocked,
          [workKey(kind)]: { ...work, state: completed ? "completed" : blocked ? "needs_review" : "pending",
            dueAtMs: Date.now() + 5 * 60 * 1000, lastError: completed ? null : errorCode } }, { merge: true });
      });
      if (completed) summary.processedCount++; else summary.failedCount++;
    }
  }
  return summary;
}
