import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { isSiteEvaluation } from "./agentRunRecord";
import { enqueueTaskLifecycleNotification } from "./taskLifecycleNotifications";
import { notifyTeamOfRunOutcome } from "./robotTeamNotifications";

/** Intent is written with the result/terminal state; outbox IDs deduplicate retries. */
export async function reconcileAgentRunNotifications(limit = 50): Promise<void> {
  if (!db) return;
  const snapshot = await db.collection("evaluationRuns").where("notificationPending", "==", true)
    .limit(Math.max(1, Math.min(limit, 100))).get();
  for (const doc of snapshot.docs) {
    try {
      const run = doc.data();
      const intent = run.notificationIntent;
      if (!intent || !["result", "no_result"].includes(intent.kind)) continue;
      if (isSiteEvaluation(run)) {
        const site = await enqueueTaskLifecycleNotification({
          requestId: run.sceneId, eventId: run.runId,
          milestone: intent.kind === "result" ? "results_ready" : "run_no_result",
          ...(intent.kind === "result" ? { detail: `${intent.episodesSucceeded} of ${intent.episodesRun} simulated episodes succeeded` } : {}),
        });
        if (!site.enqueued) continue;
      }
      const team = await notifyTeamOfRunOutcome({ teamId: run.teamId, runId: run.runId,
        outcome: intent.kind === "result"
          ? { kind: "result", episodesSucceeded: intent.episodesSucceeded, episodesRun: intent.episodesRun }
          : { kind: "no_result" },
      });
      if (!team.enqueued) continue;
      await db.runTransaction(async transaction => {
        const current = await transaction.get(doc.ref);
        if (JSON.stringify(current.data()?.notificationIntent) !== JSON.stringify(intent)) return;
        transaction.set(doc.ref, { notificationPending: false }, { merge: true });
      });
    } catch (error) {
      logger.warn({ error, runId: doc.id }, "Run notification intent remains pending");
    }
  }
}
