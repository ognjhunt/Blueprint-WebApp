import { createHash } from "node:crypto";

import { Router, type Request, type Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { parseVerifiedTaskEvaluationRunPublication } from "../utils/taskEvaluationRunContract";
import { stableJson } from "../utils/taskCandidateContract";
import { dispatchTransactionalNotification } from "../utils/transactional-notifications";
import { evaluationResultWebsiteUrl } from "../utils/evaluationReadyRunContract";

const router = Router();
const rateLimiter = createPipelineSyncRateLimiter();

function sameScientificIdentity(left: Record<string, any>, right: Record<string, any>) {
  return [
    "capture_session_id",
    "intake_id",
    "run_id",
    "testbed_digest",
    "request_digest",
    "plan_digest",
    "state",
  ].every((field) => left[field] === right[field])
    && left.decision_envelope?.decision_envelope_digest
      === right.decision_envelope?.decision_envelope_digest;
}

function requirePipelineSignature(req: Request, res: Response, next: () => void) {
  const result = verifyPipelineSyncRequest(req);
  if (!result.ok) return res.status(result.status).json({ error: result.message, code: result.code });
  next();
}

router.post("/capture-task-evaluation-runs", rateLimiter, requirePipelineSignature, async (req, res) => {
  if (!db) return res.status(503).json({ error: "Task Evaluation Run store is unavailable" });
  const verified = parseVerifiedTaskEvaluationRunPublication(req.body);
  if (!verified.ok) return res.status(400).json({ error: "Pipeline run publication is invalid", blockers: verified.blockers });
  const publication = verified.publication;
  const sessionRef = db.collection("captureUploadSessions").doc(publication.capture_session_id);
  const recordId = `capture-run-${createHash("sha256").update(`${publication.capture_session_id}\0${publication.run_id}`).digest("hex").slice(0, 32)}`;
  const runRef = db.collection("captureTaskEvaluationRuns").doc(recordId);
  const policyRunRef = publication.schema_version === "task_evaluation_run_publication.v3"
    ? db.collection("taskEvaluationPolicyRuns").doc(publication.run_id)
    : null;
  type Outcome = "created" | "updated" | "replayed" | "not_found" | "intake_mismatch" | "testbed_mismatch" | "policy_run_not_found" | "policy_run_mismatch" | "immutable_conflict";
  let outcome: Outcome;
  try {
    outcome = await db.runTransaction<Outcome>(async (transaction) => {
      const sessionSnapshot = await transaction.get(sessionRef);
      const runSnapshot = await transaction.get(runRef);
      const policyRunSnapshot = policyRunRef ? await transaction.get(policyRunRef) : null;
      if (!sessionSnapshot.exists) return "not_found";
      if (policyRunRef && !policyRunSnapshot?.exists) return "policy_run_not_found";
      const session = sessionSnapshot.data() as Record<string, any>;
      if (session.request?.intake_id !== publication.intake_id) return "intake_mismatch";
      if (session.pipeline_site_task_testbed?.testbed_digest !== publication.testbed_digest) return "testbed_mismatch";
      const organizationId = String(session.organization_id || `user:${session.owner_user_id}`);
      const accessVisibility = session.organization_binding_status === "firebase_tenant_verified"
        ? "organization_members"
        : "owner_only";
      const policyRun = policyRunSnapshot?.data() as Record<string, any> | undefined;
      if (
        publication.schema_version === "task_evaluation_run_publication.v3"
        && (
          policyRun?.source_launch_id !== publication.policy_run_result.source_launch_id
          || policyRun?.offering_digest !== publication.policy_run_result.offering_digest
          || policyRun?.configuration_digest
            !== publication.policy_run_result.configuration_digest
          || policyRun?.team_namespace !== organizationId
        )
      ) return "policy_run_mismatch";
      const now = new Date().toISOString();
      const record = {
        schema_version: "capture_task_evaluation_run_record.v2",
        record_id: recordId,
        owner_user_id: String(session.owner_user_id || ""),
        organization_id: organizationId,
        access_visibility: accessVisibility,
        created_at_iso: runSnapshot.exists
          ? String((runSnapshot.data() as Record<string, any>)?.created_at_iso || now)
          : now,
        updated_at_iso: now,
        publication,
      };
      let recordOutcome: "created" | "updated" | "replayed" = "created";
      if (runSnapshot.exists) {
        const existing = runSnapshot.data() as Record<string, any>;
        const exactReplay = stableJson(existing.publication) === stableJson(publication);
        if (exactReplay) {
          record.updated_at_iso = String(existing.updated_at_iso || record.created_at_iso);
          recordOutcome = "replayed";
        } else {
          const existingDelivery = existing.publication?.result_delivery;
          const nextDelivery = (publication as Record<string, any>).result_delivery;
          const monotonicEvidenceUpgrade = sameScientificIdentity(existing.publication || {}, publication)
            && (!existingDelivery || existingDelivery.status === "blocked")
            && nextDelivery?.status === "ready";
          if (!monotonicEvidenceUpgrade) return "immutable_conflict";
          recordOutcome = "updated";
        }
      }
      if (recordOutcome === "created") transaction.create(runRef, record);
      if (recordOutcome === "updated") transaction.set(runRef, record);
      transaction.set(sessionRef, {
        pipeline_task_evaluation_run: record,
        pipeline_run_state: publication.state,
        pipeline_run_projection_updated_at_iso: new Date().toISOString(),
      }, { merge: true });
      if (
        policyRunRef
        && publication.schema_version === "task_evaluation_run_publication.v3"
      ) transaction.set(policyRunRef, {
        state: publication.state === "abstained" ? "abstained" : "results_ready",
        phase: "published",
        progress: {
          completed_episodes: publication.policy_run_result.matrix.completed_episode_count,
          total_episodes: publication.policy_run_result.matrix.expected_episode_count,
        },
        result_record_id: recordId,
        policy_run_result: publication.policy_run_result,
        delivery_digest: publication.result_delivery.delivery_digest,
        pipeline_observed_at_iso: now,
        updated_at_iso: now,
      }, { merge: true });
      return recordOutcome;
    });
  } catch {
    return res.status(503).json({ error: "Task Evaluation Run store is unavailable" });
  }
  if (outcome === "not_found") return res.status(404).json({ error: "Capture upload not found" });
  if (outcome === "intake_mismatch") return res.status(409).json({ error: "Capture intake binding mismatch" });
  if (outcome === "testbed_mismatch") return res.status(409).json({ error: "Current testbed digest mismatch" });
  if (outcome === "policy_run_not_found") return res.status(404).json({ error: "Evaluation Ready policy run not found" });
  if (outcome === "policy_run_mismatch") return res.status(409).json({ error: "Evaluation Ready policy-run binding mismatch" });
  if (outcome === "immutable_conflict") return res.status(409).json({ error: "Immutable Task Evaluation Run conflict" });
  res.set("Cache-Control", "no-store");
  const resultDeliveryDigest = (
    publication.schema_version === "task_evaluation_run_publication.v2"
    || publication.schema_version === "task_evaluation_run_publication.v3"
  )
    ? publication.result_delivery.delivery_digest
    : undefined;
  const policyRunProjectionDigest = publication.schema_version
    === "task_evaluation_run_publication.v3"
    ? publication.policy_run_result.projection_digest
    : undefined;
  if (publication.schema_version === "task_evaluation_run_publication.v3" && policyRunRef) {
    const snapshot = await policyRunRef.get();
    const policyRun = snapshot.data() as Record<string, any> | undefined;
    const resultUrl = evaluationResultWebsiteUrl(recordId);
    await dispatchTransactionalNotification({
      eventType: "evaluation_results_ready",
      recipientType: "buyer",
      recipientUserId: String(policyRun?.notification_recipient_user_id || ""),
      subjectId: publication.run_id,
      sourceEventId: String(
        policyRun?.notification_source_event_id || policyRun?.configuration_digest,
      ),
      sourceCollection: "taskEvaluationPolicyRuns",
      sourceDocId: publication.run_id,
      title: "Blueprint evaluation results are ready",
      body: "Your Task Evaluation Run results are ready in Blueprint.",
      emailSubject: "Your Blueprint evaluation results are ready",
      emailText: `Your Task Evaluation Run results are ready: ${resultUrl}`,
      preferenceKey: "account",
      data: {
        run_id: publication.run_id,
        result_record_id: recordId,
        result_url: resultUrl,
      },
    });
  }
  return res.status(outcome === "created" ? 201 : 200).json({
    schema_version: "capture_task_evaluation_run_publication_receipt.v1",
    status: publication.state,
    already_exists: outcome === "replayed",
    capture_session_id: publication.capture_session_id,
    intake_id: publication.intake_id,
    run_id: publication.run_id,
    testbed_digest: publication.testbed_digest,
    request_digest: publication.request_digest,
    plan_digest: publication.plan_digest,
    decision_envelope_digest: publication.decision_envelope.decision_envelope_digest,
    ...(resultDeliveryDigest ? { result_delivery_digest: resultDeliveryDigest } : {}),
    ...(policyRunProjectionDigest ? { policy_run_projection_digest: policyRunProjectionDigest } : {}),
    proof_boundary: publication.proof_boundary,
  });
});

export default router;
