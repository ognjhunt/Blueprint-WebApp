import { createHash } from "node:crypto";
import { crossRuntimeArtifactDigest, crossRuntimeDigest } from "../../utils/crossRuntimeCanonical";

export function evaluationOwnerFixture(sourceLaunchId: string, revisionDigest: string, taskId: string,
  setupDigest = `sha256:${"c".repeat(64)}`) {
  const submission = "team-eval-browser-request";
  const request = { submission_id: submission,
    owner: { user_id: "buyer-1", organization_id: "user:buyer-1" },
    task: { task_id: taskId, evaluation_source: { evaluation_run_id: submission,
      source_launch_id: sourceLaunchId, configured_scene_revision_digest: revisionDigest } } };
  const requestDigest = crossRuntimeDigest(request);
  const receipt: Record<string, any> = { schema_version: "task_evaluation_scene_intake_receipt.v1",
    status: "accepted", intent_id: "scene-owned-evaluation", intent_digest: `sha256:${"a".repeat(64)}`,
    request_digest: requestDigest };
  receipt.receipt_digest = crossRuntimeArtifactDigest(receipt, "receipt_digest");
  const scope = createHash("sha256").update(`${sourceLaunchId}\0${submission}`).digest("hex").slice(0, 32);
  return { id: receipt.intent_id, setupDigest,
    runId: `team-eval-${scope}-policy-canary-${setupDigest.slice(7, 19)}`,
    record: { source_launch_id: sourceLaunchId, owner_user_id: "buyer-1", organization_id: "user:buyer-1",
      request, request_digest: requestDigest, receipt } };
}
