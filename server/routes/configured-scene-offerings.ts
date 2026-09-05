import { Router, type Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { submitTaskEvaluationLaunchPreparation } from "./admin-task-evaluation-launches";
import { resolveAccessContext } from "../utils/access-control";
import {
  configuredSceneOfferingBinding,
  configuredSceneOfferingSchema,
  preparationMatchesConfiguredSceneOffering,
  type ConfiguredSceneOffering,
} from "../utils/configuredSceneOfferingContract";
import { readConfiguredSceneThumbnail } from "../utils/configuredSceneThumbnail";
import { withTaskEvaluationLaunchStoreTimeout } from "../utils/taskEvaluationLaunchStore";
import {
  internalPolicyCanarySelectionSchema,
  policyCanaryError,
  policyCanaryNotificationRecipientOptions,
} from "../utils/internalPolicyCanaryContract";
import {
  CANONICAL_POLICY_CANDIDATE_IDS,
  FRANKA_DROID_EMBODIMENT_ID,
  buildResolvedPolicyRunConfiguration,
  evaluationReadyRunInputSchema,
  policyRunSetupDigest,
  projectEvaluationReadyRun,
  projectPolicyRunConfiguration,
  type EvaluationReadyPolicyRunSetup,
  type EvaluationReadyRunRecord,
} from "../utils/evaluationReadyRunContract";
import {
  resolvePublishedLaunchProfileCatalog,
} from "../utils/taskEvaluationLaunchContract";
import {
  loadConfiguredSceneOffering,
  policyCanarySetupFor,
  submitPolicyCanaryRun,
} from "../utils/policyCanaryRunSubmission";
import {
  buildPolicyRunLaunchPreparation,
  forwardTaskEvaluationLaunchPreparation,
  taskEvaluationLaunchPreparationRequestDigest,
} from "../utils/taskEvaluationLaunchPreparationContract";

const router = Router();
const COLLECTION = "taskEvaluationLaunches";
const POLICY_RUN_COLLECTION = "taskEvaluationPolicyRuns";
const PREPARATION_COLLECTION = "taskEvaluationLaunchPreparations";
const STORED_OFFERING_STATES = [
  "launch_ready",
  "configured_controls_pending",
  "evaluation_ready",
] as const;

function isStoredOfferingState(
  value: unknown,
): value is (typeof STORED_OFFERING_STATES)[number] {
  return STORED_OFFERING_STATES.includes(value as ConfiguredSceneOffering["status"]);
}

function storedStateMatchesOffering(
  storedState: (typeof STORED_OFFERING_STATES)[number],
  offeringStatus: ConfiguredSceneOffering["status"],
) {
  return storedState === offeringStatus
    || (
      storedState === "launch_ready"
      && offeringStatus === "configured_controls_pending"
    );
}

function firebaseTenantId(res: Response) {
  const user = res.locals.firebaseUser as { tenantId?: string; tenant_id?: string } | undefined;
  return String(user?.tenantId || user?.tenant_id || "").trim();
}

async function accessibleOffering(launchId: string, res: Response) {
  if (!db) return null;
  const access = await resolveAccessContext(res);
  if (!access.uid) return null;
  const loaded = await loadConfiguredSceneOffering(launchId);
  if (!loaded) return null;
  const tenantId = firebaseTenantId(res);
  if (!access.isOps && (!tenantId || tenantId !== loaded.offering.team_namespace)) return null;
  return { offering: loaded.offering, access };
}

async function policyRunSetupFor(
  sourceLaunchId: string,
  offering: ConfiguredSceneOffering,
) {
  const catalog = await resolvePublishedLaunchProfileCatalog();
  if (catalog.blocker) return {
    ok: false as const,
    status: 503,
    code: catalog.blocker,
  };
  const matches = catalog.profiles.filter((profile) => (
    profile.source_commit
    && profile.policy_run_setup
    && profile.policy_run_setup.source_launch_id === sourceLaunchId
    && profile.policy_run_setup.offering_digest === offering.offering_digest
    && profile.task_evaluation_run?.team_namespace === offering.team_namespace
    && profile.task_evaluation_run.scene_id === offering.scene_identity.id
    && profile.task_evaluation_run.configuration_run_id === offering.configuration_run_id
  ));
  if (matches.length !== 1) return {
    ok: false as const,
    status: 409,
    code: matches.length === 0
      ? "evaluation_ready_policy_run_setup_not_published"
      : "evaluation_ready_policy_run_setup_ambiguous",
  };
  return {
    ok: true as const,
    profile: matches[0],
    setup: matches[0].policy_run_setup as EvaluationReadyPolicyRunSetup,
  };
}

function setupProjection(params: {
  sourceLaunchId: string;
  offering: ConfiguredSceneOffering;
  profile: { profile_id: string; profile_digest: string };
  setup: EvaluationReadyPolicyRunSetup;
  recipientEmail: string | null;
}) {
  return {
    schema_version: "task_evaluation_policy_run_setup_projection.v1",
    source_launch_id: params.sourceLaunchId,
    offering_digest: params.offering.offering_digest,
    offering_status: params.offering.status,
    offering: {
      scene_id: params.offering.scene_identity.id,
      scene_version: params.offering.scene_identity.version,
      task_id: params.offering.task.identity.id,
      task_version: params.offering.task.identity.version,
      task_kind: params.offering.task.kind,
      task_strategy: params.offering.task.strategy,
    },
    setup_digest: policyRunSetupDigest(params.setup),
    launch_profile: {
      profile_id: params.profile.profile_id,
      profile_digest: params.profile.profile_digest,
    },
    robot: {
      embodiment_id: FRANKA_DROID_EMBODIMENT_ID,
      label: "Franka + DROID",
      locked: true,
    },
    policy_candidates: CANONICAL_POLICY_CANDIDATE_IDS.map((candidateId) => ({
      candidate_id: candidateId,
      label: candidateId === "pi05_droid" ? "PI 0.5 DROID" : "GR00T N1.7 DROID",
      locked: true,
    })),
    matrix: {
      profile_id: params.setup.matrix_profile_id,
      preregistration_digest: params.setup.preregistration.digest,
      compiler: params.setup.scenario_compiler,
      presets: params.setup.presets.map(({ cells: _privateCells, ...preset }) => ({
        ...preset,
        episode_counts: {
          learned_episode_count: preset.scenario_count_per_policy * 2,
          control_episode_count: preset.scenario_count_per_policy * 2,
          total_episode_count: preset.scenario_count_per_policy * 4,
        },
      })),
    },
    notification: {
      email_when_ready: true,
      recipient: "authenticated_account",
      recipient_email: params.recipientEmail,
    },
    proof_boundary: {
      setup_is_execution: false,
      provider_mutation_performed: false,
      paid_execution_requested: false,
      simulation_is_physical_success: false,
    },
  };
}

const policyRunReceiptProofBoundary = {
  preparation_is_execution: false,
  provider_mutation_performed_inside_http_request: false,
  paid_execution_requested: false,
  payment_required: false,
  simulation_is_physical_success: false,
  deployment_or_safety_approved: false,
} as const;

function card(offering: ConfiguredSceneOffering, sourceLaunchId: string) {
  return {
    source_launch_id: sourceLaunchId,
    status: offering.status,
    offering_digest: offering.offering_digest,
    configuration_run_id: offering.configuration_run_id,
    team_namespace: offering.team_namespace,
    scene_identity: offering.scene_identity,
    task: offering.task,
    presentation: {
      thumbnail_url: `/api/configured-scene-offerings/${encodeURIComponent(sourceLaunchId)}/thumbnail`,
      selection: offering.presentation.selection,
      appearance_review_status:
        offering.presentation.appearance_review_status ?? "accepted",
      selected_from_exact_reviewed_frame_count:
        offering.presentation.selected_from_exact_reviewed_frame_count,
      ...(offering.presentation.warning_label ? {
        warning_label: offering.presentation.warning_label,
      } : {}),
    },
    evaluation_preparation_binding: offering.evaluation_preparation_binding,
    proof_boundary: offering.proof_boundary,
    evaluation_admission: offering.evaluation_admission,
  };
}

function catalogIdentity(offering: ConfiguredSceneOffering) {
  return [
    offering.team_namespace,
    offering.scene_identity.id,
    offering.scene_identity.version,
    offering.task.identity.id,
    offering.task.identity.version,
    offering.status,
  ].join("\u0000");
}

function catalogRevisionOrder(record: Record<string, unknown>, sourceLaunchId: string) {
  const terminalUpdatedAt = String(record.terminal_updated_at_iso || "");
  const parsed = Date.parse(terminalUpdatedAt);
  const normalized = Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
  return `${normalized}\u0000${sourceLaunchId}`;
}

router.get("/", async (_req, res) => {
  if (!db) return res.status(503).json({ error: "Configured scene offering store is unavailable" });
  const access = await resolveAccessContext(res);
  if (!access.uid) return res.status(401).json({ error: "Authentication required" });
  const tenantId = firebaseTenantId(res);
  if (!access.isOps && !tenantId) return res.status(200).json({
    schema_version: "task_evaluation_configured_scene_offering_catalog.v1",
    scope: "owner_without_verified_team",
    offerings: [],
  });
  try {
    const query = access.isOps
      ? db.collection(COLLECTION).where("configured_scene_offering_state", "in", STORED_OFFERING_STATES)
      : db.collection(COLLECTION).where("configured_scene_offering_team_namespace", "==", tenantId);
    const snapshot = await withTaskEvaluationLaunchStoreTimeout(query.limit(100).get());
    const offeringsByIdentity = new Map<string, {
      offering: ReturnType<typeof card>;
      revisionOrder: string;
    }>();
    for (const document of snapshot.docs) {
      const record = document.data() as Record<string, unknown>;
      if (!isStoredOfferingState(record.configured_scene_offering_state)) continue;
      const parsed = configuredSceneOfferingSchema.safeParse(record.configured_scene_offering);
      if (
        !parsed.success
        || !storedStateMatchesOffering(
          record.configured_scene_offering_state,
          parsed.data.status,
        )
        || parsed.data.offering_digest !== record.configured_scene_offering_digest
      ) {
        // The launch collection also contains controls/construction runs. A
        // historical run may retain an indexed offering-state field without
        // carrying a configured-scene offering object. Such a record is not an
        // offering and must not make every valid team scene unavailable.
        continue;
      }
      if (!access.isOps && parsed.data.team_namespace !== tenantId) continue;
      const identity = catalogIdentity(parsed.data);
      const revisionOrder = catalogRevisionOrder(record, document.id);
      const retained = offeringsByIdentity.get(identity);
      if (!retained || retained.revisionOrder < revisionOrder) {
        offeringsByIdentity.set(identity, {
          offering: card(parsed.data, document.id),
          revisionOrder,
        });
      }
    }
    const offerings = [...offeringsByIdentity.values()].map(({ offering }) => offering);
    res.set("Cache-Control", "private, no-store");
    return res.json({
      schema_version: "task_evaluation_configured_scene_offering_catalog.v1",
      scope: access.isOps ? "blueprint_operations" : "verified_team",
      offerings,
    });
  } catch {
    return res.status(503).json({
      error: "Configured scene offering store is unavailable",
      offerings: [],
    });
  }
});

router.get("/:launchId/evaluation-setup", async (req, res) => {
  let resolved;
  try {
    resolved = await accessibleOffering(req.params.launchId, res);
  } catch {
    return res.status(503).json({
      error: "Configured scene offering store is unavailable",
      code: "configured_scene_offering_store_unavailable",
    });
  }
  if (!resolved) return res.status(404).json({
    error: "Configured scene offering not found",
    code: "configured_scene_offering_not_found",
  });
  if (
    resolved.offering.status !== "evaluation_ready"
    || resolved.offering.evaluation_admission?.learned_policy_evaluation_admitted !== true
  ) return res.status(409).json({
    error: "Configured scene controls have not admitted policy evaluation",
    code: "configured_scene_offering_not_evaluation_ready",
    paid_execution_requested: false,
  });
  const setup = await policyRunSetupFor(req.params.launchId, resolved.offering);
  if (!setup.ok) return res.status(setup.status).json({
    error: "Policy-run setup is unavailable for this configured scene",
    code: setup.code,
    paid_execution_requested: false,
  });
  res.set("Cache-Control", "private, no-store");
  return res.status(200).json(setupProjection({
    sourceLaunchId: req.params.launchId,
    offering: resolved.offering,
    profile: setup.profile,
    setup: setup.setup,
    recipientEmail: resolved.access.email,
  }));
});

router.get("/:launchId/policy-canary-setup", async (req, res) => {
  let resolved;
  try {
    resolved = await accessibleOffering(req.params.launchId, res);
  } catch {
    return res.status(503).json(policyCanaryError(
      "CONFIGURED_SCENE_STORE_UNAVAILABLE",
      "Configured scene offering store is unavailable.",
    ));
  }
  if (!resolved) return res.status(404).json(policyCanaryError(
    "CONFIGURED_SCENE_NOT_FOUND",
    "Configured scene offering was not found in this team scope.",
  ));
  if (resolved.offering.status !== "configured_controls_pending") {
    return res.status(409).json(policyCanaryError(
      "POLICY_CANARY_REQUIRES_CONTROLS_PENDING_SCENE",
      "This action is for internal controls-pending canaries. Use qualified evaluation after controls pass.",
      { offering_status: resolved.offering.status },
    ));
  }
  const setup = await policyCanarySetupFor(req.params.launchId, resolved.offering);
  if (!setup.ok) return res.status(setup.status).json(policyCanaryError(
    setup.code,
    "A verified runnable policy-canary setup is not published for this exact configured revision.",
  ));
  res.set("Cache-Control", "private, no-store");
  return res.status(200).json({
    ...setup.setup,
    offering: {
      scene_id: resolved.offering.scene_identity.id,
      scene_version: resolved.offering.scene_identity.version,
      task_id: resolved.offering.task.identity.id,
      task_version: resolved.offering.task.identity.version,
      task_kind: resolved.offering.task.kind,
      task_strategy: resolved.offering.task.strategy,
      controls_status: resolved.offering.status,
    },
    notification_recipient_email: resolved.access.email,
    notification_recipient_options: policyCanaryNotificationRecipientOptions({
      authenticatedEmail: resolved.access.email,
      isAdmin: resolved.access.isAdmin,
      isOps: resolved.access.isOps,
    }),
    task_success_contract_digest: setup.setup.task_success_contract_digest,
    task_success_contract_confirmation_team_id: resolved.offering.team_namespace,
    warning: "Controls pending — results are unqualified.",
    proof_boundary: {
      controls_qualification_bypassed: false,
      result_is_unqualified: true,
      official_ranking_permitted: false,
      scene_promotion_permitted: false,
    },
  });
});

router.post("/:launchId/policy-canary-runs", async (req, res) => {
  if (!db) return res.status(503).json(policyCanaryError(
    "POLICY_CANARY_STORE_UNAVAILABLE",
    "Policy canary store is unavailable.",
  ));
  let resolved;
  try {
    resolved = await accessibleOffering(req.params.launchId, res);
  } catch {
    return res.status(503).json(policyCanaryError(
      "CONFIGURED_SCENE_STORE_UNAVAILABLE",
      "Configured scene offering store is unavailable.",
    ));
  }
  if (!resolved) return res.status(404).json(policyCanaryError(
    "CONFIGURED_SCENE_NOT_FOUND",
    "Configured scene offering was not found in this team scope.",
  ));
  if (resolved.offering.status !== "configured_controls_pending") {
    return res.status(409).json(policyCanaryError(
      "POLICY_CANARY_REQUIRES_CONTROLS_PENDING_SCENE",
      "This action is for internal controls-pending canaries. Use qualified evaluation after controls pass.",
      { offering_status: resolved.offering.status },
    ));
  }
  const parsed = internalPolicyCanarySelectionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json(policyCanaryError(
    "POLICY_CANARY_CONFIGURATION_INVALID",
    "Policy canary configuration is invalid.",
    {
      violations: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    },
  ));
  const selection = parsed.data;
  const idempotencyKey = String(req.header("idempotency-key") || "").trim();
  if (!idempotencyKey || idempotencyKey !== selection.run_id) {
    return res.status(409).json(policyCanaryError(
      "POLICY_CANARY_IDEMPOTENCY_CONFLICT",
      "Idempotency-Key must equal the immutable run_id.",
    ));
  }
  return submitPolicyCanaryRun({
    launchId: req.params.launchId,
    offering: resolved.offering,
    selection,
    access: {
      uid: resolved.access.uid,
      email: resolved.access.email,
      isAdmin: resolved.access.isAdmin,
      isOps: resolved.access.isOps,
    },
    res,
  });
});

router.post("/:launchId/evaluation-runs", async (req, res) => {
  if (!db) return res.status(503).json({
    error: "Task Evaluation Run store is unavailable",
    code: "task_evaluation_policy_run_store_unavailable",
  });
  let resolved;
  try {
    resolved = await accessibleOffering(req.params.launchId, res);
  } catch {
    return res.status(503).json({
      error: "Configured scene offering store is unavailable",
      code: "configured_scene_offering_store_unavailable",
    });
  }
  if (!resolved) return res.status(404).json({
    error: "Configured scene offering not found",
    code: "configured_scene_offering_not_found",
  });
  if (
    resolved.offering.status !== "evaluation_ready"
    || resolved.offering.evaluation_admission?.learned_policy_evaluation_admitted !== true
  ) return res.status(409).json({
    error: "Configured scene controls have not admitted policy evaluation",
    code: "configured_scene_offering_not_evaluation_ready",
    paid_execution_requested: false,
  });
  const input = evaluationReadyRunInputSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({
    error: "Policy-run configuration is invalid",
    code: "task_evaluation_policy_run_input_invalid",
    violations: input.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
    paid_execution_requested: false,
  });
  const idempotencyKey = String(req.header("idempotency-key") || "").trim();
  if (!idempotencyKey || idempotencyKey !== input.data.run_id) return res.status(400).json({
    error: "Idempotency-Key must equal run_id",
    code: "task_evaluation_policy_run_idempotency_key_mismatch",
    paid_execution_requested: false,
  });
  if (input.data.offering_digest !== resolved.offering.offering_digest) {
    return res.status(409).json({
      error: "Configured scene offering changed before policy-run submission",
      code: "task_evaluation_policy_run_offering_digest_mismatch",
      paid_execution_requested: false,
    });
  }
  const setup = await policyRunSetupFor(req.params.launchId, resolved.offering);
  if (!setup.ok) return res.status(setup.status).json({
    error: "Policy-run setup is unavailable for this configured scene",
    code: setup.code,
    paid_execution_requested: false,
  });
  const selectedPreset = setup.setup.presets.find(
    (preset) => preset.preset_id === input.data.preset_id,
  );
  if (
    !selectedPreset
    || selectedPreset.availability !== "enabled"
    || !selectedPreset.cells
  ) return res.status(409).json({
    error: "The selected evaluation preset is not available yet",
    code: "task_evaluation_policy_run_preset_unavailable",
    available_preset_ids: setup.setup.presets
      .filter((preset) => preset.availability === "enabled")
      .map((preset) => preset.preset_id),
    paid_execution_requested: false,
  });
  const setupDigest = policyRunSetupDigest(setup.setup);
  const configuration = buildResolvedPolicyRunConfiguration({
    sourceLaunchId: req.params.launchId,
    offeringDigest: resolved.offering.offering_digest,
    runId: input.data.run_id,
    setup: setup.setup,
    presetId: input.data.preset_id,
  });
  const preparation = buildPolicyRunLaunchPreparation({
    template: setup.setup.preparation_template,
    expectedProductionCommit: setup.profile.source_commit!,
    teamNamespace: resolved.offering.team_namespace,
    runId: input.data.run_id,
    policyRunSetup: setup.setup,
    policyRunSelection: input.data,
    policyRunConfiguration: configuration,
  });
  if (!preparation.success) return res.status(503).json({
    error: "Published policy-run preparation template is invalid",
    code: "task_evaluation_policy_run_preparation_template_invalid",
    blockers: preparation.error.issues.map((issue) => issue.path.join(".") || issue.message),
    paid_execution_requested: false,
  });
  const requestDigest = taskEvaluationLaunchPreparationRequestDigest(preparation.data);
  const now = new Date().toISOString();
  const episodeCounts = configuration.counts;
  const record: EvaluationReadyRunRecord = {
    schema_version: "task_evaluation_policy_run_web_record.v1",
    run_id: input.data.run_id,
    source_launch_id: req.params.launchId,
    offering_digest: resolved.offering.offering_digest,
    owner_user_id: resolved.access.uid || "",
    team_namespace: resolved.offering.team_namespace,
    state: "queued_for_preparation",
    configuration_digest: configuration.configuration_digest,
    configuration,
    setup_digest: setupDigest,
    launch_profile_id: setup.profile.profile_id,
    launch_profile_digest: setup.profile.profile_digest,
    preparation_id: preparation.data.preparation_id,
    preparation_request_digest: requestDigest,
    notification_recipient_user_id: resolved.access.uid,
    notification_source_event_id: configuration.configuration_digest,
    episode_counts: episodeCounts,
    progress: { completed_episodes: 0, total_episodes: episodeCounts.total_episode_count },
    result_record_id: null,
    created_at_iso: now,
    updated_at_iso: now,
  };
  const preparationRecord = {
    schema_version: "task_evaluation_launch_preparation_web_record.v1",
    preparation_id: preparation.data.preparation_id,
    team_namespace: resolved.offering.team_namespace,
    run_id: input.data.run_id,
    expected_production_commit: setup.profile.source_commit,
    request: preparation.data,
    request_digest: requestDigest,
    state: "forward_pending",
    forward_attempt_count: 0,
    provider_mutation_observed: false,
    configured_scene_offering_binding: configuredSceneOfferingBinding(
      resolved.offering,
      req.params.launchId,
    ),
    submission: {
      channel: "production_webapp_browser",
      actor_id: resolved.access.uid,
      actor_role: resolved.access.isAdmin
        ? "admin"
        : resolved.access.isOps ? "ops" : "team_member",
      idempotency_key: idempotencyKey,
    },
    created_at_iso: now,
  };
  const runRef = db.collection(POLICY_RUN_COLLECTION).doc(input.data.run_id);
  const preparationRef = db.collection(PREPARATION_COLLECTION).doc(
    preparation.data.preparation_id,
  );
  let existing: EvaluationReadyRunRecord | null = null;
  try {
    existing = await withTaskEvaluationLaunchStoreTimeout(db.runTransaction(async (transaction) => {
      const runSnapshot = await transaction.get(runRef);
      const preparationSnapshot = await transaction.get(preparationRef);
      if (runSnapshot.exists) {
        const prior = runSnapshot.data() as EvaluationReadyRunRecord;
        if (
          prior.team_namespace !== record.team_namespace
          || prior.owner_user_id !== record.owner_user_id
          || prior.source_launch_id !== record.source_launch_id
          || prior.configuration_digest !== record.configuration_digest
        ) throw new Error("task_evaluation_policy_run_immutable_conflict");
        return prior;
      }
      if (preparationSnapshot.exists) {
        const prior = preparationSnapshot.data() as Record<string, unknown>;
        if (prior.request_digest !== requestDigest) {
          throw new Error("task_evaluation_policy_run_immutable_conflict");
        }
      }
      transaction.create(runRef, record);
      if (!preparationSnapshot.exists) transaction.create(preparationRef, preparationRecord);
      return null;
    }));
  } catch (error) {
    if (error instanceof Error && error.message === "task_evaluation_policy_run_immutable_conflict") {
      return res.status(409).json({
        error: "Immutable policy-run identity is already in use",
        code: "task_evaluation_policy_run_immutable_conflict",
        paid_execution_requested: false,
      });
    }
    return res.status(503).json({
      error: "Task Evaluation Run store is unavailable",
      code: "task_evaluation_policy_run_store_unavailable",
      persistence_state: "unknown",
      retryable: true,
      paid_execution_requested: false,
    });
  }
  if (existing) {
    res.set("Cache-Control", "private, no-store");
    return res.status(200).json({
      schema_version: "task_evaluation_policy_run_web_receipt.v1",
      status: existing.state,
      already_exists: true,
      run: projectEvaluationReadyRun(existing),
      configuration: projectPolicyRunConfiguration(configuration),
      preparation: {
        preparation_id: preparation.data.preparation_id,
        request_digest: requestDigest,
        status: "already_recorded",
      },
      notification: {
        email_when_ready: true,
        recipient: "authenticated_account",
        recipient_email: resolved.access.email,
      },
      proof_boundary: policyRunReceiptProofBoundary,
    });
  }
  const forwarded = await forwardTaskEvaluationLaunchPreparation({
    request: preparation.data,
  });
  const forwardedState = forwarded.status === "forwarded"
    ? "queued_for_no_spend_preparation"
    : "forward_blocked";
  const update = {
    state: forwarded.status === "forwarded" ? "queued_for_preparation" : "blocked",
    preparation_forward: forwarded,
    ...(forwarded.status === "forwarded" ? {} : {
      error: {
        code: forwarded.blocker || "task_evaluation_policy_run_preparation_forward_failed",
        message: "Policy-run preparation could not be queued.",
      },
    }),
    updated_at_iso: new Date().toISOString(),
  } as const;
  try {
    await withTaskEvaluationLaunchStoreTimeout(Promise.all([
      runRef.set(update, { merge: true }),
      preparationRef.set({
        state: forwardedState,
        pipeline: forwarded,
        forward_attempt_count: 1,
        forwarded_at_iso: forwarded.status === "forwarded" ? new Date().toISOString() : null,
        updated_at_iso: new Date().toISOString(),
      }, { merge: true }),
    ]));
  } catch {
    return res.status(503).json({
      error: "Policy-run forward receipt store is unavailable",
      code: "task_evaluation_policy_run_forward_receipt_store_unavailable",
      persistence_state: "forward_receipt_unknown",
      retryable: true,
      paid_execution_requested: false,
    });
  }
  const current = { ...record, ...update } as EvaluationReadyRunRecord;
  res.set("Cache-Control", "private, no-store");
  return res.status(forwarded.status === "forwarded" ? 202 : 503).json({
    schema_version: "task_evaluation_policy_run_web_receipt.v1",
    status: current.state,
    already_exists: false,
    run: projectEvaluationReadyRun(current),
    configuration: projectPolicyRunConfiguration(configuration),
    preparation: {
      preparation_id: preparation.data.preparation_id,
      request_digest: requestDigest,
      status: forwardedState,
    },
    notification: {
      email_when_ready: true,
      recipient: "authenticated_account",
      recipient_email: resolved.access.email,
    },
    proof_boundary: policyRunReceiptProofBoundary,
  });
});

router.get("/:launchId/thumbnail", async (req, res) => {
  if (!db) return res.status(503).json({
    error: "Configured scene thumbnail store is unavailable",
  });
  try {
    const resolved = await accessibleOffering(req.params.launchId, res);
    if (!resolved) return res.status(404).json({ error: "Configured scene offering not found" });
    const buffer = await readConfiguredSceneThumbnail(
      resolved.offering.presentation.task_thumbnail,
    );
    res.set("Cache-Control", "private, no-store");
    res.type("png");
    return res.send(buffer);
  } catch {
    return res.status(503).json({ error: "Configured scene thumbnail store is unavailable" });
  }
});

router.post("/:launchId/preparations", async (req, res) => {
  let resolved;
  try {
    resolved = await accessibleOffering(req.params.launchId, res);
  } catch {
    return res.status(503).json({ error: "Configured scene offering store is unavailable" });
  }
  if (!resolved) return res.status(404).json({ error: "Configured scene offering not found" });
  if (resolved.offering.status === "configured_controls_pending") return res.status(409).json({
    error: "Configured scene controls have not passed",
    code: "configured_scene_offering_controls_pending",
    paid_execution_requested: false,
  });
  if (!preparationMatchesConfiguredSceneOffering(req.body, resolved.offering)) return res.status(409).json({
    error: "Task Evaluation preparation does not match the configured scene offering",
    code: "configured_scene_offering_preparation_binding_mismatch",
    paid_execution_requested: false,
  });
  return submitTaskEvaluationLaunchPreparation(req, res, {
    actorId: resolved.access.uid,
    actorRole: resolved.access.isAdmin
      ? "admin"
      : resolved.access.isOps ? "ops" : "team_member",
    channel: "production_webapp_browser",
    serviceId: null,
    idempotencyKey: String(req.header("idempotency-key") || req.body?.preparation_id || ""),
    configuredSceneOfferingBinding: configuredSceneOfferingBinding(
      resolved.offering,
      req.params.launchId,
    ),
  });
});

export default router;
