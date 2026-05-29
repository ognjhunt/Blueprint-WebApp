import fs from "node:fs/promises";
import path from "node:path";

import {
  analyzeAgentImprovementArtifacts,
  writeObserverOutputs,
  type AgentImprovementObserverSummary,
} from "../paperclip/agent-improvement-observer.ts";
import {
  buildAutoResearchPromotionQueue,
  buildAutoResearchPromotionQueueMarkdown,
  type AutoResearchPromotionQueueItem,
} from "../paperclip/autoresearch-promotion-queue.ts";
import {
  writeAutoResearchFixture,
  type WriteAutoResearchFixtureResult,
} from "./write-autoresearch-fixture.ts";
import { runPipeline } from "./run-pipeline.ts";
import { type EvalLane, type LocalEvalSummary } from "./local-evaluator.ts";
import { runPromptPolicyPromotionGate } from "./prompt-policy-promotion-gate.ts";
import { runCanaryPromotion } from "./run-canary-promotion.ts";
import { monitorCanaryRollback } from "./monitor-canary-rollback.ts";
import {
  AUTOAGENT_DISALLOWED_LIVE_SIDE_EFFECTS,
  AUTOAGENT_PERMANENTLY_BLOCKED_LANES,
} from "../../server/agents/autoagent-promotion-policy.ts";

type RecursiveLoopStatus =
  | "dry_run_completed"
  | "canary_applied"
  | "rollback_applied"
  | "insufficient_evidence"
  | "promotion_rejected"
  | "promotion_held"
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

export type RecursiveImprovementSummary = {
  schema: "blueprint/autoagent-recursive-improvement-summary/v1";
  generated_at: string;
  dry_run: boolean;
  status: RecursiveLoopStatus;
  selected_failure_family: string | null;
  selected_queue_item_id: string | null;
  generated_fixture_paths: string[];
  offline_eval_result: OfflineEvalResultSummary;
  negative_controls_blocked: boolean;
  promotion_decision: string;
  canary_decision: string;
  rollback_decision: string;
  live_mutation_attempted: boolean;
  next_autonomous_action: string;
  retry_condition: string;
  residual_risk: string;
  high_risk_blockers: string[];
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
  applyCanary?: boolean;
  applyRollback?: boolean;
  writeArtifacts?: boolean;
  now?: Date;
};

type StageOutputs = {
  proofPaths: string[];
  commandOutputs: string[];
};

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
const AUTO_APPLY_CANARY_LANE = "support_triage";

const ALL_EVAL_LANES: EvalLane[] = [
  "waitlist_triage",
  "support_triage",
  "preview_diagnosis",
  "agent_failure_promotion",
];

const HIGH_RISK_LANES = new Set<string>(AUTOAGENT_PERMANENTLY_BLOCKED_LANES);
const DISALLOWED_SIDE_EFFECTS = new Set<string>(AUTOAGENT_DISALLOWED_LIVE_SIDE_EFFECTS);

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

function laneApplyBlockers(requestedLane: string | null, applyCanary: boolean) {
  if (!applyCanary) {
    return [];
  }
  if (!requestedLane) {
    return ["apply-canary requires explicit --lane support_triage"];
  }
  if (requestedLane !== AUTO_APPLY_CANARY_LANE) {
    return [`lane is not enabled for auto-apply: ${requestedLane}`];
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
  canaryDecision?: string;
  rollbackDecision?: string;
  nextAutonomousAction: string;
  retryCondition: string;
  residualRisk: string;
  highRiskBlockers?: string[];
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
  return {
    schema: "blueprint/autoagent-recursive-improvement-summary/v1",
    generated_at: params.generatedAt,
    dry_run: params.dryRun,
    status: params.status,
    selected_failure_family: params.selectedFailureFamily ?? null,
    selected_queue_item_id: params.selectedQueueItemId ?? null,
    generated_fixture_paths: params.generatedFixturePaths ?? [],
    offline_eval_result: offline,
    negative_controls_blocked:
      params.negativeControlsBlocked ?? negativeControlsBlocked(offline),
    promotion_decision: params.promotionDecision ?? "not_run",
    canary_decision: params.canaryDecision ?? "not_run",
    rollback_decision: params.rollbackDecision ?? "not_run",
    live_mutation_attempted: false,
    next_autonomous_action: params.nextAutonomousAction,
    retry_condition: params.retryCondition,
    residual_risk: params.residualRisk,
    high_risk_blockers: params.highRiskBlockers ?? [],
    proof_paths: unique(params.proofPaths ?? []),
    command_outputs: params.commandOutputs ?? [],
  };
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
    `Canary decision: ${summary.canary_decision}`,
    `Rollback decision: ${summary.rollback_decision}`,
    "",
    "## Generated Fixtures",
    "",
    list(summary.generated_fixture_paths),
    "",
    "## High-Risk Blockers",
    "",
    list(summary.high_risk_blockers),
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
  const dryRun = options.dryRun ?? !(options.applyCanary || options.applyRollback);
  const writeArtifacts = options.writeArtifacts !== false;
  const generatedAt = (options.now ?? new Date()).toISOString();
  const stageOutputs: StageOutputs = { proofPaths: [], commandOutputs: [] };

  const observerOutputDir = path.join(outputDir, "observer");
  const observerSummary = await analyzeAgentImprovementArtifacts({
    cwd,
    inputRoots: options.observerInputRoots,
    maxFiles: options.observerMaxFiles,
    maxBytesPerFile: options.observerMaxBytesPerFile,
    top: 5,
    now: options.now,
  });
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
    const summary = baseSummary({
      generatedAt,
      dryRun,
      status: "insufficient_evidence",
      nextAutonomousAction: "collect_local_observer_evidence",
      retryCondition:
        "Retry after local observer evidence contains a classified recurring failure family.",
      residualRisk:
        "No queue item was selected, so no fixture, offline eval, promotion, canary, or rollback decision can prove movement.",
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
    now: options.now,
  });
  const fixturePaths = generatedFixturePaths(fixtureResult);
  stageOutputs.proofPaths.push(...fixturePaths);
  stageOutputs.commandOutputs.push(
    fixtureResult.status === "written"
      ? `write-autoresearch-fixture: status=written family=${fixtureResult.failureFamily} lane=${fixtureResult.laneDir}`
      : `write-autoresearch-fixture: status=skipped reason=${fixtureResult.reason}`,
  );

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
    ...laneApplyBlockers(requestedLane, options.applyCanary === true),
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

  if (highRiskBlockers.length > 0) {
    const summary = baseSummary({
      generatedAt,
      dryRun,
      status: "high_risk_blocked",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      promotionDecision: gateResult.evaluation.decision,
      canaryDecision: "not_run_high_risk",
      nextAutonomousAction: "route_high_risk_candidate_to_policy_gate",
      retryCondition:
        "Retry only with a low-risk candidate or explicit human/policy approval outside this repo-local loop.",
      residualRisk:
        `High-risk candidate blocked before canary: ${highRiskBlockers.join("; ")}.`,
      highRiskBlockers,
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: stageOutputs.commandOutputs,
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: false, summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  if (gateResult.evaluation.decision === "reject") {
    const summary = baseSummary({
      generatedAt,
      dryRun,
      status: "promotion_rejected",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      promotionDecision: "reject",
      canaryDecision: "not_run_promotion_reject",
      nextAutonomousAction: "repair_promotion_candidate_before_canary",
      retryCondition:
        "Retry after the promotion gate no longer rejects and all blocked claims are removed or routed to owning proof gates.",
      residualRisk:
        gateResult.evaluation.reasons.join("; ") || "Promotion gate rejected the candidate.",
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: stageOutputs.commandOutputs,
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: false, summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  if (gateResult.evaluation.decision === "hold") {
    const summary = baseSummary({
      generatedAt,
      dryRun,
      status: "promotion_held",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      promotionDecision: "hold",
      canaryDecision: "not_run_promotion_hold",
      nextAutonomousAction: "collect_required_promotion_evidence",
      retryCondition:
        "Retry after the promotion gate has required offline, closeout, shadow, and rollback evidence.",
      residualRisk:
        gateResult.evaluation.reasons.join("; ") || "Promotion gate held the candidate.",
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
    applyCanary: options.applyCanary === true,
    requestedMode: options.applyCanary === true ? "apply" : "dry_run",
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
    const summary = baseSummary({
      generatedAt,
      dryRun,
      status: "canary_rejected",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      promotionDecision: gateResult.evaluation.decision,
      canaryDecision: "rejected",
      nextAutonomousAction: "repair_canary_plan_before_rollback_monitor",
      retryCondition:
        "Retry after the canary dry-run accepts the candidate under central policy.",
      residualRisk:
        canaryResult.plan.validationErrors.join("; ") || "Canary dry-run rejected the candidate.",
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
    applyRollback: options.applyRollback === true || options.applyCanary === true,
    writeArtifacts,
    now: options.now,
  });
  stageOutputs.proofPaths.push(rollbackResult.decisionJsonPath, rollbackResult.decisionMarkdownPath);
  stageOutputs.commandOutputs.push(
    `autoagent-rollback-monitor: status=${rollbackResult.decision.status}`,
    ...rollbackResult.decision.reasons.map((reason) => `autoagent-rollback-monitor reason=${reason}`),
  );

  if (rollbackResult.decision.status === "rollback_required") {
    const summary = baseSummary({
      generatedAt,
      dryRun,
      status: "rollback_required",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      promotionDecision: gateResult.evaluation.decision,
      canaryDecision: canaryResult.plan.status,
      rollbackDecision: "rollback_required",
      nextAutonomousAction: "rollback_required_before_promotion",
      retryCondition:
        "Retry only after rollback triggers are cleared and the monitor returns keep_canary.",
      residualRisk: rollbackResult.decision.reasons.join("; "),
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: stageOutputs.commandOutputs,
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: false, summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  if (rollbackResult.decision.status === "rolled_back") {
    const summary = baseSummary({
      generatedAt,
      dryRun,
      status: "rollback_applied",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      promotionDecision: gateResult.evaluation.decision,
      canaryDecision: canaryResult.plan.status,
      rollbackDecision: "rolled_back",
      nextAutonomousAction: "support_triage_canary_rolled_back",
      retryCondition:
        "Retry only after rollback triggers are cleared and a fresh promote gate packet exists.",
      residualRisk:
        rollbackResult.decision.reasons.join("; ") || "Applied support_triage canary was rolled back.",
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: stageOutputs.commandOutputs,
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: resultStatus(summary), summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  if (rollbackResult.decision.status === "insufficient_evidence") {
    const summary = baseSummary({
      generatedAt,
      dryRun,
      status: "insufficient_evidence",
      selectedFailureFamily: selected.sourceFailureFamily,
      selectedQueueItemId: selected.id,
      generatedFixturePaths: fixturePaths,
      offlineEvalResult: offline,
      promotionDecision: gateResult.evaluation.decision,
      canaryDecision: canaryResult.plan.status,
      rollbackDecision: "insufficient_evidence",
      nextAutonomousAction: "collect_canary_shadow_evidence",
      retryCondition:
        "Retry after a local AutoAgent shadow summary is present for rollback monitoring.",
      residualRisk:
        rollbackResult.decision.reasons.join("; ") || "Rollback monitor had insufficient evidence.",
      proofPaths: stageOutputs.proofPaths,
      commandOutputs: stageOutputs.commandOutputs,
    });
    const paths = await writeConsolidatedOutputs(outputDir, summary, writeArtifacts);
    return { ok: false, summary, summaryPath: paths.summaryPath, reportPath: paths.reportPath };
  }

  const summary = baseSummary({
    generatedAt,
    dryRun,
    status: options.applyCanary === true ? "canary_applied" : "dry_run_completed",
    selectedFailureFamily: selected.sourceFailureFamily,
    selectedQueueItemId: selected.id,
    generatedFixturePaths: fixturePaths,
    offlineEvalResult: offline,
    promotionDecision: gateResult.evaluation.decision,
    canaryDecision: canaryResult.plan.status,
    rollbackDecision: rollbackResult.decision.status,
    nextAutonomousAction: options.applyCanary === true
      ? "monitor_support_triage_canary"
      : "manual_review_or_next_shadow_canary_packet",
    retryCondition:
      options.applyCanary === true
        ? "Rollback monitor remains configured; rollback automatically when it returns rollback_required."
        : "Retry when new observer evidence appears or when applying an explicitly approved repo-local canary/rollback artifact.",
    residualRisk:
      options.applyCanary === true
        ? "This applied repo-local support_triage canary remains observation-only; it does not prove live sends, provider recovery, hosted-session fulfillment, payments, rights/legal decisions, city-live state, customer claims, or operational launch readiness."
        : "This dry-run proves the repo-local loop only; it does not prove live Paperclip/Hermes mutation, provider recovery, hosted-session fulfillment, sends, payments, rights/legal decisions, city-live state, or production automation quality.",
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
