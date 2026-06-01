#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import yaml from "js-yaml";

import type {
  AllocationProofLevel,
  OutcomeSignal,
  OutcomeSnapshot,
  ProofStatus,
} from "./dynamic-budget-allocator-core";

const DEFAULT_REGISTRY_PATH = "config/autonomy/outcome-sources.yaml";
const DEFAULT_OUT_DIR = "output/autonomous-org/budget/outcomes";

type OutcomeSourceConfig = {
  id: string;
  label: string;
  channelId: string;
  budgetLine: string;
  ownerSystem: string;
  adapter: string;
  localPath: string;
  proofLevel: AllocationProofLevel;
  staleAfterHours: number;
  canAffectAllocation: boolean;
  missingInputs?: string[] | null;
  notes?: string[] | null;
};

type OutcomeSourceRegistry = {
  schema: "blueprint/autonomous-outcome-sources/v1";
  date: string;
  defaultOutputPath?: string;
  defaultWindow?: string;
  sources: OutcomeSourceConfig[];
};

type OutcomeSourceSnapshot = {
  id: string;
  label: string;
  channel_id: string;
  budget_line: string;
  owner_system: string;
  adapter: string;
  local_path: string;
  status: "loaded" | "missing" | "stale" | "unsupported";
  proof_level: AllocationProofLevel;
  proof_status: ProofStatus;
  can_affect_allocation: boolean;
  observed_at: string | null;
  stale_after_hours: number;
  evidence_refs: string[];
  missing_inputs: string[];
  notes: string[];
};

type OutcomeSnapshotWithSources = OutcomeSnapshot & {
  sources: OutcomeSourceSnapshot[];
  missing_inputs: Array<{
    source_id: string;
    missing_inputs: string[];
  }>;
};

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function usage() {
  return `Usage:
  npm run autonomy:outcomes:snapshot -- [--registry config/autonomy/outcome-sources.yaml] [--out-dir output/autonomous-org/budget/outcomes]
  tsx scripts/autonomy/collect-outcome-snapshot.ts --no-write --json

Default mode is repo-local only. The script reads local exports/fixtures and never calls live provider APIs.`;
}

function readRegistry(registryPath: string): OutcomeSourceRegistry {
  const parsed = yaml.load(fs.readFileSync(registryPath, "utf8")) as OutcomeSourceRegistry;
  if (parsed.schema !== "blueprint/autonomous-outcome-sources/v1") {
    throw new Error(`Unsupported outcome source registry schema: ${String(parsed.schema)}`);
  }
  if (!Array.isArray(parsed.sources)) {
    throw new Error("Outcome source registry must contain a sources array");
  }
  return parsed;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function readJsonIfPresent(filePath: string) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(absolutePath, "utf8")) as unknown;
}

function fileObservedAt(filePath: string, payload: unknown): string | null {
  const record = asRecord(payload);
  const raw =
    record.generated_at
    ?? record.generatedAt
    ?? record.updated_at
    ?? record.updatedAt
    ?? record.reportDate
    ?? record.date;
  if (typeof raw === "string" && raw.trim()) {
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw;
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  const absolutePath = path.resolve(filePath);
  if (fs.existsSync(absolutePath)) {
    return fs.statSync(absolutePath).mtime.toISOString();
  }
  return null;
}

function proofStatus(source: OutcomeSourceConfig, payload: unknown | null, observedAt: string | null): ProofStatus {
  if (!payload || source.proofLevel === "missing") {
    return "missing";
  }
  if (!observedAt) {
    return "unsupported";
  }
  const observedMs = new Date(observedAt).getTime();
  if (Number.isNaN(observedMs)) {
    return "unsupported";
  }
  const ageHours = (Date.now() - observedMs) / (60 * 60 * 1000);
  return ageHours > source.staleAfterHours ? "stale" : "current";
}

function sourceSnapshot(
  source: OutcomeSourceConfig,
  payload: unknown | null,
  observedAt: string | null,
  status: ProofStatus,
  evidenceRefs: string[],
): OutcomeSourceSnapshot {
  return {
    id: source.id,
    label: source.label,
    channel_id: source.channelId,
    budget_line: source.budgetLine,
    owner_system: source.ownerSystem,
    adapter: source.adapter,
    local_path: source.localPath,
    status: payload ? (status === "stale" ? "stale" : "loaded") : "missing",
    proof_level: payload ? source.proofLevel : "missing",
    proof_status: status,
    can_affect_allocation:
      source.canAffectAllocation
      && status === "current"
      && source.proofLevel !== "fixture"
      && source.proofLevel !== "missing",
    observed_at: observedAt,
    stale_after_hours: source.staleAfterHours,
    evidence_refs: evidenceRefs,
    missing_inputs: payload ? [] : source.missingInputs ?? [],
    notes: source.notes ?? [],
  };
}

function baseSignal(
  source: OutcomeSourceConfig,
  payload: unknown | null,
  status: ProofStatus,
  evidenceRefs: string[],
): OutcomeSignal {
  return {
    channel_id: source.channelId,
    budget_line: source.budgetLine,
    source_id: source.id,
    proof_level: payload ? source.proofLevel : "missing",
    proof_status: status,
    can_affect_allocation:
      source.canAffectAllocation
      && status === "current"
      && source.proofLevel !== "fixture"
      && source.proofLevel !== "missing",
    observed_at: payload ? fileObservedAt(source.localPath, payload) : null,
    stale_after_hours: source.staleAfterHours,
    confidence: 0,
    score: 0,
    evidence_refs: evidenceRefs,
    metrics: {},
    missing_inputs: payload ? [] : source.missingInputs ?? [],
  };
}

function summarizeExactSiteHostedReview(signal: OutcomeSignal, payload: unknown) {
  const summary = asRecord(asRecord(payload).summary);
  const replies = asNumber(summary.replies);
  const starts = asNumber(summary.hostedReviewStarts);
  const qualifiedCalls = asNumber(summary.qualifiedCalls);
  const approvalReady = asNumber(summary.approvalReadyTargets);
  const proofReady = asNumber(summary.proofReadyArtifacts);
  const recipientBacked = asNumber(summary.recipientBackedTargets);
  const actualOutcomes = replies + starts + qualifiedCalls;
  signal.metrics = {
    replies,
    hosted_review_starts: starts,
    qualified_calls: qualifiedCalls,
    approval_ready_targets: approvalReady,
    proof_ready_artifacts: proofReady,
    recipient_backed_targets: recipientBacked,
  };
  signal.confidence = actualOutcomes > 0 ? 0.84 : proofReady >= 3 && approvalReady >= 10 ? 0.68 : 0.45;
  signal.score = actualOutcomes > 0 ? 0.86 : proofReady >= 3 && approvalReady >= 10 ? 0.62 : 0.25;
}

function summarizeKpiSourceStatus(signal: OutcomeSignal, payload: unknown) {
  const summary = asRecord(asRecord(payload).summary);
  const sourcedRows = asNumber(summary.sourcedRows);
  const totalRows = Math.max(1, asNumber(summary.totalRows, sourcedRows));
  const sourceNeededRows = asNumber(summary.sourceNeededRows);
  signal.metrics = {
    sourced_rows: sourcedRows,
    source_needed_rows: sourceNeededRows,
    total_rows: totalRows,
  };
  signal.confidence = 0.65;
  signal.score = clamp01(sourcedRows / totalRows);
}

function summarizeAgentCost(signal: OutcomeSignal, payload: unknown) {
  const runs = asArray(payload);
  const noChangeRuns = runs.filter((entry) => String(asRecord(entry).status ?? "").includes("no_change")).length;
  signal.metrics = {
    runs: runs.length,
    no_change_runs: noChangeRuns,
  };
  signal.confidence = 0.4;
  signal.score = runs.length > 0 ? clamp01(1 - noChangeRuns / runs.length) : 0;
}

function summarizeSpendSnapshot(signal: OutcomeSignal, payload: unknown) {
  const totals = asRecord(asRecord(payload).totals);
  signal.metrics = {
    target_usd: asNumber(totals.target_usd),
    live_billing_verified_usd: asNumber(totals.live_billing_verified_usd),
    missing_or_unverified_target_usd: asNumber(totals.missing_or_unverified_target_usd),
  };
  signal.confidence = 0.55;
  signal.score = 0;
  signal.can_affect_allocation = false;
}

function summarizeCityLaunch(signal: OutcomeSignal, payload: unknown) {
  const record = asRecord(payload);
  const status = String(record.status ?? "");
  const windows = asArray(record.scorecard_windows);
  const completedWindows = windows.filter((entry) => String(asRecord(entry).status ?? "").includes("complete")).length;
  signal.metrics = {
    scorecard_windows: windows.length,
    completed_windows: completedWindows,
    status,
  };
  signal.confidence = completedWindows > 0 ? 0.72 : 0.45;
  signal.score = completedWindows > 0 ? 0.74 : status.includes("scheduled") ? 0.25 : 0.35;
}

function summarizeManualExport(signal: OutcomeSignal, payload: unknown) {
  const record = asRecord(payload);
  signal.confidence = asNumber(record.confidence, 0.5);
  signal.score = asNumber(record.score, 0);
  signal.metrics = asRecord(record.metrics) as OutcomeSignal["metrics"];
}

function buildOutcomeSignal(
  source: OutcomeSourceConfig,
  payload: unknown | null,
  status: ProofStatus,
  evidenceRefs: string[],
): OutcomeSignal {
  const signal = baseSignal(source, payload, status, evidenceRefs);
  if (!payload || status !== "current") {
    return signal;
  }
  switch (source.adapter) {
    case "agent_cost_cache_report":
      summarizeAgentCost(signal, payload);
      break;
    case "spend_snapshot":
      summarizeSpendSnapshot(signal, payload);
      break;
    case "kpi_source_status":
    case "support_intake_volume":
      summarizeKpiSourceStatus(signal, payload);
      break;
    case "exact_site_hosted_review_buyer_loop":
      summarizeExactSiteHostedReview(signal, payload);
      break;
    case "city_launch_scorecards":
      summarizeCityLaunch(signal, payload);
      break;
    case "manual_outcome_export":
      summarizeManualExport(signal, payload);
      break;
    default:
      signal.proof_status = "unsupported";
      signal.can_affect_allocation = false;
      signal.missing_inputs = [`unsupported adapter: ${source.adapter}`];
  }
  return signal;
}

function renderMarkdown(snapshot: OutcomeSnapshotWithSources) {
  const lines = [
    "# Autonomous Outcome Snapshot",
    "",
    `Generated: ${snapshot.generated_at}`,
    `Mode: ${snapshot.mode.live_read_enabled ? "live-read requested, local adapters only" : "local-only"}`,
    `Live mutation attempted: ${snapshot.mode.live_mutation_attempted ? "yes" : "no"}`,
    "",
    "## Outcome Signals",
    "",
    "| channel | budget line | source | proof | status | score | confidence | can affect allocation | evidence |",
    "|---|---|---|---|---|---:|---:|---|---|",
  ];

  for (const signal of snapshot.outcomes) {
    lines.push([
      signal.channel_id,
      signal.budget_line,
      signal.source_id,
      signal.proof_level,
      signal.proof_status,
      signal.score.toFixed(2),
      signal.confidence.toFixed(2),
      signal.can_affect_allocation ? "yes" : "no",
      signal.evidence_refs.join("; ") || "",
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }

  if (snapshot.missing_inputs.length > 0) {
    lines.push("", "## Missing Inputs", "");
    for (const missing of snapshot.missing_inputs) {
      lines.push(`- ${missing.source_id}: ${missing.missing_inputs.join("; ")}`);
    }
  }

  lines.push(
    "",
    "## Boundary",
    "",
    "- This snapshot reads repo-local artifacts only.",
    "- Missing, stale, fixture-only, or repo-local-config proof cannot justify spend-affecting recommendations.",
    "- Any paid or live-system allocation remains human approval required.",
  );

  return `${lines.join("\n")}\n`;
}

export function buildOutcomeSnapshot(input: {
  registry: OutcomeSourceRegistry;
  registryPath: string;
  liveReadEnabled: boolean;
}): OutcomeSnapshotWithSources {
  const sources: OutcomeSourceSnapshot[] = [];
  const outcomes: OutcomeSignal[] = [];

  for (const source of input.registry.sources) {
    const payload = readJsonIfPresent(source.localPath);
    const observedAt = payload ? fileObservedAt(source.localPath, payload) : null;
    const status = proofStatus(source, payload, observedAt);
    const evidenceRefs = payload && status !== "missing" ? [`${source.localPath}#${source.id}`] : [];
    sources.push(sourceSnapshot(source, payload, observedAt, status, evidenceRefs));
    outcomes.push(buildOutcomeSignal(source, payload, status, evidenceRefs));
  }

  return {
    schema: "blueprint/autonomous-outcome-snapshot/v1",
    generated_at: new Date().toISOString(),
    registry_path: input.registryPath,
    mode: {
      default_local_only: true,
      live_read_enabled: input.liveReadEnabled,
      live_mutation_attempted: false,
    },
    sources,
    outcomes,
    missing_inputs: sources
      .filter((source) => source.missing_inputs.length > 0)
      .map((source) => ({
        source_id: source.id,
        missing_inputs: source.missing_inputs,
      })),
  };
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    console.log(usage());
    return;
  }

  const registryPath = readArg("--registry") || DEFAULT_REGISTRY_PATH;
  const outDir = readArg("--out-dir") || DEFAULT_OUT_DIR;
  const liveReadEnabled = hasFlag("--live-read") || hasFlag("--allow-live-read");
  const registry = readRegistry(registryPath);
  const snapshot = buildOutcomeSnapshot({ registry, registryPath, liveReadEnabled });

  if (!hasFlag("--no-write")) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "latest.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
    fs.writeFileSync(path.join(outDir, "latest.md"), renderMarkdown(snapshot));
  }

  if (hasFlag("--json")) {
    console.log(JSON.stringify(snapshot, null, 2));
  } else {
    console.log(renderMarkdown(snapshot));
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentPath = path.resolve(new URL(import.meta.url).pathname);

if (invokedPath && currentPath === invokedPath) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
