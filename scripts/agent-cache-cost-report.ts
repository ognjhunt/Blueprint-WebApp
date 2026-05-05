#!/usr/bin/env tsx
import fs from "node:fs";

import { dbAdmin as db } from "../client/src/lib/firebaseAdmin.js";
import {
  summarizeAgentCostTelemetry,
  type AgentTelemetryRun,
} from "../server/utils/agentCostTelemetry.js";

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function usage() {
  return `Usage:
  npm run agent:cost-cache-report -- [--limit 500]
  tsx scripts/agent-cache-cost-report.ts --from-json ./runs.json

Reports cache hit ratio and cost by task kind, model, provider, and route.
The JSON input shape is an array of agent run records with task_kind, provider, model, artifacts, and logs.`;
}

async function readRunsFromFirestore(limit: number): Promise<AgentTelemetryRun[]> {
  if (!db) {
    throw new Error("Firestore is not configured; pass --from-json to report on exported runs.");
  }
  const snapshot = await db
    .collection("agentRuns")
    .orderBy("created_at", "desc")
    .limit(Math.max(1, Math.min(limit, 5000)))
    .get();
  return snapshot.docs.map((doc) => doc.data() as AgentTelemetryRun);
}

function readRunsFromJson(path: string): AgentTelemetryRun[] {
  const parsed = JSON.parse(fs.readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("--from-json file must contain an array of agent run records");
  }
  return parsed as AgentTelemetryRun[];
}

function renderMarkdownTable(rows: ReturnType<typeof summarizeAgentCostTelemetry>["rows"]) {
  const lines = [
    "| task_kind | provider | route | model | provider_route | calls | prompt_tokens | cached_tokens | cache_write_tokens | reasoning_tokens | cache_hit_ratio | cost_usd |",
    "|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|",
  ];
  for (const row of rows) {
    lines.push(
      [
        row.task_kind,
        row.provider,
        row.route,
        row.model,
        row.provider_route,
        String(row.calls),
        String(row.prompt_tokens),
        String(row.cached_tokens),
        String(row.cache_write_tokens),
        String(row.reasoning_tokens),
        row.cache_hit_ratio.toFixed(4),
        row.cost_usd.toFixed(6),
      ].join(" | ").replace(/^/, "| ").replace(/$/, " |"),
    );
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
  const runs = fromJson ? readRunsFromJson(fromJson) : await readRunsFromFirestore(limit);
  const summary = summarizeAgentCostTelemetry(runs);

  console.log(`# Agent Cache And Cost Report`);
  console.log(`Runs scanned: ${runs.length}`);
  console.log("");
  console.log(renderMarkdownTable(summary.rows));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
