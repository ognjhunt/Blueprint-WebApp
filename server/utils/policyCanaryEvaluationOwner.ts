import { createHash } from "node:crypto";
import type { Firestore, Transaction } from "firebase-admin/firestore";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "./crossRuntimeCanonical";

const RUNNER = "blueprint-production-runner";

export function isControllerPolicyRun(record: Record<string, any>) {
  return record.submission_channel === "production_webapp_service_api"
    && record.request?.authorization?.actor?.id === RUNNER
    && record.request?.authorization?.actor?.role === "ops";
}

/** Join the signed controller run to its already accepted browser evaluation.
 * The id locates the request; its stored owner, revision and admission receipt
 * supply the authority. The controller remains the request actor, never owner.
 */
export async function policyCanaryEvaluationOwner(db: Firestore, params: {
  runId: string; sourceLaunchId: string; setupDigest: string; revisionDigest: string; taskId: string;
}, transaction?: Transaction) {
  if (!/^team-eval-[a-f0-9]{32}-policy-canary-[a-f0-9]{12}$/.test(params.runId)) return null;
  const collection = db.collection("taskEvaluationSceneIntakes");
  const candidates = await collection.where("source_launch_id", "==", params.sourceLaunchId).limit(1001).get();
  if (candidates.docs.length > 1000) throw new Error("policy_canary_evaluation_owner_lookup_limit");
  const matchesRun = (record: Record<string, any> | undefined) => {
    const id = record?.request?.submission_id;
    if (typeof id !== "string") return false;
    // Same identity as Pipeline configured_scene_run_identity.scoped_identity.
    const scope = createHash("sha256").update(`${params.sourceLaunchId}\0${id}`).digest("hex").slice(0, 32);
    return params.runId === `team-eval-${scope}-policy-canary-${params.setupDigest.replace(/^sha256:/, "").slice(0, 12)}`;
  };
  const matches = candidates.docs.filter((doc) => matchesRun(doc.data()));
  if (matches.length !== 1) throw new Error("policy_canary_evaluation_owner_not_unique");
  const doc = matches[0];
  const snapshot = transaction ? await transaction.get(collection.doc(doc.id)) : doc;
  const record = snapshot.data();
  const request = record?.request;
  const receipt = record?.receipt;
  const selection = request?.task?.evaluation_source;
  if (!record || !request || !receipt || !selection || !matchesRun(record)
    || record.source_launch_id !== params.sourceLaunchId
    || selection.source_launch_id !== params.sourceLaunchId
    || selection.evaluation_run_id !== request.submission_id
    || selection.configured_scene_revision_digest !== params.revisionDigest
    || request.task.task_id !== params.taskId
    || !request.owner?.user_id || request.owner.user_id === RUNNER
    || record.owner_user_id !== request.owner.user_id
    || record.organization_id !== request.owner.organization_id
    || record.request_digest !== crossRuntimeDigest(request)
    || receipt.schema_version !== "task_evaluation_scene_intake_receipt.v1"
    || receipt.status !== "accepted" || receipt.intent_id !== doc.id
    || !/^sha256:[a-f0-9]{64}$/.test(receipt.intent_digest)
    || receipt.request_digest !== record.request_digest
    || receipt.receipt_digest !== crossRuntimeArtifactDigest(receipt, "receipt_digest")) {
    throw new Error("policy_canary_evaluation_owner_binding_invalid");
  }
  return { owner_user_id: request.owner.user_id as string,
    evaluation_owner_binding: { intake_id: doc.id, intent_digest: receipt.intent_digest,
      request_digest: record.request_digest, evaluation_run_id: request.submission_id } };
}
