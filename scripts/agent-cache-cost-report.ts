#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import {
  summarizeAgentCostWaste,
  summarizeAgentCostTelemetry,
  type AgentTelemetryRun,
} from "../server/utils/agentCostTelemetry.js";

const DEFAULT_FALLBACK_JSON = path.resolve(
  "server/tests/fixtures/agent-cost-cache-runs.json",
);

type ReportSource =
  | { kind: "json"; path: string }
  | {
      kind: "firestore";
      limit: number;
      since_iso: string;
      collection: "agentRuns";
      project_id: string;
      credential_mode: string;
    }
  | { kind: "local_fixture_fallback"; path: string; warning: string };

type ResolveReportRunsOptions = {
  fromJson?: string | null;
  limit: number;
  sinceHours?: number;
  fallbackJson?: string | null;
  firestoreReader?: (limit: number, sinceIso: string) => Promise<AgentTelemetryRun[]>;
};

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function usage() {
  return `Usage:
  npm run agent:cost-cache-report -- [--limit 500]
  npm run agent:cost-cache-report -- --strict-live --since-hours 24
  tsx scripts/agent-cache-cost-report.ts --from-json ./runs.json

Reports cache hit ratio and cost by task kind, model, provider, and route.
The JSON input shape is an array of agent run records with task_kind, provider, model, artifacts, and logs.

With no flags, the script reads Firestore when available and falls back to
server/tests/fixtures/agent-cost-cache-runs.json with an explicit source warning
when live reads are unavailable. Pass --strict-live to fail instead.`;
}

async function readRunsFromFirestore(
  limit: number,
  sinceIso: string,
): Promise<AgentTelemetryRun[]> {
  const { dbAdmin: db } = await import("../client/src/lib/firebaseAdmin.js");
  if (!db) {
    throw new Error("Firestore is not configured; pass --from-json to report on exported runs.");
  }
  const snapshot = await db
    .collection("agentRuns")
    .where("created_at", ">=", new Date(sinceIso))
    .orderBy("created_at", "desc")
    .limit(Math.max(1, Math.min(limit, 5000)))
    .get();
  return snapshot.docs.map((doc) => doc.data() as AgentTelemetryRun);
}

export function readRunsFromJson(jsonPath: string): AgentTelemetryRun[] {
  const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("--from-json file must contain an array of agent run records");
  }
  return parsed as AgentTelemetryRun[];
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function resolveReportRuns(
  options: ResolveReportRunsOptions,
): Promise<{ runs: AgentTelemetryRun[]; source: ReportSource }> {
  if (options.fromJson) {
    const jsonPath = path.resolve(options.fromJson);
    return {
      runs: readRunsFromJson(jsonPath),
      source: { kind: "json", path: jsonPath },
    };
  }

  const readFirestore = options.firestoreReader ?? readRunsFromFirestore;
  const sinceHours = Math.max(1, Math.min(options.sinceHours ?? 24, 24 * 31));
  const sinceIso = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  try {
    return {
      runs: await readFirestore(options.limit, sinceIso),
      source: {
        kind: "firestore",
        limit: options.limit,
        since_iso: sinceIso,
        collection: "agentRuns",
        project_id:
          process.env.GOOGLE_CLOUD_PROJECT?.trim()
          || process.env.GCLOUD_PROJECT?.trim()
          || "runtime-attached-project",
        credential_mode: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
          ? "service-account-json-env"
          : process.env.GOOGLE_APPLICATION_CREDENTIALS
            ? "service-account-file"
            : "application-default-credentials",
      },
    };
  } catch (error) {
    const fallbackJson = options.fallbackJson === undefined
      ? DEFAULT_FALLBACK_JSON
      : options.fallbackJson;
    if (!fallbackJson || !fs.existsSync(fallbackJson)) {
      throw error;
    }
    const warning = errorMessage(error);
    return {
      runs: readRunsFromJson(fallbackJson),
      source: {
        kind: "local_fixture_fallback",
        path: fallbackJson,
        warning,
      },
    };
  }
}

function renderMarkdownTable(rows: ReturnType<typeof summarizeAgentCostTelemetry>["rows"]) {
  const lines = [
    "| task_kind | model | cache_family | contract | decision | calls | input | writes | reads | uncached | hit_ratio | write_cost | read_cost | savings |",
    "|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const row of rows) {
    lines.push(
      [
        row.task_kind,
        row.model,
        row.cache_family,
        row.prompt_contract_version,
        row.cache_decision,
        String(row.calls),
        String(row.prompt_tokens),
        String(row.cache_write_tokens),
        String(row.cached_tokens),
        String(row.uncached_input_tokens),
        row.cache_hit_ratio.toFixed(4),
        row.cache_write_cost_usd.toFixed(6),
        row.cached_read_cost_usd.toFixed(6),
        row.estimated_savings_usd.toFixed(6),
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
    );
  }
  return lines.join("\n");
}

function renderWasteSignals(summary: ReturnType<typeof summarizeAgentCostWaste>) {
  const lines = [
    `Total prompt tokens: ${summary.totals.prompt_tokens}`,
    `Total cached tokens: ${summary.totals.cached_tokens}`,
    `Total cache-write tokens: ${summary.totals.cache_write_tokens}`,
    `Overall cache hit ratio: ${summary.totals.cache_hit_ratio.toFixed(4)}`,
    `Write-to-read ratio: ${Number.isFinite(summary.totals.write_to_read_ratio) ? summary.totals.write_to_read_ratio.toFixed(4) : "infinite"}`,
    `Cache families: ${summary.totals.cache_families}`,
    `Families with writes and no reads: ${summary.totals.cache_families_with_writes_without_reads}`,
    `Estimated/reportable cost: $${summary.totals.cost_estimate_usd.toFixed(6)}`,
    `Estimated no-cache cost: $${summary.totals.estimated_cost_without_caching_usd.toFixed(6)}`,
    `Estimated savings/loss: $${summary.totals.estimated_savings_usd.toFixed(6)}`,
    "",
    "## Waste Signals",
  ];

  if (summary.signals.length === 0) {
    lines.push("No local waste signals crossed the report thresholds.");
  } else {
    lines.push(
      "| signal | runs | prompt_tokens | writes | reads | cost_estimate_usd | sample_run_ids | recommendation |",
      "|---|---:|---:|---:|---:|---:|---|---|",
    );
    for (const signal of summary.signals) {
      lines.push(
        [
          signal.signal,
          String(signal.runs),
          String(signal.prompt_tokens),
          String(signal.cache_write_tokens),
          String(signal.cached_tokens),
          signal.cost_estimate_usd.toFixed(6),
          signal.run_ids.join(", ") || "none",
          signal.recommendation,
        ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
      );
    }
  }

  lines.push("", "## Recommendation");
  for (const recommendation of summary.recommendations) {
    lines.push(`- ${recommendation}`);
  }

  return lines.join("\n");
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(usage());
    return;
  }

  const fromJson = readArg("--from-json");
  const limit = Number(readArg("--limit") || 500);
  const sinceHours = Number(readArg("--since-hours") || 24);
  const strictLive = process.argv.includes("--strict-live");
  const { runs, source } = await resolveReportRuns({
    fromJson,
    limit,
    sinceHours,
    fallbackJson: strictLive ? null : DEFAULT_FALLBACK_JSON,
  });
  const summary = summarizeAgentCostTelemetry(runs);
  const waste = summarizeAgentCostWaste(runs);

  console.log(`# Agent Cache And Cost Report`);
  console.log(`Runs scanned: ${runs.length}`);
  if (source.kind === "firestore") {
    console.log(
      `Data source: Firestore ${source.collection} project=${source.project_id} `
      + `since=${source.since_iso} limit=${source.limit} credentials=${source.credential_mode}`,
    );
  } else if (source.kind === "json") {
    console.log(`Data source: ${source.path}`);
  } else {
    console.log(`Data source: local fixture fallback (${source.path})`);
    console.log(`Source warning: ${source.warning}`);
  }
  console.log("");
  console.log(renderMarkdownTable(summary.rows));
  console.log("");
  console.log(renderWasteSignals(waste));
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentPath = path.resolve(new URL(import.meta.url).pathname);

if (invokedPath && currentPath === invokedPath) {
  main().catch((error) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  });
}
