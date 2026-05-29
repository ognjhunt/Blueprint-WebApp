import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  type AiFailureFamilyClassifierResult,
  type ValidatedAiFailureFamilyClassification,
} from "./ai-failure-family-classifier.ts";

export type ImprovementSeverity = "critical" | "high" | "medium" | "low";

export type ImprovementCandidate = {
  failure_family: string;
  severity: ImprovementSeverity;
  recurrence_count: number;
  evidence_paths: string[];
  recommended_eval_or_policy_change: string;
  blocked_claims: string[];
  source?: "deterministic_observer" | "ai_classifier";
  affected_lane?: string;
  risk_tier?: string;
  report_only?: boolean;
  validation_reasons?: string[];
};

type FamilyDefinition = {
  failure_family: string;
  baseSeverity: number;
  patterns: RegExp[];
  recommended_eval_or_policy_change: string;
  blocked_claims: string[];
};

type Observation = {
  failureFamily: string;
  evidencePath: string;
  excerpt: string;
};

export type AgentImprovementObserverSummary = {
  generated_at: string;
  analyzer: "blueprint_recursive_agent_improvement_observer";
  mode: "read_only_local_files";
  input_roots: string[];
  scanned_files: number;
  skipped_roots: string[];
  improvement_candidates: ImprovementCandidate[];
  top_5: ImprovementCandidate[];
  ai_classifier?: AiFailureFamilyClassifierResult["summary"];
};

export type AnalyzeAgentImprovementArtifactsOptions = {
  cwd?: string;
  inputRoots?: string[];
  maxFiles?: number;
  maxBytesPerFile?: number;
  top?: number;
  now?: Date;
};

export type WriteObserverOutputsOptions = {
  outputDir: string;
  summary: AgentImprovementObserverSummary;
};

const DEFAULT_INPUT_ROOTS = [
  "labs/autoagent",
  "ops/paperclip/reports",
  "ops/paperclip/playbooks",
  "output",
];

const TEXT_EXTENSIONS = new Set([
  ".csv",
  ".json",
  ".jsonl",
  ".log",
  ".md",
  ".txt",
  ".toml",
  ".yaml",
  ".yml",
]);

const LINE_ORIENTED_EXTENSIONS = new Set([".jsonl", ".log", ".txt"]);

const SKIP_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "node_modules",
  "__pycache__",
]);

const SKIP_PATH_SEGMENTS = [
  `${path.sep}ops${path.sep}paperclip${path.sep}external${path.sep}`,
  `${path.sep}graphify-out${path.sep}`,
  `${path.sep}derived${path.sep}graphify${path.sep}`,
];

const FAMILY_DEFINITIONS: FamilyDefinition[] = [
  {
    failure_family: "codex_usage_limit_adapter_unavailable",
    baseSeverity: 3,
    patterns: [
      /no execution adapter available:\s*codex_local[\s\S]{0,220}(?:weekly limit exhausted|usage limit|quota)/i,
      /codex_local[\s\S]{0,160}(?:weekly limit exhausted|usage limit exhausted)/i,
    ],
    recommended_eval_or_policy_change:
      "Add a Paperclip adapter-capacity policy check that blocks or reroutes Codex-local lanes before issue execution when usage limits are active.",
    blocked_claims: [
      "Codex issue execution is available",
      "assigned implementation lane can resume now",
      "goal closeout is blocked by product code rather than adapter capacity",
    ],
  },
  {
    failure_family: "codex_local_exec_tooling_unavailable",
    baseSeverity: 3,
    patterns: [
      /tool_runtime_unavailable/i,
      /failed to create unified exec process/i,
      /exec_command failed/i,
      /write_stdin failed: stdin is closed/i,
      /codex lost access to its local exec tooling/i,
    ],
    recommended_eval_or_policy_change:
      "Add a local-exec preflight and result-classifier rule so completed Codex turns are not misreported as task failures after transient tool loss.",
    blocked_claims: [
      "local verification actually ran",
      "failed run proves a repo regression",
      "adapter success or failure alone proves task state",
    ],
  },
  {
    failure_family: "hermes_provider_auth_unavailable",
    baseSeverity: 4,
    patterns: [
      /openrouter[\s\S]{0,220}(?:http 401|401 unauthorized|invalid api key|provider auth failed|auth failed|user not found)/i,
      /hermes[\s\S]{0,220}(?:http 401|401 unauthorized|provider auth failed|authentication failed)/i,
    ],
    recommended_eval_or_policy_change:
      "Add a Hermes provider-auth readiness gate and fallback policy that fails closed before assigning work to an unauthenticated provider lane.",
    blocked_claims: [
      "Hermes provider execution completed",
      "OpenRouter-backed lane is healthy",
      "provider artifacts prove operational launch readiness",
    ],
  },
  {
    failure_family: "provider_quota_or_rate_limit",
    baseSeverity: 3,
    patterns: [
      /http 429/i,
      /rate limit exceeded/i,
      /free-models-per-(?:min|day)/i,
      /insufficient credits/i,
      /spend limit exceeded/i,
      /http 402/i,
    ],
    recommended_eval_or_policy_change:
      "Add quota-aware cooldown fixtures and ladder-routing policy so provider exhaustion becomes a blocked/reroute state instead of repeated failed retries.",
    blocked_claims: [
      "provider-backed run is ready to retry immediately",
      "agent failure is caused by task logic",
      "provider execution completed",
    ],
  },
  {
    failure_family: "provider_model_contract_failure",
    baseSeverity: 3,
    patterns: [
      /no endpoints found for/i,
      /http 404:\s*no endpoints/i,
      /invalid provider\/model/i,
      /dead model id/i,
    ],
    recommended_eval_or_policy_change:
      "Add a model-ladder contract eval that rejects dead provider model IDs before they can be recorded as successful agent runs.",
    blocked_claims: [
      "configured model ladder is valid",
      "Hermes provider fallback is operational",
      "successful run status implies useful model output",
    ],
  },
  {
    failure_family: "provider_or_model_timeout",
    baseSeverity: 2,
    patterns: [
      /timed out while running/i,
      /deadline exceeded/i,
      /\betimedout\b/i,
      /timeout=\d+s[\s\S]{0,160}(?:timed out|failed)/i,
    ],
    recommended_eval_or_policy_change:
      "Add timeout-family fixtures that separate retryable provider latency from durable blockers and enforce one bounded retry before reroute.",
    blocked_claims: [
      "provider run completed",
      "timeout failure proves product defect",
      "retry can proceed without cooldown or reroute policy",
    ],
  },
  {
    failure_family: "paperclip_runtime_unavailable",
    baseSeverity: 4,
    patterns: [
      /failed to connect to 127\.0\.0\.1 port 3100/i,
      /econnrefused[\s\S]{0,120}(?:127\.0\.0\.1|localhost)[\s\S]{0,80}3100/i,
      /nothing is listening on 127\.0\.0\.1:3100/i,
      /localhost:3100[\s\S]{0,140}(?:unavailable|down|refused|not listening)/i,
    ],
    recommended_eval_or_policy_change:
      "Keep repo-side closeout generation independent from live Paperclip availability and classify localhost runtime outages as retry conditions.",
    blocked_claims: [
      "live Paperclip runtime was inspected",
      "Paperclip issue state proves closure",
      "localhost availability is required for repo-local goal evidence",
    ],
  },
  {
    failure_family: "paperclip_auth_or_env_missing",
    baseSeverity: 3,
    patterns: [
      /paperclip_api_key is missing/i,
      /agent authentication required/i,
      /(?:401|403)\s+(?:unauthorized|forbidden)[\s\S]{0,120}\/api\//i,
      /missing[\s\S]{0,120}paperclip[\s\S]{0,80}(?:env|auth|token)/i,
    ],
    recommended_eval_or_policy_change:
      "Add an auth/env bootstrap check that turns missing Paperclip credentials into a durable blocker id before queue or issue reads start.",
    blocked_claims: [
      "Paperclip API read succeeded",
      "agent owns current issue context",
      "runtime state was reconciled",
    ],
  },
  {
    failure_family: "paperclip_route_contract_or_probe_drift",
    baseSeverity: 3,
    patterns: [
      /\/api\/runs[\s\S]{0,220}(?:jq: error|sort_by\/0|unsupported|not found)/i,
      /issue-bound wake[\s\S]{0,220}(?:\/api\/runs|inbox-lite|queue discovery|check the inbox)/i,
      /hand-written jq filter failed/i,
    ],
    recommended_eval_or_policy_change:
      "Add a route-contract policy and fixture that forces issue-bound wakes through deterministic helpers instead of ad hoc /api/runs probes.",
    blocked_claims: [
      "issue-bound run stayed scoped",
      "Paperclip route contract was followed",
      "manual queue discovery is safe evidence",
    ],
  },
  {
    failure_family: "issue_binding_missing_or_scope_widened",
    baseSeverity: 3,
    patterns: [
      /without paperclip_task_id[\s\S]{0,180}binding failure/i,
      /issue-bound wake[\s\S]{0,160}(?:widened|queue discovery|check the inbox)/i,
      /do not invent ad hoc \/api\/runs probes/i,
    ],
    recommended_eval_or_policy_change:
      "Add a binding preflight that exits cheaply when PAPERCLIP_TASK_ID or an explicit issue id is absent instead of widening into inbox discovery.",
    blocked_claims: [
      "agent was bound to the owning issue",
      "queue-wide scan was necessary",
      "closeout can cite an inferred issue id",
    ],
  },
  {
    failure_family: "no_change_closeout_churn",
    baseSeverity: 4,
    patterns: [
      /no-change closeout/i,
      /no changed artifact/i,
      /no new proof/i,
      /does not show completed movement/i,
      /mislabeled as completed movement/i,
      /marked the run complete[\s\S]{0,160}(?:without|no)\s+(?:proof|movement|changed artifact)/i,
    ],
    recommended_eval_or_policy_change:
      "Promote no-change churn into a negative-control eval that requires either changed proof, a durable suppression rule, or an explicit blocked state.",
    blocked_claims: [
      "goal state is done",
      "blocker was resolved",
      "run produced durable movement",
    ],
  },
  {
    failure_family: "closeout_evidence_contract_gap",
    baseSeverity: 4,
    patterns: [
      /adapter success is not completion/i,
      /missing required paperclip goal closeout/i,
      /closeout packet[\s\S]{0,120}missing/i,
      /required closeout labels/i,
      /done[\s\S]{0,120}without[\s\S]{0,80}proof paths/i,
      /claims done[\s\S]{0,120}without[\s\S]{0,80}evidence/i,
    ],
    recommended_eval_or_policy_change:
      "Enforce the goal-closeout contract as a local validator before any run reports done, blocked, or awaiting_human_decision.",
    blocked_claims: [
      "done state is evidence-grade",
      "blocked state names earliest hard stop",
      "awaiting-human state has durable blocker ownership",
    ],
  },
  {
    failure_family: "hosted_session_proof_gap",
    baseSeverity: 4,
    patterns: [
      /hosted-session proof gap/i,
      /no entitlement,\s*runtime session,\s*or provider artifact/i,
      /no entitlement[\s\S]{0,120}runtime[\s\S]{0,120}provider artifact/i,
      /hosted-session fulfillment[\s\S]{0,160}(?:not proved|unsupported|missing)/i,
      /only sample\/demo copy[\s\S]{0,180}no entitlement/i,
    ],
    recommended_eval_or_policy_change:
      "Add a hosted-session proof negative control that blocks fulfillment claims unless entitlement, runtime-session, and provider/package artifacts are present.",
    blocked_claims: [
      "hosted-session fulfillment completed",
      "package access is already open",
      "runtime/provider artifacts prove operational launch readiness",
    ],
  },
  {
    failure_family: "public_copy_proof_drift",
    baseSeverity: 3,
    patterns: [
      /public-copy proof drift/i,
      /unsupported public claim/i,
      /invented[\s\S]{0,120}(?:customer|traction|rights|hosted-session|provider|city coverage)/i,
      /fake[\s\S]{0,120}(?:traction|customer|provider|readiness|supply)/i,
    ],
    recommended_eval_or_policy_change:
      "Add a public-claims fixture that preserves confident Public Launch Ready copy while blocking only specific unsupported operational claims.",
    blocked_claims: [
      "real customer proof exists",
      "rights are cleared",
      "active city coverage or provider completion is proven",
    ],
  },
  {
    failure_family: "human_gate_or_reply_durability_blocker",
    baseSeverity: 3,
    patterns: [
      /sender verification/i,
      /gmail oauth/i,
      /first-send approval/i,
      /awaiting_human_decision/i,
      /human reply[\s\S]{0,140}durability/i,
      /durable blocker id/i,
    ],
    recommended_eval_or_policy_change:
      "Add a human-gate closeout check that requires blocker id, routing surface, watcher owner, and exact resume condition before claiming blocked or awaiting-human.",
    blocked_claims: [
      "human-gated branch is done",
      "reply durability is configured",
      "first-send or approval path can resume automatically",
    ],
  },
  {
    failure_family: "notion_capability_gap_manual_probe",
    baseSeverity: 2,
    patterns: [
      /since i can't directly access notion/i,
      /notion capability gap/i,
      /notion-related endpoints/i,
      /verify this manually[\s\S]{0,120}notion/i,
      /notion[\s\S]{0,160}manual probing/i,
    ],
    recommended_eval_or_policy_change:
      "Add a Notion capability policy that blocks cleanly when supported connector/API paths are unavailable instead of scraping or manual probing.",
    blocked_claims: [
      "Notion workspace truth was verified",
      "Notion write/read path is available",
      "manual browser inspection is acceptable automation evidence",
    ],
  },
  {
    failure_family: "runtime_context_or_output_limit",
    baseSeverity: 2,
    patterns: [
      /context length/i,
      /maximum context/i,
      /prompt is too long/i,
      /token limit/i,
      /output limit/i,
      /ran out of room in the context window/i,
    ],
    recommended_eval_or_policy_change:
      "Add a thread-size failure playbook check that reroutes to smaller handoffs instead of retrying bloated sessions.",
    blocked_claims: [
      "same thread can safely continue",
      "retry should use the same oversized prompt",
      "failure proves product/runtime defect",
    ],
  },
  {
    failure_family: "live_side_effect_boundary_risk",
    baseSeverity: 4,
    patterns: [
      /(?:attempted|tried|ran|executed)[\s\S]{0,120}(?:--live --founder-approved|--write --dry-run 0|live send|provider call|payment|notion write|paperclip mutation)/i,
      /(?:blocked|failed|unsafe|unauthorized)[\s\S]{0,160}(?:live send|provider call|payment|notion write|paperclip mutation|stripe mutation|firestore mutation|render deploy)/i,
      /no live mutation[\s\S]{0,120}(?:violated|breach|attempted)/i,
    ],
    recommended_eval_or_policy_change:
      "Add a side-effect gate eval that fails any recursive-improvement lane attempting live sends, provider calls, payments, Notion writes, or Paperclip mutation.",
    blocked_claims: [
      "observer run is read-only",
      "artifact was safe to execute without approval",
      "live operational state remained untouched",
    ],
  },
  {
    failure_family: "process_loss_or_service_restart",
    baseSeverity: 3,
    patterns: [
      /process lost --/i,
      /server may have restarted/i,
      /\bepipe\b/i,
      /\benospc\b/i,
      /postmaster\.pid/i,
      /no space left on device/i,
    ],
    recommended_eval_or_policy_change:
      "Add a runner-stability failure family that routes process loss to host/runtime remediation instead of repeating agent-level retries.",
    blocked_claims: [
      "agent logic caused the failure",
      "same run can be trusted as complete",
      "runtime host was stable during execution",
    ],
  },
];

function parseArgs(argv: string[]) {
  const values = new Map<string, string[]>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      values.set(key, [...(values.get(key) ?? []), "true"]);
      continue;
    }
    values.set(key, [...(values.get(key) ?? []), next]);
    index += 1;
  }
  return values;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function compactExcerpt(value: string, maxLength = 220) {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function shouldSkipPath(pathname: string) {
  return SKIP_PATH_SEGMENTS.some((segment) => pathname.includes(segment));
}

async function pathExists(pathname: string) {
  try {
    await fs.access(pathname);
    return true;
  } catch {
    return false;
  }
}

async function collectCandidateFiles(root: string, maxFiles: number) {
  const files: string[] = [];
  const queue = [root];

  while (queue.length > 0 && files.length < maxFiles) {
    const current = queue.shift();
    if (!current || shouldSkipPath(current)) continue;

    const entries = await fs.readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORY_NAMES.has(entry.name)) queue.push(next);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      files.push(next);
      if (files.length >= maxFiles) break;
    }
  }

  return files;
}

async function readFilePrefix(pathname: string, maxBytes: number) {
  const handle = await fs.open(pathname, "r");
  try {
    const stats = await handle.stat();
    const bytesToRead = Math.min(stats.size, maxBytes);
    const buffer = Buffer.alloc(bytesToRead);
    await handle.read(buffer, 0, bytesToRead, 0);
    return buffer.toString("utf8");
  } finally {
    await handle.close();
  }
}

function displayEvidencePath(cwd: string, filePath: string, lineNumber: number) {
  const relative = path.relative(cwd, filePath);
  const displayPath = relative.startsWith("..") || path.isAbsolute(relative) ? filePath : relative;
  return `${displayPath}:${lineNumber}`;
}

function familyMatchesLine(family: FamilyDefinition, line: string) {
  return family.patterns.find((pattern) => pattern.test(line)) ?? null;
}

function familyFirstTextMatch(family: FamilyDefinition, text: string) {
  for (const pattern of family.patterns) {
    const match = pattern.exec(text);
    if (match?.index !== undefined) {
      return {
        index: match.index,
        text: match[0] ?? "",
      };
    }
  }
  return null;
}

function lineNumberAtIndex(text: string, index: number) {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (text.charCodeAt(cursor) === 10) line += 1;
  }
  return line;
}

function collectObservationsFromFile(cwd: string, filePath: string, text: string) {
  const observations: Observation[] = [];
  const extension = path.extname(filePath).toLowerCase();
  const lineOriented = LINE_ORIENTED_EXTENSIONS.has(extension);

  for (const family of FAMILY_DEFINITIONS) {
    if (lineOriented) {
      const lines = text.split(/\r?\n/);
      let perFileMatches = 0;
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        const pattern = familyMatchesLine(family, line);
        if (!pattern) continue;
        perFileMatches += 1;
        observations.push({
          failureFamily: family.failure_family,
          evidencePath: displayEvidencePath(cwd, filePath, index + 1),
          excerpt: compactExcerpt(line),
        });
        if (perFileMatches >= 5) break;
      }
      continue;
    }

    const match = familyFirstTextMatch(family, text);
    if (!match) continue;
    observations.push({
      failureFamily: family.failure_family,
      evidencePath: displayEvidencePath(cwd, filePath, lineNumberAtIndex(text, match.index)),
      excerpt: compactExcerpt(match.text),
    });
  }

  return observations;
}

function severityFor(baseSeverity: number, recurrenceCount: number): ImprovementSeverity {
  const recurrenceBonus = recurrenceCount >= 10 ? 2 : recurrenceCount >= 3 ? 1 : 0;
  const score = baseSeverity + recurrenceBonus;
  if (score >= 5) return "critical";
  if (score >= 4) return "high";
  if (score >= 3) return "medium";
  return "low";
}

function severityRank(severity: ImprovementSeverity) {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

function uniqueStrings(values: string[]) {
  return [...new Set(values)];
}

function buildCandidates(observations: Observation[]) {
  const byFamily = new Map<string, Observation[]>();
  for (const observation of observations) {
    byFamily.set(observation.failureFamily, [...(byFamily.get(observation.failureFamily) ?? []), observation]);
  }

  const candidates: ImprovementCandidate[] = [];
  for (const family of FAMILY_DEFINITIONS) {
    const familyObservations = byFamily.get(family.failure_family) ?? [];
    if (familyObservations.length === 0) continue;

    candidates.push({
      failure_family: family.failure_family,
      severity: severityFor(family.baseSeverity, familyObservations.length),
      recurrence_count: familyObservations.length,
      evidence_paths: uniqueStrings(familyObservations.map((observation) => observation.evidencePath)).slice(0, 12),
      recommended_eval_or_policy_change: family.recommended_eval_or_policy_change,
      blocked_claims: family.blocked_claims,
      source: "deterministic_observer",
    });
  }

  return sortCandidates(candidates);
}

function sortCandidates(candidates: ImprovementCandidate[]) {
  return candidates.sort((left, right) => {
    const severityDelta = severityRank(right.severity) - severityRank(left.severity);
    if (severityDelta !== 0) return severityDelta;
    if (right.recurrence_count !== left.recurrence_count) {
      return right.recurrence_count - left.recurrence_count;
    }
    return left.failure_family.localeCompare(right.failure_family);
  });
}

function severityForAiClassification(classification: ValidatedAiFailureFamilyClassification) {
  if (classification.risk_tier === "shadow_only") return "high";
  if (classification.risk_tier === "guarded_low") return "medium";
  if (classification.confidence >= 0.85) return "medium";
  return "low";
}

function aiClassificationToCandidate(
  classification: ValidatedAiFailureFamilyClassification,
): ImprovementCandidate {
  return {
    failure_family: classification.family_id,
    severity: severityForAiClassification(classification),
    recurrence_count: classification.evidence_paths.length,
    evidence_paths: classification.evidence_paths,
    recommended_eval_or_policy_change: classification.suggested_eval_intent,
    blocked_claims: classification.disallowed_claims,
    source: "ai_classifier",
    affected_lane: classification.affected_lane,
    risk_tier: classification.risk_tier,
    report_only: classification.report_only,
    validation_reasons: classification.validation_reasons,
  };
}

export function mergeAiClassifierResultIntoObserverSummary(
  summary: AgentImprovementObserverSummary,
  aiClassifierResult: AiFailureFamilyClassifierResult,
): AgentImprovementObserverSummary {
  const aiCandidates = aiClassifierResult.accepted
    .filter((classification) => !classification.report_only)
    .map(aiClassificationToCandidate);
  const combinedCandidates = sortCandidates([
    ...summary.improvement_candidates,
    ...aiCandidates,
  ]);

  return {
    ...summary,
    ai_classifier: aiClassifierResult.summary,
    improvement_candidates: combinedCandidates,
    top_5: combinedCandidates.slice(0, summary.top_5.length || 5),
  };
}

export async function analyzeAgentImprovementArtifacts(
  options: AnalyzeAgentImprovementArtifactsOptions = {},
): Promise<AgentImprovementObserverSummary> {
  const cwd = options.cwd ?? process.cwd();
  const maxFiles = Math.max(1, options.maxFiles ?? 1_500);
  const maxBytesPerFile = Math.max(1024, options.maxBytesPerFile ?? 256_000);
  const top = Math.max(1, options.top ?? 5);
  const roots = options.inputRoots && options.inputRoots.length > 0 ? options.inputRoots : DEFAULT_INPUT_ROOTS;
  const resolvedRoots = roots.map((root) => path.resolve(cwd, root));
  const skippedRoots: string[] = [];
  const files: string[] = [];

  for (const root of resolvedRoots) {
    if (!(await pathExists(root))) {
      skippedRoots.push(root);
      continue;
    }
    const remaining = maxFiles - files.length;
    if (remaining <= 0) break;
    files.push(...await collectCandidateFiles(root, remaining));
  }

  const observations: Observation[] = [];
  for (const file of files) {
    const text = await readFilePrefix(file, maxBytesPerFile);
    observations.push(...collectObservationsFromFile(cwd, file, text));
  }

  const improvementCandidates = buildCandidates(observations);

  return {
    generated_at: (options.now ?? new Date()).toISOString(),
    analyzer: "blueprint_recursive_agent_improvement_observer",
    mode: "read_only_local_files",
    input_roots: resolvedRoots,
    scanned_files: files.length,
    skipped_roots: skippedRoots,
    improvement_candidates: improvementCandidates,
    top_5: improvementCandidates.slice(0, top),
  };
}

function escapeTableCell(value: string) {
  return value.replace(/\|/g, "/").replace(/\n/g, " ").trim();
}

export function renderAgentImprovementReport(summary: AgentImprovementObserverSummary) {
  const lines = [
    "# Recursive Agent Improvement Observer",
    "",
    `Generated: ${summary.generated_at}`,
    "",
    "Mode: read-only local files. This analyzer does not call Paperclip, Notion, providers, Stripe, Firebase, Render, Slack, Gmail, or payment systems.",
    "",
    `Scanned files: ${summary.scanned_files}`,
    `Input roots: ${summary.input_roots.join(", ") || "none"}`,
  ];

  if (summary.skipped_roots.length > 0) {
    lines.push(`Skipped missing roots: ${summary.skipped_roots.join(", ")}`);
  }
  if (summary.ai_classifier) {
    lines.push(
      `AI classifier: ${summary.ai_classifier.status} (used=${summary.ai_classifier.ai_used}, accepted=${summary.ai_classifier.accepted_count}, rejected=${summary.ai_classifier.rejected_count}, report_only=${summary.ai_classifier.report_only_count})`,
    );
  }

  lines.push("");
  lines.push("## Top Improvement Opportunities");
  lines.push("");

  if (summary.top_5.length === 0) {
    lines.push("No failure-family candidates were detected in the inspected local artifacts.");
    return lines.join("\n");
  }

  lines.push("| Rank | Failure family | Severity | Recurrence | Recommended eval or policy change | Blocked claims | Evidence paths |");
  lines.push("| ---: | --- | --- | ---: | --- | --- | --- |");

  summary.top_5.forEach((candidate, index) => {
    lines.push(
      [
        index + 1,
        escapeTableCell(candidate.failure_family),
        candidate.severity,
        candidate.recurrence_count,
        escapeTableCell(candidate.recommended_eval_or_policy_change),
        escapeTableCell(candidate.blocked_claims.join("; ")),
        escapeTableCell(candidate.evidence_paths.slice(0, 5).join("; ")),
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
    );
  });

  lines.push("");
  lines.push("## Machine-Readable Contract");
  lines.push("");
  lines.push("Each `improvement_candidates[]` entry in `summary.json` includes:");
  lines.push("");
  lines.push("- `failure_family`");
  lines.push("- `severity`");
  lines.push("- `recurrence_count`");
  lines.push("- `evidence_paths`");
  lines.push("- `recommended_eval_or_policy_change`");
  lines.push("- `blocked_claims`");

  return lines.join("\n");
}

export async function writeObserverOutputs(options: WriteObserverOutputsOptions) {
  await fs.mkdir(options.outputDir, { recursive: true });
  const jsonPath = path.join(options.outputDir, "summary.json");
  const reportPath = path.join(options.outputDir, "report.md");
  await fs.writeFile(jsonPath, `${JSON.stringify(options.summary, null, 2)}\n`);
  await fs.writeFile(reportPath, `${renderAgentImprovementReport(options.summary)}\n`);
  return { jsonPath, reportPath };
}

function printHelp() {
  console.log(`Usage: npm exec tsx -- scripts/paperclip/agent-improvement-observer.ts [options]

Read local Paperclip/Hermes/Codex artifacts and rank recurring failure families.

Options:
  --input <path>         Artifact root to scan. Can be repeated. Defaults to repo-local report/output/lab roots.
  --output-dir <path>    Where to write report.md and summary.json. Default: output/agent-improvement-observer/latest.
  --max-files <n>        Max text artifacts to inspect. Default: 1500.
  --max-bytes <n>        Max bytes to read per artifact. Default: 256000.
  --top <n>              Number of ranked candidates in top_5/report. Default: 5.
  --help                 Show this message.

This command is local-file only: it performs no live Paperclip reads, sends, provider calls, payments, Notion writes, or Paperclip mutation.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.get("help")?.includes("true")) {
    printHelp();
    return;
  }

  const inputRoots = args.get("input") ?? [];
  const outputDir = path.resolve(process.cwd(), args.get("output-dir")?.[0] ?? "output/agent-improvement-observer/latest");
  const maxFiles = Number.parseInt(args.get("max-files")?.[0] ?? "", 10);
  const maxBytesPerFile = Number.parseInt(args.get("max-bytes")?.[0] ?? "", 10);
  const top = Number.parseInt(args.get("top")?.[0] ?? "", 10);
  const summary = await analyzeAgentImprovementArtifacts({
    inputRoots,
    maxFiles: Number.isFinite(maxFiles) ? maxFiles : undefined,
    maxBytesPerFile: Number.isFinite(maxBytesPerFile) ? maxBytesPerFile : undefined,
    top: Number.isFinite(top) ? top : undefined,
  });
  const outputs = await writeObserverOutputs({ outputDir, summary });

  console.log(`Wrote ${path.relative(process.cwd(), outputs.reportPath)}`);
  console.log(`Wrote ${path.relative(process.cwd(), outputs.jsonPath)}`);
  console.log(`Scanned files: ${summary.scanned_files}`);
  console.log(`Improvement candidates: ${summary.improvement_candidates.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
