import fs from "node:fs/promises";
import path from "node:path";

import {
  analyzeAgentImprovementArtifacts,
  mergeAiClassifierResultIntoObserverSummary,
  writeObserverOutputs,
  type AgentImprovementObserverSummary,
} from "../paperclip/agent-improvement-observer.ts";
import {
  runAiFailureFamilyClassifier,
  type AiFailureFamilyClassifierInvoker,
  type AiFailureFamilyClassifierSummary,
} from "../paperclip/ai-failure-family-classifier.ts";
import {
  buildAutoResearchPromotionQueue,
  buildAutoResearchPromotionQueueMarkdown,
  type AutoResearchPromotionQueueItem,
} from "../paperclip/autoresearch-promotion-queue.ts";
import {
  writeAutoResearchFixture,
  type WriteAutoResearchFixtureResult,
} from "./write-autoresearch-fixture.ts";
import {
  type AiFixtureDrafterInvoker,
  type AiFixtureDrafterSummary,
} from "./ai-fixture-drafter.ts";
import {
  renderAiPatchProposalReport,
  runAiPatchProposal,
  type AiPatchProposalInvoker,
  type AiPatchProposalSummary,
} from "./ai-patch-proposal.ts";
import {
  buildProductionContextBundle,
  type BuildProductionContextBundleResult,
} from "./build-production-context-bundle.ts";
import {
  runAiProductionChangeProposal,
  type AiProductionChangeProposal,
  type AiProductionChangeProposalInvoker,
  type AiProductionChangeProposalSummary,
} from "./ai-production-change-proposer.ts";
import {
  executeProductionCanary,
  readProductionIdempotencyKeys,
  type ProductionCanaryResult,
} from "./execute-production-canary.ts";
import { runPipeline } from "./run-pipeline.ts";
import { type EvalLane, type LocalEvalSummary } from "./local-evaluator.ts";
import { runPromptPolicyPromotionGate } from "./prompt-policy-promotion-gate.ts";
import { runCanaryPromotion } from "./run-canary-promotion.ts";
import { monitorCanaryRollback } from "./monitor-canary-rollback.ts";
import {
  AUTOAGENT_ALLOWED_AUTO_PROMOTION_LANES,
  AUTOAGENT_DISALLOWED_LIVE_SIDE_EFFECTS,
  AUTOAGENT_LANE_POLICIES,
  AUTOAGENT_PERMANENTLY_BLOCKED_LANES,
  type AutoAgentOperatingPolicyTier,
  type AutoAgentPromotionLane,
} from "../../server/agents/autoagent-promotion-policy.ts";
import {
  AUTOAGENT_BLOCKED_PRODUCTION_ACTION_TYPES,
  AUTOAGENT_INITIAL_LIVE_PRODUCTION_ACTION_TYPES,
  AUTOAGENT_NEXT_LIVE_PRODUCTION_ACTION_TYPES,
  AUTOAGENT_PRODUCTION_ACTION_DEFAULT_MODE,
  AUTOAGENT_PRODUCTION_ACTION_REGISTRY_PATH,
  AUTOAGENT_REGISTERED_LIVE_PRODUCTION_ACTION_TYPES,
} from "../../server/agents/autoagent-production-action-registry.ts";

type RecursiveLoopStatus =
  | "dry_run_completed"
  | "no_change_report_only"
  | "canary_applied"
  | "rollback_applied"
  | "insufficient_evidence"
  | "promotion_rejected"
  | "promotion_held"
  | "fixture_rejected"
  | "patch_proposal_rejected"
  | "high_risk_blocked"
  | "canary_rejected"
  | "rollback_required";

type OfflineEvalResultSummary = {
  status: "passed" | "failed" | "not_run";
  fixture_root: string | null;
  harbor_root: string | null;
  lanes: EvalLane[];
  total_cases: number;
  total_failed: number;
  negative_controls_blocked_count: number;
  negative_controls_total: number;
  generated_fixture_included: boolean;
  summary_path: string | null;
};

type AutoApplyResult =
  | "not_requested"
  | "blocked"
  | "rejected"
  | "dry_run"
  | "applied"
  | "rolled_back";

type RollbackMonitorResult =
  | "not_run"
  | "keep_canary"
  | "rollback_required"
  | "rolled_back"
  | "insufficient_evidence";

type NoChangeClassification = {
  classification: "no_change_report_only";
  no_new_family: boolean;
  no_new_proof: boolean;
  no_generated_fixture: boolean;
  same_held_reason: boolean;
  same_candidate: boolean;
  duplicate_follow_up_created: false;
  previous_status: string | null;
  selected_proof_paths: string;
  held_reason: string;
  fixture_result: string;
  reasons: string[];
};

type ProductionActionRegistrySummary = {
  registry_path: string;
  default_mode: typeof AUTOAGENT_PRODUCTION_ACTION_DEFAULT_MODE;
  allowed_live_action_types: string[];
  registered_live_action_types: string[];
  gated_live_action_types: string[];
  blocked_action_types: string[];
  required_checks: string[];
  live_mutation_enabled_by_default: false;
};

export type RecursiveImprovementSummary = {
  schema: "blueprint/autoagent-recursive-improvement-summary/v1";
  generated_at: string;
  dry_run: boolean;
  status: RecursiveLoopStatus;
  production_action_registry: ProductionActionRegistrySummary;
  selected_failure_family: string | null;
  selected_queue_item_id: string | null;
  generated_fixture_paths: string[];
  offline_eval_result: OfflineEvalResultSummary;
  negative_controls_blocked: boolean;
  promotion_decision: string;
  policy_tier: AutoAgentOperatingPolicyTier;
  policy_tiers: Partial<Record<string, AutoAgentOperatingPolicyTier>>;
  ai_classifier: AiFailureFamilyClassifierSummary | null;
  ai_fixture_drafter: AiFixtureDrafterSummary | null;
  blocked_fixture_attempts: AiFixtureDrafterSummary["blocked_attempts"];
  ai_patch_proposal: AiPatchProposalSummary | null;
  production_context_built: boolean;
  ai_production_proposal_used: boolean;
  production_proposal_status: string;
  production_action_type: string | null;
  production_target_system: string | null;
  production_canary_attempted: boolean;
  production_canary_result: ProductionCanaryResult;
  idempotency_key: string | null;
  audit_event_path: string | null;
  rollback_snapshot_path: string | null;
  canary_decision: string;
  rollback_decision: string;
  auto_apply_attempted: boolean;
  auto_apply_result: AutoApplyResult;
  rollback_monitor_result: RollbackMonitorResult;
  rollback_applied: boolean;
  live_mutation_attempted: boolean;
  live_mutation_committed: boolean;
  next_action: string;
  next_autonomous_action: string;
  retry_condition: string;
  residual_risk: string;
  high_risk_blockers: string[];
  no_change_classification: NoChangeClassification | null;
  proof_paths: string[];
  command_outputs: string[];
};

export type RecursiveImprovementLoopResult = {
  ok: boolean;
  summary: RecursiveImprovementSummary;
  summaryPath: string;
  reportPath: string;
};

export type RecursiveImprovementLoopOptions = {
  cwd?: string;
  observerInputRoots?: string[];
  observerMaxFiles?: number;
  observerMaxBytesPerFile?: number;
  candidatePath?: string;
  fixtureRoot?: string;
  harborRoot?: string;
  outputDir?: string;
  gatePacketOutput?: string;
  canaryOutputDir?: string;
  shadowSourcePath?: string;
  paperclipConfigPath?: string;
  sampleCount?: number;
  lane?: string;
  dryRun?: boolean;
  aiClassifier?: boolean;
  aiClassifierArtifacts?: string[];
  aiClassifierInvoker?: AiFailureFamilyClassifierInvoker;
  aiClassifierEnv?: Record<string, string | undefined>;
  aiFixtureDrafter?: boolean;
  aiFixtureDrafterArtifacts?: string[];
  aiFixtureDrafterInvoker?: AiFixtureDrafterInvoker;
  aiFixtureDrafterEnv?: Record<string, string | undefined>;
  aiPatchProposal?: boolean;
  aiPatchProposalArtifacts?: string[];
  aiPatchProposalInvoker?: AiPatchProposalInvoker;
  aiPatchProposalEnv?: Record<string, string | undefined>;
  productionContext?: boolean;
  aiProductionProposal?: boolean;
  aiProductionProposalInvoker?: AiProductionChangeProposalInvoker;
  aiProductionProposalEnv?: Record<string, string | undefined>;
  executeProductionCanary?: boolean;
  autoApplyLowRisk?: boolean;
  applyCanary?: boolean;
  applyRollback?: boolean;
  writeArtifacts?: boolean;
  now?: Date;
};

type StageOutputs = {
  proofPaths: string[];
  commandOutputs: string[];
};

type ProductionDecisionFields = Pick<
  RecursiveImprovementSummary,
  | "production_context_built"
  | "ai_production_proposal_used"
  | "production_proposal_status"
  | "production_action_type"
  | "production_target_system"
  | "production_canary_attempted"
  | "production_canary_result"
  | "idempotency_key"
  | "audit_event_path"
  | "rollback_snapshot_path"
  | "live_mutation_attempted"
  | "live_mutation_committed"
>;

const DEFAULT_OUTPUT_DIR = path.resolve("output/autoagent/recursive-improvement/latest");
const DEFAULT_FIXTURE_ROOT = path.resolve("labs/autoagent/tasks");
const DEFAULT_HARBOR_ROOT = path.resolve("labs/autoagent/harbor");
const DEFAULT_CANDIDATE_PATH = path.resolve(
  "labs/autoagent/promotion-candidates/autoagent-to-paperclip-hermes-2026-05-28.json",
);
const DEFAULT_PAPERCLIP_CONFIG_PATH = path.resolve(
  "ops/paperclip/blueprint-company/.paperclip.yaml",
);
const DEFAULT_SAMPLE_COUNT = 3;
const ALL_EVAL_LANES: EvalLane[] = [
  "waitlist_triage",
  "support_triage",
  "preview_diagnosis",
  "agent_failure_promotion",
];

const HIGH_RISK_LANES = new Set<string>(AUTOAGENT_PERMANENTLY_BLOCKED_LANES);
const DISALLOWED_SIDE_EFFECTS = new Set<string>(AUTOAGENT_DISALLOWED_LIVE_SIDE_EFFECTS);

function defaultProductionDecisionFields(): ProductionDecisionFields {
  return {
    production_context_built: false,
    ai_production_proposal_used: false,
    production_proposal_status: "not_requested",
    production_action_type: null,
    production_target_system: null,
    production_canary_attempted: false,
    production_canary_result: "not_requested",
    idempotency_key: null,
    audit_event_path: null,
    rollback_snapshot_path: null,
    live_mutation_attempted: false,
    live_mutation_committed: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

async function readJsonFile(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

async function readPreviousSummary(outputDir: string) {
  try {
    const value = await readJsonFile(path.join(outputDir, "summary.json"));
    return isRecord(value) ? (value as Partial<RecursiveImprovementSummary>) : null;
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath: string, value: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

function titleForFamily(family: string) {
  return family
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugForId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    || "unknown";
}

function observerCandidateClusters(summary: AgentImprovementObserverSummary) {
  return summary.top_5.map((candidate) => ({
    signature: {
      key: candidate.failure_family,
      title: titleForFamily(candidate.failure_family),
      category: "unknown",
      matchedBy: "agent-improvement-observer",
    },
    count: candidate.recurrence_count,
    agents: ["local-artifact-observer"],
    agentKeys: ["local-artifact-observer"],
    runIds: candidate.evidence_paths,
    issueIdentifiers: [],
  })) as Parameters<typeof buildAutoResearchPromotionQueue>[0]["clusters"];
}

function eligibleQueueItem(item: AutoResearchPromotionQueueItem) {
  return Boolean(
    item.id
      && item.sourceFailureFamily
      && item.owner
      && item.targetFile
      && item.expectedNegativeControl
      && item.validationCommand
      && item.promotionThreshold
      && item.rollbackCondition
      && item.residualRisk,
  );
}

function generatedFixturePaths(result: WriteAutoResearchFixtureResult) {
  if (result.status !== "written") {
    return [];
  }
  return [
    result.files.input,
    result.files.expected,
    result.files.labels,
    result.files.source,
  ];
}

function laneFromFixture(result: WriteAutoResearchFixtureResult): EvalLane | null {
  if (result.status !== "written") {
    return null;
  }
  switch (result.laneDir) {
    case "agent-failure-promotion":
      return "agent_failure_promotion";
    case "support-triage":
      return "support_triage";
    case "preview-diagnosis":
      return "preview_diagnosis";
    case "waitlist-triage":
      return "waitlist_triage";
  }
}

function evalLanesFromRawCandidate(rawCandidate: unknown) {
  const record = isRecord(rawCandidate) ? rawCandidate : {};
  return unique([
    ...stringList(record.requiredLanes),
    ...stringList(record.lanes),
  ].filter((lane): lane is EvalLane => (ALL_EVAL_LANES as string[]).includes(lane)));
}

function detectHighRiskCandidate(rawCandidate: unknown) {
  const record = isRecord(rawCandidate) ? rawCandidate : {};
  const highRiskEntries = [
    ...stringList(record.requiredLanes),
    ...stringList(record.lanes),
    ...stringList(record.riskDomains),
  ].filter((entry) => HIGH_RISK_LANES.has(entry));
  const sideEffects = stringList(record.liveSideEffects).filter((entry) =>
    DISALLOWED_SIDE_EFFECTS.has(entry),
  );

  return unique([
    ...highRiskEntries.map((entry) => `high-risk lane or domain: ${entry}`),
    ...sideEffects.map((entry) => `disallowed live side effect: ${entry}`),
  ]);
}

function knownPromotionLane(lane: string): lane is AutoAgentPromotionLane {
  return lane in AUTOAGENT_LANE_POLICIES;
}

function candidateDeclaredPromotionLanes(rawCandidate: unknown) {
  const record = isRecord(rawCandidate) ? rawCandidate : {};
  return unique([
    ...stringList(record.requiredLanes),
    ...stringList(record.lanes),
  ]);
}

function laneIsCentralPolicyApprovedLowRisk(lane: string) {
  if (!knownPromotionLane(lane)) {
    return false;
  }
  const policy = AUTOAGENT_LANE_POLICIES[lane];
  return (
    (AUTOAGENT_ALLOWED_AUTO_PROMOTION_LANES as readonly string[]).includes(lane)
    && policy.riskTier === "low"
    && policy.policyTier === "repo_local_canary"
    && policy.maxAutomaticDecision === "canary"
  );
}

function laneApplyBlockers(params: {
  requestedLane: string | null;
  scopedCandidate: unknown;
  applyRequested: boolean;
  autoApplyLowRisk: boolean;
}) {
  if (!params.applyRequested) {
    return [];
  }

  if (!params.autoApplyLowRisk && !params.requestedLane) {
    return ["apply-canary requires explicit --lane support_triage or --auto-apply-low-risk"];
  }

  const declaredLanes = params.requestedLane
    ? [params.requestedLane]
    : candidateDeclaredPromotionLanes(params.scopedCandidate);
  if (declaredLanes.length !== 1) {
    return [
      `auto-apply requires exactly one central-policy-approved low-risk lane; saw ${declaredLanes.join(", ") || "none"}`,
    ];
  }

  const [lane] = declaredLanes;
  if (!laneIsCentralPolicyApprovedLowRisk(lane)) {
    return [`lane is not enabled for central-policy-approved low-risk auto-apply: ${lane}`];
  }
  return [];
}

function scopeCandidateToLane(rawCandidate: unknown, lane: string | null) {
  if (!lane || !isRecord(rawCandidate)) {
    return rawCandidate;
  }
  return {
    ...rawCandidate,
    requiredLanes: [lane],
    lanes: [lane],
  };
}

function offlineEvalSummary(
  localEval: LocalEvalSummary | null,
  params: {
    fixtureRoot: string | null;
    harborRoot: string | null;
    lanes: EvalLane[];
    generatedFixturePaths: string[];
    summaryPath: string | null;
  },
): OfflineEvalResultSummary {
  if (!localEval) {
    return {
      status: "not_run",
      fixture_root: params.fixtureRoot,
      harbor_root: params.harborRoot,
      lanes: [],
      total_cases: 0,
      total_failed: 0,
      negative_controls_blocked_count: 0,
      negative_controls_total: 0,
      generated_fixture_included: false,
      summary_path: null,
    };
  }

  return {
    status: localEval.totalCases > 0 && localEval.totalFailed === 0 ? "passed" : "failed",
    fixture_root: params.fixtureRoot,
    harbor_root: params.harborRoot,
    lanes: params.lanes,
    total_cases: localEval.totalCases,
    total_failed: localEval.totalFailed,
    negative_controls_blocked_count: localEval.totalNegativeControlsBlocked,
    negative_controls_total: localEval.totalNegativeControls,
    generated_fixture_included:
      params.generatedFixturePaths.length > 0
      && params.generatedFixturePaths.every((filePath) =>
        params.fixtureRoot ? path.resolve(filePath).startsWith(path.resolve(params.fixtureRoot)) : false,
      ),
    summary_path: params.summaryPath,
  };
}

function negativeControlsBlocked(summary: OfflineEvalResultSummary) {
  return (
    summary.status === "passed"
    && summary.negative_controls_total > 0
    && summary.negative_controls_blocked_count === summary.negative_controls_total
  );
}

function baseSummary(params: {
  generatedAt: string;
  dryRun: boolean;
  status: RecursiveLoopStatus;
  selectedFailureFamily?: string | null;
  selectedQueueItemId?: string | null;
  generatedFixturePaths?: string[];
  offlineEvalResult?: OfflineEvalResultSummary;
  negativeControlsBlocked?: boolean;
  promotionDecision?: string;
  policyTier?: AutoAgentOperatingPolicyTier;
  policyTiers?: Partial<Record<string, AutoAgentOperatingPolicyTier>>;
  aiClassifier?: AiFailureFamilyClassifierSummary | null;
  aiFixtureDrafter?: AiFixtureDrafterSummary | null;
  aiPatchProposal?: AiPatchProposalSummary | null;
  productionDecision?: ProductionDecisionFields;
  canaryDecision?: string;
  rollbackDecision?: string;
  autoApplyAttempted?: boolean;
  autoApplyResult?: AutoApplyResult;
  rollbackMonitorResult?: RollbackMonitorResult;
  rollbackApplied?: boolean;
  nextAutonomousAction: string;
  retryCondition: string;
  residualRisk: string;
  highRiskBlockers?: string[];
  noChangeClassification?: NoChangeClassification | null;
  proofPaths?: string[];
  commandOutputs?: string[];
}): RecursiveImprovementSummary {
  const offline = params.offlineEvalResult ?? offlineEvalSummary(null, {
    fixtureRoot: null,
    harborRoot: null,
    lanes: [],
    generatedFixturePaths: [],
    summaryPath: null,
  });
  const productionDecision = params.productionDecision ?? defaultProductionDecisionFields();
  return {
    schema: "blueprint/autoagent-recursive-improvement-summary/v1",
    generated_at: params.generatedAt,
    dry_run: params.dryRun,
    status: params.status,
    production_action_registry: productionActionRegistrySummary(),
    selected_failure_family: params.selectedFailureFamily ?? null,
    selected_queue_item_id: params.selectedQueueItemId ?? null,
    generated_fixture_paths: params.generatedFixturePaths ?? [],
    offline_eval_result: offline,
    negative_controls_blocked:
      params.negativeControlsBlocked ?? negativeControlsBlocked(offline),
    promotion_decision: params.promotionDecision ?? "not_run",
    policy_tier: params.policyTier ?? "fully_autonomous",
    policy_tiers: params.policyTiers ?? {},
    ai_classifier: params.aiClassifier ?? null,
    ai_fixture_drafter: params.aiFixtureDrafter ?? null,
    blocked_fixture_attempts: params.aiFixtureDrafter?.blocked_attempts ?? [],
    ai_patch_proposal: params.aiPatchProposal ?? null,
    production_context_built: productionDecision.production_context_built,
    ai_production_proposal_used: productionDecision.ai_production_proposal_used,
    production_proposal_status: productionDecision.production_proposal_status,
    production_action_type: productionDecision.production_action_type,
    production_target_system: productionDecision.production_target_system,
    production_canary_attempted: productionDecision.production_canary_attempted,
    production_canary_result: productionDecision.production_canary_result,
    idempotency_key: productionDecision.idempotency_key,
    audit_event_path: productionDecision.audit_event_path,
    rollback_snapshot_path: productionDecision.rollback_snapshot_path,
    canary_decision: params.canaryDecision ?? "not_run",
    rollback_decision: params.rollbackDecision ?? "not_run",
    auto_apply_attempted: params.autoApplyAttempted ?? false,
    auto_apply_result: params.autoApplyResult ?? "not_requested",
    rollback_monitor_result:
      params.rollbackMonitorResult
      ?? (params.rollbackDecision as RollbackMonitorResult | undefined)
      ?? "not_run",
    rollback_applied: params.rollbackApplied ?? params.rollbackDecision === "rolled_back",
    live_mutation_attempted: productionDecision.live_mutation_attempted,
    live_mutation_committed: productionDecision.live_mutation_committed,
    next_action: params.nextAutonomousAction,
    next_autonomous_action: params.nextAutonomousAction,
    retry_condition: params.retryCondition,
    residual_risk: params.residualRisk,
    high_risk_blockers: params.highRiskBlockers ?? [],
    no_change_classification: params.noChangeClassification ?? null,
    proof_paths: unique([
      AUTOAGENT_PRODUCTION_ACTION_REGISTRY_PATH,
      ...(params.proofPaths ?? []),
    ]),
    command_outputs: params.commandOutputs ?? [],
  };
}

function productionActionRegistrySummary(): ProductionActionRegistrySummary {
  return {
    registry_path: AUTOAGENT_PRODUCTION_ACTION_REGISTRY_PATH,
    default_mode: AUTOAGENT_PRODUCTION_ACTION_DEFAULT_MODE,
    allowed_live_action_types: [...AUTOAGENT_INITIAL_LIVE_PRODUCTION_ACTION_TYPES],
    registered_live_action_types: [...AUTOAGENT_REGISTERED_LIVE_PRODUCTION_ACTION_TYPES],
    gated_live_action_types: [...AUTOAGENT_NEXT_LIVE_PRODUCTION_ACTION_TYPES],
    blocked_action_types: [...AUTOAGENT_BLOCKED_PRODUCTION_ACTION_TYPES],
    required_checks: [
      "owner system named",
      "proof path exists",
      "idempotency key present and unique",
      "rollback path exists",
      "canary limit exists",
      "audit event schema exists",
      "target record id and target field are allowed",
      "live mutation flag explicit",
    ],
    live_mutation_enabled_by_default: false,
  };
}

function readPreviousNoChangeClassification(
  previousSummary: Partial<RecursiveImprovementSummary> | null,
) {
  const classification = previousSummary?.no_change_classification;
  return isRecord(classification) ? classification : null;
}

function heldReasonForGate(decision: string, reasons: string[]) {
  return reasons.length > 0 ? reasons.join("; ") : decision;
}

function classifyNoChangeReportOnly(params: {
  previousSummary: Partial<RecursiveImprovementSummary> | null;
  applyRequested: boolean;
  selected: AutoResearchPromotionQueueItem;
  fixtureResult: WriteAutoResearchFixtureResult;
  generatedFixturePaths: string[];
  heldReason: string;
}) {
  if (params.applyRequested || !params.previousSummary) {
    return null;
  }

  const previousNoChange = readPreviousNoChangeClassification(params.previousSummary);
  const previousHeldReason = typeof previousNoChange?.held_reason === "string"
    ? previousNoChange.held_reason
    : typeof params.previousSummary.residual_risk === "string"
      ? params.previousSummary.residual_risk
      : "";
  const previousProofPaths = typeof previousNoChange?.selected_proof_paths === "string"
    ? previousNoChange.selected_proof_paths
    : "";

  const noNewFamily =
    params.previousSummary.selected_failure_family === params.selected.sourceFailureFamily;
  const sameCandidate =
    params.previousSummary.selected_queue_item_id === params.selected.id;
  const noGeneratedFixture =
    params.fixtureResult.status !== "written" && params.generatedFixturePaths.length === 0;
  const sameHeldReason =
    previousHeldReason.length > 0 && previousHeldReason === params.heldReason;
  const noNewProof =
    previousProofPaths.length > 0
      ? previousProofPaths === params.selected.proofPaths
      : noNewFamily && sameCandidate && noGeneratedFixture;

  const classification: NoChangeClassification = {
    classification: "no_change_report_only",
    no_new_family: noNewFamily,
    no_new_proof: noNewProof,
    no_generated_fixture: noGeneratedFixture,
    same_held_reason: sameHeldReason,
    same_candidate: sameCandidate,
    duplicate_follow_up_created: false,
    previous_status:
      typeof params.previousSummary.status === "string" ? params.previousSummary.status : null,
    selected_proof_paths: params.selected.proofPaths,
    held_reason: params.heldReason,
    fixture_result: params.fixtureResult.status === "written"
      ? "written"
      : `${params.fixtureResult.status}: ${params.fixtureResult.reason}`,
    reasons: [
      "no new failure family",
      "no new proof path",
      "no generated fixture",
      "same held reason",
      "same selected candidate",
      "duplicate follow-up suppressed",
    ],
  };

  return noNewFamily && noNewProof && noGeneratedFixture && sameHeldReason && sameCandidate
    ? classification
    : null;
}

function renderHighRiskBlockerPacket(params: {
  generatedAt: string;
  selected: AutoResearchPromotionQueueItem;
  highRiskBlockers: string[];
  gateReasons: string[];
}) {
  const blockerId = `autoagent-high-risk:${slugForId(params.selected.id)}`;
  return [
    "# AutoAgent High-Risk Candidate Blocker Packet",
    "",
    "## 1. Blocker Title",
    "",
    `High-risk AutoAgent candidate blocked before canary: ${params.selected.sourceFailureFamily}`,
    "",
    "## 1a. Blocker Id",
    "",
    blockerId,
    "",
    "## 2. Why This Is Blocked",
    "",
    "The recursive improvement loop found a candidate that crosses central AutoAgent policy boundaries. It cannot safely continue as an unattended routine because the requested lane or side effect requires owner-system proof, explicit policy approval, or human review outside this repo-local loop.",
    "",
    "## 3. Recommended Answer",
    "",
    "Keep the candidate blocked in repo-local report mode. Do not apply a canary or create live Paperclip/Hermes changes from this routine.",
    "",
    "## 4. Alternatives",
    "",
    "- Replace the candidate with a central-policy-approved low-risk `support_triage` canary candidate.",
    "- Open a separate policy issue that names the owner-system proof, rollback path, and human approval needed for this lane.",
    "- Keep the evidence as an offline negative control only.",
    "",
    "## 5. Downside / Risk",
    "",
    "Approving this candidate without a separate policy path could mutate or imply authority over live sends, payments, provider jobs, rights/privacy/legal posture, customer claims, hosted-session fulfillment, city-live state, operational launch readiness, Firestore export, Notion writes, or live Paperclip/Hermes state.",
    "",
    "## 6. Exact Response Needed",
    "",
    "Approve a separate bounded policy issue, or replace the candidate with an approved low-risk repo-local canary. No approval is requested or sent by this report.",
    "",
    "## 7. Execution Owner After Reply",
    "",
    "`webapp-codex` for repo-local policy/test changes; owning specialist lane for any live/system-specific proof.",
    "",
    "## 8. Immediate Next Action After Reply",
    "",
    "If approved in a separate issue, update `server/agents/autoagent-promotion-policy.ts` and add focused tests before any apply run. Otherwise leave this candidate blocked.",
    "",
    "## 9. Deadline / Checkpoint",
    "",
    "Revisit only when the owning issue supplies explicit policy approval and proof requirements.",
    "",
    "## 10. Evidence",
    "",
    `- Generated at: ${params.generatedAt}`,
    `- Queue item: ${params.selected.id}`,
    `- Failure family: ${params.selected.sourceFailureFamily}`,
    `- Proof paths: ${params.selected.proofPaths}`,
    ...params.highRiskBlockers.map((blocker) => `- Blocker: ${blocker}`),
    ...params.gateReasons.map((reason) => `- Gate reason: ${reason}`),
    "",
    "## 11. Non-Scope",
    "",
    "This repo-local no-send packet does not authorize external sends, payments, payouts, provider execution, rights/privacy/legal decisions, city-live work, customer claims, hosted-session fulfillment, operational launch readiness claims, Notion writes, Firestore export, production Paperclip reconcile/repair/import/bootstrap, or live Paperclip/Hermes mutation.",
    "",
    "Routing surface: repo-local no-send.",
    "",
  ].join("\n");
}

function renderReport(summary: RecursiveImprovementSummary) {
  const list = (items: string[]) =>
    items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- none";

  return [
    "# Recursive AutoResearch Improvement Loop",
    "",
    `Generated: ${summary.generated_at}`,
    `Status: ${summary.status}`,
    `Dry run: ${summary.dry_run}`,
    `Live mutation attempted: ${summary.live_mutation_attempted}`,
    "",
    "## Selected Candidate",
    "",
    `Failure family: ${summary.selected_failure_family ?? "none"}`,
    `Queue item: ${summary.selected_queue_item_id ?? "none"}`,
    "",
    "## Decisions",
    "",
    `Offline eval: ${summary.offline_eval_result.status}`,
    `Negative controls blocked: ${summary.negative_controls_blocked}`,
    `Promotion decision: ${summary.promotion_decision}`,
    `Policy tier: ${summary.policy_tier}`,
    `AI classifier: ${summary.ai_classifier ? `${summary.ai_classifier.status} (used=${summary.ai_classifier.ai_used})` : "not_requested"}`,
    `AI fixture drafter: ${summary.ai_fixture_drafter ? `${summary.ai_fixture_drafter.status} (used=${summary.ai_fixture_drafter.ai_used})` : "not_requested"}`,
    `AI patch proposal: ${summary.ai_patch_proposal ? `${summary.ai_patch_proposal.status} (used=${summary.ai_patch_proposal.ai_used})` : "not_requested"}`,
    `Production context built: ${summary.production_context_built}`,
    `AI production proposal used: ${summary.ai_production_proposal_used}`,
    `Production proposal status: ${summary.production_proposal_status}`,
    `Production action type: ${summary.production_action_type ?? "none"}`,
    `Production target system: ${summary.production_target_system ?? "none"}`,
    `Production canary attempted: ${summary.production_canary_attempted}`,
    `Production canary result: ${summary.production_canary_result}`,
    `Production idempotency key: ${summary.idempotency_key ?? "none"}`,
    `Audit event path: ${summary.audit_event_path ?? "none"}`,
    `Rollback snapshot path: ${summary.rollback_snapshot_path ?? "none"}`,
    `Canary decision: ${summary.canary_decision}`,
    `Rollback decision: ${summary.rollback_decision}`,
    `Auto-apply attempted: ${summary.auto_apply_attempted}`,
    `Auto-apply result: ${summary.auto_apply_result}`,
    `Rollback monitor result: ${summary.rollback_monitor_result}`,
    `Rollback applied: ${summary.rollback_applied}`,
    `Live mutation committed: ${summary.live_mutation_committed}`,
    "",
    "## Production Action Registry",
    "",
    `Production registry: ${summary.production_action_registry.registry_path}`,
    `Default mode: ${summary.production_action_registry.default_mode}`,
    `Live mutation enabled by default: ${summary.production_action_registry.live_mutation_enabled_by_default}`,
    "",
    "Allowed live action types",
    "",
    list(summary.production_action_registry.allowed_live_action_types),
    "",
    "Registered live action types",
    "",
    list(summary.production_action_registry.registered_live_action_types),
    "",
    "Gated live action types",
    "",
    list(summary.production_action_registry.gated_live_action_types),
    "",
    "Blocked action types",
    "",
    list(summary.production_action_registry.blocked_action_types),
    "",
    "Required checks",
    "",
    list(summary.production_action_registry.required_checks),
    "",
    "## No-Change Classification",
    "",
    summary.no_change_classification
      ? [
          `No-change classification: ${summary.no_change_classification.classification}`,
          `Duplicate follow-up created: ${summary.no_change_classification.duplicate_follow_up_created}`,
          ...summary.no_change_classification.reasons.map((reason) => `- ${reason}`),
        ].join("\n")
      : "not_applicable",
    "",
    "## Generated Fixtures",
    "",
    list(summary.generated_fixture_paths),
    "",
    "## High-Risk Blockers",
    "",
    list(summary.high_risk_blockers),
    "",
    "## Blocked Fixture Attempts",
    "",
    list(summary.blocked_fixture_attempts.flatMap((attempt) =>
      attempt.reasons.map((reason) => `${attempt.failure_family}/${attempt.fixture_id ?? "unknown"}: ${reason}`),
    )),
    "",
    "## Proposed Patch",
    "",
    summary.ai_patch_proposal
      ? [
          `Status: ${summary.ai_patch_proposal.status}`,
          `Proposal: ${summary.ai_patch_proposal.proposal_id ?? "none"}`,
          `Reason: ${summary.ai_patch_proposal.deterministic_gate_reason}`,
        ].join("\n")
      : "not_requested",
    "",
    "## Proof Paths",
    "",
    list(summary.proof_paths),
    "",
    "## Command Outputs",
    "",
    list(summary.command_outputs),
    "",
    "## Next",
    "",
    `Next action: ${summary.next_action}`,
    `Next autonomous action: ${summary.next_autonomous_action}`,
    `Retry condition: ${summary.retry_condition}`,
    `Residual risk: ${summary.residual_risk}`,
    "",
  ].join("\n");
}

async function writeConsolidatedOutputs(
  outputDir: string,
  summary: RecursiveImprovementSummary,
  writeArtifacts: boolean,
) {
  const summaryPath = path.join(outputDir, "summary.json");
  const reportPath = path.join(outputDir, "report.md");
  if (writeArtifacts) {
    await writeJson(summaryPath, summary);
    await writeText(reportPath, renderReport(summary));
  }
  return { summaryPath, reportPath };
}

function resultStatus(summary: RecursiveImprovementSummary) {
  return [
    "dry_run_completed",
    "no_change_report_only",
    "canary_applied",
    "rollback_applied",
  ].includes(summary.status);
}

export async function runRecursiveImprovementLoop(
  options: RecursiveImprovementLoopOptions = {},
): Promise<RecursiveImprovementLoopResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const outputDir = path.resolve(cwd, options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const fixtureRoot = path.resolve(cwd, options.fixtureRoot ?? DEFAULT_FIXTURE_ROOT);
  const harborRoot = path.resolve(cwd, options.harborRoot ?? DEFAULT_HARBOR_ROOT);
  const candidatePath = path.resolve(cwd, options.candidatePath ?? DEFAULT_CANDIDATE_PATH);
  const gatePacketOutput = path.resolve(
    cwd,
    options.gatePacketOutput ?? path.join(outputDir, "promotion-gate", "promotion-packet.md"),
  );
  const canaryOutputDir = path.resolve(
    cwd,
    options.canaryOutputDir ?? path.join(outputDir, "canary"),
  );
  const paperclipConfigPath = path.resolve(
    cwd,
    options.paperclipConfigPath ?? DEFAULT_PAPERCLIP_CONFIG_PATH,
  );
  const sampleCount = Math.max(0, Math.floor(options.sampleCount ?? DEFAULT_SAMPLE_COUNT));
  const requestedLane = typeof options.lane === "string" && options.lane.trim()
    ? options.lane.trim()
    : null;
  const applyRequested = options.applyCanary === true || options.autoApplyLowRisk === true;
  const productionContextRequested = Boolean(
    options.productionContext
      || options.aiProductionProposal
      || options.executeProductionCanary,
  );
  const productionCanaryOutputDir = path.join(outputDir, "production-canary");
  const productionExecuteRequested = options.executeProductionCanary === true;
  const dryRun = options.dryRun ?? !(applyRequested || options.applyRollback || productionExecuteRequested);
  const productionExecutionAllowed = productionExecuteRequested && !dryRun;
  const writeArtifacts = options.writeArtifacts !== false;
  const generatedAt = (options.now ?? new Date()).toISOString();
  const stageOutputs: StageOutputs = { proofPaths: [], commandOutputs: [] };
  const blockedAutoApplyResult: AutoApplyResult = applyRequested ? "blocked" : "not_requested";
  const previousSummary = await readPreviousSummary(outputDir);
  const productionDecision = defaultProductionDecisionFields();
  let productionContextResult: BuildProductionContextBundleResult | null = null;
  let productionProposalSummary: AiProductionChangeProposalSummary | null = null;
  let productionProposal: AiProductionChangeProposal | null = null;

  if (productionContextRequested) {
    productionContextResult = await buildProductionContextBundle({
      cwd,
      outputDir: path.join(outputDir, "production-context"),
      candidatePath,
      paperclipConfigPath,
      writeArtifacts,
      now: options.now,
    });
    productionDecision.production_context_built = true;
    productionDecision.rollback_snapshot_path = productionContextResult.rollbackSnapshotPath;
    stageOutputs.proofPaths.push(
      productionContextResult.bundlePath,
      productionContextResult.bundleMarkdownPath,
      productionContextResult.proofPath,
      productionContextResult.rollbackSnapshotPath,
    );
    stageOutputs.commandOutputs.push(
      `production-context-bundle: built=true path=${productionContextResult.bundlePath}`,
    );

    if (options.aiProductionProposal === true) {
      const usedIdempotencyKeys = await readProductionIdempotencyKeys({
        cwd,
        outputDir: productionCanaryOutputDir,
      });
      const productionProposalResult = await runAiProductionChangeProposal({
        cwd,
        enabled: true,
        contextBundle: productionContextResult.bundle,
        executeRequested: productionExecutionAllowed,
        invoker: options.aiProductionProposalInvoker,
        env: options.aiProductionProposalEnv,
        usedIdempotencyKeys,
        now: options.now,
      });
      productionProposalSummary = productionProposalResult.summary;
      productionProposal = productionProposalResult.proposal;
      const productionProposalSummaryPath = path.join(
        outputDir,
        "production-proposal-summary.json",
      );
      const productionProposalPromptPath = path.join(
        outputDir,
        "production-proposal-prompt.txt",
      );
      if (writeArtifacts) {
        await writeJson(productionProposalSummaryPath, productionProposalSummary);
        await writeText(productionProposalPromptPath, productionProposalResult.prompt);
      }
      productionDecision.ai_production_proposal_used =
        productionProposalSummary.ai_used;
      productionDecision.production_proposal_status =
        productionProposalSummary.status;
      productionDecision.production_action_type =
        productionProposalSummary.action_type;
      productionDecision.production_target_system =
        productionProposalSummary.target_system;
      productionDecision.idempotency_key =
        productionProposalSummary.idempotency_key;
      if (productionProposalSummary.status === "fallback_ai_unavailable") {
        productionDecision.production_canary_result = "not_attempted";
      } else if (["blocked", "rejected"].includes(productionProposalSummary.status)) {
        productionDecision.production_canary_result = "not_attempted_validator_rejected";
      } else if (productionProposalSummary.status === "duplicate_idempotency") {
        productionDecision.production_canary_result = "duplicate_idempotency_suppressed";
      }
      stageOutputs.proofPaths.push(productionProposalSummaryPath, productionProposalPromptPath);
      stageOutputs.commandOutputs.push(
        `ai-production-change-proposer: status=${productionProposalSummary.status} ai_used=${productionProposalSummary.ai_used} action=${productionProposalSummary.action_type ?? "none"}`,
        ...productionProposalSummary.reasons.map((reason) =>
          `ai-production-change-proposer reason=${reason}`
        ),
      );
    }
  }

  const makeSummary = (params: Parameters<typeof baseSummary>[0]) =>
    baseSummary({
      ...params,
      productionDecision: params.productionDecision ?? productionDecision,
    });

  const observerOutputDir = path.join(outputDir, "observer");
  let observerSummary = await analyzeAgentImprovementArtifacts({
    cwd,
    inputRoots: options.observerInputRoots,
    maxFiles: options.observerMaxFiles,
    maxBytesPerFile: options.observerMaxBytesPerFile,
    top: 5,
    now: options.now,
  });
  let aiClassifierSummary: AiFailureFamilyClassifierSummary | null = null;

  if (options.aiClassifier === true) {
    const aiClassifierResult = await runAiFailureFamilyClassifier({
      cwd,
      artifactPaths: options.aiClassifierArtifacts
        ?? options.observerInputRoots
        ?? [
          "labs/autoagent",
          "ops/paperclip/reports",
          "ops/paperclip/playbooks",
          "output",
        ],
      existingFamilyIds: observerSummary.improvement_candidates.map((candidate) => candidate.failure_family),
      invoker: options.aiClassifierInvoker,
      env: options.aiClassifierEnv,
    });
    aiClassifierSummary = aiClassifierResult.summary;
    observerSummary = mergeAiClassifierResultIntoObserverSummary(
      observerSummary,
      aiClassifierResult,
    );
    const aiClassifierOutputPath = path.join(outputDir, "ai-classifier", "summary.json");
    if (writeArtifacts) {
      await writeJson(aiClassifierOutputPath, {
        summary: aiClassifierResult.summary,
        artifact_paths: aiClassifierResult.artifact_paths,
        accepted: aiClassifierResult.accepted,
        rejected: aiClassifierResult.rejected,
        raw_output: aiClassifierResult.raw_output,
      });
    }
    stageOutputs.proofPaths.push(aiClassifierOutputPath);
    stageOutputs.commandOutputs.push(
      `ai-failure-family-classifier: status=${aiClassifierResult.summary.status} ai_used=${aiClassifierResult.summary.ai_used} accepted=${aiClassifierResult.summary.accepted_count} rejected=${aiClassifierResult.summary.rejected_count} report_only=${aiClassifierResult.summary.report_only_count}`,
    );
  }

  const observerOutputs = writeArtifacts
    ? await writeObserverOutputs({ outputDir: observerOutputDir, summary: observerSummary })
    : { jsonPath: path.join(observerOutputDir, "summary.json"), reportPath: path.join(observerOutputDir, "report.md") };
  stageOutputs.proofPaths.push(observerOutputs.jsonPath, observerOutputs.reportPath);
  stageOutputs.commandOutputs.push(
    `agent-improvement-observer(local-files): scanned=${observerSummary.scanned_files} candidates=${observerSummary.improvement_candidates.length}`,
  );

  const clusters = observerCandidateClusters(observerSummary);
  const queue = buildAutoResearchPromotionQueue({
    clusters,
    paperclipApiUrl: "repo-local agent-improvement-observer",
    maxItems: 5,
  });
  const queueJsonPath = path.join(outputDir, "promotion-queue.json");
  const queueMarkdownPath = path.join(outputDir, "promotion-queue.md");
  if (writeArtifacts) {
    await writeJson(queueJsonPath, {
      generatedAt,
      scope:
        "Repo-local recursive-improvement queue only. Does not mutate live systems.",
      sourceGeneratedAt: observerSummary.generated_at,
      paperclipApiUrl: null,
      queue,
    });
    await writeText(
      queueMarkdownPath,
      buildAutoResearchPromotionQueueMarkdown({
        generatedAt,
        paperclipApiUrl: null,
        queue,
      }),
    );
  }
  stageOutputs.proofPaths.push(queueJsonPath, queueMarkdownPath);
  stageOutputs.commandOutputs.push(`autoresearch-promotion-queue(local): queued=${queue.length}`);

  const selected = queue.find(eligibleQueueItem) ?? null;
  if (!selected) {
    const summary = makeSummary({
      generatedAt,
      dryRun,
      status: "insufficient_evidence",
      nextAutonomousAction: "collect_local_observer_evidence",
      retryCondition:
        "Retry after local observer evidence contains a classified recurring failure family.",
      residualRisk:
        "No queue item was selected, so no fixture, offline eval, promotion, canary, or rollback decision can prove movement.",
      aiClassifier: aiClassifierSummary,
      autoApplyAttempted: applyRequested,
      autoApplyResult: blockedAutoApplyResult,
      rollbackMonitorResult: "not_run",
      rollbackApplied: false,
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: stageOutputs.commandOutputs,
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: false, summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  const fixtureResult = await writeAutoResearchFixture({
    observerSummary,
    queueJson: {
      generatedAt,
      sourceGeneratedAt: observerSummary.generated_at,
      paperclipApiUrl: null,
      queue,
    },
    family: selected.sourceFailureFamily,
    outputRoot: fixtureRoot,
    cwd,
    aiFixtureDrafter: options.aiFixtureDrafter === true
      ? {
          enabled: true,
          artifactPaths: options.aiFixtureDrafterArtifacts,
          invoker: options.aiFixtureDrafterInvoker,
          env: options.aiFixtureDrafterEnv,
        }
      : null,
    now: options.now,
  });
  const fixturePaths = generatedFixturePaths(fixtureResult);
  const aiFixtureDrafterSummary = "aiFixtureDrafter" in fixtureResult
    ? fixtureResult.aiFixtureDrafter ?? null
    : null;
  stageOutputs.proofPaths.push(...fixturePaths);
  stageOutputs.commandOutputs.push(
    fixtureResult.status === "written"
      ? `write-autoresearch-fixture: status=written family=${fixtureResult.failureFamily} lane=${fixtureResult.laneDir}`
      : `write-autoresearch-fixture: status=${fixtureResult.status} reason=${fixtureResult.reason}`,
  );
  if (aiFixtureDrafterSummary) {
    stageOutputs.commandOutputs.push(
      `ai-fixture-drafter: status=${aiFixtureDrafterSummary.status} ai_used=${aiFixtureDrafterSummary.ai_used} accepted=${aiFixtureDrafterSummary.accepted_fixture_id ?? "none"} rejected=${aiFixtureDrafterSummary.rejected_count}`,
    );
  }

  if (fixtureResult.status === "rejected") {
    const summary = makeSummary({
      generatedAt,
      dryRun,
      status: "fixture_rejected",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: [],
      canaryDecision: "not_run_fixture_rejected",
      nextAutonomousAction: "repair_ai_fixture_draft_before_offline_eval",
      retryCondition:
        "Retry after the AI fixture draft passes deterministic validation or run without --ai-fixture-drafter for deterministic fixture generation.",
      residualRisk:
        fixtureResult.reason || "AI fixture drafter output was rejected before offline eval or promotion gate.",
      aiClassifier: aiClassifierSummary,
      aiFixtureDrafter: aiFixtureDrafterSummary,
      autoApplyAttempted: applyRequested,
      autoApplyResult: blockedAutoApplyResult,
      rollbackMonitorResult: "not_run",
      rollbackApplied: false,
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: stageOutputs.commandOutputs,
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: false, summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  const rawCandidate = await readJsonFile(candidatePath);
  const scopedCandidate = scopeCandidateToLane(rawCandidate, requestedLane);
  const candidateForGatePath = requestedLane
    ? path.join(outputDir, `promotion-candidate-${requestedLane}.json`)
    : candidatePath;
  if (writeArtifacts && requestedLane) {
    await writeJson(candidateForGatePath, scopedCandidate);
  }
  stageOutputs.proofPaths.push(candidatePath);
  if (candidateForGatePath !== candidatePath) {
    stageOutputs.proofPaths.push(candidateForGatePath);
    stageOutputs.commandOutputs.push(`recursive-improvement lane scope: lane=${requestedLane}`);
  }
  const highRiskBlockers = unique([
    ...detectHighRiskCandidate(scopedCandidate),
    ...laneApplyBlockers({
      requestedLane,
      scopedCandidate,
      applyRequested,
      autoApplyLowRisk: options.autoApplyLowRisk === true,
    }),
  ]);
  const generatedLane = laneFromFixture(fixtureResult);
  const candidateEvalLanes = evalLanesFromRawCandidate(scopedCandidate);
  const evalLanes = unique([
    ...(candidateEvalLanes.length > 0 ? candidateEvalLanes : ["support_triage" as EvalLane]),
    ...(generatedLane ? [generatedLane] : []),
  ]);

  const pipelineResult = await runPipeline({
    lanes: evalLanes,
    fixtureRoot,
    harborRoot,
    maxPerLane: 250,
    overwrite: true,
    since: null,
    sampleCount,
    seedKnown: true,
    exportLive: false,
  });
  const offlineSummaryPath = path.join(outputDir, "offline-eval-summary.json");
  if (writeArtifacts) {
    await writeJson(offlineSummaryPath, pipelineResult.localEval);
  }
  stageOutputs.proofPaths.push(offlineSummaryPath);
  stageOutputs.commandOutputs.push(
    `offline AutoAgent eval runPipeline(exportLive=false,sample=${sampleCount}): cases=${pipelineResult.localEval.totalCases} failed=${pipelineResult.localEval.totalFailed} negative_controls_blocked=${pipelineResult.localEval.totalNegativeControlsBlocked}/${pipelineResult.localEval.totalNegativeControls}`,
  );
  const offline = offlineEvalSummary(pipelineResult.localEval, {
    fixtureRoot,
    harborRoot,
    lanes: evalLanes,
    generatedFixturePaths: fixturePaths,
    summaryPath: offlineSummaryPath,
  });

  if (fixtureResult.status === "written" && !offline.generated_fixture_included) {
    const summary = makeSummary({
      generatedAt,
      dryRun,
      status: "fixture_rejected",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      canaryDecision: "not_run_fixture_not_evaluated",
      nextAutonomousAction: "repair_fixture_eval_routing_before_promotion_gate",
      retryCondition:
        "Retry after the generated fixture path is included in the offline evaluator lane set.",
      residualRisk:
        "The generated fixture was not included in offline eval, so the promotion gate was not run.",
      aiClassifier: aiClassifierSummary,
      aiFixtureDrafter: aiFixtureDrafterSummary,
      autoApplyAttempted: applyRequested,
      autoApplyResult: blockedAutoApplyResult,
      rollbackMonitorResult: "not_run",
      rollbackApplied: false,
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: stageOutputs.commandOutputs,
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: false, summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  const gateResult = await runPromptPolicyPromotionGate({
    candidatePath: candidateForGatePath,
    fixtureRoot,
    harborRoot,
    packetOutput: gatePacketOutput,
    sampleCount,
    writePacket: writeArtifacts,
  });
  stageOutputs.proofPaths.push(gatePacketOutput);
  stageOutputs.commandOutputs.push(
    `prompt-policy-promotion-gate: decision=${gateResult.evaluation.decision}`,
    ...gateResult.evaluation.reasons.map((reason) => `prompt-policy-promotion-gate reason=${reason}`),
  );
  const gatePolicyTier = gateResult.evaluation.policyTier as AutoAgentOperatingPolicyTier;
  const gatePolicyTiers = gateResult.evaluation.policyTiers as Partial<
    Record<string, AutoAgentOperatingPolicyTier>
  >;
  const gateHeldReason = heldReasonForGate(
    gateResult.evaluation.decision,
    gateResult.evaluation.reasons,
  );

  const patchProposalResult = await runAiPatchProposal({
    cwd,
    enabled: options.aiPatchProposal === true,
    failureFamily: selected.sourceFailureFamily,
    generatedFixturePaths: fixturePaths,
    offlineEval: {
      status: offline.status,
      total_failed: offline.total_failed,
      negative_controls_blocked: negativeControlsBlocked(offline),
    },
    promotionGate: gateResult.evaluation,
    sampleCount,
    invoker: options.aiPatchProposalInvoker,
    env: options.aiPatchProposalEnv,
    now: options.now,
  });
  const patchProposalSummary = patchProposalResult.summary;
  const patchProposalSummaryPath = path.join(outputDir, "proposed_patch_summary.json");
  const patchProposalReportPath = path.join(outputDir, "proposed_patch_report.md");
  if (writeArtifacts) {
    await writeJson(patchProposalSummaryPath, patchProposalSummary);
    await writeText(patchProposalReportPath, renderAiPatchProposalReport(patchProposalSummary));
  }
  stageOutputs.proofPaths.push(patchProposalSummaryPath, patchProposalReportPath);
  stageOutputs.commandOutputs.push(
    `ai-patch-proposal: status=${patchProposalSummary.status} ai_used=${patchProposalSummary.ai_used} proposal=${patchProposalSummary.proposal_id ?? "none"}`,
    ...patchProposalSummary.reasons.map((reason) => `ai-patch-proposal reason=${reason}`),
  );

  if (highRiskBlockers.length > 0) {
    const blockerPacketPath = path.join(outputDir, "high-risk-blocker-packet.md");
    if (writeArtifacts) {
      await writeText(
        blockerPacketPath,
        renderHighRiskBlockerPacket({
          generatedAt,
          selected,
          highRiskBlockers,
          gateReasons: gateResult.evaluation.reasons,
        }),
      );
    }
    stageOutputs.proofPaths.push(blockerPacketPath);
    stageOutputs.commandOutputs.push(
      `high-risk-blocker-packet: path=${blockerPacketPath} routing=repo-local-no-send`,
    );
    const summary = makeSummary({
      generatedAt,
      dryRun,
      status: "high_risk_blocked",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      promotionDecision: gateResult.evaluation.decision,
      policyTier: "permanently_blocked",
      policyTiers: {
        ...gatePolicyTiers,
        high_risk_candidate: "permanently_blocked",
      },
      canaryDecision: "not_run_high_risk",
      autoApplyAttempted: applyRequested,
      autoApplyResult: blockedAutoApplyResult,
      rollbackMonitorResult: "not_run",
      rollbackApplied: false,
      nextAutonomousAction: "route_high_risk_candidate_to_policy_gate",
      retryCondition:
        "Retry only with a low-risk candidate or explicit human/policy approval outside this repo-local loop.",
      residualRisk:
        `High-risk candidate blocked before canary: ${highRiskBlockers.join("; ")}.`,
      aiClassifier: aiClassifierSummary,
      aiFixtureDrafter: aiFixtureDrafterSummary,
      aiPatchProposal: patchProposalSummary,
      highRiskBlockers,
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: stageOutputs.commandOutputs,
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: false, summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  const noChangeClassification = classifyNoChangeReportOnly({
    previousSummary,
    applyRequested,
    selected,
    fixtureResult,
    generatedFixturePaths: fixturePaths,
    heldReason: gateHeldReason,
  });
  if (noChangeClassification && !productionContextRequested) {
    const summary = makeSummary({
      generatedAt,
      dryRun,
      status: "no_change_report_only",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      promotionDecision: gateResult.evaluation.decision,
      policyTier: gatePolicyTier,
      policyTiers: gatePolicyTiers,
      canaryDecision: "not_run_no_change_report_only",
      rollbackDecision: "not_run",
      autoApplyAttempted: false,
      autoApplyResult: "not_requested",
      rollbackMonitorResult: "not_run",
      rollbackApplied: false,
      nextAutonomousAction:
        "close routine issue with this report path; do not create duplicate follow-up",
      retryCondition:
        "Retry only after a new failure family, new proof path, generated fixture, changed candidate, or changed held reason appears.",
      residualRisk:
        "No-change suppression only prevents duplicate routine/report follow-up churn; it does not prove live Paperclip/Hermes mutation, provider recovery, hosted-session fulfillment, sends, payments, rights/legal decisions, city-live state, customer claims, or operational launch readiness.",
      aiClassifier: aiClassifierSummary,
      aiFixtureDrafter: aiFixtureDrafterSummary,
      aiPatchProposal: patchProposalSummary,
      noChangeClassification,
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: [
        ...stageOutputs.commandOutputs,
        "recursive-improvement no-change: status=no_change_report_only duplicate_follow_up_created=false",
      ],
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: true, summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  if (gateResult.evaluation.decision === "reject") {
    const summary = makeSummary({
      generatedAt,
      dryRun,
      status: "promotion_rejected",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      promotionDecision: "reject",
      policyTier: gatePolicyTier,
      policyTiers: gatePolicyTiers,
      canaryDecision: "not_run_promotion_reject",
      autoApplyAttempted: applyRequested,
      autoApplyResult: blockedAutoApplyResult,
      rollbackMonitorResult: "not_run",
      rollbackApplied: false,
      nextAutonomousAction: "repair_promotion_candidate_before_canary",
      retryCondition:
        "Retry after the promotion gate no longer rejects and all blocked claims are removed or routed to owning proof gates.",
      residualRisk:
        gateResult.evaluation.reasons.join("; ") || "Promotion gate rejected the candidate.",
      aiClassifier: aiClassifierSummary,
      aiFixtureDrafter: aiFixtureDrafterSummary,
      aiPatchProposal: patchProposalSummary,
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: stageOutputs.commandOutputs,
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: false, summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  if (gateResult.evaluation.decision === "hold") {
    const summary = makeSummary({
      generatedAt,
      dryRun,
      status: "promotion_held",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      promotionDecision: "hold",
      policyTier: gatePolicyTier,
      policyTiers: gatePolicyTiers,
      canaryDecision: "not_run_promotion_hold",
      autoApplyAttempted: applyRequested,
      autoApplyResult: blockedAutoApplyResult,
      rollbackMonitorResult: "not_run",
      rollbackApplied: false,
      nextAutonomousAction: "collect_required_promotion_evidence",
      retryCondition:
        "Retry after the promotion gate has required offline, closeout, shadow, and rollback evidence.",
      residualRisk:
        gateResult.evaluation.reasons.join("; ") || "Promotion gate held the candidate.",
      aiClassifier: aiClassifierSummary,
      aiFixtureDrafter: aiFixtureDrafterSummary,
      aiPatchProposal: patchProposalSummary,
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: stageOutputs.commandOutputs,
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: false, summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  if (patchProposalSummary.status === "rejected") {
    const summary = makeSummary({
      generatedAt,
      dryRun,
      status: "patch_proposal_rejected",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      promotionDecision: gateResult.evaluation.decision,
      policyTier: gatePolicyTier,
      policyTiers: gatePolicyTiers,
      aiClassifier: aiClassifierSummary,
      aiFixtureDrafter: aiFixtureDrafterSummary,
      aiPatchProposal: patchProposalSummary,
      canaryDecision: "not_run_patch_proposal_rejected",
      autoApplyAttempted: applyRequested,
      autoApplyResult: blockedAutoApplyResult,
      rollbackMonitorResult: "not_run",
      rollbackApplied: false,
      nextAutonomousAction: "repair_or_drop_ai_patch_proposal_before_canary",
      retryCondition:
        "Retry after the AI patch proposal stays inside the low-risk allowlist and deterministic eval/promotion gates pass.",
      residualRisk:
        patchProposalSummary.deterministic_gate_reason || "AI patch proposal was rejected before canary.",
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: stageOutputs.commandOutputs,
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: false, summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  const canaryResult = await runCanaryPromotion({
    candidatePath: candidateForGatePath,
    fixtureRoot,
    harborRoot,
    gatePacketOutput,
    outputDir: canaryOutputDir,
    paperclipConfigPath,
    gateSampleCount: sampleCount,
    canarySampleCount: 20,
    canaryPercentage: null,
    applyCanary: applyRequested,
    requestedMode: applyRequested ? "apply" : "dry_run",
    writeArtifacts,
    now: options.now,
  });
  stageOutputs.proofPaths.push(canaryResult.planJsonPath, canaryResult.planMarkdownPath);
  if (canaryResult.plan.status === "applied") {
    stageOutputs.proofPaths.push(canaryResult.rollbackSnapshotPath, canaryResult.activeConfigPath);
  }
  stageOutputs.commandOutputs.push(
    `autoagent-canary-promotion: status=${canaryResult.plan.status} mode=${canaryResult.plan.mode}`,
    ...canaryResult.plan.validationErrors.map((error) => `autoagent-canary-promotion error=${error}`),
  );

  if (canaryResult.plan.status === "rejected") {
    const summary = makeSummary({
      generatedAt,
      dryRun,
      status: "canary_rejected",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      promotionDecision: gateResult.evaluation.decision,
      policyTier: gatePolicyTier,
      policyTiers: gatePolicyTiers,
      canaryDecision: "rejected",
      autoApplyAttempted: applyRequested,
      autoApplyResult: applyRequested ? "rejected" : "not_requested",
      rollbackMonitorResult: "not_run",
      rollbackApplied: false,
      nextAutonomousAction: "repair_canary_plan_before_rollback_monitor",
      retryCondition:
        "Retry after the canary dry-run accepts the candidate under central policy.",
      residualRisk:
        canaryResult.plan.validationErrors.join("; ") || "Canary dry-run rejected the candidate.",
      aiClassifier: aiClassifierSummary,
      aiFixtureDrafter: aiFixtureDrafterSummary,
      aiPatchProposal: patchProposalSummary,
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: stageOutputs.commandOutputs,
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: false, summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  const rollbackOutputDir = path.join(outputDir, "rollback");
  const rollbackResult = await monitorCanaryRollback({
    canaryPlanPath: canaryResult.planJsonPath,
    shadowSourcePath: options.shadowSourcePath
      ? path.resolve(cwd, options.shadowSourcePath)
      : undefined,
    outputDir: rollbackOutputDir,
    offlineEvalSummary: pipelineResult.localEval,
    applyRollback: options.applyRollback === true || applyRequested,
    writeArtifacts,
    now: options.now,
  });
  stageOutputs.proofPaths.push(rollbackResult.decisionJsonPath, rollbackResult.decisionMarkdownPath);
  stageOutputs.commandOutputs.push(
    `autoagent-rollback-monitor: status=${rollbackResult.decision.status}`,
    ...rollbackResult.decision.reasons.map((reason) => `autoagent-rollback-monitor reason=${reason}`),
  );

  if (rollbackResult.decision.status === "rollback_required") {
    const summary = makeSummary({
      generatedAt,
      dryRun,
      status: "rollback_required",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      promotionDecision: gateResult.evaluation.decision,
      policyTier: gatePolicyTier,
      policyTiers: gatePolicyTiers,
      canaryDecision: canaryResult.plan.status,
      rollbackDecision: "rollback_required",
      autoApplyAttempted: applyRequested,
      autoApplyResult: applyRequested ? "blocked" : "not_requested",
      rollbackMonitorResult: "rollback_required",
      rollbackApplied: false,
      nextAutonomousAction: "rollback_required_before_promotion",
      retryCondition:
        "Retry only after rollback triggers are cleared and the monitor returns keep_canary.",
      residualRisk: rollbackResult.decision.reasons.join("; "),
      aiClassifier: aiClassifierSummary,
      aiFixtureDrafter: aiFixtureDrafterSummary,
      aiPatchProposal: patchProposalSummary,
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: stageOutputs.commandOutputs,
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: false, summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  if (rollbackResult.decision.status === "rolled_back") {
    const summary = makeSummary({
      generatedAt,
      dryRun,
      status: "rollback_applied",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      promotionDecision: gateResult.evaluation.decision,
      policyTier: gatePolicyTier,
      policyTiers: gatePolicyTiers,
      canaryDecision: canaryResult.plan.status,
      rollbackDecision: "rolled_back",
      autoApplyAttempted: applyRequested,
      autoApplyResult: applyRequested ? "rolled_back" : "not_requested",
      rollbackMonitorResult: "rolled_back",
      rollbackApplied: true,
      nextAutonomousAction: "support_triage_canary_rolled_back",
      retryCondition:
        "Retry only after rollback triggers are cleared and a fresh promote gate packet exists.",
      residualRisk:
        rollbackResult.decision.reasons.join("; ") || "Applied support_triage canary was rolled back.",
      aiClassifier: aiClassifierSummary,
      aiFixtureDrafter: aiFixtureDrafterSummary,
      aiPatchProposal: patchProposalSummary,
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: stageOutputs.commandOutputs,
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: resultStatus(summary), summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  if (rollbackResult.decision.status === "insufficient_evidence") {
    const summary = makeSummary({
      generatedAt,
      dryRun,
      status: "insufficient_evidence",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      promotionDecision: gateResult.evaluation.decision,
      policyTier: gatePolicyTier,
      policyTiers: gatePolicyTiers,
      canaryDecision: canaryResult.plan.status,
      rollbackDecision: "insufficient_evidence",
      autoApplyAttempted: applyRequested,
      autoApplyResult: applyRequested ? "blocked" : "not_requested",
      rollbackMonitorResult: "insufficient_evidence",
      rollbackApplied: false,
      nextAutonomousAction: "collect_canary_shadow_evidence",
      retryCondition:
        "Retry after a local AutoAgent shadow summary is present for rollback monitoring.",
      residualRisk:
        rollbackResult.decision.reasons.join("; ") || "Rollback monitor had insufficient evidence.",
      aiClassifier: aiClassifierSummary,
      aiFixtureDrafter: aiFixtureDrafterSummary,
      aiPatchProposal: patchProposalSummary,
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: stageOutputs.commandOutputs,
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: false, summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  if (productionContextRequested && productionProposalSummary) {
    if (productionProposalSummary.status === "duplicate_idempotency") {
      productionDecision.production_canary_attempted = false;
      productionDecision.production_canary_result = "duplicate_idempotency_suppressed";
      stageOutputs.commandOutputs.push(
        `production-canary: duplicate idempotency key suppressed ${productionProposalSummary.idempotency_key ?? "unknown"}`,
      );
    } else if (
      ["blocked", "rejected", "fallback_ai_unavailable", "not_requested"].includes(
        productionProposalSummary.status,
      )
    ) {
      productionDecision.production_canary_attempted = false;
      productionDecision.production_canary_result =
        productionDecision.production_canary_result === "not_requested"
          ? "not_attempted"
          : productionDecision.production_canary_result;
    } else {
      const productionCanary = await executeProductionCanary({
        cwd,
        outputDir: productionCanaryOutputDir,
        execute: productionExecutionAllowed,
        proposalSummary: productionProposalSummary,
        proposal: productionProposal,
        validation: productionProposalSummary.validation,
        writeArtifacts,
        now: options.now,
      });
      productionDecision.production_canary_attempted = productionCanary.attempted;
      productionDecision.production_canary_result = productionCanary.result;
      productionDecision.audit_event_path = productionCanary.auditEventPath;
      productionDecision.rollback_snapshot_path =
        productionCanary.rollbackSnapshotPath ?? productionDecision.rollback_snapshot_path;
      productionDecision.live_mutation_attempted = productionCanary.liveMutationAttempted;
      productionDecision.live_mutation_committed = productionCanary.liveMutationCommitted;
      stageOutputs.proofPaths.push(...productionCanary.proofPaths);
      stageOutputs.commandOutputs.push(...productionCanary.commandOutputs);
    }
  } else if (productionContextRequested) {
    productionDecision.production_canary_result = "not_attempted";
  }

  const summary = makeSummary({
    generatedAt,
    dryRun,
    status: applyRequested ? "canary_applied" : "dry_run_completed",
    selectedFailureFamily: selected.sourceFailureFamily,
    selectedQueueItemId: selected.id,
    generatedFixturePaths: fixturePaths,
    offlineEvalResult: offline,
    promotionDecision: gateResult.evaluation.decision,
    policyTier: gatePolicyTier,
    policyTiers: gatePolicyTiers,
    canaryDecision: canaryResult.plan.status,
    rollbackDecision: rollbackResult.decision.status,
    autoApplyAttempted: applyRequested,
    autoApplyResult: applyRequested ? "applied" : "not_requested",
    rollbackMonitorResult: rollbackResult.decision.status,
    rollbackApplied: productionDecision.production_canary_result === "rolled_back",
    nextAutonomousAction: applyRequested
      ? "monitor_support_triage_canary"
      : "manual_review_or_next_shadow_canary_packet",
    retryCondition:
      applyRequested
        ? "Rollback monitor remains configured; rollback automatically when it returns rollback_required."
        : "Retry when new observer evidence appears or when applying an explicitly approved repo-local canary/rollback artifact.",
    residualRisk:
      applyRequested
        ? "This applied repo-local support_triage canary remains observation-only; it does not prove live sends, provider recovery, hosted-session fulfillment, payments, rights/legal decisions, city-live state, customer claims, or operational launch readiness."
        : "This dry-run proves the repo-local loop only; it does not prove live Paperclip/Hermes mutation, provider recovery, hosted-session fulfillment, sends, payments, rights/legal decisions, city-live state, or production automation quality.",
    aiClassifier: aiClassifierSummary,
    aiFixtureDrafter: aiFixtureDrafterSummary,
    aiPatchProposal: patchProposalSummary,
    productionDecision,
    proofPaths: stageOutputs.proofPaths,
    commandOutputs: stageOutputs.commandOutputs,
  });
  const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
  return { ok: resultStatus(summary), summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
}

export function parseRecursiveImprovementArgs(argv: string[]): RecursiveImprovementLoopOptions {
  const options: RecursiveImprovementLoopOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--auto-apply-low-risk":
        options.autoApplyLowRisk = true;
        options.applyCanary = true;
        options.dryRun = false;
        break;
      case "--ai-classifier":
        options.aiClassifier = true;
        break;
      case "--ai-classifier-artifact":
        if (!next) throw new Error("--ai-classifier-artifact requires a path");
        options.aiClassifierArtifacts = [...(options.aiClassifierArtifacts ?? []), next];
        index += 1;
        break;
      case "--ai-fixture-drafter":
        options.aiFixtureDrafter = true;
        break;
      case "--ai-fixture-drafter-artifact":
        if (!next) throw new Error("--ai-fixture-drafter-artifact requires a path");
        options.aiFixtureDrafterArtifacts = [...(options.aiFixtureDrafterArtifacts ?? []), next];
        index += 1;
        break;
      case "--ai-patch-proposal":
        options.aiPatchProposal = true;
        break;
      case "--ai-patch-proposal-artifact":
        if (!next) throw new Error("--ai-patch-proposal-artifact requires a path");
        options.aiPatchProposalArtifacts = [...(options.aiPatchProposalArtifacts ?? []), next];
        index += 1;
        break;
      case "--production-context":
        options.productionContext = true;
        break;
      case "--ai-production-proposal":
        options.aiProductionProposal = true;
        options.productionContext = true;
        break;
      case "--execute-production-canary":
        options.executeProductionCanary = true;
        options.productionContext = true;
        options.dryRun = false;
        break;
      case "--observer-input":
        if (!next) throw new Error("--observer-input requires a path");
        options.observerInputRoots = [...(options.observerInputRoots ?? []), next];
        index += 1;
        break;
      case "--candidate":
        if (!next) throw new Error("--candidate requires a path");
        options.candidatePath = next;
        index += 1;
        break;
      case "--fixture-root":
        if (!next) throw new Error("--fixture-root requires a path");
        options.fixtureRoot = next;
        index += 1;
        break;
      case "--harbor-root":
        if (!next) throw new Error("--harbor-root requires a path");
        options.harborRoot = next;
        index += 1;
        break;
      case "--output-dir":
        if (!next) throw new Error("--output-dir requires a path");
        options.outputDir = next;
        index += 1;
        break;
      case "--gate-packet-output":
        if (!next) throw new Error("--gate-packet-output requires a path");
        options.gatePacketOutput = next;
        index += 1;
        break;
      case "--canary-output-dir":
        if (!next) throw new Error("--canary-output-dir requires a path");
        options.canaryOutputDir = next;
        index += 1;
        break;
      case "--shadow-summary":
        if (!next) throw new Error("--shadow-summary requires a path");
        options.shadowSourcePath = next;
        index += 1;
        break;
      case "--paperclip-config":
        if (!next) throw new Error("--paperclip-config requires a path");
        options.paperclipConfigPath = next;
        index += 1;
        break;
      case "--sample":
        if (!next) throw new Error("--sample requires a number");
        options.sampleCount = Math.max(0, Number.parseInt(next, 10) || 0);
        index += 1;
        break;
      case "--lane":
        if (!next) throw new Error("--lane requires a lane name");
        options.lane = next;
        index += 1;
        break;
      case "--max-files":
        if (!next) throw new Error("--max-files requires a number");
        options.observerMaxFiles = Math.max(1, Number.parseInt(next, 10) || 1);
        index += 1;
        break;
      case "--max-bytes":
        if (!next) throw new Error("--max-bytes requires a number");
        options.observerMaxBytesPerFile = Math.max(1024, Number.parseInt(next, 10) || 1024);
        index += 1;
        break;
      case "--apply-canary":
        options.applyCanary = true;
        options.dryRun = false;
        break;
      case "--apply-rollback":
        options.applyRollback = true;
        options.dryRun = false;
        break;
      case "--live":
      case "--export-live":
      case "--apply":
      case "--founder-approved":
        throw new Error(`${arg} is not allowed by the recursive improvement loop; use the lower-level command only with explicit live authorization.`);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseRecursiveImprovementArgs(argv);
  const result = await runRecursiveImprovementLoop(options);
  console.log(
    `[autoagent-recursive-improve] status=${result.summary.status} selected=${result.summary.selected_failure_family ?? "none"} promotion=${result.summary.promotion_decision} canary=${result.summary.canary_decision} rollback=${result.summary.rollback_decision}`,
  );
  console.log(`[autoagent-recursive-improve] summary=${result.summaryPath}`);
  console.log(`[autoagent-recursive-improve] report=${result.reportPath}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentPath = path.resolve(new URL(import.meta.url).pathname);

if (invokedPath && invokedPath === currentPath) {
  main().catch((error) => {
    console.error(
      `[autoagent-recursive-improve] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
