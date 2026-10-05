import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { recordCohortCostReceipt } from "./cohortEconomics";
import type { OpenAIInferenceUsagePacket } from "./openaiInferenceUsageContract";

/** Feed the existing internal cohort ledger from already-authenticated Pipeline publications. */
export async function recordPipelineCohortCosts(launchId: string, packet?: OpenAIInferenceUsagePacket) {
  if (!db) throw new Error("cohort_store_unavailable");
  const launch = (await db.collection("taskEvaluationLaunches").doc(launchId).get()).data();
  const context = launch?.configured_scene_context;
  const sceneId = context?.scene_id || launch?.request?.task_evaluation_run?.scene_id;
  if (!sceneId) {
    const digest = packet?.packet_digest || launch?.request_digest;
    if (!digest) throw new Error("cohort_allocation_source_missing");
    await db.collection("unallocatedCohortCosts").doc(digest.replace(/^sha256:/, "")).set({
      sourceDigest: digest, launchId, runId: packet?.run_id || null,
      state: "allocation_required", settledCostUsd: null,
    });
    return;
  }
  if (packet) {
    for (const call of packet.calls) await recordCohortCostReceipt({
      receiptId: `inference-${call.call_id.replace(/^sha256:/, "")}`, sceneId,
      sourceDigest: call.usage_receipt_digest, sourceUri: `firestore:agentRuns/pipeline-openai-${call.call_id.replace(/^sha256:/, "")}`,
      currency: "USD", allocation: context?.run_mode === "scene_configuration" ? "shared_preparation" : "incremental_policy",
      allocationId: `inference:${call.call_id}`, status: call.estimated_total_cost_usd == null ? "unknown" : "estimated",
      amountUsd: call.estimated_total_cost_usd ?? null,
    });
  } else if (context?.run_mode === "scene_configuration" && launch?.terminal_receipt_digest) {
    await recordCohortCostReceipt({ receiptId: `preparation-${launchId}`, sceneId,
      sourceDigest: launch.request_digest, sourceUri: `firestore:taskEvaluationLaunches/${launchId}`,
      currency: "USD", allocation: "shared_preparation", allocationId: `non_inference:${context.configuration_run_id || launchId}`,
      status: "unknown", amountUsd: null });
  }
}
