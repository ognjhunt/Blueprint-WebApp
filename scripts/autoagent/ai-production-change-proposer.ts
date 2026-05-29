import { spawn } from "node:child_process";
import path from "node:path";

import {
  AUTOAGENT_PRODUCTION_ACTION_REGISTRY,
  evaluateAutoAgentProductionAction,
  type AutoAgentProductionActionEvaluation,
  type AutoAgentProductionActionRequest,
  type AutoAgentProductionActionTier,
} from "../../server/agents/autoagent-production-action-registry.ts";
import { type ProductionContextBundle } from "./build-production-context-bundle.ts";

export type AiProductionChangeProposal = {
  proposal_id: string;
  action_type: string;
  target_system: string;
  target_record_id: string;
  target_field: string;
  proposed_value: unknown;
  reason: string;
  idempotency_key: string;
  stop_condition: string;
};

export type AiProductionChangeProposalRequest = {
  cwd: string;
  contextBundle: ProductionContextBundle;
  executeRequested: boolean;
  prompt: string;
  schema: typeof AI_PRODUCTION_CHANGE_PROPOSAL_RESPONSE_SCHEMA;
};

export type AiProductionChangeProposalInvoker = (
  request: AiProductionChangeProposalRequest,
) => Promise<string>;

export type AiProductionChangeProposalStatus =
  | "not_requested"
  | "fallback_ai_unavailable"
  | "validated_dry_run_allowed"
  | "validated_live_allowed"
  | "blocked"
  | "duplicate_idempotency"
  | "rejected";

export type AiProductionChangeProposalSummary = {
  schema: "blueprint/autoagent-production-change-proposal-summary/v1";
  generated_at: string;
  status: AiProductionChangeProposalStatus;
  ai_used: boolean;
  proposal_id: string | null;
  action_type: string | null;
  target_system: string | null;
  target_record_id: string | null;
  target_field: string | null;
  idempotency_key: string | null;
  stop_condition: string | null;
  deterministic_gate_reason: string;
  reasons: string[];
  request: AutoAgentProductionActionRequest | null;
  validation: AutoAgentProductionActionEvaluation | null;
};

export type RunAiProductionChangeProposalOptions = {
  cwd?: string;
  enabled?: boolean;
  contextBundle: ProductionContextBundle;
  executeRequested?: boolean;
  invoker?: AiProductionChangeProposalInvoker;
  env?: Record<string, string | undefined>;
  usedIdempotencyKeys?: ReadonlySet<string> | readonly string[];
  timeoutMs?: number;
  now?: Date;
};

const DEFAULT_TIMEOUT_MS = 45_000;

export const AI_PRODUCTION_CHANGE_PROPOSAL_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "proposal_id",
    "action_type",
    "target_system",
    "target_record_id",
    "target_field",
    "proposed_value",
    "reason",
    "idempotency_key",
    "stop_condition",
  ],
  properties: {
    proposal_id: { type: "string", pattern: "^[a-z0-9][a-z0-9-]{7,96}$" },
    action_type: { type: "string", minLength: 3 },
    target_system: { type: "string", minLength: 3 },
    target_record_id: { type: "string", minLength: 3 },
    target_field: { type: "string", minLength: 3 },
    proposed_value: {},
    reason: { type: "string", minLength: 24 },
    idempotency_key: { type: "string", minLength: 12 },
    stop_condition: { type: "string", minLength: 8 },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildPrompt(contextBundle: ProductionContextBundle, executeRequested: boolean) {
  const gatedLiveActionTypes = contextBundle.registered_live_action_types.filter(
    (actionType) => !contextBundle.allowed_live_action_types.includes(actionType),
  );
  return [
    "You are proposing one narrow Blueprint AutoAgent production canary action.",
    "Return JSON only. No markdown, prose, comments, or code fences.",
    "The JSON must match this schema exactly:",
    JSON.stringify(AI_PRODUCTION_CHANGE_PROPOSAL_RESPONSE_SCHEMA),
    "",
    "Allowed live action types for this context:",
    ...contextBundle.allowed_live_action_types.map((actionType) => `- ${actionType}`),
    "",
    "Allowed action constraints:",
    ...contextBundle.allowed_live_action_types.flatMap((actionType) => {
      const constraints = contextBundle.action_constraints[actionType];
      if (!constraints) {
        return [`- ${actionType}: no constraints supplied; do not propose this action`];
      }
      return [
        `- ${actionType}:`,
        `  owner_system=${constraints.owner_system}`,
        `  proof_source=${constraints.proof_source}`,
        `  rollback_strategy=${constraints.rollback_strategy}`,
        `  mutation_surface=${constraints.mutation_surface}`,
        `  requires_prior_live_action_proof=${constraints.requires_prior_live_action_proof ?? "none"}`,
        `  allowed_target_fields=${constraints.allowed_target_fields.join(", ") || "none"}`,
      ];
    }),
    "",
    "Registered but currently gated live action types:",
    ...(gatedLiveActionTypes.length > 0
      ? gatedLiveActionTypes.map((actionType) => `- ${actionType}`)
      : ["- none"]),
    "",
    "Blocked actions:",
    ...contextBundle.blocked_action_types.map((actionType) => `- ${actionType}`),
    "",
    "Constraints:",
    ...contextBundle.constraints.map((constraint) => `- ${constraint}`),
    "",
    `Execution requested by caller: ${executeRequested}`,
    `Context bundle generated at: ${contextBundle.generated_at}`,
    `Owner system: ${contextBundle.owner_system}`,
    `Target record id: ${contextBundle.target_record_id}`,
    `Proof path: ${contextBundle.proof_path}`,
    `Rollback snapshot path: ${contextBundle.rollback_snapshot_path}`,
    `First live lane proven: ${contextBundle.first_live_lane_proven}`,
    `First live lane proof path: ${contextBundle.first_live_lane_proof_path}`,
  ].join("\n");
}

function parseArgsJson(value: string | undefined) {
  if (!value) return [];
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
    throw new Error("BLUEPRINT_AUTORESEARCH_AI_PRODUCTION_PROPOSAL_ARGS_JSON must be a JSON array of strings");
  }
  return parsed as string[];
}

function commandInvokerFromEnv(
  env: Record<string, string | undefined>,
  timeoutMs: number,
): AiProductionChangeProposalInvoker | null {
  const command = env.BLUEPRINT_AUTORESEARCH_AI_PRODUCTION_PROPOSAL_BIN;
  if (!command) return null;
  const args = parseArgsJson(env.BLUEPRINT_AUTORESEARCH_AI_PRODUCTION_PROPOSAL_ARGS_JSON);

  return async (request) => runProposalCommand({
    cwd: request.cwd,
    command,
    args,
    input: request.prompt,
    timeoutMs,
    env,
  });
}

async function runProposalCommand(input: {
  cwd: string;
  command: string;
  args: string[];
  input: string;
  timeoutMs: number;
  env: Record<string, string | undefined>;
}) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(input.command, input.args, {
      cwd: input.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ...input.env,
      },
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`AI production proposal command timed out after ${input.timeoutMs}ms`));
    }, input.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`AI production proposal command exited ${code}: ${stderr.trim()}`));
        return;
      }
      resolve(stdout);
    });
    child.stdin.end(input.input);
  });
}

function parseProposal(rawJson: unknown): {
  proposal: AiProductionChangeProposal | null;
  reasons: string[];
} {
  if (!isRecord(rawJson)) {
    return { proposal: null, reasons: ["AI production proposal response must be a JSON object"] };
  }

  const reasons: string[] = [];
  const allowedKeys = new Set([
    "proposal_id",
    "action_type",
    "target_system",
    "target_record_id",
    "target_field",
    "proposed_value",
    "reason",
    "idempotency_key",
    "stop_condition",
  ]);
  const unknownKeys = Object.keys(rawJson).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    reasons.push(`unknown top-level fields are not allowed: ${unknownKeys.join(", ")}`);
  }

  const proposalId = stringValue(rawJson.proposal_id);
  const actionType = stringValue(rawJson.action_type);
  const targetSystem = stringValue(rawJson.target_system);
  const targetRecordId = stringValue(rawJson.target_record_id);
  const targetField = stringValue(rawJson.target_field);
  const reason = stringValue(rawJson.reason);
  const idempotencyKey = stringValue(rawJson.idempotency_key);
  const stopCondition = stringValue(rawJson.stop_condition);

  if (!/^[a-z0-9][a-z0-9-]{7,96}$/.test(proposalId)) {
    reasons.push("proposal_id must be stable lowercase kebab case and at least 8 characters");
  }
  if (actionType.length < 3) reasons.push("action_type is required");
  if (targetSystem.length < 3) reasons.push("target_system is required");
  if (targetRecordId.length < 3) reasons.push("target_record_id is required");
  if (targetField.length < 3) reasons.push("target_field is required");
  if (reason.length < 24) reasons.push("reason must describe the production action concretely");
  if (idempotencyKey.length < 12) reasons.push("idempotency_key must be concrete");
  if (stopCondition.length < 8) reasons.push("stop_condition must be concrete");

  if (reasons.length > 0) {
    return { proposal: null, reasons };
  }

  return {
    proposal: {
      proposal_id: proposalId,
      action_type: actionType,
      target_system: targetSystem,
      target_record_id: targetRecordId,
      target_field: targetField,
      proposed_value: rawJson.proposed_value,
      reason,
      idempotency_key: idempotencyKey,
      stop_condition: stopCondition,
    },
    reasons,
  };
}

function actionTierFor(actionType: string): AutoAgentProductionActionTier {
  return actionType in AUTOAGENT_PRODUCTION_ACTION_REGISTRY
    ? AUTOAGENT_PRODUCTION_ACTION_REGISTRY[
      actionType as keyof typeof AUTOAGENT_PRODUCTION_ACTION_REGISTRY
    ].actionTier
    : "internal_metadata_update";
}

function requestForProposal(input: {
  proposal: AiProductionChangeProposal;
  contextBundle: ProductionContextBundle;
  executeRequested: boolean;
}): AutoAgentProductionActionRequest {
  const entry = input.proposal.action_type in AUTOAGENT_PRODUCTION_ACTION_REGISTRY
    ? AUTOAGENT_PRODUCTION_ACTION_REGISTRY[
      input.proposal.action_type as keyof typeof AUTOAGENT_PRODUCTION_ACTION_REGISTRY
    ]
    : null;
  const dryRun = !input.executeRequested;
  const liveMutationEnabled = input.executeRequested;
  const actionTier = entry?.actionTier ?? actionTierFor(input.proposal.action_type);
  const ownerSystem = input.proposal.target_system;
  return {
    actionType: input.proposal.action_type,
    ownerSystem,
    targetRecordId: input.proposal.target_record_id,
    targetField: input.proposal.target_field,
    proofSource: entry?.proofSource ?? input.contextBundle.proof_source,
    proofPath: input.contextBundle.proof_path,
    idempotencyKey: input.proposal.idempotency_key,
    rollbackStrategy:
      entry?.rollbackStrategy ?? "restore_previous_metadata_snapshot",
    rollbackPath: input.contextBundle.rollback_snapshot_path,
    dryRun,
    canaryMode: true,
    canaryLimit: {
      maxActions: 1,
      window: "per_run",
    },
    liveMutationEnabled,
    auditEvent: {
      schema: "blueprint/autoagent-production-action-audit/v1",
      actionType: input.proposal.action_type,
      actionTier,
      ownerSystem,
      targetRecordId: input.proposal.target_record_id,
      targetField: input.proposal.target_field,
      idempotencyKey: input.proposal.idempotency_key,
      proofPath: input.contextBundle.proof_path,
      rollbackPath: input.contextBundle.rollback_snapshot_path,
      dryRun,
      canaryMode: true,
      liveMutationEnabled,
    },
  };
}

function statusForValidation(
  validation: AutoAgentProductionActionEvaluation,
): AiProductionChangeProposalStatus {
  if (validation.decision === "dry_run_allowed") return "validated_dry_run_allowed";
  if (validation.decision === "live_allowed") return "validated_live_allowed";
  if (validation.reasons.some((reason) => /duplicate idempotency key/i.test(reason))) {
    return "duplicate_idempotency";
  }
  if (validation.blockedActionTypes.length > 0 || validation.actionEntry?.blockedReason) {
    return "blocked";
  }
  return "rejected";
}

function summaryFor(input: {
  status: AiProductionChangeProposalStatus;
  aiUsed: boolean;
  generatedAt: string;
  proposal?: AiProductionChangeProposal | null;
  request?: AutoAgentProductionActionRequest | null;
  validation?: AutoAgentProductionActionEvaluation | null;
  reasons?: string[];
  deterministicGateReason: string;
}): AiProductionChangeProposalSummary {
  const proposal = input.proposal ?? null;
  return {
    schema: "blueprint/autoagent-production-change-proposal-summary/v1",
    generated_at: input.generatedAt,
    status: input.status,
    ai_used: input.aiUsed,
    proposal_id: proposal?.proposal_id ?? null,
    action_type: proposal?.action_type ?? input.request?.actionType ?? null,
    target_system: proposal?.target_system ?? input.request?.ownerSystem ?? null,
    target_record_id: proposal?.target_record_id ?? null,
    target_field: proposal?.target_field ?? null,
    idempotency_key: proposal?.idempotency_key ?? input.request?.idempotencyKey ?? null,
    stop_condition: proposal?.stop_condition ?? null,
    deterministic_gate_reason: input.deterministicGateReason,
    reasons: unique(input.reasons ?? []),
    request: input.request ?? null,
    validation: input.validation ?? null,
  };
}

export async function runAiProductionChangeProposal(
  options: RunAiProductionChangeProposalOptions,
): Promise<{
  summary: AiProductionChangeProposalSummary;
  proposal: AiProductionChangeProposal | null;
  raw_output: string | null;
  prompt: string;
}> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const generatedAt = (options.now ?? new Date()).toISOString();
  const executeRequested = options.executeRequested === true;
  const prompt = buildPrompt(options.contextBundle, executeRequested);

  if (options.enabled !== true) {
    return {
      summary: summaryFor({
        status: "not_requested",
        aiUsed: false,
        generatedAt,
        deterministicGateReason:
          "not_requested: no AI production proposal was requested",
      }),
      proposal: null,
      raw_output: null,
      prompt,
    };
  }

  const env = options.env ?? process.env;
  const invoker = options.invoker
    ?? commandInvokerFromEnv(env, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (!invoker) {
    return {
      summary: summaryFor({
        status: "fallback_ai_unavailable",
        aiUsed: false,
        generatedAt,
        deterministicGateReason:
          "fallback_ai_unavailable: no AI production proposal command or session was configured",
      }),
      proposal: null,
      raw_output: null,
      prompt,
    };
  }

  let rawOutput: string;
  try {
    rawOutput = await invoker({
      cwd,
      contextBundle: options.contextBundle,
      executeRequested,
      prompt,
      schema: AI_PRODUCTION_CHANGE_PROPOSAL_RESPONSE_SCHEMA,
    });
  } catch (error) {
    return {
      summary: summaryFor({
        status: "fallback_ai_unavailable",
        aiUsed: false,
        generatedAt,
        deterministicGateReason:
          `fallback_ai_unavailable: ${error instanceof Error ? error.message : String(error)}`,
      }),
      proposal: null,
      raw_output: null,
      prompt,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOutput);
  } catch {
    return {
      summary: summaryFor({
        status: "rejected",
        aiUsed: true,
        generatedAt,
        reasons: ["AI production proposal returned non-JSON output"],
        deterministicGateReason:
          "rejected: AI production proposal returned non-JSON output",
      }),
      proposal: null,
      raw_output: rawOutput,
      prompt,
    };
  }

  const parsedProposal = parseProposal(parsed);
  if (!parsedProposal.proposal) {
    return {
      summary: summaryFor({
        status: "rejected",
        aiUsed: true,
        generatedAt,
        reasons: parsedProposal.reasons,
        deterministicGateReason:
          `rejected: ${parsedProposal.reasons[0] ?? "AI production proposal failed schema validation"}`,
      }),
      proposal: null,
      raw_output: rawOutput,
      prompt,
    };
  }

  const request = requestForProposal({
    proposal: parsedProposal.proposal,
    contextBundle: options.contextBundle,
    executeRequested,
  });
  const validation = evaluateAutoAgentProductionAction(request, {
    cwd,
    usedIdempotencyKeys: options.usedIdempotencyKeys,
  });
  const contextAllowsAction = options.contextBundle.allowed_live_action_types.includes(
    parsedProposal.proposal.action_type,
  );
  if (validation.decision !== "reject" && !contextAllowsAction) {
    const gatedReason =
      `first live production lane proof is missing for ${parsedProposal.proposal.action_type}; allowed actions are ${options.contextBundle.allowed_live_action_types.join(", ") || "none"}`;
    return {
      summary: summaryFor({
        status: "blocked",
        aiUsed: true,
        generatedAt,
        proposal: parsedProposal.proposal,
        request,
        validation,
        reasons: [gatedReason],
        deterministicGateReason: `blocked: ${gatedReason}`,
      }),
      proposal: parsedProposal.proposal,
      raw_output: rawOutput,
      prompt,
    };
  }
  const status = statusForValidation(validation);
  if (validation.decision === "reject") {
    return {
      summary: summaryFor({
        status,
        aiUsed: true,
        generatedAt,
        proposal: parsedProposal.proposal,
        request,
        validation,
        reasons: validation.reasons,
        deterministicGateReason:
          `${status}: ${validation.reasons[0] ?? "production action validator rejected the proposal"}`,
      }),
      proposal: parsedProposal.proposal,
      raw_output: rawOutput,
      prompt,
    };
  }

  return {
    summary: summaryFor({
      status,
      aiUsed: true,
      generatedAt,
      proposal: parsedProposal.proposal,
      request,
      validation,
      deterministicGateReason:
        `${status}: registry validation passed; execution remains controlled by the deterministic canary harness`,
    }),
    proposal: parsedProposal.proposal,
    raw_output: rawOutput,
    prompt,
  };
}
