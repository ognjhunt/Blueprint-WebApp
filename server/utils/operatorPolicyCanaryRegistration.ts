import type { Response } from "express";
import { z } from "zod";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { canonicalArtifactDigest, stableJson } from "./taskCandidateContract";
import { configuredSceneOfferingSchema } from "./configuredSceneOfferingContract";
import { confirmedTaskSuccessContractSchema } from "./articulatedTaskSuccessContract";
import { policyCanaryNotificationRecipientAllowed } from "./internalPolicyCanaryContract";
import type { PipelinePolicyCanaryPublication } from "./policyCanaryWebappSyncContract";
import { TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID } from "./taskEvaluationLaunchSubmissionAuth";
import { projectWebsiteCaptureRights, projectWebsiteTaskContext } from "./websiteTaskContext";
import type { SiteTaskBriefRecord } from "./siteTaskBrief";
import type { TaskItemInventoryRecord } from "./taskItemInventory";

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const candidate = z.object({
  candidate_id: z.enum(["pi05_droid", "groot_n17_droid"]),
  display_name: z.string().trim().min(1).max(120),
  checkpoint_digest: digest,
}).strict();

/** Registration binds an existing operator run. It never queues execution. */
export const operatorPolicyCanaryRegistrationSchema = z.object({
  schema_version: z.literal("task_evaluation_operator_policy_canary_registration.v1"),
  run_kind: z.literal("internal_policy_canary"),
  claim_ceiling: z.literal("diagnostic_policy_execution"),
  run_id: identifier,
  source_launch_id: identifier.optional(),
  source_offering_digest: digest.optional(),
  capture_source: z.object({
    request_id: identifier, scene_id: identifier, capture_id: identifier, task_context_digest: digest,
  }).strict().optional(),
  capture_session_id: identifier,
  intake_id: identifier,
  team_namespace: identifier,
  scene_revision_digest: digest,
  request_digest: digest,
  configuration_digest: digest,
  plan_digest: digest,
  activation_digest: digest,
  runtime_inputs_digest: digest,
  setup_digest: digest,
  source_commit: z.string().regex(/^[0-9a-f]{40}$/),
  operator_authorization_digest: digest,
  control_omission_authority_digest: digest,
  task_success_contract: confirmedTaskSuccessContractSchema,
  policy_candidates: z.tuple([candidate, candidate]),
  notification: z.union([
    z.object({ email: z.string().email().max(254) }).strict(),
    z.object({ mode: z.literal("disabled") }).strict(),
  ]),
  registration_digest: digest,
}).strict().superRefine((value, context) => {
  if (value.capture_source
    ? value.source_launch_id !== undefined || value.source_offering_digest !== undefined
      || value.capture_source.scene_id !== `site-${value.capture_source.request_id}`
      || value.capture_source.capture_id !== `walkthrough-${value.capture_source.request_id}`
      || value.capture_session_id !== value.capture_source.capture_id
      || ![value.capture_source.scene_id, `scene-${value.capture_source.scene_id}`]
        .includes(value.task_success_contract.scope.site_id)
    : !value.source_launch_id || !value.source_offering_digest) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Exactly one bound offering or original website capture source is required" });
  }
  if (value.registration_digest !== canonicalArtifactDigest(value, "registration_digest")) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Registration digest mismatch" });
  }
  if (value.policy_candidates[0].candidate_id !== "pi05_droid"
    || value.policy_candidates[1].candidate_id !== "groot_n17_droid") {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Exactly two frozen candidates are required" });
  }
  if (value.task_success_contract.provenance.confirmed_by_team_id !== value.team_namespace) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Task confirmation team mismatch" });
  }
});

export type OperatorPolicyCanaryRegistration = z.infer<typeof operatorPolicyCanaryRegistrationSchema>;

/** A capture context is provenance, never an ownership or task-attestation grant. */
export async function operatorPolicyCanaryCaptureSourceMatches(
  transaction: FirebaseFirestore.Transaction, value: OperatorPolicyCanaryRegistration,
) {
  const source = value.capture_source;
  if (!source || !db) return false;
  const [request, brief, inventory] = await Promise.all([
    transaction.get(db.collection("inboundRequests").doc(source.request_id)),
    transaction.get(db.collection("siteTaskBriefs").doc(source.request_id)),
    transaction.get(db.collection("siteTaskItemInventories").doc(source.request_id)),
  ]);
  if (!request.exists || !brief.exists) return false;
  const rights = projectWebsiteCaptureRights(request.data());
  if (!rights.derived_scene_generation_allowed) return false;
  const task = brief.data() as SiteTaskBriefRecord;
  const items = inventory.exists ? inventory.data() as TaskItemInventoryRecord : null;
  if (task.requestId !== source.request_id
    || items && (items.requestId !== source.request_id || !Array.isArray(items.items))) return false;
  return projectWebsiteTaskContext(task, rights, { purpose: "scene_preparation", inventory: items })
    .context_digest === source.task_context_digest;
}

export async function registerOperatorPolicyCanary(params: {
  registration: OperatorPolicyCanaryRegistration;
  actorId: string;
  res: Response;
}) {
  const { registration: value, actorId, res } = params;
  if (actorId !== TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID) {
    return res.status(403).json({ error: "Operator registration client is not admitted" });
  }
  if (!db) return res.status(503).json({ error: "Policy run store is unavailable" });
  if ("email" in value.notification && !policyCanaryNotificationRecipientAllowed({
    requestedEmail: value.notification.email,
    authenticatedEmail: null,
    isAdmin: false,
    isOps: true,
  })) return res.status(422).json({ error: "Policy run notification recipient is not admitted" });
  const runRef = db.collection("taskEvaluationPolicyRuns").doc(value.run_id);
  const parentRef = value.source_launch_id
    ? db.collection("taskEvaluationLaunches").doc(value.source_launch_id) : null;
  let outcome: string;
  try {
    outcome = await db.runTransaction(async (transaction) => {
      const [parentSnapshot, runSnapshot] = await Promise.all([
        parentRef ? transaction.get(parentRef) : null, transaction.get(runRef),
      ]);
      let scene;
      if (value.capture_source) {
        if (!await operatorPolicyCanaryCaptureSourceMatches(transaction, value)) return "capture_binding_mismatch";
        scene = { id: value.capture_source.scene_id, version: value.scene_revision_digest };
      } else {
        if (!parentSnapshot?.exists) return "parent_not_found";
        const parent = parentSnapshot.data() as Record<string, any>;
        const parsed = configuredSceneOfferingSchema.safeParse(parent.configured_scene_offering);
        if (!parsed.success || parent.configured_scene_offering_digest !== parsed.data.offering_digest
          || parsed.data.offering_digest !== value.source_offering_digest
          || parsed.data.team_namespace !== value.team_namespace
          || parsed.data.evaluation_preparation_binding.configured_scene_revision_digest !== value.scene_revision_digest) {
          return "parent_binding_mismatch";
        }
        scene = parsed.data.scene_identity;
      }
      if (runSnapshot.exists) {
        const prior = runSnapshot.data() as Record<string, any>;
        const retained = operatorPolicyCanaryRegistrationSchema.safeParse(prior.operator_registration);
        return prior.owner_user_id === actorId
          && retained.success && retained.data.registration_digest === value.registration_digest
          && prior.team_namespace === value.team_namespace
          ? "replayed" : "immutable_conflict";
      }
      const now = new Date().toISOString();
      transaction.create(runRef, {
        schema_version: "task_evaluation_policy_run_web_record.v2",
        run_id: value.run_id,
        run_kind: value.run_kind,
        claim_ceiling: value.claim_ceiling,
        ...(value.capture_source ? { capture_source: value.capture_source } : {
          source_launch_id: value.source_launch_id, offering_digest: value.source_offering_digest,
        }),
        setup_digest: value.setup_digest,
        operator_registration: value,
        submission_channel: "production_webapp_operator_registration",
        owner_user_id: actorId,
        team_namespace: value.team_namespace,
        firebase_tenant_id: null,
        state: "running",
        phase: "awaiting_operator_results",
        request_digest: value.request_digest,
        configuration_digest: value.configuration_digest,
        pipeline_configuration_digest: value.configuration_digest,
        scene_revision_digest: value.scene_revision_digest,
        scene_controls_status_at_submission: "controls_omitted_by_user",
        task_success_contract: value.task_success_contract,
        task_success_contract_digest: value.task_success_contract.contract_digest,
        scene: { id: scene.id, version: scene.version },
        task: { id: value.task_success_contract.scope.task_id, label: value.task_success_contract.scope.task_id.replaceAll("_", " ") },
        robot_preset_id: "droid_franka_panda_robotiq_2f85_v1",
        robot: { preset_id: "droid_franka_panda_robotiq_2f85_v1", display_name: "Franka with Robotiq 2F-85" },
        policy_candidate_ids: value.policy_candidates.map((row) => row.candidate_id),
        policy_candidates: value.policy_candidates,
        episode_counts: { learned_episode_count: 20, control_episode_count: 0, total_episode_count: 20 },
        progress: { completed_episodes: 0, total_episodes: 20 },
        completed_learned_episode_count: 0,
        completed_control_episode_count: 0,
        notification: value.notification,
        notification_recipient_user_id: actorId,
        notification_source_event_id: value.registration_digest,
        forward_attempt_count: 0,
        next_forward_at_iso: null,
        retryable: false,
        result_record_id: null,
        delivery_digest: null,
        created_at_iso: now,
        updated_at_iso: now,
      });
      return "created";
    });
  } catch {
    return res.status(503).json({ error: "Operator policy registration store is unavailable" });
  }
  if (outcome === "parent_not_found") return res.status(404).json({ error: "Source scene offering not found" });
  if (outcome !== "created" && outcome !== "replayed") return res.status(409).json({
    error: "Operator policy registration binding conflict", code: outcome,
  });
  return res.status(outcome === "created" ? 201 : 200).json({
    schema_version: "task_evaluation_operator_policy_canary_registration_receipt.v1",
    run_id: value.run_id,
    registration_digest: value.registration_digest,
    status: "registered",
    already_exists: outcome === "replayed",
    provider_mutation_performed: false,
    execution_queued: false,
  });
}

export function operatorPolicyCanaryPublicationScope(
  policyRun: Record<string, any>,
  publication: PipelinePolicyCanaryPublication,
) {
  const parsed = operatorPolicyCanaryRegistrationSchema.safeParse(policyRun.operator_registration);
  if (!parsed.success) return null;
  const value = parsed.data;
  const ownerUserId = String(policyRun.owner_user_id || "").trim();
  if (value.capture_source && (policyRun.source_launch_id !== undefined
    || policyRun.offering_digest !== undefined
    || stableJson(policyRun.capture_source ?? null) !== stableJson(value.capture_source))) return null;
  if (ownerUserId !== TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID
    || policyRun.submission_channel !== "production_webapp_operator_registration"
    || policyRun.team_namespace !== value.team_namespace
    || policyRun.source_launch_id !== value.source_launch_id
    || value.run_id !== publication.run_id
    || value.capture_session_id !== publication.capture_session_id
    || value.intake_id !== publication.intake_id
    || value.request_digest !== publication.request_digest
    || value.configuration_digest !== publication.configuration_digest
    || value.plan_digest !== publication.plan_digest
    || value.registration_digest !== publication.operator_registration_digest
    || value.control_omission_authority_digest !== publication.policy_canary_result.control_omission?.authority_digest
    || publication.scene_controls_status !== "controls_omitted_by_user"
    || value.task_success_contract.contract_digest !== publication.policy_canary_result.task_success_contract?.contract_digest) {
    return null;
  }
  return {
    ownerUserId,
    organizationId: value.team_namespace,
    accessVisibility: value.capture_source || value.team_namespace === `user:${ownerUserId}`
      ? "owner_only" as const : "organization_members" as const,
  };
}
