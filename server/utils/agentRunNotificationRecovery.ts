import { resultNotificationIntent, reconcileAgentRunResultNotifications } from "./agentRunResultNotifications";
import { automationBatch } from "./automationBatch";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { isSiteEvaluation } from "./agentRunRecord";
import { enqueueTaskLifecycleNotification, notifyIfNoTeamPassed } from "./taskLifecycleNotifications";
import { notifyTeamOfRunOutcome } from "./robotTeamNotifications";
import { CAPTURE_OUTBOX_COLLECTION } from "./captureOutbox";

/** Intent is written with the result/terminal state; outbox IDs deduplicate retries. */
export async function reconcileAgentRunNotifications(limit = 50): Promise<void> {
  if (!db) return;
  const snapshot = await automationBatch(db, db.collection("evaluationRuns").where("notificationPending", "==", true), "legacy_run_notifications", limit);
  for (const doc of snapshot.docs) {
    try {
      const run = doc.data();
      const intent = run.notificationIntent;
      if (!intent || !["result", "no_result"].includes(intent.kind)) continue;
      if (intent.kind === "result" || run.result) {
        // Only retained result evidence can authorize a result notice. Adopt the
        // canonical intent atomically; existing outbox IDs retain send/unknown state.
        await db.runTransaction(async transaction => {
          const current = (await transaction.get(doc.ref)).data();
          if (!current?.result || !current.notificationPending) return;
          transaction.set(doc.ref, { notificationPending: false,
            ...(!current.result_notification_intent ? {
              result_notification_intent: resultNotificationIntent(current as never, current.result),
              result_notification_pending: true,
            } : {}),
          }, { merge: true });
        });
        continue;
      }
      const progress = { episodesRun: run.episodesRun, executionProgress: run.executionProgress };
      if (isSiteEvaluation(run)) {
        const site = await enqueueTaskLifecycleNotification({
          requestId: run.sceneId, eventId: run.runId,
          milestone: "run_no_result",
          runProgress: progress,
        });
        if (!site.enqueued && site.reason) continue;
        try { await notifyIfNoTeamPassed(run.sceneId, run.runId); } catch { /* best-effort */ }
      }
      const team = await notifyTeamOfRunOutcome({ teamId: run.teamId, runId: run.runId,
        outcome: { kind: "no_result", progress },
      });
      if (!team.enqueued && team.reason) continue;
      const eventId = String(run.runId).replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
      const expectedRows = [{ key: `team:${run.teamId}:no_result:${eventId}`, kind: "team_run_no_result", requestId: `team:${run.teamId}` },
        ...(isSiteEvaluation(run) ? [{ key: `${run.sceneId}:run_no_result:${eventId}`, kind: "run_no_result", requestId: run.sceneId }] : [])];
      await db.runTransaction(async transaction => {
        const current = await transaction.get(doc.ref);
        const outbox = await Promise.all(expectedRows.map(row => transaction.get(db!.collection(CAPTURE_OUTBOX_COLLECTION).doc(row.key))));
        if (JSON.stringify(current.data()?.notificationIntent) !== JSON.stringify(intent)) return;
        if (!outbox.every((row, index) => row.exists && row.data()?.kind === expectedRows[index].kind
          && row.data()?.requestId === expectedRows[index].requestId && row.data()?.idempotencyKey === expectedRows[index].key)) return;
        transaction.set(doc.ref, { notificationPending: false }, { merge: true });
      });
    } catch (error) {
      logger.warn({ error, runId: doc.id }, "Run notification intent remains pending");
    }
  }
  await reconcileAgentRunResultNotifications(limit);
}
