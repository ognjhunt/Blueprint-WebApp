import { createHash } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import { projectEvaluationReadyRun, type EvaluationReadyRunRecord } from "./evaluationReadyRunContract";
import { operatorPolicyCanaryRegistrationSchema } from "./operatorPolicyCanaryRegistration";
import { taskEvaluationPolicyRunAccessAllowed, type PolicyRunActor } from "./taskEvaluationPolicyRunAccess";
import { TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID } from "./taskEvaluationLaunchSubmissionAuth";

/** Legacy registrations have no result-ID index: keep the private lookup bounded. */
export async function readTaskEvaluationPendingResult(db: Firestore, recordId: string, actor: PolicyRunActor) {
  if (!actor.uid || !/^capture-run-[0-9a-f]{32}$/.test(recordId)) return null;
  // A malformed existing publication must never be disguised as pending.
  if ((await db.collection("captureTaskEvaluationRuns").doc(recordId).get()).exists) return null;
  const collection = db.collection("taskEvaluationPolicyRuns");
  const query = actor.isOps
    ? collection.where("submission_channel", "==", "production_webapp_operator_registration")
    : actor.tenantId ? collection.where("team_namespace", "==", actor.tenantId)
      : collection.where("owner_user_id", "==", actor.uid);
  const snapshot = await query.limit(250).get();
  for (const document of snapshot.docs) {
    const run = document.data() as EvaluationReadyRunRecord;
    if (!taskEvaluationPolicyRunAccessAllowed(run, actor)) continue;
    const parsed = operatorPolicyCanaryRegistrationSchema.safeParse(run.operator_registration);
    if (!parsed.success) continue;
    const registration = parsed.data;
    const expectedId = `capture-run-${createHash("sha256")
      .update(`${registration.capture_session_id}\0${registration.run_id}`).digest("hex").slice(0, 32)}`;
    if (expectedId !== recordId || document.id !== registration.run_id || run.run_id !== registration.run_id
      || run.owner_user_id !== TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID
      || run.submission_channel !== "production_webapp_operator_registration"
      || run.run_kind !== registration.run_kind || run.claim_ceiling !== registration.claim_ceiling
      || run.team_namespace !== registration.team_namespace || run.source_launch_id !== registration.source_launch_id
      || run.request_digest !== registration.request_digest || run.configuration_digest !== registration.configuration_digest
      || run.task_success_contract_digest !== registration.task_success_contract.contract_digest
      || run.result_record_id || run.phase === "published") continue;
    const progress = projectEvaluationReadyRun(run);
    return {
      schema_version: "task_evaluation_result_pending.v1" as const,
      record_id: recordId,
      status: "publication_pending" as const,
      run: {
        run_id: run.run_id, run_kind: registration.run_kind, claim_ceiling: registration.claim_ceiling,
        state: progress.state, phase: progress.phase, terminal: progress.terminal,
        progress: progress.progress, error: progress.error, updated_at_iso: progress.updated_at_iso,
        href: `/app/evaluation-runs/${encodeURIComponent(run.run_id)}`,
      },
    };
  }
  return null;
}
