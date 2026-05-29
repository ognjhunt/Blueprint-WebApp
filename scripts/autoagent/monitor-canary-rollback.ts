import fs from "node:fs/promises";
import path from "node:path";

import {
  AUTOAGENT_ALLOWED_AUTO_PROMOTION_LANES,
  AUTOAGENT_PERMANENTLY_BLOCKED_LANES,
  type AutoAgentOfflineEvalSummary,
  type AutoAgentPromotionLane,
} from "../../server/agents/autoagent-promotion-policy.ts";
import { type EvalLane } from "./local-evaluator.ts";
import { runPipeline } from "./run-pipeline.ts";

type RollbackMonitorStatus =
  | "keep_canary"
  | "rollback_required"
  | "rolled_back"
  | "insufficient_evidence";

type CommandOutput = {
  command: string;
  exitCode: number;
  output: string[];
};

type FileSnapshot = {
  path: string;
  exists: boolean;
  sha256: string | null;
  sizeBytes: number | null;
};

type PreviousConfigSnapshot = {
  capturedAt: string;
  livePaperclipConfigMutation: boolean;
  paperclipConfig: FileSnapshot;
  existingRepoLocalCanaryConfig: FileSnapshot;
  existingRepoLocalCanaryConfigValue: unknown | null;
  autoagentShadowEnv?: Record<string, string | null>;
};

type CanaryMutationPlanItem = {
  order: number;
  action: string;
  path: string;
  sideEffectClass: string;
  requiredBefore?: string;
};

export type CanaryRollbackPlan = {
  schema: string;
  generatedAt: string;
  status: string;
  mode: string;
  candidate: {
    id: string;
    title: string;
    manifestPath: string;
    changedPaths: string[];
    declaredLanes: string[];
  };
  gate: {
    decision: string;
    checks: Record<string, unknown>;
    reasons: string[];
    packetPath: string;
  };
  policy: {
    decision: string;
    riskTiers: Record<string, string>;
    checks: Record<string, unknown>;
    reasons: string[];
    blockedClaims: string[];
    requiredNextEvidence: string[];
    rollbackTriggers: string[];
  };
  canary: {
    lane: string | null;
    behavior: string;
    canaryAuthority: string;
    primaryOutputAuthority: string;
    canaryOutputStorage: string;
    sampleCount: number;
    percentage: number | null;
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

export type ShadowSourceRecord = {
  namespace?: string;
  kind?: string;
  status?: string;
  provider?: string;
  runtime?: string;
  model?: string | null;
  error?: string | null;
  output?: unknown;
  primary?: Record<string, unknown>;
  comparison?: Record<string, unknown>;
  liveEvidenceContradictions?: unknown;
  contradictions?: unknown;
};

export type CanaryRollbackDecision = {
  schema: "blueprint/autoagent-canary-rollback-decision/v1";
  generatedAt: string;
  status: RollbackMonitorStatus;
  dryRun: boolean;
  applyRollbackRequested: boolean;
  candidateId: string;
  canaryLane: string | null;
  triggeredRules: string[];
  reasons: string[];
  evidencePaths: string[];
  commandOutputs: CommandOutput[];
  thresholds: {
    maxMismatchedDecisionFields: number;
    maxCanaryOutputUnavailableRate: number;
    runtimeFailureRecurrenceThreshold: number;
  };
  counts: {
    shadowRecords: number;
    mismatchedDecisionFields: number;
    canaryOutputUnavailable: number;
    runtimeProviderAuthFailures: number;
  };
  rollbackApplied: false | {
    snapshotPath: string;
    activeConfigPath: string;
    resultPath: string;
  };
};

type LivePaperclipReadOptions = {
  enabled: boolean;
  collections: string[];
  limit: number;
};

export type MonitorCanaryRollbackOptions = {
  canaryPlanPath?: string;
  shadowSourcePath?: string;
  offlineEvalPath?: string;
  offlineEvalSummary?: AutoAgentOfflineEvalSummary | null;
  outputDir?: string;
  fixtureRoot?: string;
  harborRoot?: string;
  sampleCount?: number;
  applyRollback?: boolean;
  writeArtifacts?: boolean;
  runOfflineEval?: boolean;
  allowLivePaperclipRead?: boolean;
  paperclipCollections?: string[];
  paperclipLimit?: number;
  maxMismatchedDecisionFields?: number;
  maxCanaryOutputUnavailableRate?: number;
  runtimeFailureRecurrenceThreshold?: number;
  now?: Date;
};

type OfflineEvalResult = {
  summary: AutoAgentOfflineEvalSummary | null;
  commandOutputs: CommandOutput[];
  evidencePaths: string[];
  failedToRun: boolean;
};

type ShadowReadResult = {
  records: ShadowSourceRecord[];
  commandOutputs: CommandOutput[];
  evidencePaths: string[];
};

const DEFAULT_CANARY_PLAN_PATH = path.resolve("output/autoagent/canary/latest/canary-plan.json");
const DEFAULT_FIXTURE_ROOT = path.resolve("labs/autoagent/tasks");
const DEFAULT_HARBOR_ROOT = path.resolve("labs/autoagent/harbor");
const DEFAULT_SAMPLE_COUNT = 3;
const DEFAULT_PAPERCLIP_COLLECTIONS = [
  "contactRequests",
  "waitlistSubmissions",
  "inboundRequests",
];
const LOW_RISK_ROLLBACK_LANES = new Set<string>(AUTOAGENT_ALLOWED_AUTO_PROMOTION_LANES);
const KNOWN_EVAL_LANES = new Set<EvalLane>([
  "waitlist_triage",
  "support_triage",
  "preview_diagnosis",
  "agent_failure_promotion",
]);

const HIGH_RISK_OUTPUT_PATTERNS: Array<{ rule: string; label: string; pattern: RegExp }> = [
  {
    rule: "high_risk_claim_in_canary_output",
    label: "live send or outbound execution",
    pattern: /\b(live_send|send_email|outbound_send|sendgrid|gmail_send|dispatch_email)\b/i,
  },
  {
    rule: "high_risk_claim_in_canary_output",
    label: "payment or payout claim",
    pattern: /\b(payment_succeeded|payment\s+complete|charge\s+customer|payout|stripe_payout|refund)\b/i,
  },
  {
    rule: "high_risk_claim_in_canary_output",
    label: "rights/legal clearance claim",
    pattern: /\b(rights[-_\s]?cleared|legal[-_\s]?approved|privacy[-_\s]?approved|commercialization[-_\s]?approved)\b/i,
  },
  {
    rule: "high_risk_claim_in_canary_output",
    label: "provider execution claim",
    pattern: /\b(provider_execution|provider\s+job\s+(complete|completed|started)|runtime\s+fulfillment\s+complete)\b/i,
  },
  {
    rule: "high_risk_claim_in_canary_output",
    label: "city-live/customer/operational readiness claim",
    pattern: /\b(city_live|city\s+is\s+live|customer_claim|hosted_session_fulfillment|operational_launch_ready|operational_launch_readiness)\b/i,
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

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter(Boolean);
  }
  const stringValue = asString(value);
  return stringValue ? [stringValue] : [];
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
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

function normalizeOfflineEval(value: unknown): AutoAgentOfflineEvalSummary | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const nested = record.localEval ?? record.summary ?? record.offlineEval;
  if (nested && nested !== value) {
    return normalizeOfflineEval(nested);
  }

  const totalCases = Number(record.totalCases ?? 0);
  const totalFailed = Number(record.totalFailed ?? record.failed ?? 0);
  const totalNegativeControls = Number(record.totalNegativeControls ?? 0);
  const totalNegativeControlsBlocked = Number(record.totalNegativeControlsBlocked ?? 0);
  if (
    !Number.isFinite(totalCases)
    || !Number.isFinite(totalFailed)
    || !Number.isFinite(totalNegativeControls)
    || !Number.isFinite(totalNegativeControlsBlocked)
  ) {
    return null;
  }

  return {
    totalCases,
    totalFailed,
    totalNegativeControls,
    totalNegativeControlsBlocked,
    laneSummaries: asRecord(record.laneSummaries) as AutoAgentOfflineEvalSummary["laneSummaries"],
  };
}

function formatOfflineEval(summary: AutoAgentOfflineEvalSummary | null) {
  if (!summary) {
    return ["offline_eval unavailable"];
  }
  return [
    `cases=${summary.totalCases}`,
    `failed=${summary.totalFailed}`,
    `negative_controls_blocked=${summary.totalNegativeControlsBlocked}/${summary.totalNegativeControls}`,
  ];
}

function evalLanesFromPlan(plan: CanaryRollbackPlan): EvalLane[] {
  const lanes = [
    ...(plan.canary.lane ? [plan.canary.lane] : []),
    ...(plan.candidate.declaredLanes || []),
  ].filter((lane): lane is EvalLane => KNOWN_EVAL_LANES.has(lane as EvalLane));
  return unique(lanes) as EvalLane[];
}

async function resolveOfflineEval(
  options: Required<
    Pick<
      MonitorCanaryRollbackOptions,
      "fixtureRoot" | "harborRoot" | "sampleCount" | "runOfflineEval"
    >
  > &
    Pick<MonitorCanaryRollbackOptions, "offlineEvalPath" | "offlineEvalSummary"> & {
      plan: CanaryRollbackPlan;
    },
): Promise<OfflineEvalResult> {
  if (options.offlineEvalSummary !== undefined) {
    return {
      summary: options.offlineEvalSummary,
      commandOutputs: [
        {
          command: "offline AutoAgent eval summary supplied by caller",
          exitCode: options.offlineEvalSummary ? 0 : 1,
          output: formatOfflineEval(options.offlineEvalSummary),
        },
      ],
      evidencePaths: [],
      failedToRun: false,
    };
  }

  if (options.offlineEvalPath) {
    const resolvedPath = path.resolve(options.offlineEvalPath);
    try {
      const summary = normalizeOfflineEval(await readJsonFile(resolvedPath));
      return {
        summary,
        commandOutputs: [
          {
            command: `read offline AutoAgent eval summary ${resolvedPath}`,
            exitCode: summary ? 0 : 1,
            output: formatOfflineEval(summary),
          },
        ],
        evidencePaths: [resolvedPath],
        failedToRun: false,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        summary: null,
        commandOutputs: [
          {
            command: `read offline AutoAgent eval summary ${resolvedPath}`,
            exitCode: 1,
            output: [message],
          },
        ],
        evidencePaths: [resolvedPath],
        failedToRun: true,
      };
    }
  }

  if (!options.runOfflineEval) {
    return {
      summary: null,
      commandOutputs: [
        {
          command: "offline AutoAgent eval run skipped",
          exitCode: 0,
          output: ["runOfflineEval=false"],
        },
      ],
      evidencePaths: [],
      failedToRun: false,
    };
  }

  const lanes = evalLanesFromPlan(options.plan);
  try {
    const pipelineResult = await runPipeline({
      lanes: lanes.length > 0 ? lanes : undefined,
      fixtureRoot: options.fixtureRoot,
      harborRoot: options.harborRoot,
      maxPerLane: 250,
      overwrite: true,
      since: null,
      sampleCount: options.sampleCount,
      seedKnown: true,
      exportLive: false,
    });
    return {
      summary: pipelineResult.localEval,
      commandOutputs: [
        {
          command: `offline AutoAgent eval runPipeline(exportLive=false,sample=${options.sampleCount})`,
          exitCode: 0,
          output: [`export_mode=${pipelineResult.exportMode}`, ...formatOfflineEval(pipelineResult.localEval)],
        },
      ],
      evidencePaths: [],
      failedToRun: false,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      summary: null,
      commandOutputs: [
        {
          command: `offline AutoAgent eval runPipeline(exportLive=false,sample=${options.sampleCount})`,
          exitCode: 1,
          output: [message],
        },
      ],
      evidencePaths: [],
      failedToRun: true,
    };
  }
}

function looksLikeShadowRecord(record: Record<string, unknown>) {
  return Boolean(
    record.comparison
      || record.output
      || record.primary
      || record.kind
      || record.namespace === "autoagent",
  );
}

function extractShadowRecords(value: unknown): ShadowSourceRecord[] {
  if (Array.isArray(value)) {
    return value.flatMap(extractShadowRecords);
  }

  const record = asRecord(value);
  if (!record) {
    return [];
  }

  const records = [
    record.records,
    record.shadowRecords,
    record.shadow_runs,
    record.documents,
    record.results,
  ];
  for (const candidate of records) {
    if (Array.isArray(candidate)) {
      return candidate.flatMap(extractShadowRecords);
    }
  }

  const opsAutomation = asRecord(record.ops_automation ?? record.opsAutomation);
  const nestedShadowRuns = asRecord(opsAutomation?.shadow_runs ?? opsAutomation?.shadowRuns);
  const autoagent = nestedShadowRuns?.autoagent;
  if (autoagent) {
    return extractShadowRecords(autoagent);
  }

  const directAutoagent = record.autoagent;
  if (directAutoagent && directAutoagent !== value) {
    return extractShadowRecords(directAutoagent);
  }

  return looksLikeShadowRecord(record) ? [record as ShadowSourceRecord] : [];
}

async function readLocalShadowSource(
  shadowSourcePath: string | null,
): Promise<ShadowReadResult> {
  if (!shadowSourcePath) {
    return {
      records: [],
      evidencePaths: [],
      commandOutputs: [
        {
          command: "read local AutoAgent shadow summary",
          exitCode: 1,
          output: ["no local shadow summary path configured"],
        },
      ],
    };
  }

  const resolvedPath = path.resolve(shadowSourcePath);
  try {
    const records = extractShadowRecords(await readJsonFile(resolvedPath));
    return {
      records,
      evidencePaths: [resolvedPath],
      commandOutputs: [
        {
          command: `read local AutoAgent shadow summary ${resolvedPath}`,
          exitCode: records.length > 0 ? 0 : 1,
          output: [`shadow_records=${records.length}`],
        },
      ],
    };
  } catch (error) {
    const code = error && typeof error === "object" ? (error as { code?: string }).code : "";
    const message = error instanceof Error ? error.message : String(error);
    return {
      records: [],
      evidencePaths: [resolvedPath],
      commandOutputs: [
        {
          command: `read local AutoAgent shadow summary ${resolvedPath}`,
          exitCode: 1,
          output: [code === "ENOENT" ? "local shadow summary not found" : message],
        },
      ],
    };
  }
}

async function readLivePaperclipShadowRecords(
  options: LivePaperclipReadOptions,
): Promise<ShadowReadResult> {
  if (!options.enabled) {
    return {
      records: [],
      evidencePaths: [],
      commandOutputs: [
        {
          command: "live Paperclip AutoAgent shadow read",
          exitCode: 0,
          output: ["disabled"],
        },
      ],
    };
  }

  try {
    const { dbAdmin } = await import("../../client/src/lib/firebaseAdmin");
    const records: ShadowSourceRecord[] = [];
    for (const collection of options.collections) {
      const snapshot = await dbAdmin.collection(collection).limit(options.limit).get();
      for (const doc of snapshot.docs) {
        records.push(...extractShadowRecords(doc.data()));
      }
    }
    return {
      records,
      evidencePaths: options.collections.map((collection) => `firestore:${collection}`),
      commandOutputs: [
        {
          command: `live Paperclip AutoAgent shadow read collections=${options.collections.join(",")} limit=${options.limit}`,
          exitCode: 0,
          output: [`shadow_records=${records.length}`, "read_only=true"],
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      records: [],
      evidencePaths: options.collections.map((collection) => `firestore:${collection}`),
      commandOutputs: [
        {
          command: `live Paperclip AutoAgent shadow read collections=${options.collections.join(",")} limit=${options.limit}`,
          exitCode: 1,
          output: [message, "read_only=true"],
        },
      ],
    };
  }
}

function numberListLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function comparisonList(record: ShadowSourceRecord, key: string) {
  const comparison = asRecord(record.comparison);
  return comparison ? stringList(comparison[key]) : [];
}

function mismatchedFieldCount(record: ShadowSourceRecord) {
  const comparison = asRecord(record.comparison);
  return comparison ? numberListLength(comparison.mismatched_fields ?? comparison.mismatchedFields) : 0;
}

function safetyBlockers(record: ShadowSourceRecord) {
  const comparison = asRecord(record.comparison);
  return comparison ? stringList(comparison.safety_blockers ?? comparison.safetyBlockers) : [];
}

function isCanaryUnavailable(record: ShadowSourceRecord) {
  return record.status !== "completed" || record.output == null;
}

function isRuntimeProviderAuthFailure(record: ShadowSourceRecord) {
  const errorText = [
    asString(record.error),
    asString(asRecord(record.output)?.error),
    asString(asRecord(record.comparison)?.error),
  ].join("\n");
  return /\b(runtime|provider|auth|credential|unauthorized|forbidden|token|rate[-_\s]?limit)\b/i.test(errorText);
}

function recordDropsHumanReview(record: ShadowSourceRecord) {
  const blockers = safetyBlockers(record);
  if (blockers.includes("shadow_drops_human_review")) {
    return true;
  }
  const primary = asRecord(record.primary);
  const output = asRecord(record.output);
  return primary?.requires_human_review === true && output?.requires_human_review !== true;
}

function recordAutoclearsBlockedPrimary(record: ShadowSourceRecord) {
  const blockers = safetyBlockers(record);
  if (blockers.includes("shadow_autoclears_blocked_primary")) {
    return true;
  }

  const comparison = asRecord(record.comparison);
  const mismatched = Array.isArray(comparison?.mismatched_fields)
    ? comparison.mismatched_fields
    : [];
  return mismatched.some((item) => {
    const field = asString(asRecord(item)?.field);
    const primary = asString(asRecord(item)?.primary);
    const shadow = asString(asRecord(item)?.shadow);
    return field === "automation_status" && primary === "blocked" && shadow !== "blocked";
  });
}

function recordLiveEvidenceContradictsPacket(record: ShadowSourceRecord) {
  const comparison = asRecord(record.comparison);
  if (stringList(record.liveEvidenceContradictions).length > 0) {
    return true;
  }
  if (stringList(record.contradictions).length > 0) {
    return true;
  }
  if (safetyBlockers(record).includes("live_evidence_contradicts_promotion_packet")) {
    return true;
  }
  if (asString(comparison?.live_action_authority) && comparison?.live_action_authority !== "primary_result_only") {
    return true;
  }
  if (asString(comparison?.shadow_mode) && comparison?.shadow_mode !== "observation_only") {
    return true;
  }
  return asRecord(record.output)?.used_as_authoritative === true;
}

function flattenForSearch(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function highRiskCanaryOutputFindings(record: ShadowSourceRecord) {
  const text = flattenForSearch(record.output);
  return HIGH_RISK_OUTPUT_PATTERNS.filter(({ pattern }) => pattern.test(text));
}

function evaluateOfflineTriggers(summary: AutoAgentOfflineEvalSummary | null, failedToRun: boolean) {
  const triggeredRules: string[] = [];
  const reasons: string[] = [];

  if (failedToRun) {
    triggeredRules.push("offline_eval_failed");
    reasons.push("Offline AutoAgent eval failed to run.");
    return { triggeredRules, reasons };
  }

  if (!summary) {
    return { triggeredRules, reasons };
  }

  if (summary.totalCases <= 0 || summary.totalFailed > 0) {
    triggeredRules.push("offline_eval_failed");
    reasons.push(
      `Offline AutoAgent eval now fails or has no passing evidence: cases=${summary.totalCases} failed=${summary.totalFailed}.`,
    );
  }

  if (
    summary.totalNegativeControls <= 0
    || summary.totalNegativeControlsBlocked < summary.totalNegativeControls
  ) {
    triggeredRules.push("negative_control_passed");
    reasons.push(
      `A negative control passed or is missing: blocked ${summary.totalNegativeControlsBlocked}/${summary.totalNegativeControls}.`,
    );
  }

  for (const [lane, laneSummary] of Object.entries(summary.laneSummaries ?? {})) {
    const negativeControls = Number(laneSummary?.negativeControls ?? 0);
    const blocked = Number(laneSummary?.negativeControlsBlocked ?? 0);
    if (negativeControls <= 0 || blocked < negativeControls) {
      triggeredRules.push("negative_control_passed");
      reasons.push(`${lane} negative controls are not fully blocked: ${blocked}/${negativeControls}.`);
    }
  }

  return {
    triggeredRules: unique(triggeredRules),
    reasons: unique(reasons),
  };
}

function evaluateShadowTriggers(
  records: ShadowSourceRecord[],
  thresholds: CanaryRollbackDecision["thresholds"],
) {
  const triggeredRules: string[] = [];
  const reasons: string[] = [];
  let mismatchedDecisionFields = 0;
  let canaryOutputUnavailable = 0;
  let runtimeProviderAuthFailures = 0;

  records.forEach((record, index) => {
    const label = `shadow record ${index + 1}`;
    const blockers = safetyBlockers(record);
    const mismatches = mismatchedFieldCount(record);
    mismatchedDecisionFields += mismatches;

    if (recordDropsHumanReview(record)) {
      triggeredRules.push("shadow_drops_human_review");
      reasons.push(`${label} drops a primary human-review safeguard.`);
    }

    if (recordAutoclearsBlockedPrimary(record)) {
      triggeredRules.push("shadow_autoclears_blocked_primary");
      reasons.push(`${label} autoclears a blocked primary result.`);
    }

    if (isCanaryUnavailable(record)) {
      canaryOutputUnavailable += 1;
    }

    if (isRuntimeProviderAuthFailure(record)) {
      runtimeProviderAuthFailures += 1;
    }

    if (recordLiveEvidenceContradictsPacket(record)) {
      triggeredRules.push("live_evidence_contradicts_promotion_packet");
      reasons.push(`${label} contradicts promotion packet safety authority.`);
    }

    const highRiskFindings = highRiskCanaryOutputFindings(record);
    for (const finding of highRiskFindings) {
      triggeredRules.push(finding.rule);
      reasons.push(`${label} contains high-risk canary output: ${finding.label}.`);
    }

    if (blockers.includes("shadow_result_unavailable")) {
      triggeredRules.push("canary_output_unavailable");
    }
  });

  if (mismatchedDecisionFields > thresholds.maxMismatchedDecisionFields) {
    triggeredRules.push("decision_fields_mismatch_threshold");
    reasons.push(
      `Required decision fields mismatched above threshold: ${mismatchedDecisionFields} > ${thresholds.maxMismatchedDecisionFields}.`,
    );
  }

  const unavailableRate = records.length > 0 ? canaryOutputUnavailable / records.length : 0;
  if (unavailableRate > thresholds.maxCanaryOutputUnavailableRate) {
    triggeredRules.push("canary_output_unavailable");
    reasons.push(
      `Canary output unavailable above threshold: ${canaryOutputUnavailable}/${records.length}.`,
    );
  }

  if (runtimeProviderAuthFailures >= thresholds.runtimeFailureRecurrenceThreshold) {
    triggeredRules.push("runtime_provider_auth_failure_recurred");
    reasons.push(
      `Runtime/provider/auth failures recurred above threshold: ${runtimeProviderAuthFailures}.`,
    );
  }

  return {
    triggeredRules: unique(triggeredRules),
    reasons: unique(reasons),
    counts: {
      shadowRecords: records.length,
      mismatchedDecisionFields,
      canaryOutputUnavailable,
      runtimeProviderAuthFailures,
    },
  };
}

function canUsePlanForLowRiskRollback(plan: CanaryRollbackPlan) {
  const lanes = unique([
    ...(plan.canary.lane ? [plan.canary.lane] : []),
    ...(plan.candidate.declaredLanes || []),
  ]);
  if (lanes.length === 0) {
    return false;
  }
  return lanes.every(
    (lane) =>
      LOW_RISK_ROLLBACK_LANES.has(lane)
      && !(AUTOAGENT_PERMANENTLY_BLOCKED_LANES as readonly string[]).includes(lane),
  );
}

async function loadPreviousConfigSnapshot(plan: CanaryRollbackPlan) {
  if (plan.rollback.previousConfigSnapshot) {
    return {
      snapshot: plan.rollback.previousConfigSnapshot,
      snapshotPath: plan.rollback.snapshotPath,
      commandOutput: {
        command: "load stored previous config snapshot from canary plan",
        exitCode: 0,
        output: ["source=canary_plan.rollback.previousConfigSnapshot"],
      } satisfies CommandOutput,
    };
  }

  if (!plan.rollback.snapshotPath) {
    return {
      snapshot: null,
      snapshotPath: "",
      commandOutput: {
        command: "load stored previous config snapshot",
        exitCode: 1,
        output: ["snapshotPath is missing"],
      } satisfies CommandOutput,
    };
  }

  try {
    const snapshot = asRecord(await readJsonFile(plan.rollback.snapshotPath)) as PreviousConfigSnapshot | null;
    return {
      snapshot,
      snapshotPath: plan.rollback.snapshotPath,
      commandOutput: {
        command: `load stored previous config snapshot ${plan.rollback.snapshotPath}`,
        exitCode: snapshot ? 0 : 1,
        output: [snapshot ? "snapshot_loaded=true" : "snapshot JSON is not an object"],
      } satisfies CommandOutput,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      snapshot: null,
      snapshotPath: plan.rollback.snapshotPath,
      commandOutput: {
        command: `load stored previous config snapshot ${plan.rollback.snapshotPath}`,
        exitCode: 1,
        output: [message],
      } satisfies CommandOutput,
    };
  }
}

function rollbackRefusalReason(plan: CanaryRollbackPlan, snapshot: PreviousConfigSnapshot | null) {
  if (!snapshot) {
    return "Rollback apply refused: stored previous config snapshot is missing.";
  }
  if (snapshot.livePaperclipConfigMutation) {
    return "Rollback apply refused: high-risk or live mutation rollback is not allowed.";
  }
  if (!canUsePlanForLowRiskRollback(plan)) {
    return "Rollback apply refused: high-risk or live mutation rollback is not allowed.";
  }
  if (plan.mutationPlan.some((item) => item.sideEffectClass !== "repo_local_artifact")) {
    return "Rollback apply refused: high-risk or live mutation rollback is not allowed.";
  }
  if (!snapshot.existingRepoLocalCanaryConfig?.path) {
    return "Rollback apply refused: stored previous config snapshot is missing.";
  }
  if (
    snapshot.existingRepoLocalCanaryConfig.exists
    && snapshot.existingRepoLocalCanaryConfigValue == null
  ) {
    return "Rollback apply refused: stored previous config value is missing.";
  }
  return null;
}

async function applyRepoLocalRollback(params: {
  plan: CanaryRollbackPlan;
  outputDir: string;
  now: string;
}) {
  const loaded = await loadPreviousConfigSnapshot(params.plan);
  const commandOutputs = [loaded.commandOutput];
  const refusal = rollbackRefusalReason(params.plan, loaded.snapshot);
  if (refusal || !loaded.snapshot) {
    commandOutputs.push({
      command: "apply repo-local rollback from stored previous config snapshot",
      exitCode: 1,
      output: [refusal || "Rollback apply refused."],
    });
    return {
      applied: null,
      refusal: refusal || "Rollback apply refused.",
      commandOutputs,
    };
  }

  const activeConfigPath = path.resolve(loaded.snapshot.existingRepoLocalCanaryConfig.path);
  if (loaded.snapshot.existingRepoLocalCanaryConfig.exists) {
    await writeJson(activeConfigPath, loaded.snapshot.existingRepoLocalCanaryConfigValue);
  } else {
    await fs.rm(activeConfigPath, { force: true });
  }

  const resultPath = path.join(params.outputDir, "rollback-applied.json");
  await writeJson(resultPath, {
    schema: "blueprint/autoagent-canary-rollback-apply/v1",
    status: "rolled_back",
    rolledBackAt: params.now,
    candidateId: params.plan.candidate.id,
    activeConfigPath,
    snapshotPath: loaded.snapshotPath,
    livePaperclipConfigMutation: false,
    restoredFromPreviousConfigSnapshot: true,
  });
  commandOutputs.push({
    command: "apply repo-local rollback from stored previous config snapshot",
    exitCode: 0,
    output: [
      `active_config=${activeConfigPath}`,
      `snapshot=${loaded.snapshotPath}`,
      "livePaperclipConfigMutation=false",
    ],
  });

  return {
    applied: {
      snapshotPath: loaded.snapshotPath,
      activeConfigPath,
      resultPath,
    },
    refusal: null,
    commandOutputs,
  };
}

function renderDecisionMarkdown(decision: CanaryRollbackDecision) {
  const list = (values: string[]) =>
    values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "- none";
  const commandOutputs = decision.commandOutputs
    .map((commandOutput) =>
      [
        `### ${commandOutput.command}`,
        `exit_code: ${commandOutput.exitCode}`,
        "```text",
        commandOutput.output.join("\n") || "(no output)",
        "```",
      ].join("\n"),
    )
    .join("\n\n");

  return [
    "# AutoAgent Canary Rollback Decision",
    "",
    `Status: ${decision.status}`,
    `Generated at: ${decision.generatedAt}`,
    `Candidate id: ${decision.candidateId || "unknown"}`,
    `Canary lane: ${decision.canaryLane || "unknown"}`,
    `Dry run: ${decision.dryRun}`,
    `Apply rollback requested: ${decision.applyRollbackRequested}`,
    "",
    "## Triggered Rules",
    "",
    list(decision.triggeredRules),
    "",
    "## Reasons",
    "",
    list(decision.reasons),
    "",
    "## Evidence Paths",
    "",
    list(decision.evidencePaths),
    "",
    "## Counts",
    "",
    `- shadow_records: ${decision.counts.shadowRecords}`,
    `- mismatched_decision_fields: ${decision.counts.mismatchedDecisionFields}`,
    `- canary_output_unavailable: ${decision.counts.canaryOutputUnavailable}`,
    `- runtime_provider_auth_failures: ${decision.counts.runtimeProviderAuthFailures}`,
    "",
    "## Command Outputs",
    "",
    commandOutputs || "none",
    "",
  ].join("\n");
}

export async function monitorCanaryRollback(
  options: MonitorCanaryRollbackOptions = {},
) {
  const canaryPlanPath = path.resolve(options.canaryPlanPath || DEFAULT_CANARY_PLAN_PATH);
  const outputDir = path.resolve(options.outputDir || path.dirname(canaryPlanPath));
  const generatedAt = (options.now || new Date()).toISOString();
  const decisionJsonPath = path.join(outputDir, "rollback-decision.json");
  const decisionMarkdownPath = path.join(outputDir, "rollback-decision.md");
  const commandOutputs: CommandOutput[] = [];
  const evidencePaths: string[] = [canaryPlanPath];

  const plan = (await readJsonFile(canaryPlanPath)) as CanaryRollbackPlan;
  commandOutputs.push({
    command: `read canary plan ${canaryPlanPath}`,
    exitCode: 0,
    output: [
      `candidate=${plan.candidate?.id || "unknown"}`,
      `status=${plan.status || "unknown"}`,
    ],
  });

  const offlineResult = await resolveOfflineEval({
    plan,
    offlineEvalPath: options.offlineEvalPath,
    offlineEvalSummary: options.offlineEvalSummary,
    fixtureRoot: path.resolve(options.fixtureRoot || DEFAULT_FIXTURE_ROOT),
    harborRoot: path.resolve(options.harborRoot || DEFAULT_HARBOR_ROOT),
    sampleCount: Math.max(0, Math.floor(options.sampleCount ?? DEFAULT_SAMPLE_COUNT)),
    runOfflineEval: options.runOfflineEval !== false,
  });
  commandOutputs.push(...offlineResult.commandOutputs);
  evidencePaths.push(...offlineResult.evidencePaths);

  const defaultShadowPath = path.join(path.dirname(canaryPlanPath), "shadow-summary.json");
  const shadowSourcePath = options.shadowSourcePath
    ? path.resolve(options.shadowSourcePath)
    : defaultShadowPath;
  const localShadow = await readLocalShadowSource(shadowSourcePath);
  commandOutputs.push(...localShadow.commandOutputs);
  evidencePaths.push(...localShadow.evidencePaths);

  let shadowRecords = localShadow.records;
  if (shadowRecords.length === 0 && options.allowLivePaperclipRead) {
    const liveShadow = await readLivePaperclipShadowRecords({
      enabled: true,
      collections: options.paperclipCollections || DEFAULT_PAPERCLIP_COLLECTIONS,
      limit: Math.max(1, Math.floor(options.paperclipLimit ?? 50)),
    });
    shadowRecords = liveShadow.records;
    commandOutputs.push(...liveShadow.commandOutputs);
    evidencePaths.push(...liveShadow.evidencePaths);
  } else {
    const liveShadow = await readLivePaperclipShadowRecords({
      enabled: false,
      collections: [],
      limit: 0,
    });
    commandOutputs.push(...liveShadow.commandOutputs);
  }

  const thresholds = {
    maxMismatchedDecisionFields: Math.max(
      0,
      Math.floor(options.maxMismatchedDecisionFields ?? 0),
    ),
    maxCanaryOutputUnavailableRate: Math.max(
      0,
      Number(options.maxCanaryOutputUnavailableRate ?? 0),
    ),
    runtimeFailureRecurrenceThreshold: Math.max(
      1,
      Math.floor(options.runtimeFailureRecurrenceThreshold ?? 2),
    ),
  };

  const offlineTriggers = evaluateOfflineTriggers(
    offlineResult.summary,
    offlineResult.failedToRun,
  );
  const shadowTriggers = evaluateShadowTriggers(shadowRecords, thresholds);
  let triggeredRules = unique([
    ...offlineTriggers.triggeredRules,
    ...shadowTriggers.triggeredRules,
  ]);
  const reasons = unique([
    ...offlineTriggers.reasons,
    ...shadowTriggers.reasons,
  ]);

  let status: RollbackMonitorStatus = "keep_canary";
  if (triggeredRules.length > 0) {
    status = "rollback_required";
  } else if (shadowRecords.length === 0) {
    status = "insufficient_evidence";
    reasons.push("No AutoAgent shadow records exist; missing evidence cannot count as canary success.");
  } else {
    reasons.push("Canary evidence is clean against rollback thresholds.");
  }

  let rollbackApplied: CanaryRollbackDecision["rollbackApplied"] = false;
  if (options.applyRollback === true) {
    if (status !== "rollback_required") {
      commandOutputs.push({
        command: "apply repo-local rollback from stored previous config snapshot",
        exitCode: 0,
        output: [`decision_status=${status}`, "rollback_not_required=true"],
      });
    } else {
      const applyResult = await applyRepoLocalRollback({
        plan,
        outputDir,
        now: generatedAt,
      });
      commandOutputs.push(...applyResult.commandOutputs);
      if (applyResult.applied) {
        rollbackApplied = applyResult.applied;
        status = "rolled_back";
        reasons.push("Rollback applied from the stored previous config snapshot.");
      } else if (applyResult.refusal) {
        reasons.push(applyResult.refusal);
      }
    }
  }

  triggeredRules = unique(triggeredRules);
  const decision: CanaryRollbackDecision = {
    schema: "blueprint/autoagent-canary-rollback-decision/v1",
    generatedAt,
    status,
    dryRun: options.applyRollback !== true,
    applyRollbackRequested: options.applyRollback === true,
    candidateId: plan.candidate?.id || "",
    canaryLane: plan.canary?.lane ?? null,
    triggeredRules,
    reasons: unique(reasons),
    evidencePaths: unique([
      ...evidencePaths,
      ...(rollbackApplied ? [rollbackApplied.snapshotPath, rollbackApplied.resultPath] : []),
    ]),
    commandOutputs,
    thresholds,
    counts: shadowTriggers.counts,
    rollbackApplied,
  };

  if (options.writeArtifacts !== false) {
    await writeJson(decisionJsonPath, decision);
    await writeText(decisionMarkdownPath, renderDecisionMarkdown(decision));
  }

  return {
    decision,
    plan,
    decisionJsonPath,
    decisionMarkdownPath,
  };
}

function parseArgs(argv: string[]): MonitorCanaryRollbackOptions {
  const options: MonitorCanaryRollbackOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--canary-plan":
      case "--plan":
        if (!next) throw new Error(`${arg} requires a path`);
        options.canaryPlanPath = path.resolve(next);
        index += 1;
        break;
      case "--shadow-summary":
      case "--shadow-source":
        if (!next) throw new Error(`${arg} requires a path`);
        options.shadowSourcePath = path.resolve(next);
        index += 1;
        break;
      case "--offline-eval-report":
        if (!next) throw new Error("--offline-eval-report requires a path");
        options.offlineEvalPath = path.resolve(next);
        index += 1;
        break;
      case "--output-dir":
        if (!next) throw new Error("--output-dir requires a path");
        options.outputDir = path.resolve(next);
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
      case "--sample":
        if (!next) throw new Error("--sample requires a number");
        options.sampleCount = Math.max(0, Number.parseInt(next, 10) || 0);
        index += 1;
        break;
      case "--apply-rollback":
        options.applyRollback = true;
        break;
      case "--dry-run":
        options.applyRollback = false;
        break;
      case "--no-write":
        options.writeArtifacts = false;
        break;
      case "--no-run-offline-eval":
        options.runOfflineEval = false;
        break;
      case "--allow-live-paperclip-read":
        options.allowLivePaperclipRead = true;
        break;
      case "--paperclip-collections":
        if (!next) throw new Error("--paperclip-collections requires a comma-separated list");
        options.paperclipCollections = next
          .split(",")
          .map((collection) => collection.trim())
          .filter(Boolean);
        index += 1;
        break;
      case "--paperclip-limit":
        if (!next) throw new Error("--paperclip-limit requires a number");
        options.paperclipLimit = Math.max(1, Number.parseInt(next, 10) || 1);
        index += 1;
        break;
      case "--max-mismatched-decision-fields":
        if (!next) throw new Error("--max-mismatched-decision-fields requires a number");
        options.maxMismatchedDecisionFields = Math.max(0, Number.parseInt(next, 10) || 0);
        index += 1;
        break;
      case "--max-canary-output-unavailable-rate":
        if (!next) throw new Error("--max-canary-output-unavailable-rate requires a number");
        options.maxCanaryOutputUnavailableRate = Math.max(0, Number.parseFloat(next) || 0);
        index += 1;
        break;
      case "--runtime-failure-recurrence-threshold":
        if (!next) throw new Error("--runtime-failure-recurrence-threshold requires a number");
        options.runtimeFailureRecurrenceThreshold = Math.max(1, Number.parseInt(next, 10) || 1);
        index += 1;
        break;
      case "--apply":
      case "--live":
      case "--export-live":
        throw new Error(`${arg} is not allowed; use --apply-rollback for repo-local rollback only`);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const result = await monitorCanaryRollback(parseArgs(argv));
  console.log(
    `[autoagent-canary-rollback] status=${result.decision.status} decision=${result.decisionJsonPath} markdown=${result.decisionMarkdownPath}`,
  );
  for (const reason of result.decision.reasons) {
    console.log(`[autoagent-canary-rollback] reason=${reason}`);
  }
  process.exitCode = result.decision.status === "keep_canary" || result.decision.status === "rolled_back"
    ? 0
    : 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentPath = path.resolve(new URL(import.meta.url).pathname);

if (invokedPath && currentPath === invokedPath) {
  main().catch((error) => {
    console.error(
      `[autoagent-canary-rollback] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
