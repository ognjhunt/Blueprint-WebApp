#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import yaml from "js-yaml";

import {
  verifyDynamicBudgetAllocation,
  type AllocationPolicy,
  type BudgetRecommendations,
  type OutcomeSnapshot,
} from "./dynamic-budget-allocator-core";

const DEFAULT_POLICY_PATH = "config/autonomy/budget-allocation-policy.yaml";
const DEFAULT_OUTCOME_PATH = "output/autonomous-org/budget/outcomes/latest.json";
const DEFAULT_RECOMMENDATIONS_PATH = "output/autonomous-org/budget/dynamic/latest/recommendations.json";
const DEFAULT_RECOMMENDATIONS_MD = "output/autonomous-org/budget/dynamic/latest/recommendations.md";
const DEFAULT_APPROVAL_PACKET = "output/autonomous-org/budget/dynamic/latest/human-approval-packet.md";
const DEFAULT_PATCH = "output/autonomous-org/budget/dynamic/latest/proposed-repo-local-budget-diff.patch";
const DEFAULT_OUT_DIR = "output/autonomous-org/budget/dynamic/latest";

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function readPolicy(filePath: string): AllocationPolicy {
  return yaml.load(fs.readFileSync(filePath, "utf8")) as AllocationPolicy;
}

function renderMarkdown(result: ReturnType<typeof verifyDynamicBudgetAllocation>) {
  const lines = [
    "# Dynamic Budget Allocator Verification",
    "",
    `Generated: ${result.generated_at}`,
    `Status: ${result.pass ? "pass" : "fail"}`,
  ];
  if (result.errors.length > 0) {
    lines.push("", "## Errors", "", ...result.errors.map((error) => `- ${error}`));
  }
  if (result.warnings.length > 0) {
    lines.push("", "## Warnings", "", ...result.warnings.map((warning) => `- ${warning}`));
  }
  return `${lines.join("\n")}\n`;
}

function verifyRequiredOutputs(paths: string[]) {
  return paths.filter((filePath) => !fs.existsSync(filePath));
}

async function main() {
  const policyPath = readArg("--policy") || DEFAULT_POLICY_PATH;
  const outcomePath = readArg("--outcome-snapshot") || DEFAULT_OUTCOME_PATH;
  const recommendationsPath = readArg("--recommendations") || DEFAULT_RECOMMENDATIONS_PATH;
  const outDir = readArg("--out-dir") || DEFAULT_OUT_DIR;
  const requiredOutputs = [
    outcomePath,
    recommendationsPath,
    readArg("--recommendations-md") || DEFAULT_RECOMMENDATIONS_MD,
    readArg("--human-approval-packet") || DEFAULT_APPROVAL_PACKET,
    readArg("--proposed-diff") || DEFAULT_PATCH,
  ];

  const policy = readPolicy(policyPath);
  const recommendations = readJson<BudgetRecommendations>(recommendationsPath);
  const outcomeSnapshot = readJson<OutcomeSnapshot>(outcomePath);
  const verification = verifyDynamicBudgetAllocation({ policy, recommendations });
  const errors = [...verification.errors];
  const warnings = [...verification.warnings];

  for (const missingPath of verifyRequiredOutputs(requiredOutputs)) {
    errors.push(`generated output missing: ${missingPath}`);
  }
  if (outcomeSnapshot.mode.live_mutation_attempted) {
    errors.push("outcome snapshot live mutation flag must remain false");
  }
  if (outcomeSnapshot.outcomes.some((signal) => signal.proof_level === "fixture" && signal.can_affect_allocation)) {
    errors.push("fixture outcome proof must be advisory-only");
  }
  for (const recommendation of recommendations.recommendations) {
    if (recommendation.amount_usd > policy.max_single_move_usd) {
      errors.push(`${recommendation.id} exceeds max single recommended move`);
    }
    if (recommendation.to_budget_line === "Paid city/launch experiments" && !recommendation.approval_required) {
      errors.push(`${recommendation.id} paid city/ads recommendation must require approval`);
    }
    if (recommendation.proof_level === "live-performance" && recommendation.evidence_refs.some((ref) => ref.includes("fixture"))) {
      errors.push(`${recommendation.id} uses fixture/local proof as live performance proof`);
    }
  }

  const result = {
    ...verification,
    pass: errors.length === 0,
    errors,
    warnings,
  };

  if (!hasFlag("--no-write")) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "verification.json"), `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(path.join(outDir, "verification.md"), renderMarkdown(result));
  }

  if (hasFlag("--json")) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(renderMarkdown(result));
  }

  if (!result.pass) {
    process.exit(1);
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
