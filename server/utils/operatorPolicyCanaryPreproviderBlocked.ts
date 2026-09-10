import { createHash } from "node:crypto";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { operatorPolicyCanaryRegistrationSchema } from "./operatorPolicyCanaryRegistration";
import { crossRuntimeCanonicalJson } from "./crossRuntimeCanonical";
import type { PipelineOperatorPolicyCanaryPreproviderBlocked } from "./policyCanaryWebappSyncContract";
import { TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID } from "./taskEvaluationLaunchSubmissionAuth";

type Rejection = { ok: false; status: number; code: string };
const reject = (status: number, code: string): Rejection => ({ ok: false, status, code });

/** Close only an existing operator registration; never create an activation or delivery. */
export async function persistOperatorPolicyCanaryPreproviderBlocked(
  payload: PipelineOperatorPolicyCanaryPreproviderBlocked,
) {
  if (!db) return reject(503, "operator_policy_canary_store_unavailable");
  const policyRunRef = db.collection("taskEvaluationPolicyRuns").doc(payload.run_id);
  // Share the execution-publication record key so either terminal path prevents
  // a later incompatible terminal record, including concurrent deliveries.
  const recordId = `capture-run-${createHash("sha256")
    .update(`${payload.capture_session_id}\0${payload.run_id}`).digest("hex").slice(0, 32)}`;
  const blockedRef = db.collection("captureTaskEvaluationRuns").doc(recordId);
  try {
    return await db.runTransaction(async (transaction) => {
      const [runSnapshot, blockedSnapshot] = await Promise.all([
        transaction.get(policyRunRef), transaction.get(blockedRef),
      ]);
      if (!runSnapshot.exists) return reject(404, "operator_policy_canary_registration_not_found");
      const run = runSnapshot.data() as Record<string, any>;
      const parsed = operatorPolicyCanaryRegistrationSchema.safeParse(run.operator_registration);
      if (!parsed.success) return reject(409, "operator_policy_canary_registration_invalid");
      const registration = parsed.data;
      const registeredFields = ["run_id", "run_kind", "claim_ceiling", "source_launch_id",
        "setup_digest", "team_namespace", "request_digest", "configuration_digest", "scene_revision_digest"] as const;
      if (run.owner_user_id !== TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID
        || run.submission_channel !== "production_webapp_operator_registration"
        || run.firebase_tenant_id !== null
        || registeredFields.some((field) => run[field] !== registration[field])
        || run.offering_digest !== registration.source_offering_digest
        || run.pipeline_configuration_digest !== registration.configuration_digest
        || run.task_success_contract_digest !== registration.task_success_contract.contract_digest
        || run.notification?.email !== registration.notification.email
        || run.notification_recipient_user_id !== run.owner_user_id
        || run.notification_source_event_id !== registration.registration_digest
        || registration.registration_digest !== payload.operator_registration_digest
        || ["run_id", "capture_session_id", "intake_id", "request_digest", "configuration_digest", "team_namespace"]
          .some((field) => registration[field as keyof typeof registration] !== payload[field as keyof typeof payload])) {
        return reject(409, "operator_policy_canary_registration_binding_mismatch");
      }
      if (run.result_record_id !== null || run.delivery_digest !== null
        || run.policy_run_result_projection
        || run.completed_learned_episode_count !== 0 || run.completed_control_episode_count !== 0
        || run.progress?.completed_episodes !== 0 || run.progress?.total_episodes !== 20) {
        return reject(409, "operator_policy_canary_terminal_conflict");
      }
      if (blockedSnapshot.exists) {
        const prior = blockedSnapshot.data() as Record<string, any>;
        if (run.state !== "blocked" || run.phase !== "pre_provider_blocked"
          || run.stage !== "terminal" || run.result_status !== "blocked"
          || run.provider_allocation_performed !== false || run.retryable !== false
          || run.next_forward_at_iso !== null
          || run.blocked_record_id !== recordId
          || prior.schema_version !== "capture_task_evaluation_operator_policy_canary_preprovider_blocked_record.v1"
          || prior.record_id !== recordId
          || prior.owner_user_id !== run.owner_user_id || prior.organization_id !== registration.team_namespace
          || prior.firebase_tenant_id !== null
          || !run.preprovider_blocked || !prior.preprovider_blocked
          || crossRuntimeCanonicalJson(run.preprovider_blocked) !== crossRuntimeCanonicalJson(payload)
          || crossRuntimeCanonicalJson(prior.preprovider_blocked) !== crossRuntimeCanonicalJson(payload)) {
          return reject(409, "operator_policy_canary_terminal_conflict");
        }
        return { ok: true as const, alreadyExists: true, recordId, policyRun: run, policyRunRef };
      }
      if (run.state !== "running" || run.phase !== "awaiting_operator_results"
        || run.preprovider_blocked || run.blocked_record_id || run.notification_delivery) {
        return reject(409, "operator_policy_canary_terminal_conflict");
      }
      const now = new Date().toISOString();
      transaction.create(blockedRef, {
        schema_version: "capture_task_evaluation_operator_policy_canary_preprovider_blocked_record.v1",
        record_id: recordId,
        owner_user_id: run.owner_user_id,
        organization_id: registration.team_namespace,
        firebase_tenant_id: null,
        access_visibility: registration.team_namespace === `user:${run.owner_user_id}`
          ? "owner_only" : "organization_members",
        created_at_iso: now,
        updated_at_iso: now,
        preprovider_blocked: payload,
      });
      const update = {
        state: "blocked",
        phase: "pre_provider_blocked",
        stage: "terminal",
        result_status: "blocked",
        provider_allocation_performed: false,
        preprovider_blocked: payload,
        blocked_record_id: recordId,
        retryable: false,
        next_forward_at_iso: null,
        error: { code: payload.blockers[0], message: payload.blockers.join(" · ").slice(0, 500) },
        pipeline_observed_at_iso: now,
        updated_at_iso: now,
      };
      transaction.set(policyRunRef, update, { merge: true });
      return { ok: true as const, alreadyExists: false, recordId,
        policyRun: { ...run, ...update }, policyRunRef };
    });
  } catch {
    return reject(503, "operator_policy_canary_store_unavailable");
  }
}
