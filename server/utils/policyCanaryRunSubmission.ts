import type { Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  configuredSceneOfferingSchema,
  type ConfiguredSceneOffering,
} from "./configuredSceneOfferingContract";
import {
  buildInternalPolicyCanaryLaunchRequest,
  policyCanaryError,
  policyCanaryNotificationRecipientAllowed,
  resolveInternalPolicyCanarySelection,
  type InternalPolicyCanarySelection,
  type InternalPolicyCanarySetup,
} from "./internalPolicyCanaryContract";
import {
  forwardTaskEvaluationLaunch,
  resolvePublishedLaunchProfileCatalog,
} from "./taskEvaluationLaunchContract";
import { forwardStoredPolicyCanaryRun } from "./taskEvaluationLaunchForwardWorker";
import { withTaskEvaluationLaunchStoreTimeout } from "./taskEvaluationLaunchStore";

export const CONFIGURED_SCENE_LAUNCH_COLLECTION = "taskEvaluationLaunches";
export const POLICY_RUN_COLLECTION = "taskEvaluationPolicyRuns";
export const STORED_OFFERING_STATES = [
  "launch_ready",
  "configured_controls_pending",
  "evaluation_ready",
] as const;

export type StoredOfferingState = (typeof STORED_OFFERING_STATES)[number];

/** The identity a submitter carries into a canary run; a browser user or the signed runner. */
export interface PolicyCanarySubmitterAccess {
  uid: string | null;
  email: string | null;
  isAdmin: boolean;
  isOps: boolean;
}

export function isStoredOfferingState(value: unknown): value is StoredOfferingState {
  return STORED_OFFERING_STATES.includes(value as ConfiguredSceneOffering["status"]);
}

export function storedStateMatchesOffering(
  storedState: StoredOfferingState,
  offeringStatus: ConfiguredSceneOffering["status"],
) {
  return storedState === offeringStatus
    || (
      storedState === "launch_ready"
      && offeringStatus === "configured_controls_pending"
    );
}

/**
 * Load one stored configured-scene offering by its source launch id.
 *
 * Returns `null` when the record is absent or its stored state, digest, or
 * shape disagree with itself. Access scoping is the caller's decision: the
 * browser route checks the tenant, the signed service channel acts as ops.
 */
export async function loadConfiguredSceneOffering(launchId: string) {
  if (!db) return null;
  const snapshot = await withTaskEvaluationLaunchStoreTimeout(
    db.collection(CONFIGURED_SCENE_LAUNCH_COLLECTION).doc(launchId).get(),
  );
  if (!snapshot.exists) return null;
  const record = snapshot.data() as Record<string, unknown>;
  const parsed = configuredSceneOfferingSchema.safeParse(record.configured_scene_offering);
  if (
    !isStoredOfferingState(record.configured_scene_offering_state)
    || !parsed.success
    || !storedStateMatchesOffering(
      record.configured_scene_offering_state,
      parsed.data.status,
    )
    || parsed.data.offering_digest !== record.configured_scene_offering_digest
  ) return null;
  return { offering: parsed.data, record };
}

export async function policyCanarySetupFor(
  sourceLaunchId: string,
  offering: ConfiguredSceneOffering,
) {
  const catalog = await resolvePublishedLaunchProfileCatalog();
  if (catalog.blocker) return {
    ok: false as const,
    status: 503,
    code: catalog.blocker,
  };
  const matches = catalog.profiles.filter((profile) => {
    const setup = profile.internal_policy_canary_setup;
    return Boolean(
      profile.source_commit
      && setup
      && setup.source_launch_id === sourceLaunchId
      && setup.offering_digest === offering.offering_digest
      && setup.scene_revision_digest
        === offering.evaluation_preparation_binding.configured_scene_revision_digest
      && profile.task_evaluation_run?.team_namespace === offering.team_namespace
      && profile.task_evaluation_run.scene_id === offering.scene_identity.id
      && profile.task_evaluation_run.configuration_run_id === offering.configuration_run_id,
    );
  });
  if (matches.length !== 1) return {
    ok: false as const,
    status: matches.length === 0 ? 409 : 503,
    code: matches.length === 0
      ? "POLICY_CANARY_SETUP_NOT_PUBLISHED"
      : "POLICY_CANARY_SETUP_AMBIGUOUS",
  };
  const successContract = matches[0].internal_policy_canary_setup?.task_success_contract;
  const successContractDigest = matches[0].internal_policy_canary_setup
    ?.task_success_contract_digest;
  if (
    !successContract
    || successContractDigest !== successContract.contract_digest
  ) return {
    ok: false as const,
    status: 409,
    code: "TASK_SUCCESS_CONTRACT_NOT_PUBLISHED",
  };
  if (
    successContract.scope.site_id !== offering.scene_identity.id
    || successContract.scope.task_id !== offering.task.identity.id
  ) return {
    ok: false as const,
    status: 409,
    code: "TASK_SUCCESS_CONTRACT_SCOPE_MISMATCH",
  };
  return {
    ok: true as const,
    profile: matches[0],
    setup: matches[0].internal_policy_canary_setup as InternalPolicyCanarySetup,
  };
}

function actorRole(access: PolicyCanarySubmitterAccess): "admin" | "ops" | "team_member" {
  return access.isAdmin ? "admin" : access.isOps ? "ops" : "team_member";
}

/**
 * Bind, persist, and forward one controls-pending policy canary for an offering.
 *
 * Shared by the offering page (a signed-in browser user) and the signed
 * service channel (the production runner acting as ops after controls pass),
 * so the pipeline receives byte-identical requests from either origin. The
 * caller has already parsed the selection, checked idempotency, and confirmed
 * the offering is controls-pending.
 */
export async function submitPolicyCanaryRun(params: {
  launchId: string;
  offering: ConfiguredSceneOffering;
  selection: InternalPolicyCanarySelection;
  access: PolicyCanarySubmitterAccess;
  res: Response;
  submissionChannel?: string;
}) {
  const { launchId, offering, selection, access, res } = params;
  if (!db) return res.status(503).json(policyCanaryError(
    "POLICY_CANARY_STORE_UNAVAILABLE",
    "Policy canary store is unavailable.",
  ));
  if (!policyCanaryNotificationRecipientAllowed({
    requestedEmail: selection.notification.email,
    authenticatedEmail: access.email,
    isAdmin: access.isAdmin,
    isOps: access.isOps,
  })) {
    return res.status(422).json(policyCanaryError(
      "NOTIFICATION_EMAIL_NOT_AUTHORIZED",
      "Notification email must match the authenticated account or an admin-approved internal recipient.",
    ));
  }
  const setup = await policyCanarySetupFor(launchId, offering);
  if (!setup.ok) return res.status(setup.status).json(policyCanaryError(
    setup.code,
    "A verified runnable policy-canary setup is not published for this exact configured revision.",
  ));
  const selected = resolveInternalPolicyCanarySelection(setup.setup, selection, {
    siteId: offering.scene_identity.id,
    taskId: offering.task.identity.id,
    teamId: offering.team_namespace,
  });
  if (!selected.ok) return res.status(422).json(policyCanaryError(
    selected.code,
    selected.message,
    selected.details,
  ));
  const now = new Date().toISOString();
  const actor = { id: access.uid || "", role: actorRole(access) };
  const freshRequest = buildInternalPolicyCanaryLaunchRequest({
    selection,
    setup: setup.setup,
    profile: setup.profile,
    actor,
    teamNamespace: offering.team_namespace,
    controlsStatusAtSubmission: "configured_controls_pending",
    authorizedAt: now,
  });
  const record = {
    schema_version: "task_evaluation_policy_run_web_record.v2",
    run_id: selection.run_id,
    run_kind: selection.run_kind,
    claim_ceiling: selection.claim_ceiling,
    source_launch_id: launchId,
    offering_digest: selection.offering_digest,
    setup_digest: selection.setup_digest,
    task_success_contract: selection.task_success_contract,
    task_success_contract_digest: selection.task_success_contract.contract_digest,
    scene_revision_digest: selection.scene_revision_digest,
    scene_controls_status_at_submission: "configured_controls_pending",
    owner_user_id: access.uid,
    team_namespace: offering.team_namespace,
    state: "forward_pending",
    phase: "forwarding",
    request_digest: freshRequest.request_digest,
    configuration_digest: freshRequest.request_digest,
    robot_preset_id: selection.robot_preset_id,
    policy_candidate_ids: selection.policy_candidate_ids,
    scene: {
      id: offering.scene_identity.id,
      version: offering.scene_identity.version,
    },
    task: {
      id: offering.task.identity.id,
      label: offering.task.strategy.replaceAll("_", " "),
    },
    robot: {
      preset_id: selected.robot.robot_preset_id,
      display_name: selected.robot.display_name,
    },
    policy_candidates: selected.candidates.map((candidate) => ({
      candidate_id: candidate.candidate_id,
      display_name: candidate.display_name,
      checkpoint_digest: candidate.checkpoint.digest,
    })),
    episode_plan: freshRequest.episode_plan,
    episode_counts: {
      learned_episode_count: 20,
      control_episode_count: 20,
      total_episode_count: 40,
    },
    progress: {
      completed_episodes: 0,
      total_episodes: 20,
    },
    completed_learned_episode_count: 0,
    completed_control_episode_count: 0,
    notification: selection.notification,
    notification_recipient_user_id: access.uid,
    notification_source_event_id: freshRequest.request_digest,
    ...(params.submissionChannel ? { submission_channel: params.submissionChannel } : {}),
    request: freshRequest,
    forward_attempt_count: 0,
    next_forward_at_iso: null,
    retryable: true,
    result_record_id: null,
    delivery_digest: null,
    created_at_iso: now,
    updated_at_iso: now,
  };
  const runRef = db.collection(POLICY_RUN_COLLECTION).doc(selection.run_id);
  let priorRecord: Record<string, any> | null;
  try {
    priorRecord = await withTaskEvaluationLaunchStoreTimeout(
      db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(runRef);
        if (snapshot.exists) {
          const prior = snapshot.data() as Record<string, any>;
          const originalAuthorizedAt = prior.request?.authorization?.authorized_at;
          if (typeof originalAuthorizedAt !== "string") {
            throw new Error("policy_canary_immutable_conflict");
          }
          const replayRequest = buildInternalPolicyCanaryLaunchRequest({
            selection,
            setup: setup.setup,
            profile: setup.profile,
            actor,
            teamNamespace: offering.team_namespace,
            controlsStatusAtSubmission: "configured_controls_pending",
            authorizedAt: originalAuthorizedAt,
          });
          if (
            prior.run_kind !== selection.run_kind
            || prior.owner_user_id !== record.owner_user_id
            || prior.team_namespace !== record.team_namespace
            || prior.source_launch_id !== record.source_launch_id
            || prior.request_digest !== replayRequest.request_digest
            || prior.request?.request_digest !== replayRequest.request_digest
          ) throw new Error("policy_canary_immutable_conflict");
          return prior;
        }
        transaction.create(runRef, record);
        return null;
      }),
    );
  } catch (error) {
    if (error instanceof Error && error.message === "policy_canary_immutable_conflict") {
      return res.status(409).json(policyCanaryError(
        "POLICY_CANARY_IMMUTABLE_CONFLICT",
        "This run identity is already bound to another immutable request.",
      ));
    }
    return res.status(503).json(policyCanaryError(
      "POLICY_CANARY_STORE_UNAVAILABLE",
      "Policy canary persistence is unavailable. Check this same run ID before submitting again.",
      { persistence_state: "unknown", retryable: true },
    ));
  }
  res.set("Cache-Control", "private, no-store");
  const replayed = priorRecord !== null;
  const storedRecord = priorRecord || record;
  const channel = params.submissionChannel
    ? { submission_channel: params.submissionChannel }
    : {};
  if (
    replayed
    && !["forward_pending", "forward_blocked"].includes(String(storedRecord.state || ""))
  ) return res.status(200).json({
    schema_version: "task_evaluation_policy_canary_web_receipt.v1",
    status: storedRecord.state,
    already_exists: true,
    ...channel,
    run: storedRecord,
  });
  const forwardResult = await forwardStoredPolicyCanaryRun(
    // A user-initiated retry is immediate. The background reconciler still
    // respects next_forward_at_iso, but an explicit same-selection POST should
    // match the established admin launch retry behavior.
    replayed ? { ...storedRecord, next_forward_at_iso: null } : storedRecord,
    async () => forwardTaskEvaluationLaunch({ request: storedRecord.request }),
  );
  const forwarded = forwardResult.forward;
  const update = {
    ...forwardResult,
    launch_forward: forwarded,
    error: forwarded?.status === "forwarded"
      ? null
      : {
        code: forwarded?.blocker || "POLICY_CANARY_FORWARD_FAILED",
        message: "Policy canary could not be queued in Pipeline.",
      },
    updated_at_iso: new Date().toISOString(),
  };
  try {
    await withTaskEvaluationLaunchStoreTimeout(runRef.set(update, { merge: true }));
  } catch {
    return res.status(503).json(policyCanaryError(
      "POLICY_CANARY_FORWARD_RECEIPT_STORE_UNAVAILABLE",
      "Pipeline responded, but the forwarding receipt could not be sealed.",
      { persistence_state: "forward_receipt_unknown", retryable: true },
    ));
  }
  return res.status(forwarded?.status === "forwarded" ? 202 : 503).json({
    schema_version: "task_evaluation_policy_canary_web_receipt.v1",
    status: update.state,
    already_exists: replayed,
    ...channel,
    run: { ...storedRecord, ...update },
    forward: forwarded,
    warning: "Controls pending — results are unqualified.",
  });
}
