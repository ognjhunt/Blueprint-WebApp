import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { automationBatch } from "./automationBatch";
import { CAPTURE_OUTBOX_COLLECTION } from "./captureOutbox";
import { enqueueTaskLifecycleNotification } from "./taskLifecycleNotifications";
import { notifyTeamOfRunOutcome } from "./robotTeamNotifications";
import { humanDecisionDigest } from "./human-reply-admission";
import { isSiteEvaluation } from "./agentRunRecord";
import type { EvalRunRecord } from "./agentEvalRuns";
import type { EvalRunResult } from "./agentRunResults";

export function resultNotificationIntent(run: EvalRunRecord, result: EvalRunResult) {
  return { result_digest: humanDecisionDigest(result), run_id: run.runId, scene_id: run.sceneId,
    team_id: run.teamId, notify_site: isSiteEvaluation(run), purpose: "evaluation_result" };
}

/** The result and pending flag are written together; the existing outbox owns delivery. */
export async function reconcileAgentRunResultNotifications(limit = 20): Promise<void> {
  if (!db) return;
  const pending = await automationBatch(db, db.collection("evaluationRuns").where("result_notification_pending", "==", true), "evaluation_result_notifications", limit);
  for (const doc of pending.docs) {
    const run = doc.data() as EvalRunRecord & { result: EvalRunResult; result_notification_intent: ReturnType<typeof resultNotificationIntent> };
    const intent = run.result_notification_intent;
    if (!intent || humanDecisionDigest(intent) !== humanDecisionDigest(resultNotificationIntent(run, run.result))) continue;
    const { episodesSucceeded, episodesRun } = run.result.observed;
    if (intent.notify_site) await enqueueTaskLifecycleNotification({ requestId: intent.scene_id,
      milestone: "results_ready", eventId: intent.run_id,
      detail: `${episodesSucceeded} of ${episodesRun} simulated episodes succeeded` });
    await notifyTeamOfRunOutcome({ teamId: intent.team_id, runId: intent.run_id,
      outcome: { kind: "result", episodesSucceeded, episodesRun } });
    const eventId = intent.run_id.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
    const keys = [`team:${intent.team_id}:result:${eventId}`,
      ...(intent.notify_site ? [`${intent.scene_id}:results_ready:${eventId}`] : [])];
    await db.runTransaction(async tx => {
      const current = await tx.get(doc.ref);
      const outbox = await Promise.all(keys.map(key => tx.get(db!.collection(CAPTURE_OUTBOX_COLLECTION).doc(key))));
      if (humanDecisionDigest(current.data()?.result_notification_intent) !== humanDecisionDigest(intent)
        || !outbox.every(row => row.exists)) return;
      tx.set(doc.ref, { result_notification_pending: false }, { merge: true });
    });
  }
}
