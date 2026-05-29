import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import {
  AUTOAGENT_ALLOWED_AUTO_PROMOTION_LANES,
  AUTOAGENT_DISALLOWED_LIVE_SIDE_EFFECTS,
  AUTOAGENT_LANE_POLICIES,
  evaluateAutoPromotionEligibility,
  type AutoAgentPromotionCandidate,
  type AutoAgentPromotionLane,
} from "../../server/agents/autoagent-promotion-policy.ts";
import {
  runPromptPolicyPromotionGate,
  validatePromotionCandidate,
} from "./prompt-policy-promotion-gate.ts";

type CanaryMode = "dry_run" | "apply";
type CanaryPlanStatus = "dry_run" | "applied" | "rejected";
type CanaryLane = "support_triage";

export type CanaryPromotionOptions = {
  candidatePath: string;
  fixtureRoot: string;
  harborRoot: string;
  gatePacketOutput: string;
  outputDir: string;
  paperclipConfigPath: string;
  gateSampleCount: number;
  canarySampleCount: number;
  canaryPercentage: number | null;
  applyCanary: boolean;
  requestedMode: CanaryMode;
  writeArtifacts: boolean;
  now?: Date;
};

type FileSnapshot = {
  path: string;
  exists: boolean;
  sha256: string | null;
  sizeBytes: number | null;
};

type PreviousConfigSnapshot = {
  capturedAt: string;
  livePaperclipConfigMutation: false;
  paperclipConfig: FileSnapshot;
  existingRepoLocalCanaryConfig: FileSnapshot;
  existingRepoLocalCanaryConfigValue: unknown | null;
  autoagentShadowEnv: {
    BLUEPRINT_AUTOAGENT_SHADOW_ENABLED: string | null;
    BLUEPRINT_AUTOAGENT_SHADOW_LANES: string | null;
    BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER: string | null;
    BLUEPRINT_AUTOAGENT_SHADOW_MODEL: string | null;
  };
};

type CanaryMutationPlanItem = {
  order: number;
  action: string;
  path: string;
  sideEffectClass: "repo_local_artifact";
  requiredBefore?: string;
};

export type CanaryPromotionPlan = {
  schema: "blueprint/autoagent-canary-promotion-plan/v1";
  generatedAt: string;
  status: CanaryPlanStatus;
  mode: CanaryMode;
  candidate: {
    id: string;
    title: string;
    manifestPath: string;
    changedPaths: string[];
    declaredLanes: string[];
  };
  gate: {
    decision: string;
    checks: Record<string, boolean>;
    reasons: string[];
    packetPath: string;
  };
  policy: {
    decision: string;
    riskTiers: Record<string, string>;
    checks: Record<string, boolean>;
    reasons: string[];
    blockedClaims: string[];
    requiredNextEvidence: string[];
    rollbackTriggers: string[];
  };
  canary: {
    lane: CanaryLane | null;
    behavior: "observation_only";
    canaryAuthority: "compare_only_never_act";
    primaryOutputAuthority: "primary_result_only";
    canaryOutputStorage: "ops_automation.shadow_runs.autoagent";
    sampleCount: number;
    percentage: number | null;
    scopeCap: {
      maxSampleCount: number;
      maxPercentage: number;
    };
    stopCondition: string[];
  };
  mutationPlan: CanaryMutationPlanItem[];
  rollback: {
    previousConfigSnapshot: PreviousConfigSnapshot | null;
    snapshotPath: string;
    command: string;
    condition: string;
    stopCondition: string[];
  };
  proofPaths: string[];
  safetyInvariants: string[];
  validationErrors: string[];
};

export type CanaryPromotionResult = {
  ok: boolean;
  plan: CanaryPromotionPlan;
  planJsonPath: string;
  planMarkdownPath: string;
  activeConfigPath: string;
  rollbackSnapshotPath: string;
};

const DEFAULT_CANDIDATE_PATH = path.resolve(
  "labs/autoagent/promotion-candidates/autoagent-to-paperclip-hermes-2026-05-28.json",
);
const DEFAULT_FIXTURE_ROOT = path.resolve("labs/autoagent/tasks");
const DEFAULT_HARBOR_ROOT = path.resolve("labs/autoagent/harbor");
const DEFAULT_GATE_PACKET_OUTPUT = path.resolve(
  "output/autoagent/prompt-policy-promotion/latest/promotion-packet.md",
);
const DEFAULT_OUTPUT_DIR = path.resolve("output/autoagent/canary/latest");
const DEFAULT_PAPERCLIP_CONFIG_PATH = path.resolve(
  "ops/paperclip/blueprint-company/.paperclip.yaml",
);
const DEFAULT_CANARY_SAMPLE_COUNT = 20;
const MAX_CANARY_SAMPLE_COUNT = 50;
const MAX_CANARY_PERCENTAGE = 5;
const INITIAL_ALLOWED_CANARY_LANES = ["support_triage"] as const;

const LIVE_SIDE_EFFECT_VALIDATION_PATTERNS: Array<{
  label: string;
  pattern: RegExp;
}> = [
  { label: "live Firestore export", pattern: /(^|\s)--export-live(\s|$)/i },
  { label: "generic apply mutation flag", pattern: /(^|\s)--apply(\s|$)/i },
  { label: "live execution flag", pattern: /(^|\s)--live(\s|$)/i },
  { label: "founder-approved live execution flag", pattern: /(^|\s)--founder-approved(\s|$)/i },
  { label: "GTM send executor", pattern: /\bnpm\s+run\s+gtm:send\b/i },
  { label: "city-launch send executor", pattern: /\bnpm\s+run\s+city-launch:send\b/i },
  { label: "city-launch broad runner", pattern: /\bnpm\s+run\s+city-launch:run\b/i },
  { label: "city-launch activation", pattern: /\bnpm\s+run\s+city-launch:activate\b/i },
  { label: "city-launch creative ads", pattern: /\bnpm\s+run\s+city-launch:creative-ads\b/i },
  { label: "human reply poller", pattern: /\bnpm\s+run\s+human-replies:poll\b/i },
  { label: "human reply test sender", pattern: /\bnpm\s+run\s+human-replies:send-test-blocker\b/i },
  { label: "human reply production proof", pattern: /\bnpm\s+run\s+human-replies:prove-production\b/i },
  { label: "Notion mutation sync", pattern: /\bnpm\s+run\s+notion:sync:growth-studio\b/i },
  { label: "Render env mutation", pattern: /\bnpm\s+run\s+render:import-env\b(?!.*\b--dry-run\b)/i },
  {
    label: "Paperclip host mutation script",
    pattern: /\bscripts\/paperclip\/.*(bootstrap|reconcile|repair|sync|restart|import)/i,
  },
];

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
  return value.map((item) => asString(item)).filter(Boolean);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

async function readJsonFile(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

async function snapshotFile(filePath: string): Promise<FileSnapshot> {
  try {
    const buffer = await fs.readFile(filePath);
    return {
      path: path.resolve(filePath),
      exists: true,
      sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
      sizeBytes: buffer.byteLength,
    };
  } catch (error) {
    const code = error && typeof error === "object" ? (error as { code?: string }).code : "";
    if (code === "ENOENT") {
      return {
        path: path.resolve(filePath),
        exists: false,
        sha256: null,
        sizeBytes: null,
      };
    }
    throw error;
  }
}

async function readExistingCanaryConfig(configPath: string) {
  try {
    return await readJsonFile(configPath);
  } catch (error) {
    const code = error && typeof error === "object" ? (error as { code?: string }).code : "";
    if (code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function buildPreviousConfigSnapshot(params: {
  paperclipConfigPath: string;
  activeConfigPath: string;
  capturedAt: string;
}): Promise<PreviousConfigSnapshot> {
  return {
    capturedAt: params.capturedAt,
    livePaperclipConfigMutation: false,
    paperclipConfig: await snapshotFile(params.paperclipConfigPath),
    existingRepoLocalCanaryConfig: await snapshotFile(params.activeConfigPath),
    existingRepoLocalCanaryConfigValue: await readExistingCanaryConfig(params.activeConfigPath),
    autoagentShadowEnv: {
      BLUEPRINT_AUTOAGENT_SHADOW_ENABLED:
        process.env.BLUEPRINT_AUTOAGENT_SHADOW_ENABLED ?? null,
      BLUEPRINT_AUTOAGENT_SHADOW_LANES:
        process.env.BLUEPRINT_AUTOAGENT_SHADOW_LANES ?? null,
      BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER:
        process.env.BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER ?? null,
      BLUEPRINT_AUTOAGENT_SHADOW_MODEL:
        process.env.BLUEPRINT_AUTOAGENT_SHADOW_MODEL ?? null,
    },
  };
}

function declaredLanesFor(rawCandidate: unknown, fallback: string[]) {
  const record = asRecord(rawCandidate);
  if (!record) {
    return fallback;
  }
  const required = stringList(record.requiredLanes);
  if (required.length > 0) {
    return unique(required);
  }
  const lanes = stringList(record.lanes);
  if (lanes.length > 0) {
    return unique(lanes);
  }
  return unique(fallback);
}

function riskDomainsFor(rawCandidate: unknown) {
  const record = asRecord(rawCandidate);
  return record ? stringList(record.riskDomains) : [];
}

export function findLiveSideEffectValidationCommands(commands: string[]) {
  const findings: Array<{ command: string; label: string }> = [];
  for (const command of commands) {
    for (const { label, pattern } of LIVE_SIDE_EFFECT_VALIDATION_PATTERNS) {
      if (pattern.test(command)) {
        findings.push({ command, label });
      }
    }
  }
  return findings;
}

function canaryLaneErrors(declaredLanes: string[]) {
  const errors: string[] = [];
  const knownPolicyLanes = new Set(Object.keys(AUTOAGENT_LANE_POLICIES));
  const unknownLanes = declaredLanes.filter((lane) => !knownPolicyLanes.has(lane));

  if (declaredLanes.length === 0) {
    errors.push("candidate must declare a canary lane");
  }
  for (const lane of unknownLanes) {
    errors.push(`unknown canary lane: ${lane}`);
  }
  if (
    declaredLanes.length !== 1
    || declaredLanes[0] !== INITIAL_ALLOWED_CANARY_LANES[0]
  ) {
    errors.push(
      `initial canary supports support_triage only; saw ${declaredLanes.join(", ") || "none"}`,
    );
  }

  const lane = AUTOAGENT_LANE_POLICIES.support_triage;
  const supportAllowedByCentralPolicy =
    (AUTOAGENT_ALLOWED_AUTO_PROMOTION_LANES as readonly string[]).includes("support_triage")
    && lane.maxAutomaticDecision === "canary"
    && lane.riskTier === "low";
  if (!supportAllowedByCentralPolicy) {
    errors.push("central policy does not currently allow support_triage canary");
  }

  return errors;
}

function normalizeCanarySampleCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_CANARY_SAMPLE_COUNT;
  }
  return Math.min(MAX_CANARY_SAMPLE_COUNT, Math.floor(value));
}

function normalizeCanaryPercentage(value: number | null) {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.min(MAX_CANARY_PERCENTAGE, value);
}

function centralCandidateFor(params: {
  rawCandidate: unknown;
  candidate: NonNullable<ReturnType<typeof validatePromotionCandidate>["candidate"]>;
  declaredLanes: string[];
}): AutoAgentPromotionCandidate {
  const knownLanes = params.declaredLanes.filter(
    (lane): lane is AutoAgentPromotionLane => lane in AUTOAGENT_LANE_POLICIES,
  );

  return {
    candidateId: params.candidate.candidateId,
    changeType: params.candidate.changeType,
    lanes: knownLanes,
    requiredLanes: knownLanes,
    changedPaths: params.candidate.changedPaths,
    rollbackCondition: params.candidate.rollbackCondition,
    requestedDecision: params.candidate.requestedDecision,
    claims: params.candidate.claims,
    liveSideEffects: params.candidate.liveSideEffects,
    riskDomains: riskDomainsFor(params.rawCandidate) as AutoAgentPromotionCandidate["riskDomains"],
  };
}

function stopConditionsFor(rollbackCondition: string, rollbackTriggers: string[]) {
  return unique([
    rollbackCondition,
    ...rollbackTriggers,
    "Any canary output attempts to drive sends, payments, provider jobs, rights/legal decisions, city-live claims, customer claims, hosted-session fulfillment, or operational launch readiness.",
    "Any canary comparison drops a primary support-triage human-review safeguard.",
    "Any canary output is used as the authoritative production result instead of primary_result_only.",
  ]);
}

function validationErrorsFor(params: {
  candidateValidation: ReturnType<typeof validatePromotionCandidate>;
  declaredLanes: string[];
  gateDecision: string;
  centralDecision: string;
  centralBlockedClaims: string[];
  closeoutCommandOutputs: string[];
  requestedMode: CanaryMode;
}) {
  const errors: string[] = [];

  errors.push(...canaryLaneErrors(params.declaredLanes));

  if (params.requestedMode === "apply" && params.gateDecision !== "promote") {
    errors.push(`promotion gate decision must be promote before apply; saw ${params.gateDecision}`);
  } else if (
    params.requestedMode !== "apply"
    && params.gateDecision !== "canary"
    && params.gateDecision !== "promote"
  ) {
    errors.push(`promotion gate decision must be canary; saw ${params.gateDecision}`);
  }
  if (params.requestedMode === "apply" && params.centralDecision !== "promote") {
    errors.push(`central policy decision must be promote before apply; saw ${params.centralDecision}`);
  } else if (
    params.requestedMode !== "apply"
    && params.centralDecision !== "canary"
    && params.centralDecision !== "promote"
  ) {
    errors.push(`central policy decision must be canary; saw ${params.centralDecision}`);
  }
  if (params.centralBlockedClaims.length > 0) {
    errors.push(`central policy blocked claims: ${params.centralBlockedClaims.join(", ")}`);
  }
  if (!params.candidateValidation.valid) {
    errors.push(...params.candidateValidation.errors);
  }

  const sideEffectCommands = findLiveSideEffectValidationCommands(
    params.closeoutCommandOutputs,
  );
  for (const finding of sideEffectCommands) {
    errors.push(
      `live side-effect validation command is not allowed (${finding.label}): ${finding.command}`,
    );
  }

  return unique(errors);
}

export function validateCanaryPlanForApply(plan: CanaryPromotionPlan) {
  const errors: string[] = [];
  if (plan.status === "rejected" || plan.validationErrors.length > 0) {
    errors.push("cannot apply a rejected canary plan");
  }
  if (!plan.rollback.previousConfigSnapshot) {
    errors.push("rollback previousConfigSnapshot is required before apply");
  }
  if (!plan.rollback.snapshotPath) {
    errors.push("rollback snapshotPath is required before apply");
  }
  if (!plan.rollback.command) {
    errors.push("rollback command is required before apply");
  }
  if (!plan.rollback.condition) {
    errors.push("rollback condition is required before apply");
  }
  if (!plan.rollback.previousConfigSnapshot?.paperclipConfig.exists) {
    errors.push("paperclip config snapshot must exist before apply");
  }
  const writesSnapshot = plan.mutationPlan.some(
    (item) => item.action === "write_rollback_snapshot",
  );
  if (!writesSnapshot) {
    errors.push("mutation plan must write a rollback snapshot before apply");
  }
  for (const mutation of plan.mutationPlan) {
    if (mutation.sideEffectClass !== "repo_local_artifact") {
      errors.push(`unsupported mutation side-effect class: ${mutation.sideEffectClass}`);
    }
  }
  if (plan.canary.lane !== "support_triage") {
    errors.push("apply is limited to support_triage canaries");
  }
  return unique(errors);
}

function renderCanaryPlanMarkdown(plan: CanaryPromotionPlan) {
  const list = (items: string[]) => (items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- none");
  return [
    "# AutoAgent Canary Promotion Plan",
    "",
    `Status: ${plan.status}`,
    `Mode: ${plan.mode}`,
    `Generated at: ${plan.generatedAt}`,
    `Candidate id: ${plan.candidate.id || "unknown"}`,
    `Candidate manifest: ${plan.candidate.manifestPath}`,
    `Canary lane: ${plan.canary.lane || "none"}`,
    `Canary behavior: ${plan.canary.behavior}`,
    `Primary output authority: ${plan.canary.primaryOutputAuthority}`,
    `Canary authority: ${plan.canary.canaryAuthority}`,
    `Canary sample count: ${plan.canary.sampleCount}`,
    `Canary percentage: ${plan.canary.percentage ?? "n/a"}`,
    `Canary scope cap: sample_count<=${plan.canary.scopeCap.maxSampleCount}, percentage<=${plan.canary.scopeCap.maxPercentage}`,
    "",
    "## Gate",
    "",
    `Decision: ${plan.gate.decision}`,
    "",
    "Reasons:",
    list(plan.gate.reasons),
    "",
    "## Central Policy",
    "",
    `Decision: ${plan.policy.decision}`,
    "",
    "Reasons:",
    list(plan.policy.reasons),
    "",
    "Blocked claims:",
    list(plan.policy.blockedClaims),
    "",
    "## Mutation Plan",
    "",
    list(
      plan.mutationPlan.map(
        (item) => `${item.order}. ${item.action} -> ${item.path} (${item.sideEffectClass})`,
      ),
    ),
    "",
    "## Rollback",
    "",
    `Command: ${plan.rollback.command}`,
    `Condition: ${plan.rollback.condition}`,
    `Snapshot: ${plan.rollback.snapshotPath}`,
    "",
    "Stop conditions:",
    list(plan.rollback.stopCondition),
    "",
    "## Proof Paths",
    "",
    list(plan.proofPaths),
    "",
    "## Safety Invariants",
    "",
    list(plan.safetyInvariants),
    "",
    "## Validation Errors",
    "",
    list(plan.validationErrors),
    "",
  ].join("\n");
}

function buildActiveCanaryConfig(plan: CanaryPromotionPlan) {
  return {
    schema: "blueprint/autoagent-active-canary/v1",
    candidateId: plan.candidate.id,
    lane: plan.canary.lane,
    status: "active",
    activatedAt: plan.generatedAt,
    behavior: plan.canary.behavior,
    primaryOutputAuthority: plan.canary.primaryOutputAuthority,
    canaryAuthority: plan.canary.canaryAuthority,
    canaryOutputStorage: plan.canary.canaryOutputStorage,
    sampleCount: plan.canary.sampleCount,
    percentage: plan.canary.percentage,
    scopeCap: plan.canary.scopeCap,
    stopCondition: plan.canary.stopCondition,
    rollbackCommand: plan.rollback.command,
    rollbackSnapshotPath: plan.rollback.snapshotPath,
    proofPaths: plan.proofPaths,
  };
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath: string, value: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

export async function runCanaryPromotion(
  options: Partial<CanaryPromotionOptions> = {},
): Promise<CanaryPromotionResult> {
  const resolved: CanaryPromotionOptions = {
    candidatePath: path.resolve(options.candidatePath || DEFAULT_CANDIDATE_PATH),
    fixtureRoot: path.resolve(options.fixtureRoot || DEFAULT_FIXTURE_ROOT),
    harborRoot: path.resolve(options.harborRoot || DEFAULT_HARBOR_ROOT),
    gatePacketOutput: path.resolve(options.gatePacketOutput || DEFAULT_GATE_PACKET_OUTPUT),
    outputDir: path.resolve(options.outputDir || DEFAULT_OUTPUT_DIR),
    paperclipConfigPath: path.resolve(
      options.paperclipConfigPath || DEFAULT_PAPERCLIP_CONFIG_PATH,
    ),
    gateSampleCount: Math.max(0, Math.floor(options.gateSampleCount ?? 3)),
    canarySampleCount: normalizeCanarySampleCount(
      options.canarySampleCount ?? DEFAULT_CANARY_SAMPLE_COUNT,
    ),
    canaryPercentage: normalizeCanaryPercentage(options.canaryPercentage ?? null),
    applyCanary: options.applyCanary === true,
    requestedMode: options.requestedMode || "dry_run",
    writeArtifacts: options.writeArtifacts !== false,
    now: options.now,
  };

  if (resolved.requestedMode === "apply" && !resolved.applyCanary) {
    throw new Error("apply mode requires the explicit --apply-canary flag");
  }

  const generatedAt = (resolved.now || new Date()).toISOString();
  const planJsonPath = path.join(resolved.outputDir, "canary-plan.json");
  const planMarkdownPath = path.join(resolved.outputDir, "canary-plan.md");
  const activeConfigPath = path.join(resolved.outputDir, "canary-config.json");
  const rollbackSnapshotPath = path.join(resolved.outputDir, "rollback-snapshot.json");

  const rawCandidate = await readJsonFile(resolved.candidatePath);
  const candidateValidation = validatePromotionCandidate(rawCandidate);
  const fallbackLanes = candidateValidation.candidate?.requiredLanes ?? [];
  const declaredLanes = declaredLanesFor(rawCandidate, fallbackLanes);

  const gateResult = await runPromptPolicyPromotionGate({
    candidatePath: resolved.candidatePath,
    fixtureRoot: resolved.fixtureRoot,
    harborRoot: resolved.harborRoot,
    packetOutput: resolved.gatePacketOutput,
    sampleCount: resolved.gateSampleCount,
    writePacket: true,
  });

  const candidate = candidateValidation.candidate;
  const centralEvaluation = candidate
    ? evaluateAutoPromotionEligibility(
        centralCandidateFor({
          rawCandidate,
          candidate,
          declaredLanes,
        }),
        gateResult.localEval,
        candidate.shadowSummary,
      )
    : null;
  const closeoutCommandOutputs = candidate?.closeoutProof?.commandOutputs ?? [];
  const validationErrors = validationErrorsFor({
    candidateValidation,
    declaredLanes,
    gateDecision: gateResult.evaluation.decision,
    centralDecision: centralEvaluation?.decision ?? "reject",
    centralBlockedClaims: centralEvaluation?.blockedClaims ?? [],
    closeoutCommandOutputs,
    requestedMode: resolved.requestedMode,
  });

  const previousConfigSnapshot = await buildPreviousConfigSnapshot({
    paperclipConfigPath: resolved.paperclipConfigPath,
    activeConfigPath,
    capturedAt: generatedAt,
  });
  const rollbackCondition =
    centralEvaluation?.rollbackCondition
    || candidate?.rollbackCondition
    || "Missing rollback condition.";
  const rollbackTriggers = centralEvaluation?.rollbackTriggers ?? [];
  const stopCondition = stopConditionsFor(rollbackCondition, rollbackTriggers);
  const mode: CanaryMode = resolved.applyCanary ? "apply" : "dry_run";
  const status: CanaryPlanStatus =
    validationErrors.length > 0 ? "rejected" : resolved.applyCanary ? "applied" : "dry_run";
  const rollbackOutputDir = path.join(resolved.outputDir, "rollback");
  const shadowSummaryPath = path.join(resolved.outputDir, "shadow-summary.json");
  const rollbackCommand = [
    "npm run autoagent:canary-rollback --",
    `--canary-plan ${planJsonPath}`,
    `--shadow-summary ${shadowSummaryPath}`,
    `--output-dir ${rollbackOutputDir}`,
    "--apply-rollback",
  ].join(" ");
  const mutationPlan: CanaryMutationPlanItem[] = [
    {
      order: 1,
      action: "write_rollback_snapshot",
      path: rollbackSnapshotPath,
      sideEffectClass: "repo_local_artifact",
      requiredBefore: "write_active_canary_config",
    },
    {
      order: 2,
      action: "write_canary_plan_json",
      path: planJsonPath,
      sideEffectClass: "repo_local_artifact",
    },
    {
      order: 3,
      action: "write_canary_plan_markdown",
      path: planMarkdownPath,
      sideEffectClass: "repo_local_artifact",
    },
  ];

  if (resolved.applyCanary) {
    mutationPlan.push({
      order: 4,
      action: "write_active_canary_config",
      path: activeConfigPath,
      sideEffectClass: "repo_local_artifact",
      requiredBefore: "canary can be considered active",
    });
  }

  const plan: CanaryPromotionPlan = {
    schema: "blueprint/autoagent-canary-promotion-plan/v1",
    generatedAt,
    status,
    mode,
    candidate: {
      id: candidate?.candidateId || "",
      title: candidate?.title || "",
      manifestPath: resolved.candidatePath,
      changedPaths: candidate?.changedPaths ?? [],
      declaredLanes,
    },
    gate: {
      decision: gateResult.evaluation.decision,
      checks: gateResult.evaluation.checks,
      reasons: gateResult.evaluation.reasons,
      packetPath: resolved.gatePacketOutput,
    },
    policy: {
      decision: centralEvaluation?.decision ?? "reject",
      riskTiers: centralEvaluation?.riskTiers ?? {},
      checks: centralEvaluation?.checks ?? {
        offlineEvalPassed: false,
        negativeControlsBlocked: false,
        shadowEvidencePassed: false,
        noRegressionWindowPassed: false,
        rollbackConditionPresent: false,
        disallowedLiveSideEffectsAbsent: false,
        blockedClaimsAbsent: false,
      },
      reasons: centralEvaluation?.reasons ?? ["central policy could not evaluate candidate"],
      blockedClaims: centralEvaluation?.blockedClaims ?? [],
      requiredNextEvidence: centralEvaluation?.requiredNextEvidence ?? [],
      rollbackTriggers,
    },
    canary: {
      lane: declaredLanes.length === 1 && declaredLanes[0] === "support_triage"
        ? "support_triage"
        : null,
      behavior: "observation_only",
      canaryAuthority: "compare_only_never_act",
      primaryOutputAuthority: "primary_result_only",
      canaryOutputStorage: "ops_automation.shadow_runs.autoagent",
      sampleCount: resolved.canarySampleCount,
      percentage: resolved.canaryPercentage,
      scopeCap: {
        maxSampleCount: MAX_CANARY_SAMPLE_COUNT,
        maxPercentage: MAX_CANARY_PERCENTAGE,
      },
      stopCondition,
    },
    mutationPlan,
    rollback: {
      previousConfigSnapshot,
      snapshotPath: rollbackSnapshotPath,
      command: rollbackCommand,
      condition: rollbackCondition,
      stopCondition,
    },
    proofPaths: unique([
      resolved.candidatePath,
      resolved.gatePacketOutput,
      planJsonPath,
      planMarkdownPath,
      ...(resolved.applyCanary ? [rollbackSnapshotPath, activeConfigPath] : []),
    ]),
    safetyInvariants: [
      "No live Paperclip/Hermes config mutation is performed by this controller.",
      "Canary output is observation-only and compare-only.",
      "Primary support_triage output remains authoritative.",
      "Canary output must not drive sends, payments, provider jobs, rights/legal decisions, city-live claims, hosted-session fulfillment, customer claims, or operational launch readiness.",
      `Disallowed live side effects remain blocked: ${(AUTOAGENT_DISALLOWED_LIVE_SIDE_EFFECTS as readonly string[]).join(", ")}`,
    ],
    validationErrors,
  };

  if (resolved.applyCanary) {
    const applyErrors = validateCanaryPlanForApply(plan);
    if (applyErrors.length > 0) {
      plan.status = "rejected";
      plan.validationErrors = unique([...plan.validationErrors, ...applyErrors]);
    } else if (resolved.writeArtifacts) {
      await writeJson(rollbackSnapshotPath, previousConfigSnapshot);
      await writeJson(activeConfigPath, buildActiveCanaryConfig(plan));
    }
  }

  if (resolved.writeArtifacts) {
    await writeJson(planJsonPath, plan);
    await writeText(planMarkdownPath, renderCanaryPlanMarkdown(plan));
  }

  return {
    ok: plan.validationErrors.length === 0,
    plan,
    planJsonPath,
    planMarkdownPath,
    activeConfigPath,
    rollbackSnapshotPath,
  };
}

export async function rollbackCanary(params: {
  candidateId: string;
  outputDir?: string;
  now?: Date;
}) {
  const outputDir = path.resolve(params.outputDir || DEFAULT_OUTPUT_DIR);
  const activeConfigPath = path.join(outputDir, "canary-config.json");
  const rollbackResultPath = path.join(outputDir, "rollback-result.json");
  const current = await readExistingCanaryConfig(activeConfigPath);
  const record = {
    schema: "blueprint/autoagent-canary-rollback/v1",
    candidateId: params.candidateId,
    rolledBackAt: (params.now || new Date()).toISOString(),
    livePaperclipConfigMutation: false,
    activeConfigPath,
    previousActiveConfig: current,
    action: current ? "marked_repo_local_canary_rolled_back" : "no_active_repo_local_canary_config",
  };

  if (current && asRecord(current)) {
    await writeJson(activeConfigPath, {
      ...current,
      status: "rolled_back",
      rolledBackAt: record.rolledBackAt,
    });
  }
  await writeJson(rollbackResultPath, record);
  return {
    record,
    rollbackResultPath,
    activeConfigPath,
  };
}

export function parseCanaryPromotionArgs(argv: string[]): Partial<CanaryPromotionOptions> & {
  rollbackCandidateId?: string;
} {
  const options: Partial<CanaryPromotionOptions> & { rollbackCandidateId?: string } = {};

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
      case "--gate-packet-output":
        if (!next) throw new Error("--gate-packet-output requires a path");
        options.gatePacketOutput = path.resolve(next);
        index += 1;
        break;
      case "--output-dir":
        if (!next) throw new Error("--output-dir requires a path");
        options.outputDir = path.resolve(next);
        index += 1;
        break;
      case "--paperclip-config":
        if (!next) throw new Error("--paperclip-config requires a path");
        options.paperclipConfigPath = path.resolve(next);
        index += 1;
        break;
      case "--gate-sample":
        if (!next) throw new Error("--gate-sample requires a number");
        options.gateSampleCount = Math.max(0, Number.parseInt(next, 10) || 0);
        index += 1;
        break;
      case "--canary-sample-count":
        if (!next) throw new Error("--canary-sample-count requires a number");
        options.canarySampleCount = normalizeCanarySampleCount(Number.parseInt(next, 10));
        index += 1;
        break;
      case "--canary-percentage":
        if (!next) throw new Error("--canary-percentage requires a number");
        options.canaryPercentage = normalizeCanaryPercentage(Number.parseFloat(next));
        index += 1;
        break;
      case "--mode":
        if (!next) throw new Error("--mode requires dry-run or apply");
        if (next !== "dry-run" && next !== "dry_run" && next !== "apply") {
          throw new Error("--mode must be dry-run or apply");
        }
        options.requestedMode = next === "apply" ? "apply" : "dry_run";
        index += 1;
        break;
      case "--dry-run":
        options.requestedMode = "dry_run";
        options.applyCanary = false;
        break;
      case "--apply-canary":
        options.requestedMode = "apply";
        options.applyCanary = true;
        break;
      case "--rollback":
        if (!next) throw new Error("--rollback requires a candidate id");
        options.rollbackCandidateId = next;
        index += 1;
        break;
      case "--apply":
      case "--live":
      case "--export-live":
        throw new Error(`${arg} is not allowed; use --apply-canary for repo-local canary artifacts`);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCanaryPromotionArgs(argv);

  if (options.rollbackCandidateId) {
    const result = await rollbackCanary({
      candidateId: options.rollbackCandidateId,
      outputDir: options.outputDir,
    });
    console.log(
      `[autoagent-canary-promotion] rollback=${result.record.action} result=${result.rollbackResultPath}`,
    );
    return;
  }

  const result = await runCanaryPromotion(options);
  console.log(
    `[autoagent-canary-promotion] status=${result.plan.status} plan=${result.planJsonPath} markdown=${result.planMarkdownPath}`,
  );
  if (result.plan.validationErrors.length > 0) {
    for (const error of result.plan.validationErrors) {
      console.log(`[autoagent-canary-promotion] error=${error}`);
    }
  }
  process.exitCode = result.ok ? 0 : 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentPath = path.resolve(new URL(import.meta.url).pathname);

if (invokedPath && currentPath === invokedPath) {
  main().catch((error) => {
    console.error(
      `[autoagent-canary-promotion] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
