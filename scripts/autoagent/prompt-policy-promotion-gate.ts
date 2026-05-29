import fs from "node:fs/promises";
import path from "node:path";

import {
  validatePaperclipGoalCloseoutPacket,
  type PaperclipGoalCloseoutAllowedState,
} from "../../server/agents/goal-closeout-contract.ts";
import {
  evaluateAutoPromotionEligibility,
  type AutoAgentClaim,
  type AutoAgentLiveSideEffect,
  type AutoAgentPromotionDecision,
  type AutoAgentShadowSummary,
} from "../../server/agents/autoagent-promotion-policy.ts";
import { type EvalLane, type LocalEvalSummary } from "./local-evaluator.ts";
import { runPipeline } from "./run-pipeline.ts";

export type PromptPolicyPromotionDecision = AutoAgentPromotionDecision;

export type PromptPolicyCloseoutProof = {
  goalObjective: string;
  issueRunId: string;
  budgetTimeoutContext: string;
  stageReached: string;
  stateClaimed: PaperclipGoalCloseoutAllowedState;
  owner: string;
  blockerDecisionId: string;
  proofPaths: string[];
  commandOutputs: string[];
  nextAction: string;
  retryResumeCondition: string;
  residualRisk: string;
};

export type PromptPolicyPromotionCandidate = {
  candidateId: string;
  title: string;
  source: "autoagent";
  targetRuntime: "paperclip_hermes";
  changeType: "prompt_policy_orchestration";
  requiredLanes: EvalLane[];
  changedPaths: string[];
  rollbackCondition: string;
  requestedDecision?: PromptPolicyPromotionDecision;
  claims: AutoAgentClaim[];
  liveSideEffects: AutoAgentLiveSideEffect[];
  shadowSummary: AutoAgentShadowSummary | null;
  closeoutProof: PromptPolicyCloseoutProof | null;
};

export type CommandOutput = {
  command: string;
  exitCode: number;
  output: string[];
};

type CandidateValidationResult = {
  candidate: PromptPolicyPromotionCandidate | null;
  closeoutPacket: string;
  valid: boolean;
  errors: string[];
};

export type PromotionGateEvaluation = {
  decision: PromptPolicyPromotionDecision;
  reasons: string[];
  checks: {
    offlineEvalPassed: boolean;
    negativeControlsBlocked: boolean;
    closeoutProofPresent: boolean;
    requiredLaneCoveragePresent: boolean;
    shadowEvidencePassed: boolean;
    noRegressionWindowPassed: boolean;
    rollbackConditionPresent: boolean;
    blockedClaimsAbsent: boolean;
    livePaperclipMutationAttempted: false;
  };
  blockedClaims: string[];
  requiredNextEvidence: string[];
  rollbackCondition: string;
  rollbackTriggers: string[];
  policyTiers: Record<string, string>;
  policyTier: string;
};

type GateOptions = {
  candidatePath: string;
  fixtureRoot: string;
  harborRoot: string;
  packetOutput: string;
  sampleCount: number;
  writePacket: boolean;
};

const DEFAULT_LANES: EvalLane[] = [
  "waitlist_triage",
  "support_triage",
  "preview_diagnosis",
];

const DEFAULT_CANDIDATE_PATH = path.resolve(
  "labs/autoagent/promotion-candidates/autoagent-to-paperclip-hermes-2026-05-28.json",
);
const DEFAULT_FIXTURE_ROOT = path.resolve("labs/autoagent/tasks");
const DEFAULT_HARBOR_ROOT = path.resolve("labs/autoagent/harbor");
const DEFAULT_PACKET_OUTPUT = path.resolve(
  "output/autoagent/prompt-policy-promotion/latest/promotion-packet.md",
);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => asString(item))
    .filter(Boolean);
}

function laneList(value: unknown) {
  const lanes = stringList(value).filter((lane): lane is EvalLane =>
    (DEFAULT_LANES as readonly string[]).includes(lane),
  );
  return lanes.length > 0 ? lanes : [...DEFAULT_LANES];
}

function claimList(value: unknown): AutoAgentClaim[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const claimType = asString(record.claimType);
      if (!claimType) {
        return null;
      }
      return {
        claimType: claimType as AutoAgentClaim["claimType"],
        targetClaimType: asString(record.targetClaimType) as AutoAgentClaim["targetClaimType"],
        evidenceSource: asString(record.evidenceSource) as AutoAgentClaim["evidenceSource"],
        description: asString(record.description),
      };
    })
    .filter((item): item is AutoAgentClaim => Boolean(item));
}

function liveSideEffectList(value: unknown): AutoAgentLiveSideEffect[] {
  return stringList(value) as AutoAgentLiveSideEffect[];
}

function asFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseShadowSummary(value: unknown, errors: string[]) {
  if (value == null) {
    return null;
  }
  const record = asRecord(value);
  if (!record) {
    errors.push("shadowSummary must be an object when present");
    return null;
  }
  const lane = asString(record.lane);
  const sampleCount = asFiniteNumber(record.sampleCount);
  const cleanSampleCount = asFiniteNumber(record.cleanSampleCount);
  const regressionCount = asFiniteNumber(record.regressionCount);
  const noRegressionWindowDays = asFiniteNumber(record.noRegressionWindowDays);

  if (!lane) errors.push("shadowSummary.lane is required");
  if (sampleCount == null) errors.push("shadowSummary.sampleCount is required");
  if (cleanSampleCount == null) errors.push("shadowSummary.cleanSampleCount is required");
  if (regressionCount == null) errors.push("shadowSummary.regressionCount is required");
  if (noRegressionWindowDays == null) {
    errors.push("shadowSummary.noRegressionWindowDays is required");
  }

  return {
    lane: lane as AutoAgentShadowSummary["lane"],
    sampleCount: sampleCount ?? 0,
    cleanSampleCount: cleanSampleCount ?? 0,
    regressionCount: regressionCount ?? 0,
    safetyBlockers: stringList(record.safetyBlockers),
    mismatchedDecisionFields: stringList(record.mismatchedDecisionFields),
    noRegressionWindowDays: noRegressionWindowDays ?? 0,
    canaryCompleted: record.canaryCompleted === true,
    canaryRegressionCount: asFiniteNumber(record.canaryRegressionCount) ?? undefined,
  } satisfies AutoAgentShadowSummary;
}

function parseCloseoutProof(value: unknown, errors: string[]) {
  const record = asRecord(value);
  if (!record) {
    errors.push("closeoutProof must be present and must be an object");
    return null;
  }

  const proof: PromptPolicyCloseoutProof = {
    goalObjective: asString(record.goalObjective),
    issueRunId: asString(record.issueRunId),
    budgetTimeoutContext: asString(record.budgetTimeoutContext),
    stageReached: asString(record.stageReached),
    stateClaimed: asString(record.stateClaimed) as PaperclipGoalCloseoutAllowedState,
    owner: asString(record.owner),
    blockerDecisionId: asString(record.blockerDecisionId),
    proofPaths: stringList(record.proofPaths),
    commandOutputs: stringList(record.commandOutputs),
    nextAction: asString(record.nextAction),
    retryResumeCondition: asString(record.retryResumeCondition),
    residualRisk: asString(record.residualRisk),
  };

  for (const [field, valueForField] of Object.entries(proof)) {
    if (Array.isArray(valueForField)) {
      if (valueForField.length === 0) {
        errors.push(`closeoutProof.${field} must contain at least one value`);
      }
      continue;
    }
    if (!valueForField) {
      errors.push(`closeoutProof.${field} is required`);
    }
  }

  return proof;
}

export function renderCloseoutProof(proof: PromptPolicyCloseoutProof | null) {
  if (!proof) {
    return "";
  }

  return [
    `Goal objective: ${proof.goalObjective}`,
    `Issue/run id: ${proof.issueRunId}`,
    `Budget/timeout context: ${proof.budgetTimeoutContext}`,
    `Stage reached: ${proof.stageReached}`,
    `State claimed: ${proof.stateClaimed}`,
    `Owner: ${proof.owner}`,
    `Blocker/decision id: ${proof.blockerDecisionId}`,
    `Proof paths: ${proof.proofPaths.join("; ")}`,
    `Command outputs: ${proof.commandOutputs.join("; ")}`,
    `Next action: ${proof.nextAction}`,
    `Retry/resume condition: ${proof.retryResumeCondition}`,
    `Residual risk: ${proof.residualRisk}`,
  ].join("\n");
}

export function validatePromotionCandidate(value: unknown): CandidateValidationResult {
  const errors: string[] = [];
  const record = asRecord(value);
  if (!record) {
    return {
      candidate: null,
      closeoutPacket: "",
      valid: false,
      errors: ["candidate manifest must be a JSON object"],
    };
  }

  const closeoutProof = parseCloseoutProof(record.closeoutProof, errors);
  const shadowSummary = parseShadowSummary(record.shadowSummary, errors);
  const candidate: PromptPolicyPromotionCandidate = {
    candidateId: asString(record.candidateId),
    title: asString(record.title),
    source: asString(record.source) as "autoagent",
    targetRuntime: asString(record.targetRuntime) as "paperclip_hermes",
    changeType: asString(record.changeType) as "prompt_policy_orchestration",
    requiredLanes: laneList(record.requiredLanes),
    changedPaths: stringList(record.changedPaths),
    rollbackCondition: asString(record.rollbackCondition),
    requestedDecision: asString(record.requestedDecision) as PromptPolicyPromotionDecision,
    claims: claimList(record.claims),
    liveSideEffects: liveSideEffectList(record.liveSideEffects),
    shadowSummary,
    closeoutProof,
  };

  if (!candidate.candidateId) errors.push("candidateId is required");
  if (!candidate.title) errors.push("title is required");
  if (candidate.source !== "autoagent") errors.push("source must be autoagent");
  if (candidate.targetRuntime !== "paperclip_hermes") {
    errors.push("targetRuntime must be paperclip_hermes");
  }
  if (candidate.changeType !== "prompt_policy_orchestration") {
    errors.push("changeType must be prompt_policy_orchestration");
  }
  if (candidate.changedPaths.length === 0) {
    errors.push("changedPaths must contain at least one path");
  }
  if (!candidate.rollbackCondition) {
    errors.push("rollbackCondition is required");
  }

  const closeoutPacket = renderCloseoutProof(closeoutProof);
  if (closeoutPacket) {
    const closeoutValidation = validatePaperclipGoalCloseoutPacket(closeoutPacket);
    for (const issue of closeoutValidation.errors) {
      errors.push(issue.message);
    }
  }

  return {
    candidate,
    closeoutPacket,
    valid: errors.length === 0,
    errors,
  };
}

function laneCoveragePresent(summary: LocalEvalSummary | null, requiredLanes: EvalLane[]) {
  if (!summary) {
    return false;
  }
  return requiredLanes.every((lane) => summary.laneSummaries[lane]?.totalCases > 0);
}

export function evaluatePromotionGate(params: {
  candidateValidation: CandidateValidationResult;
  localEval: LocalEvalSummary | null;
  evalCommandFailed?: boolean;
}): PromotionGateEvaluation {
  const requiredLanes = params.candidateValidation.candidate?.requiredLanes ?? DEFAULT_LANES;
  const summary = params.localEval;
  const offlineEvalPassed = Boolean(
    summary
      && summary.totalCases > 0
      && summary.totalFailed === 0
      && !params.evalCommandFailed,
  );
  const negativeControlsBlocked = Boolean(
    summary
      && summary.totalNegativeControls > 0
      && summary.totalNegativeControlsBlocked === summary.totalNegativeControls,
  );
  const requiredLaneCoveragePresent = laneCoveragePresent(summary, requiredLanes);
  const closeoutProofPresent = params.candidateValidation.valid;
  const centralEvaluation = params.candidateValidation.candidate
    ? evaluateAutoPromotionEligibility(
        {
          candidateId: params.candidateValidation.candidate.candidateId,
          changeType: params.candidateValidation.candidate.changeType,
          requiredLanes: params.candidateValidation.candidate.requiredLanes,
          changedPaths: params.candidateValidation.candidate.changedPaths,
          rollbackCondition: params.candidateValidation.candidate.rollbackCondition,
          requestedDecision: params.candidateValidation.candidate.requestedDecision,
          claims: params.candidateValidation.candidate.claims,
          liveSideEffects: params.candidateValidation.candidate.liveSideEffects,
        },
        params.evalCommandFailed ? null : summary,
        params.candidateValidation.candidate.shadowSummary,
      )
    : null;
  const reasons: string[] = [];

  if (!summary || params.evalCommandFailed) {
    reasons.push("offline eval command did not complete successfully");
  } else if (!offlineEvalPassed) {
    reasons.push(`offline eval failed: cases=${summary.totalCases} failed=${summary.totalFailed}`);
  }

  if (!negativeControlsBlocked) {
    const blocked = summary?.totalNegativeControlsBlocked ?? 0;
    const total = summary?.totalNegativeControls ?? 0;
    reasons.push(`negative controls are not fully blocked: ${blocked}/${total}`);
  }

  if (!requiredLaneCoveragePresent) {
    reasons.push(`required lane coverage is missing for: ${requiredLanes.join(", ")}`);
  }

  if (!closeoutProofPresent) {
    reasons.push(...params.candidateValidation.errors);
  }

  if (centralEvaluation) {
    reasons.push(...centralEvaluation.reasons);
  }

  let decision: PromptPolicyPromotionDecision = centralEvaluation?.decision ?? "reject";
  if (!closeoutProofPresent && decision !== "reject") {
    decision = "hold";
  }

  return {
    decision,
    reasons: [...new Set(reasons)],
    checks: {
      offlineEvalPassed: centralEvaluation?.checks.offlineEvalPassed ?? offlineEvalPassed,
      negativeControlsBlocked: centralEvaluation?.checks.negativeControlsBlocked ?? negativeControlsBlocked,
      closeoutProofPresent,
      requiredLaneCoveragePresent,
      shadowEvidencePassed: centralEvaluation?.checks.shadowEvidencePassed ?? false,
      noRegressionWindowPassed: centralEvaluation?.checks.noRegressionWindowPassed ?? false,
      rollbackConditionPresent: centralEvaluation?.checks.rollbackConditionPresent ?? false,
      blockedClaimsAbsent: centralEvaluation?.checks.blockedClaimsAbsent ?? false,
      livePaperclipMutationAttempted: false,
    },
    blockedClaims: centralEvaluation?.blockedClaims ?? [],
    requiredNextEvidence: centralEvaluation?.requiredNextEvidence ?? [],
    rollbackCondition:
      centralEvaluation?.rollbackCondition
      ?? params.candidateValidation.candidate?.rollbackCondition
      ?? "Missing rollback condition.",
    rollbackTriggers: centralEvaluation?.rollbackTriggers ?? [],
    policyTiers: centralEvaluation?.policyTiers ?? {},
    policyTier: centralEvaluation?.policyTier ?? "fully_autonomous",
  };
}

function formatLocalEvalOutput(summary: LocalEvalSummary | null) {
  if (!summary) {
    return ["local_eval unavailable"];
  }

  const lines = [
    `Local eval overall: cases=${summary.totalCases} pass=${summary.totalPassed} fail=${summary.totalFailed} negative_controls_blocked=${summary.totalNegativeControlsBlocked}/${summary.totalNegativeControls}`,
  ];
  for (const lane of summary.lanes) {
    const laneSummary = summary.laneSummaries[lane];
    lines.push(
      `${lane}: cases=${laneSummary.totalCases} pass=${laneSummary.passed} fail=${laneSummary.failed} negative_controls_blocked=${laneSummary.negativeControlsBlocked}/${laneSummary.negativeControls} splits dev=${laneSummary.splits.dev} holdout=${laneSummary.splits.holdout} shadow=${laneSummary.splits.shadow}`,
    );
  }
  return lines;
}

function packetList(values: string[]) {
  if (values.length === 0) {
    return "- none";
  }
  return values.map((value) => `- ${value}`).join("\n");
}

export function renderPromotionPacket(params: {
  candidatePath: string;
  packetOutput: string;
  candidateValidation: CandidateValidationResult;
  evaluation: PromotionGateEvaluation;
  commandOutputs: CommandOutput[];
  localEval: LocalEvalSummary | null;
}) {
  const candidate = params.candidateValidation.candidate;
  const title = candidate?.title || "unknown prompt-policy promotion candidate";
  const rollbackCondition = candidate?.rollbackCondition || "missing rollback condition";
  const changedPaths = candidate?.changedPaths ?? [];
  const closeoutPacket = params.candidateValidation.closeoutPacket || "missing closeout proof";

  const commandOutputText = params.commandOutputs
    .map((commandOutput) => [
      `### ${commandOutput.command}`,
      `exit_code: ${commandOutput.exitCode}`,
      "```text",
      commandOutput.output.join("\n") || "(no output)",
      "```",
    ].join("\n"))
    .join("\n\n");

  return [
    "# AutoAgent Prompt-Policy Promotion Packet",
    "",
    `Decision: ${params.evaluation.decision}`,
    `Candidate: ${title}`,
    `Candidate id: ${candidate?.candidateId || "unknown"}`,
    "Source: AutoAgent offline lab",
    "Target runtime: Paperclip/Hermes",
    "Live Paperclip mutation: not attempted",
    `Generated at: ${new Date().toISOString()}`,
    "",
    "## Gate Checks",
    "",
    `- offline_evals_passed: ${params.evaluation.checks.offlineEvalPassed}`,
    `- negative_controls_remain_blocked: ${params.evaluation.checks.negativeControlsBlocked}`,
    `- required_lane_coverage_present: ${params.evaluation.checks.requiredLaneCoveragePresent}`,
    `- closeout_proof_present: ${params.evaluation.checks.closeoutProofPresent}`,
    `- shadow_evidence_passed: ${params.evaluation.checks.shadowEvidencePassed}`,
    `- no_regression_window_passed: ${params.evaluation.checks.noRegressionWindowPassed}`,
    `- rollback_condition_present: ${params.evaluation.checks.rollbackConditionPresent}`,
    `- blocked_claims_absent: ${params.evaluation.checks.blockedClaimsAbsent}`,
    `- live_paperclip_mutation_attempted: ${params.evaluation.checks.livePaperclipMutationAttempted}`,
    `- policy_tier: ${params.evaluation.policyTier}`,
    "",
    "## Decision Reasons",
    "",
    packetList(params.evaluation.reasons),
    "",
    "## Blocked Claims",
    "",
    packetList(params.evaluation.blockedClaims),
    "",
    "## Required Next Evidence",
    "",
    packetList(params.evaluation.requiredNextEvidence),
    "",
    "## Offline Eval Summary",
    "",
    "```text",
    formatLocalEvalOutput(params.localEval).join("\n"),
    "```",
    "",
    "## Command Outputs",
    "",
    commandOutputText,
    "",
    "## Changed Paths Under Review",
    "",
    packetList(changedPaths),
    "",
    "## Closeout Proof",
    "",
    "```text",
    closeoutPacket,
    "```",
    "",
    "## Rollback Condition",
    "",
    params.evaluation.rollbackCondition || rollbackCondition,
    "",
    "## Rollback Triggers",
    "",
    packetList(params.evaluation.rollbackTriggers),
    "",
    "## Packet Metadata",
    "",
    `- candidate_manifest: ${path.resolve(params.candidatePath)}`,
    `- packet_output: ${path.resolve(params.packetOutput)}`,
    "- repo_local_only: true",
    "- requires_live_paperclip: false",
  ].join("\n");
}

function parseArgs(argv: string[]): GateOptions {
  const options: GateOptions = {
    candidatePath: DEFAULT_CANDIDATE_PATH,
    fixtureRoot: DEFAULT_FIXTURE_ROOT,
    harborRoot: DEFAULT_HARBOR_ROOT,
    packetOutput: DEFAULT_PACKET_OUTPUT,
    sampleCount: 3,
    writePacket: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--candidate":
        if (!next) throw new Error("--candidate requires a path");
        options.candidatePath = path.resolve(next);
        index += 1;
        break;
      case "--fixture-root":
        if (!next) throw new Error("--fixture-root requires a path");
        options.fixtureRoot = path.resolve(next);
        index += 1;
        break;
      case "--harbor-root":
        if (!next) throw new Error("--harbor-root requires a path");
        options.harborRoot = path.resolve(next);
        index += 1;
        break;
      case "--packet-output":
        if (!next) throw new Error("--packet-output requires a path");
        options.packetOutput = path.resolve(next);
        index += 1;
        break;
      case "--sample":
        if (!next) throw new Error("--sample requires a number");
        options.sampleCount = Math.max(0, Number.parseInt(next, 10) || 0);
        index += 1;
        break;
      case "--no-write":
        options.writePacket = false;
        break;
      case "--export-live":
        throw new Error("prompt-policy promotion gate is offline-only; --export-live is forbidden");
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export async function runPromptPolicyPromotionGate(options: GateOptions) {
  const commandOutputs: CommandOutput[] = [];
  let candidateValidation: CandidateValidationResult = {
    candidate: null,
    closeoutPacket: "",
    valid: false,
    errors: [],
  };

  try {
    const rawCandidate = await fs.readFile(options.candidatePath, "utf8");
    candidateValidation = validatePromotionCandidate(JSON.parse(rawCandidate));
    commandOutputs.push({
      command: `read candidate manifest ${path.resolve(options.candidatePath)}`,
      exitCode: 0,
      output: [
        `candidate_valid=${candidateValidation.valid}`,
        ...candidateValidation.errors.map((error) => `validation_error=${error}`),
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    candidateValidation = {
      candidate: null,
      closeoutPacket: "",
      valid: false,
      errors: [`candidate manifest read failed: ${message}`],
    };
    commandOutputs.push({
      command: `read candidate manifest ${path.resolve(options.candidatePath)}`,
      exitCode: 1,
      output: [message],
    });
  }

  let localEval: LocalEvalSummary | null = null;
  let evalCommandFailed = false;
  try {
    const pipelineResult = await runPipeline({
      lanes: candidateValidation.candidate?.requiredLanes ?? DEFAULT_LANES,
      fixtureRoot: options.fixtureRoot,
      harborRoot: options.harborRoot,
      maxPerLane: 250,
      overwrite: true,
      since: null,
      sampleCount: options.sampleCount,
      seedKnown: true,
      exportLive: false,
    });
    localEval = pipelineResult.localEval;
    commandOutputs.push({
      command: `offline AutoAgent eval runPipeline(exportLive=false,sample=${options.sampleCount})`,
      exitCode: 0,
      output: [
        `export_mode=${pipelineResult.exportMode}`,
        ...formatLocalEvalOutput(localEval),
      ],
    });
  } catch (error) {
    evalCommandFailed = true;
    const message = error instanceof Error ? error.message : String(error);
    commandOutputs.push({
      command: `offline AutoAgent eval runPipeline(exportLive=false,sample=${options.sampleCount})`,
      exitCode: 1,
      output: [message],
    });
  }

  const evaluation = evaluatePromotionGate({
    candidateValidation,
    localEval,
    evalCommandFailed,
  });
  commandOutputs.push({
    command: "prompt-policy promotion decision",
    exitCode: ["promote", "canary"].includes(evaluation.decision) ? 0 : 1,
    output: [
      `decision=${evaluation.decision}`,
      `offline_evals_passed=${evaluation.checks.offlineEvalPassed}`,
      `negative_controls_remain_blocked=${evaluation.checks.negativeControlsBlocked}`,
      `required_lane_coverage_present=${evaluation.checks.requiredLaneCoveragePresent}`,
      `closeout_proof_present=${evaluation.checks.closeoutProofPresent}`,
      `shadow_evidence_passed=${evaluation.checks.shadowEvidencePassed}`,
      `no_regression_window_passed=${evaluation.checks.noRegressionWindowPassed}`,
      `rollback_condition_present=${evaluation.checks.rollbackConditionPresent}`,
      `blocked_claims_absent=${evaluation.checks.blockedClaimsAbsent}`,
      `policy_tier=${evaluation.policyTier}`,
      ...evaluation.reasons.map((reason) => `reason=${reason}`),
    ],
  });

  const packet = renderPromotionPacket({
    candidatePath: options.candidatePath,
    packetOutput: options.packetOutput,
    candidateValidation,
    evaluation,
    commandOutputs,
    localEval,
  });

  if (options.writePacket) {
    await fs.mkdir(path.dirname(options.packetOutput), { recursive: true });
    await fs.writeFile(options.packetOutput, `${packet}\n`, "utf8");
  }

  return {
    packet,
    packetOutput: options.packetOutput,
    evaluation,
    commandOutputs,
    localEval,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await runPromptPolicyPromotionGate(options);
  console.log(
    `[prompt-policy-promotion-gate] decision=${result.evaluation.decision} packet=${path.resolve(result.packetOutput)}`,
  );
  for (const line of formatLocalEvalOutput(result.localEval)) {
    console.log(`[prompt-policy-promotion-gate] ${line}`);
  }
  if (result.evaluation.reasons.length > 0) {
    for (const reason of result.evaluation.reasons) {
      console.log(`[prompt-policy-promotion-gate] reason=${reason}`);
    }
  }
  process.exitCode = ["promote", "canary"].includes(result.evaluation.decision) ? 0 : 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentPath = path.resolve(new URL(import.meta.url).pathname);

if (invokedPath && currentPath === invokedPath) {
  main().catch((error) => {
    console.error(
      `[prompt-policy-promotion-gate] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
