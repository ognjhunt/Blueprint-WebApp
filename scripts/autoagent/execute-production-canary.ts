import fs from "node:fs/promises";
import path from "node:path";

import { type AutoAgentProductionActionEvaluation } from "../../server/agents/autoagent-production-action-registry.ts";
import {
  type AiProductionChangeProposal,
  type AiProductionChangeProposalSummary,
} from "./ai-production-change-proposer.ts";

export type ProductionCanaryResult =
  | "not_requested"
  | "not_attempted"
  | "not_attempted_execute_flag_missing"
  | "not_attempted_validator_rejected"
  | "duplicate_idempotency_suppressed"
  | "canary_committed"
  | "rolled_back";

export type ExecuteProductionCanaryResult = {
  attempted: boolean;
  result: ProductionCanaryResult;
  auditEventPath: string | null;
  rollbackSnapshotPath: string | null;
  rollbackApplied: boolean;
  liveMutationAttempted: boolean;
  liveMutationCommitted: boolean;
  proofPaths: string[];
  commandOutputs: string[];
};

export type ExecuteProductionCanaryOptions = {
  cwd?: string;
  outputDir: string;
  execute?: boolean;
  proposalSummary: AiProductionChangeProposalSummary;
  proposal: AiProductionChangeProposal | null;
  validation: AutoAgentProductionActionEvaluation | null;
  writeArtifacts?: boolean;
  now?: Date;
};

type IdempotencyLedger = {
  schema: "blueprint/autoagent-production-idempotency-ledger/v1";
  entries: Array<{
    idempotencyKey: string;
    actionType: string;
    targetSystem: string;
    committedAt: string;
    auditEventPath: string;
  }>;
};

async function readJsonFile(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath: string, value: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

async function readLedger(filePath: string): Promise<IdempotencyLedger> {
  try {
    const parsed = await readJsonFile(filePath);
    if (
      parsed
      && typeof parsed === "object"
      && !Array.isArray(parsed)
      && Array.isArray((parsed as { entries?: unknown }).entries)
    ) {
      return parsed as IdempotencyLedger;
    }
  } catch {
    // Missing or malformed ledgers fail closed to an empty in-run ledger. The
    // validator still has a separate duplicate check before execution.
  }
  return {
    schema: "blueprint/autoagent-production-idempotency-ledger/v1",
    entries: [],
  };
}

function shouldRollback(proposal: AiProductionChangeProposal | null) {
  return /force_rollback|rollback_required/i.test(
    proposal?.stop_condition ?? "",
  );
}

function isSafeRelativeOutputPath(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return false;
  }
  if (path.isAbsolute(value)) {
    return false;
  }
  const normalized = path.posix.normalize(value.replaceAll("\\", "/"));
  return Boolean(
    normalized === value.replaceAll("\\", "/")
      && !normalized.startsWith("../")
      && !normalized.includes("/../")
      && normalized.startsWith("output/autoagent/"),
  );
}

function validateReportPointerValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return ["report pointer value must be an object"];
  }
  const pointer = value as {
    report_path?: unknown;
    summary_path?: unknown;
    report_kind?: unknown;
  };
  const reasons: string[] = [];
  if (!isSafeRelativeOutputPath(pointer.report_path)) {
    reasons.push("report pointer report_path must stay under output/autoagent/");
  }
  if (!isSafeRelativeOutputPath(pointer.summary_path)) {
    reasons.push("report pointer summary_path must stay under output/autoagent/");
  }
  if (
    typeof pointer.report_kind !== "string"
    || !/^[a-z0-9_:-]{3,80}$/.test(pointer.report_kind)
  ) {
    reasons.push("report pointer report_kind must be a stable machine label");
  }
  return reasons;
}

function executorValidationErrors(proposal: AiProductionChangeProposal) {
  if (proposal.action_type !== "paperclip_internal_report_pointer_update") {
    return [];
  }
  return validateReportPointerValue(proposal.proposed_value);
}

function renderExecutionReport(execution: {
  generated_at: string;
  action: {
    action_type: string;
    target_system: string;
    target_record_id: string;
    target_field: string;
    idempotency_key: string;
  };
  execution: {
    result: ProductionCanaryResult;
    live_mutation_attempted: boolean;
    live_mutation_committed: boolean;
  };
  mutation: {
    surface: string;
    record_path: string | null;
  };
  rollback: {
    snapshot_path: string | null;
    strategy: string;
    applied: boolean;
    artifact_path: string | null;
    reason: string | null;
  };
}) {
  return [
    "# AutoAgent Production Canary Execution",
    "",
    `Generated: ${execution.generated_at}`,
    `Action: ${execution.action.action_type}`,
    `Target system: ${execution.action.target_system}`,
    `Target record: ${execution.action.target_record_id}`,
    `Target field: ${execution.action.target_field}`,
    `Idempotency key: ${execution.action.idempotency_key}`,
    `Result: ${execution.execution.result}`,
    `Live mutation attempted: ${execution.execution.live_mutation_attempted}`,
    `Live mutation committed: ${execution.execution.live_mutation_committed}`,
    `Mutation surface: ${execution.mutation.surface}`,
    `Mutation record: ${execution.mutation.record_path ?? "none"}`,
    `Rollback strategy: ${execution.rollback.strategy}`,
    `Rollback snapshot: ${execution.rollback.snapshot_path ?? "none"}`,
    `Rollback applied: ${execution.rollback.applied}`,
    `Rollback artifact: ${execution.rollback.artifact_path ?? "none"}`,
    `Rollback reason: ${execution.rollback.reason ?? "none"}`,
    "",
  ].join("\n");
}

function notAttempted(
  result: ProductionCanaryResult,
  rollbackSnapshotPath: string | null,
  commandOutputs: string[],
): ExecuteProductionCanaryResult {
  return {
    attempted: false,
    result,
    auditEventPath: null,
    rollbackSnapshotPath,
    rollbackApplied: false,
    liveMutationAttempted: false,
    liveMutationCommitted: false,
    proofPaths: [],
    commandOutputs,
  };
}

export async function executeProductionCanary(
  options: ExecuteProductionCanaryOptions,
): Promise<ExecuteProductionCanaryResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const outputDir = path.resolve(cwd, options.outputDir);
  const generatedAt = (options.now ?? new Date()).toISOString();
  const request = options.proposalSummary.request;
  const rollbackSnapshotPath = request?.rollbackPath ?? null;

  if (!request || !options.validation || !options.proposal) {
    return notAttempted("not_attempted", rollbackSnapshotPath, [
      "production-canary: not_attempted no validated production action request",
    ]);
  }

  if (options.validation.decision === "reject") {
    return notAttempted("not_attempted_validator_rejected", rollbackSnapshotPath, [
      `production-canary: not_attempted validator=${options.proposalSummary.status}`,
    ]);
  }

  if (options.execute !== true) {
    return notAttempted("not_attempted_execute_flag_missing", rollbackSnapshotPath, [
      "production-canary: not_attempted execute flag missing",
    ]);
  }

  if (options.validation.decision !== "live_allowed") {
    return notAttempted("not_attempted_validator_rejected", rollbackSnapshotPath, [
      `production-canary: not_attempted validation_decision=${options.validation.decision}`,
    ]);
  }

  const executorErrors = executorValidationErrors(options.proposal);
  if (executorErrors.length > 0) {
    return notAttempted("not_attempted_validator_rejected", rollbackSnapshotPath, [
      ...executorErrors.map((reason) => `production-canary: not_attempted ${reason}`),
    ]);
  }

  const ledgerPath = path.join(outputDir, "idempotency-ledger.json");
  const ledger = await readLedger(ledgerPath);
  const duplicate = ledger.entries.some((entry) =>
    entry.idempotencyKey === request.idempotencyKey
  );
  if (duplicate) {
    return notAttempted("duplicate_idempotency_suppressed", rollbackSnapshotPath, [
      `production-canary: duplicate idempotency key suppressed ${request.idempotencyKey}`,
    ]);
  }

  const auditEventPath = path.join(outputDir, "audit-event.json");
  const executionPath = path.join(outputDir, "execution.json");
  const executionReportPath = path.join(outputDir, "execution-report.md");
  const mutationRecordPath = path.join(outputDir, "mutation-record.json");
  const rollbackArtifactPath = path.join(outputDir, "rollback-applied.json");
  const rollbackApplied = shouldRollback(options.proposal);
  const result: ProductionCanaryResult = rollbackApplied
    ? "rolled_back"
    : "canary_committed";
  const auditEvent = {
    schema: "blueprint/autoagent-production-canary-audit/v1",
    generated_at: generatedAt,
    request,
    proposal: options.proposal,
    validation: options.validation,
    execution: {
      result,
      action_type: request.actionType,
      target_system: request.ownerSystem,
      idempotency_key: request.idempotencyKey,
      canary_limit: request.canaryLimit,
      live_mutation_attempted: true,
      live_mutation_committed: !rollbackApplied,
      mutation_class: "allowlisted_production_harness",
    },
    rollback: {
      snapshot_path: rollbackSnapshotPath,
      applied: rollbackApplied,
      reason: rollbackApplied
        ? `stop condition triggered: ${options.proposal.stop_condition}`
        : null,
    },
  };
  const mutationRecord = rollbackApplied
    ? null
    : {
      schema: "blueprint/autoagent-production-canary-mutation/v1",
      generated_at: generatedAt,
      action_type: request.actionType,
      target_system: request.ownerSystem,
      target_record_id: options.proposal.target_record_id,
      target_field: options.proposal.target_field,
      mutation_surface:
        options.validation.actionEntry?.mutationSurface ?? "unknown",
      proposed_value: options.proposal.proposed_value,
      proof_path: request.proofPath,
      rollback_snapshot_path: rollbackSnapshotPath,
    };
  const execution = {
    schema: "blueprint/autoagent-production-canary-execution/v1",
    generated_at: generatedAt,
    action: {
      action_type: request.actionType,
      action_tier: options.validation.actionEntry?.actionTier ?? null,
      target_system: request.ownerSystem,
      target_record_id: options.proposal.target_record_id,
      target_field: options.proposal.target_field,
      idempotency_key: request.idempotencyKey,
    },
    proof: {
      proof_path: request.proofPath,
      audit_event_path: auditEventPath,
    },
    mutation: {
      surface: options.validation.actionEntry?.mutationSurface ?? "unknown",
      proposed_value: options.proposal.proposed_value,
      record_path: mutationRecord ? mutationRecordPath : null,
      canary_limit: request.canaryLimit,
    },
    rollback: {
      snapshot_path: rollbackSnapshotPath,
      strategy: request.rollbackStrategy,
      applied: rollbackApplied,
      artifact_path: rollbackApplied ? rollbackArtifactPath : null,
      reason: rollbackApplied
        ? `stop condition triggered: ${options.proposal.stop_condition}`
        : null,
    },
    execution: {
      result,
      live_mutation_attempted: true,
      live_mutation_committed: !rollbackApplied,
    },
  };

  if (options.writeArtifacts !== false) {
    await writeJson(auditEventPath, auditEvent);
    await writeJson(executionPath, execution);
    await writeText(executionReportPath, renderExecutionReport(execution));
    if (!rollbackApplied) {
      await writeJson(mutationRecordPath, mutationRecord);
      ledger.entries.push({
        idempotencyKey: request.idempotencyKey,
        actionType: request.actionType,
        targetSystem: request.ownerSystem,
        committedAt: generatedAt,
        auditEventPath,
      });
      await writeJson(ledgerPath, ledger);
    } else {
      await writeJson(rollbackArtifactPath, {
        schema: "blueprint/autoagent-production-canary-rollback/v1",
        generated_at: generatedAt,
        action_type: request.actionType,
        rollback_strategy: request.rollbackStrategy,
        idempotency_key: request.idempotencyKey,
        rollback_snapshot_path: rollbackSnapshotPath,
        reason: auditEvent.rollback.reason,
      });
    }
  }

  return {
    attempted: true,
    result,
    auditEventPath,
    rollbackSnapshotPath,
    rollbackApplied,
    liveMutationAttempted: true,
    liveMutationCommitted: !rollbackApplied,
    proofPaths: rollbackApplied
      ? [auditEventPath, executionPath, executionReportPath, rollbackArtifactPath]
      : [auditEventPath, executionPath, executionReportPath, mutationRecordPath, ledgerPath],
    commandOutputs: [
      `production-canary: result=${result} action=${request.actionType} idempotency=${request.idempotencyKey}`,
    ],
  };
}

export async function readProductionIdempotencyKeys(
  options: { cwd?: string; outputDir: string },
) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const ledgerPath = path.resolve(cwd, options.outputDir, "idempotency-ledger.json");
  const ledger = await readLedger(ledgerPath);
  return new Set(ledger.entries.map((entry) => entry.idempotencyKey));
}
