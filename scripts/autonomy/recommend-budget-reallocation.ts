#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import yaml from "js-yaml";

import {
  buildBudgetRecommendations,
  type AllocationPolicy,
  type BudgetRecommendation,
  type BudgetRecommendations,
  type OutcomeSnapshot,
  type SpendSnapshotLike,
} from "./dynamic-budget-allocator-core";

const DEFAULT_POLICY_PATH = "config/autonomy/budget-allocation-policy.yaml";
const DEFAULT_SPEND_SNAPSHOT_PATH = "output/autonomous-org/budget/spend-snapshots/latest.json";
const DEFAULT_OUTCOME_SNAPSHOT_PATH = "output/autonomous-org/budget/outcomes/latest.json";
const DEFAULT_BUDGET_SUMMARY_PATH = "output/autonomous-org/budget/latest/summary.json";
const DEFAULT_OUT_DIR = "output/autonomous-org/budget/dynamic/latest";

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function usage() {
  return `Usage:
  npm run autonomy:budget:recommend -- [--policy config/autonomy/budget-allocation-policy.yaml]

Writes recommendations, Markdown summary, human approval packet, and a repo-local proposed diff artifact.
This script never mutates live spend, ads, sends, providers, Stripe, Render, Firebase, Notion, Paperclip production state, hosted sessions, rights/legal state, city activation, or customer/traction claims.`;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function readPolicy(filePath: string): AllocationPolicy {
  const parsed = yaml.load(fs.readFileSync(filePath, "utf8")) as AllocationPolicy;
  if (parsed.schema !== "blueprint/dynamic-budget-allocation-policy/v1") {
    throw new Error(`Unsupported allocation policy schema: ${String(parsed.schema)}`);
  }
  return parsed;
}

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`;
}

function renderRecommendationRow(recommendation: BudgetRecommendation) {
  return [
    recommendation.action,
    recommendation.from_budget_line ?? "",
    recommendation.to_budget_line ?? "",
    formatUsd(recommendation.amount_usd),
    recommendation.approval_required ? "yes" : "no",
    recommendation.proof_level,
    recommendation.confidence.toFixed(2),
    recommendation.evidence_refs.join("; ") || "",
  ].join(" | ").replace(/^/, "| ").replace(/$/, " |");
}

function renderMarkdown(result: BudgetRecommendations) {
  const lines = [
    "# Dynamic Budget Recommendations",
    "",
    `Generated: ${result.generated_at}`,
    `Live mutation attempted: ${result.mode.live_mutation_attempted ? "yes" : "no"}`,
    `Human approval required: ${result.human_approval_required ? "yes" : "no"}`,
    `Projected target total: ${formatUsd(result.projected_target_total_usd)} / ${formatUsd(result.budget_cap_usd)}`,
    "",
    "## Recommendations",
    "",
    "| action | from | to | amount | approval required | proof | confidence | evidence |",
    "|---|---|---|---:|---|---|---:|---|",
    ...result.recommendations.map(renderRecommendationRow),
    "",
    "## Projected Budget Lines",
    "",
    "| line | current | projected |",
    "|---|---:|---:|",
  ];

  for (const [line, current] of Object.entries(result.current_budget_lines)) {
    lines.push(`| ${line} | ${formatUsd(current)} | ${formatUsd(result.projected_budget_lines[line] ?? current)} |`);
  }

  if (result.live_proof_gaps.length > 0) {
    lines.push("", "## Live Proof Gaps", "", ...result.live_proof_gaps.map((gap) => `- ${gap}`));
  }

  lines.push(
    "",
    "## Boundary",
    "",
    "- Recommendations are repo-local and advisory until a human approves the packet.",
    "- No provider account, ad account, send path, payment system, hosted session, rights/legal state, city activation, or customer/traction claim was mutated.",
  );

  return `${lines.join("\n")}\n`;
}

function blockerId(result: BudgetRecommendations) {
  const date = result.generated_at.slice(0, 10).replace(/-/g, "");
  return `dynamic-budget-approval-${date}`;
}

function renderHumanApprovalPacket(result: BudgetRecommendations) {
  const actionable = result.recommendations.filter((entry) => entry.approval_required);
  const lines = [
    "# Dynamic Budget Human Approval Packet",
    "",
    `Blocker id: ${blockerId(result)}`,
    "Gate category: budget_vendor_or_live_spend_change",
    "Routing surface: repo-local no-send packet",
    "Watcher/owner: blueprint-chief-of-staff with finance-support-agent and growth-lead evidence owners",
    "",
    "## Decision Requested",
    "",
  ];

  if (actionable.length === 0) {
    lines.push("No spend reallocation is recommended. Approve no live change and improve outcome proof first.");
  } else {
    for (const recommendation of actionable) {
      lines.push(
        `Approve or reject: move ${formatUsd(recommendation.amount_usd)} from ${recommendation.from_budget_line} to ${recommendation.to_budget_line}.`,
      );
    }
  }

  lines.push(
    "",
    "## Recommendation",
    "",
    actionable.length === 0
      ? "Hold budget steady until fresh allocation-grade outcome proof exists."
      : "Approve only as a repo-local budget target change first; live vendor changes remain separately handled by the owning system after approval is recorded.",
    "",
    "## Evidence",
    "",
  );

  for (const recommendation of result.recommendations) {
    lines.push(`- ${recommendation.id}: ${recommendation.summary}`);
    for (const ref of recommendation.evidence_refs) {
      lines.push(`  - ${ref}`);
    }
    if (recommendation.missing_proof.length > 0) {
      lines.push(`  - Missing proof: ${recommendation.missing_proof.join("; ")}`);
    }
  }

  lines.push(
    "",
    "## Hard Boundaries",
    "",
    "- No live spend was moved.",
    "- No ads were created or launched.",
    "- No sends were made.",
    "- No provider jobs were started.",
    "- No Stripe, Render, Firebase, Notion, or Paperclip production state was mutated.",
    "- No hosted-session, rights/legal, city activation, customer, traction, or Operational Launch Ready claim is made.",
    "",
    "## Resume Condition",
    "",
    "Record the human decision against the blocker id, then apply any approved repo-local diff in a separate controlled step before any live-system owner acts.",
  );

  return `${lines.join("\n")}\n`;
}

function renderProposedPatch(result: BudgetRecommendations) {
  const moves = result.recommendations.filter((entry) => entry.action === "reallocate");
  if (moves.length === 0) {
    return [
      "No repo-local budget diff proposed.",
      "Reason: allocator emitted no spend-affecting reallocation; improve proof first.",
      "",
    ].join("\n");
  }

  const lines = [
    "Proposed repo-local budget target changes.",
    "Apply manually only after the human approval packet is approved.",
    "",
  ];
  for (const move of moves) {
    lines.push(`- ${move.from_budget_line}: ${formatUsd(result.current_budget_lines[move.from_budget_line!] ?? 0)} -> ${formatUsd(result.projected_budget_lines[move.from_budget_line!] ?? 0)}`);
    lines.push(`- ${move.to_budget_line}: ${formatUsd(result.current_budget_lines[move.to_budget_line!] ?? 0)} -> ${formatUsd(result.projected_budget_lines[move.to_budget_line!] ?? 0)}`);
  }
  lines.push("");
  return lines.join("\n");
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    console.log(usage());
    return;
  }

  const policyPath = readArg("--policy") || DEFAULT_POLICY_PATH;
  const spendSnapshotPath = readArg("--spend-snapshot") || DEFAULT_SPEND_SNAPSHOT_PATH;
  const outcomeSnapshotPath = readArg("--outcome-snapshot") || DEFAULT_OUTCOME_SNAPSHOT_PATH;
  const budgetSummaryPath = readArg("--budget-summary") || DEFAULT_BUDGET_SUMMARY_PATH;
  const outDir = readArg("--out-dir") || DEFAULT_OUT_DIR;
  const policy = readPolicy(policyPath);
  const result = buildBudgetRecommendations({
    policy,
    spendSnapshot: readJson<SpendSnapshotLike>(spendSnapshotPath),
    outcomeSnapshot: readJson<OutcomeSnapshot>(outcomeSnapshotPath),
    budgetSummary: fs.existsSync(budgetSummaryPath) ? readJson<unknown>(budgetSummaryPath) : null,
  });

  if (!hasFlag("--no-write")) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "recommendations.json"), `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(path.join(outDir, "recommendations.md"), renderMarkdown(result));
    fs.writeFileSync(path.join(outDir, "human-approval-packet.md"), renderHumanApprovalPacket(result));
    fs.writeFileSync(path.join(outDir, "proposed-repo-local-budget-diff.patch"), renderProposedPatch(result));
  }

  if (hasFlag("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(renderMarkdown(result));
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
