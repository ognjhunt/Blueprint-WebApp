import fs from "node:fs";
import path from "node:path";

export type AutoAgentProductionActionTier =
  | "read_only_snapshot"
  | "internal_metadata_update"
  | "internal_report_pointer_update"
  | "queue_state_update"
  | "internal_note_or_report_write"
  | "external_send"
  | "payment_or_entitlement"
  | "provider_execution"
  | "hosted_session_fulfillment"
  | "rights_privacy_legal"
  | "city_launch";

export type AutoAgentProductionActionType =
  | "read_only_snapshot"
  | "paperclip_hermes_internal_metadata_update"
  | "paperclip_internal_report_pointer_update"
  | "queue_state_update"
  | "internal_note_or_report_write"
  | "external_send"
  | "payment_or_entitlement"
  | "provider_execution"
  | "hosted_session_fulfillment"
  | "rights_privacy_legal"
  | "city_launch";

export type AutoAgentProductionActionDecision =
  | "dry_run_allowed"
  | "live_allowed"
  | "reject";

export type AutoAgentProductionCanaryLimit = {
  maxActions: number;
  window: "per_run" | "per_hour" | "per_day";
};

export type AutoAgentProductionAuditEvent = {
  schema: "blueprint/autoagent-production-action-audit/v1";
  actionType: string;
  actionTier: AutoAgentProductionActionTier;
  ownerSystem: string;
  targetRecordId: string;
  targetField: string;
  idempotencyKey: string;
  proofPath: string;
  rollbackPath: string;
  dryRun: boolean;
  canaryMode: boolean;
  liveMutationEnabled: boolean;
};

export type AutoAgentProductionActionRequest = {
  actionType: string;
  ownerSystem: string;
  targetRecordId: string;
  targetField: string;
  proofSource: string;
  proofPath: string;
  idempotencyKey: string;
  rollbackStrategy: string;
  rollbackPath: string;
  dryRun: boolean;
  canaryMode: boolean;
  canaryLimit: AutoAgentProductionCanaryLimit;
  liveMutationEnabled: boolean;
  auditEvent: AutoAgentProductionAuditEvent;
};

export type AutoAgentProductionActionRegistryEntry = {
  actionType: AutoAgentProductionActionType;
  actionTier: AutoAgentProductionActionTier;
  ownerSystem: string;
  proofSource: string;
  rollbackStrategy: string;
  auditEventSchema: AutoAgentProductionAuditEvent["schema"];
  liveMutationAllowed: boolean;
  defaultDryRun: true;
  requiresCanaryMode: true;
  canaryLimit: AutoAgentProductionCanaryLimit;
  blockedReason: string | null;
  mutationSurface: string;
  allowedTargetFields: readonly string[];
  deterministicProofRequirements: readonly string[];
  stopConditions: readonly string[];
  requiresPriorLiveActionProof: AutoAgentProductionActionType | null;
};

export type AutoAgentProductionActionEvaluation = {
  decision: AutoAgentProductionActionDecision;
  actionEntry: AutoAgentProductionActionRegistryEntry | null;
  reasons: string[];
  blockedActionTypes: string[];
  checks: {
    registeredActionType: boolean;
    ownerSystemNamed: boolean;
    proofSourceNamed: boolean;
    proofPathExists: boolean;
    idempotencyKeyPresent: boolean;
    idempotencyKeyIsUnique: boolean;
    rollbackStrategyNamed: boolean;
    rollbackPathExists: boolean;
    dryRunModeExplicit: boolean;
    canaryModeExplicit: boolean;
    canaryLimitPresent: boolean;
    targetRecordNamed: boolean;
    targetFieldAllowed: boolean;
    auditEventSchemaPresent: boolean;
    auditEventMatchesRequest: boolean;
    liveMutationFlagExplicit: boolean;
    actionTypeAllowed: boolean;
  };
};

export type AutoAgentProductionActionEvaluationOptions = {
  cwd?: string;
  usedIdempotencyKeys?: ReadonlySet<string> | readonly string[];
};

export const AUTOAGENT_PRODUCTION_ACTION_DEFAULT_MODE = "dry_run" as const;

export const AUTOAGENT_PRODUCTION_ACTION_REGISTRY_PATH =
  "server/agents/autoagent-production-action-registry.ts" as const;

export const AUTOAGENT_PRODUCTION_ACTION_AUDIT_EVENT_SCHEMA =
  "blueprint/autoagent-production-action-audit/v1" as const;

export const AUTOAGENT_PRODUCTION_ACTION_TIERS: readonly AutoAgentProductionActionTier[] = [
  "read_only_snapshot",
  "internal_metadata_update",
  "internal_report_pointer_update",
  "queue_state_update",
  "internal_note_or_report_write",
  "external_send",
  "payment_or_entitlement",
  "provider_execution",
  "hosted_session_fulfillment",
  "rights_privacy_legal",
  "city_launch",
] as const;

const DEFAULT_CANARY_LIMIT: AutoAgentProductionCanaryLimit = {
  maxActions: 1,
  window: "per_run",
};

function registryEntry(params: {
  actionType: AutoAgentProductionActionType;
  actionTier: AutoAgentProductionActionTier;
  ownerSystem: string;
  proofSource: string;
  rollbackStrategy: string;
  liveMutationAllowed: boolean;
  blockedReason?: string;
  mutationSurface?: string;
  allowedTargetFields?: readonly string[];
  deterministicProofRequirements?: readonly string[];
  stopConditions?: readonly string[];
  requiresPriorLiveActionProof?: AutoAgentProductionActionType | null;
}): AutoAgentProductionActionRegistryEntry {
  return {
    ...params,
    auditEventSchema: AUTOAGENT_PRODUCTION_ACTION_AUDIT_EVENT_SCHEMA,
    defaultDryRun: true,
    requiresCanaryMode: true,
    canaryLimit: DEFAULT_CANARY_LIMIT,
    blockedReason: params.blockedReason ?? null,
    mutationSurface: params.mutationSurface ?? params.actionTier,
    allowedTargetFields: params.allowedTargetFields ?? [],
    deterministicProofRequirements: params.deterministicProofRequirements ?? [
      "owner-system proof path exists",
      "rollback snapshot exists",
      "idempotency key is unique",
      "audit event matches the request",
    ],
    stopConditions: params.stopConditions ?? [
      "validator rejects deterministic proof",
      "duplicate idempotency key is detected",
      "rollback monitor requests rollback",
    ],
    requiresPriorLiveActionProof: params.requiresPriorLiveActionProof ?? null,
  };
}

export const AUTOAGENT_PRODUCTION_ACTION_REGISTRY: Record<
  AutoAgentProductionActionType,
  AutoAgentProductionActionRegistryEntry
> = {
  read_only_snapshot: registryEntry({
    actionType: "read_only_snapshot",
    actionTier: "read_only_snapshot",
    ownerSystem: "repo_local_artifacts",
    proofSource: "repo_local_snapshot_report",
    rollbackStrategy: "no_mutation_no_rollback_required_beyond_discarding_snapshot",
    liveMutationAllowed: false,
  }),
  paperclip_hermes_internal_metadata_update: registryEntry({
    actionType: "paperclip_hermes_internal_metadata_update",
    actionTier: "internal_metadata_update",
    ownerSystem: "paperclip_hermes",
    proofSource: "paperclip_issue_metadata_snapshot",
    rollbackStrategy: "restore_previous_metadata_snapshot",
    liveMutationAllowed: true,
    mutationSurface: "paperclip_hermes.internal_metadata",
    allowedTargetFields: ["metadata.autoagent.production_decision_loop"],
    deterministicProofRequirements: [
      "paperclip issue metadata snapshot exists",
      "rollback snapshot includes previous metadata value",
      "idempotency key is unique for the target metadata field",
      "audit event matches action, owner, target, proof, rollback, dry-run, canary, and live flags",
    ],
    stopConditions: [
      "metadata proof path is missing",
      "rollback snapshot is missing",
      "duplicate idempotency key is detected",
      "rollback monitor or stop condition requests rollback",
    ],
  }),
  paperclip_internal_report_pointer_update: registryEntry({
    actionType: "paperclip_internal_report_pointer_update",
    actionTier: "internal_report_pointer_update",
    ownerSystem: "paperclip_hermes",
    proofSource: "paperclip_issue_metadata_snapshot",
    rollbackStrategy: "restore_previous_report_pointer_snapshot",
    liveMutationAllowed: true,
    mutationSurface: "paperclip_hermes.internal_report_pointer",
    allowedTargetFields: ["metadata.autoagent.latest_production_report_pointer"],
    requiresPriorLiveActionProof: "paperclip_hermes_internal_metadata_update",
    deterministicProofRequirements: [
      "first live metadata lane execution proof exists and committed",
      "paperclip issue metadata snapshot exists",
      "report pointer value names repo-local report and summary paths only",
      "rollback snapshot includes previous report pointer value",
      "idempotency key is unique for the report pointer target",
      "audit event matches action, owner, target, proof, rollback, dry-run, canary, and live flags",
    ],
    stopConditions: [
      "first live metadata lane execution proof is missing or rolled back",
      "report pointer proof path is missing",
      "report pointer value leaves repo-local output paths",
      "duplicate idempotency key is detected",
      "rollback monitor or stop condition requests rollback",
    ],
  }),
  queue_state_update: registryEntry({
    actionType: "queue_state_update",
    actionTier: "queue_state_update",
    ownerSystem: "paperclip_firestore_queue_state",
    proofSource: "owner_queue_state_snapshot",
    rollbackStrategy: "restore_previous_queue_state_snapshot",
    liveMutationAllowed: false,
    blockedReason:
      "Queue state updates remain blocked until an owner-system queue contract names allowed fields and rollback proof.",
  }),
  internal_note_or_report_write: registryEntry({
    actionType: "internal_note_or_report_write",
    actionTier: "internal_note_or_report_write",
    ownerSystem: "paperclip_internal_reports",
    proofSource: "repo_local_report_packet",
    rollbackStrategy: "append_correction_or_remove_unpublished_report",
    liveMutationAllowed: false,
    blockedReason:
      "Production note/report writes remain blocked; repo-local reports are allowed outside this production registry.",
  }),
  external_send: registryEntry({
    actionType: "external_send",
    actionTier: "external_send",
    ownerSystem: "gmail_slack_sendgrid",
    proofSource: "sender_approval_and_reply_durability_audit",
    rollbackStrategy: "cannot_unsend_escalate_to_human_correction",
    liveMutationAllowed: false,
    blockedReason: "External sends remain human/policy gated and are not AutoAgent live actions.",
  }),
  payment_or_entitlement: registryEntry({
    actionType: "payment_or_entitlement",
    actionTier: "payment_or_entitlement",
    ownerSystem: "stripe_firestore_entitlements",
    proofSource: "stripe_checkout_webhook_and_entitlement_record",
    rollbackStrategy: "stripe_refund_or_entitlement_reversal_with_human_approval",
    liveMutationAllowed: false,
    blockedReason:
      "Payment, payout, checkout, refund, invoice, subscription, and entitlement mutation remains blocked.",
  }),
  provider_execution: registryEntry({
    actionType: "provider_execution",
    actionTier: "provider_execution",
    ownerSystem: "provider_runtime",
    proofSource: "provider_run_manifest_and_runtime_artifacts",
    rollbackStrategy: "cancel_or_mark_provider_job_failed_without_retrying_live_work",
    liveMutationAllowed: false,
    blockedReason: "Provider jobs and paid runtime execution remain blocked.",
  }),
  hosted_session_fulfillment: registryEntry({
    actionType: "hosted_session_fulfillment",
    actionTier: "hosted_session_fulfillment",
    ownerSystem: "hosted_session_runtime_entitlements",
    proofSource: "entitlement_runtime_session_and_availability_artifacts",
    rollbackStrategy: "revoke_or_close_session_access_through_hosted_session_owner",
    liveMutationAllowed: false,
    blockedReason: "Hosted-session fulfillment remains blocked without request-specific owner proof.",
  }),
  rights_privacy_legal: registryEntry({
    actionType: "rights_privacy_legal",
    actionTier: "rights_privacy_legal",
    ownerSystem: "rights_privacy_legal_records",
    proofSource: "rights_privacy_consent_and_commercialization_record",
    rollbackStrategy: "restore_previous_rights_posture_and_escalate_to_human",
    liveMutationAllowed: false,
    blockedReason: "Rights, privacy, legal, consent, and commercialization decisions remain blocked.",
  }),
  city_launch: registryEntry({
    actionType: "city_launch",
    actionTier: "city_launch",
    ownerSystem: "city_launch_ledgers_paperclip",
    proofSource: "city_activation_manifest_and_launch_ledger",
    rollbackStrategy: "restore_previous_city_launch_state_and_block_external_claims",
    liveMutationAllowed: false,
    blockedReason: "City-launch activation and city-live claims remain blocked.",
  }),
} as const;

export const AUTOAGENT_INITIAL_LIVE_PRODUCTION_ACTION_TYPES = [
  "paperclip_hermes_internal_metadata_update",
] as const satisfies readonly AutoAgentProductionActionType[];

export const AUTOAGENT_NEXT_LIVE_PRODUCTION_ACTION_TYPES = [
  "paperclip_internal_report_pointer_update",
] as const satisfies readonly AutoAgentProductionActionType[];

export const AUTOAGENT_REGISTERED_LIVE_PRODUCTION_ACTION_TYPES = [
  ...AUTOAGENT_INITIAL_LIVE_PRODUCTION_ACTION_TYPES,
  ...AUTOAGENT_NEXT_LIVE_PRODUCTION_ACTION_TYPES,
] as const satisfies readonly AutoAgentProductionActionType[];

export const AUTOAGENT_BLOCKED_PRODUCTION_ACTION_TYPES = [
  "queue_state_update",
  "internal_note_or_report_write",
  "external_send",
  "payment_or_entitlement",
  "provider_execution",
  "hosted_session_fulfillment",
  "rights_privacy_legal",
  "city_launch",
] as const satisfies readonly AutoAgentProductionActionType[];

function hasOwnKey<T extends object>(
  object: T,
  key: PropertyKey,
): key is keyof T {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function resolveActionPath(cwd: string, filePath: string) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
}

function pathExists(cwd: string, filePath: unknown) {
  if (!nonEmptyString(filePath)) {
    return false;
  }
  return fs.existsSync(resolveActionPath(cwd, filePath));
}

function idempotencyKeyIsUnique(
  key: string,
  usedIdempotencyKeys: AutoAgentProductionActionEvaluationOptions["usedIdempotencyKeys"],
) {
  if (!usedIdempotencyKeys) {
    return true;
  }
  if (Array.isArray(usedIdempotencyKeys)) {
    return !usedIdempotencyKeys.includes(key);
  }
  return !(usedIdempotencyKeys as ReadonlySet<string>).has(key);
}

function auditEventMatchesRequest(
  request: AutoAgentProductionActionRequest,
  entry: AutoAgentProductionActionRegistryEntry,
) {
  const event = request.auditEvent;
  return Boolean(
    event
      && event.schema === entry.auditEventSchema
      && event.actionType === request.actionType
      && event.actionTier === entry.actionTier
      && event.ownerSystem === request.ownerSystem
      && event.targetRecordId === request.targetRecordId
      && event.targetField === request.targetField
      && event.idempotencyKey === request.idempotencyKey
      && event.proofPath === request.proofPath
      && event.rollbackPath === request.rollbackPath
      && event.dryRun === request.dryRun
      && event.canaryMode === request.canaryMode
      && event.liveMutationEnabled === request.liveMutationEnabled,
  );
}

export function evaluateAutoAgentProductionAction(
  request: AutoAgentProductionActionRequest,
  options: AutoAgentProductionActionEvaluationOptions = {},
): AutoAgentProductionActionEvaluation {
  const cwd = options.cwd ?? process.cwd();
  const registeredActionType = hasOwnKey(
    AUTOAGENT_PRODUCTION_ACTION_REGISTRY,
    request.actionType,
  );
  const actionEntry = registeredActionType
    ? AUTOAGENT_PRODUCTION_ACTION_REGISTRY[
      request.actionType as AutoAgentProductionActionType
    ]
    : null;

  const idempotencyKeyPresent = nonEmptyString(request.idempotencyKey);
  const readOnlyDryRunAllowed = Boolean(
    actionEntry?.actionTier === "read_only_snapshot"
      && request.dryRun === true
      && request.liveMutationEnabled === false,
  );
  const checks = {
    registeredActionType,
    ownerSystemNamed: Boolean(
      actionEntry
        && nonEmptyString(actionEntry.ownerSystem)
        && request.ownerSystem === actionEntry.ownerSystem,
    ),
    proofSourceNamed: Boolean(
      actionEntry
        && nonEmptyString(actionEntry.proofSource)
        && request.proofSource === actionEntry.proofSource,
    ),
    proofPathExists: pathExists(cwd, request.proofPath),
    idempotencyKeyPresent,
    idempotencyKeyIsUnique:
      idempotencyKeyPresent
      && idempotencyKeyIsUnique(request.idempotencyKey, options.usedIdempotencyKeys),
    rollbackStrategyNamed: Boolean(
      actionEntry
        && nonEmptyString(actionEntry.rollbackStrategy)
        && request.rollbackStrategy === actionEntry.rollbackStrategy,
    ),
    rollbackPathExists: pathExists(cwd, request.rollbackPath),
    dryRunModeExplicit: typeof request.dryRun === "boolean",
    canaryModeExplicit: typeof request.canaryMode === "boolean",
    canaryLimitPresent: Boolean(
      request.canaryLimit
        && Number.isFinite(request.canaryLimit.maxActions)
        && request.canaryLimit.maxActions > 0
        && nonEmptyString(request.canaryLimit.window),
    ),
    targetRecordNamed: nonEmptyString(request.targetRecordId),
    targetFieldAllowed: Boolean(
      actionEntry
        && nonEmptyString(request.targetField)
        && (
          actionEntry.allowedTargetFields.length === 0
          || actionEntry.allowedTargetFields.includes(request.targetField)
        ),
    ),
    auditEventSchemaPresent: Boolean(
      actionEntry
        && request.auditEvent
        && request.auditEvent.schema === actionEntry.auditEventSchema,
    ),
    auditEventMatchesRequest: actionEntry
      ? auditEventMatchesRequest(request, actionEntry)
      : false,
    liveMutationFlagExplicit: typeof request.liveMutationEnabled === "boolean",
    actionTypeAllowed: Boolean(actionEntry?.liveMutationAllowed || readOnlyDryRunAllowed),
  };

  const reasons: string[] = [];
  if (!checks.registeredActionType) {
    reasons.push(`unregistered production action: ${request.actionType || "missing"}`);
  }
  if (actionEntry?.blockedReason) {
    reasons.push(actionEntry.blockedReason);
  }
  if (!checks.ownerSystemNamed) {
    reasons.push("owner system is missing or does not match the registry entry");
  }
  if (!checks.proofSourceNamed) {
    reasons.push("proof source is missing or does not match the registry entry");
  }
  if (!checks.proofPathExists) {
    reasons.push("proof path is missing or does not exist");
  }
  if (!checks.idempotencyKeyPresent) {
    reasons.push("idempotency key is missing");
  }
  if (checks.idempotencyKeyPresent && !checks.idempotencyKeyIsUnique) {
    reasons.push(`duplicate idempotency key: ${request.idempotencyKey}`);
  }
  if (!checks.rollbackStrategyNamed) {
    reasons.push("rollback strategy is missing or does not match the registry entry");
  }
  if (!checks.rollbackPathExists) {
    reasons.push("rollback path is missing or does not exist");
  }
  if (!checks.dryRunModeExplicit) {
    reasons.push("dry-run mode must be explicit");
  }
  if (!checks.canaryModeExplicit) {
    reasons.push("canary mode must be explicit");
  }
  if (!checks.canaryLimitPresent) {
    reasons.push("canary limit is missing");
  }
  if (!checks.targetRecordNamed) {
    reasons.push("target record id is missing");
  }
  if (!checks.targetFieldAllowed) {
    reasons.push("target field is missing or is not allowed for this action");
  }
  if (!checks.auditEventSchemaPresent) {
    reasons.push("audit event schema is missing or unregistered");
  }
  if (!checks.auditEventMatchesRequest) {
    reasons.push("audit event does not match the action request");
  }
  if (!checks.liveMutationFlagExplicit) {
    reasons.push("live mutation flag must be explicit");
  }
  if (request.liveMutationEnabled && request.dryRun) {
    reasons.push("live mutation cannot be enabled while dry-run mode is true");
  }
  if (!request.liveMutationEnabled && !request.dryRun) {
    reasons.push("non-dry-run mode requires live mutation to be explicitly enabled");
  }
  if (actionEntry && !checks.actionTypeAllowed) {
    reasons.push(`production action is currently blocked: ${actionEntry.actionType}`);
  }

  const blockedActionTypes = actionEntry && !checks.actionTypeAllowed
    ? [actionEntry.actionType]
    : [];
  const deterministicChecksPassed = Object.values(checks).every(Boolean);
  if (!deterministicChecksPassed || blockedActionTypes.length > 0 || reasons.length > 0) {
    return {
      decision: "reject",
      actionEntry,
      reasons: unique(reasons),
      blockedActionTypes,
      checks,
    };
  }

  return {
    decision: request.dryRun ? "dry_run_allowed" : "live_allowed",
    actionEntry,
    reasons: [],
    blockedActionTypes,
    checks,
  };
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}
