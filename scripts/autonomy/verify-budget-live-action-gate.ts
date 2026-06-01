#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DELEGATION_PACKET_PATH = "output/autonomous-org/budget/latest/budget-delegation-packet.json";
const DEFAULT_LIVE_PROOF_VALIDATION_PATH = "output/autonomous-org/budget/latest/live-proof-intake-validation.json";
const DEFAULT_RECOMMENDATIONS_PATH = "output/autonomous-org/budget/dynamic/latest/recommendations.json";
const DEFAULT_OUT_DIR = "output/autonomous-org/budget/latest";

type BudgetDelegationPacket = {
  schema: string;
  state: string;
  budget_cap_usd: number;
  target_total_usd: number;
  codex_oauth_pro_excluded_from_budget: boolean;
  openai_api_target_usd: number;
  no_live_mutation_authorized: boolean;
  live_billing_verified: boolean;
  allocator: {
    spend_affecting_recommendation_count: number;
    human_approval_required: boolean;
    live_mutation_attempted: boolean;
  };
  proof_gate: {
    proof_ready_to_count_as_live_billing: boolean;
    missing_submission: number;
    rejected: number;
  };
  work_orders: Array<{
    goal_command: string;
    can_spend_without_human_approval: boolean;
    can_mutate_live_systems: boolean;
    live_mutation_allowed: boolean;
    requires_human_approval_before_live_action: boolean;
  }>;
  required_checks_before_any_live_action: string[];
  live_delegation_blockers: string[];
};

type LiveProofIntakeValidation = {
  proof_ready_to_count_as_live_billing: boolean;
  totals: {
    accepted_for_manual_review: number;
    missing_submission: number;
    rejected: number;
  };
  items: Array<{
    id: string;
    validation_status: string;
    live_mutation_allowed: boolean;
  }>;
};

type BudgetRecommendations = {
  budget_cap_usd: number;
  projected_target_total_usd: number;
  human_approval_required: boolean;
  recommendations: Array<{
    id: string;
    action: string;
    approval_required: boolean;
    live_mutation_attempted: boolean;
    proof_level: string;
  }>;
};

type GateCheck = {
  id: string;
  pass: boolean;
  severity: "blocker" | "error" | "info";
  evidence: string;
};

export type BudgetLiveActionGate = {
  schema: "blueprint/autonomous-budget-live-action-gate/v1";
  generated_at: string;
  state: "live_action_blocked" | "live_action_ready";
  validation_pass: boolean;
  live_action_allowed: boolean;
  repo_local_work_allowed: boolean;
  mode: {
    no_live_provider_calls_made: true;
    no_live_mutation_attempted: true;
    secrets_persisted: false;
    strict_live_action_ready_required: boolean;
  };
  budget_cap_usd: number;
  codex_oauth_pro_excluded_from_budget: boolean;
  openai_api_target_usd: number;
  blocker_count: number;
  error_count: number;
  checks: GateCheck[];
  blockers: string[];
  errors: string[];
  required_before_live_action: string[];
};

type BuildInput = {
  delegationPacket: BudgetDelegationPacket;
  liveProofValidation: LiveProofIntakeValidation;
  recommendations: BudgetRecommendations;
  strictLiveActionReadyRequired?: boolean;
  now?: Date;
};

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

function spendAffectingActions(recommendations: BudgetRecommendations) {
  return recommendations.recommendations.filter((entry) => ["reallocate", "increase", "reduce"].includes(entry.action));
}

function check(id: string, pass: boolean, severity: GateCheck["severity"], evidence: string): GateCheck {
  return { id, pass, severity, evidence };
}

export function buildBudgetLiveActionGate(input: BuildInput): BudgetLiveActionGate {
  const strict = input.strictLiveActionReadyRequired === true;
  const unsafeWorkOrders = input.delegationPacket.work_orders.filter(
    (order) => order.can_spend_without_human_approval || order.can_mutate_live_systems || order.live_mutation_allowed,
  );
  const workOrdersMissingHumanGate = input.delegationPacket.work_orders.filter(
    (order) => order.requires_human_approval_before_live_action !== true,
  );
  const recommendationLiveMutations = input.recommendations.recommendations.filter(
    (recommendation) => recommendation.live_mutation_attempted,
  );
  const spendAffecting = spendAffectingActions(input.recommendations);
  const weakSpendAffecting = spendAffecting.filter((recommendation) => (
    ["missing", "stale", "fixture", "unsupported", "repo-local-config"].includes(recommendation.proof_level)
    || !recommendation.approval_required
  ));

  const checks: GateCheck[] = [
    check("budget_cap", input.delegationPacket.budget_cap_usd === 500 && input.recommendations.budget_cap_usd === 500, "error", "Budget cap must remain $500."),
    check("projected_total", input.delegationPacket.target_total_usd === 500 && input.recommendations.projected_target_total_usd === 500, "error", "Projected target total must remain $500."),
    check("codex_excluded", input.delegationPacket.codex_oauth_pro_excluded_from_budget === true, "error", "Codex OAuth/Pro must remain outside the $500 launch/growth budget."),
    check("openai_zero", input.delegationPacket.openai_api_target_usd === 0, "error", "OpenAI API target must remain $0 unless separately approved."),
    check("no_live_mutation_attempted", input.delegationPacket.allocator.live_mutation_attempted === false && recommendationLiveMutations.length === 0, "error", "Allocator and recommendations must not attempt live mutation."),
    check("work_orders_safe", unsafeWorkOrders.length === 0, "error", "No work order may allow spend without approval or live mutation."),
    check("work_orders_human_gated", workOrdersMissingHumanGate.length === 0, "error", "Every work order must require approval before live action."),
    check("spend_recommendations_safe", weakSpendAffecting.length === 0, "error", "Spend-affecting recommendations need approval and allocation-grade proof."),
    check("live_billing_verified", input.delegationPacket.live_billing_verified === true, "blocker", "Live billing must be verified before live action."),
    check("proof_ready", input.liveProofValidation.proof_ready_to_count_as_live_billing === true && input.delegationPacket.proof_gate.proof_ready_to_count_as_live_billing === true, "blocker", "Owner-system proof must be ready to count as live billing."),
    check("no_missing_proof", input.liveProofValidation.totals.missing_submission === 0 && input.delegationPacket.proof_gate.missing_submission === 0, "blocker", "No live-proof intake rows may be missing."),
    check("no_rejected_proof", input.liveProofValidation.totals.rejected === 0 && input.delegationPacket.proof_gate.rejected === 0, "blocker", "No live-proof intake rows may be rejected."),
    check("no_live_delegation_blockers", input.delegationPacket.live_delegation_blockers.length === 0, "blocker", "Delegation packet must have no live blockers."),
    check("approval_artifact_required", input.delegationPacket.no_live_mutation_authorized === false, "blocker", "A current human approval artifact must explicitly authorize live action."),
  ];

  const errors = checks
    .filter((entry) => entry.severity === "error" && !entry.pass)
    .map((entry) => `${entry.id}: ${entry.evidence}`);
  const blockers = checks
    .filter((entry) => entry.severity === "blocker" && !entry.pass)
    .map((entry) => `${entry.id}: ${entry.evidence}`);
  const validationPass = errors.length === 0;
  const liveActionAllowed = validationPass && blockers.length === 0;

  return {
    schema: "blueprint/autonomous-budget-live-action-gate/v1",
    generated_at: (input.now ?? new Date()).toISOString(),
    state: liveActionAllowed ? "live_action_ready" : "live_action_blocked",
    validation_pass: validationPass,
    live_action_allowed: liveActionAllowed,
    repo_local_work_allowed: validationPass,
    mode: {
      no_live_provider_calls_made: true,
      no_live_mutation_attempted: true,
      secrets_persisted: false,
      strict_live_action_ready_required: strict,
    },
    budget_cap_usd: input.delegationPacket.budget_cap_usd,
    codex_oauth_pro_excluded_from_budget: input.delegationPacket.codex_oauth_pro_excluded_from_budget,
    openai_api_target_usd: input.delegationPacket.openai_api_target_usd,
    blocker_count: blockers.length,
    error_count: errors.length,
    checks,
    blockers,
    errors,
    required_before_live_action: input.delegationPacket.required_checks_before_any_live_action,
  };
}

export function gateExitCode(gate: BudgetLiveActionGate) {
  if (!gate.validation_pass) {
    return 1;
  }
  if (gate.mode.strict_live_action_ready_required && !gate.live_action_allowed) {
    return 1;
  }
  return 0;
}

export function renderMarkdown(gate: BudgetLiveActionGate) {
  const lines = [
    "# Autonomous Budget Live Action Gate",
    "",
    `Generated: ${gate.generated_at}`,
    `State: ${gate.state}`,
    `Validation pass: ${gate.validation_pass ? "yes" : "no"}`,
    `Live action allowed: ${gate.live_action_allowed ? "yes" : "no"}`,
    `Repo-local work allowed: ${gate.repo_local_work_allowed ? "yes" : "no"}`,
    "",
    "This command makes no provider calls and attempts no live mutation. Default mode reports the gate state; use `--require-live-action-ready` before any future live action so the command fails closed while proof or approval is missing.",
    "",
    "## Checks",
    "",
    "| Check | Pass | Severity | Evidence |",
    "|---|---:|---|---|",
    ...gate.checks.map((entry) => `| ${entry.id} | ${entry.pass ? "yes" : "no"} | ${entry.severity} | ${entry.evidence} |`),
  ];

  if (gate.blockers.length > 0) {
    lines.push("", "## Blockers", "", ...gate.blockers.map((entry) => `- ${entry}`));
  }

  if (gate.errors.length > 0) {
    lines.push("", "## Errors", "", ...gate.errors.map((entry) => `- ${entry}`));
  }

  lines.push(
    "",
    "## Required Before Live Action",
    "",
    ...gate.required_before_live_action.map((command) => `- \`${command}\``),
  );

  return lines.join("\n");
}

export function writeGate(gate: BudgetLiveActionGate, outDir = DEFAULT_OUT_DIR) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "live-action-gate.json"), `${JSON.stringify(gate, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "live-action-gate.md"), `${renderMarkdown(gate)}\n`);
}

function main() {
  const delegationPacketPath = readArg("--delegation-packet") ?? DEFAULT_DELEGATION_PACKET_PATH;
  const liveProofValidationPath = readArg("--live-proof-validation") ?? DEFAULT_LIVE_PROOF_VALIDATION_PATH;
  const recommendationsPath = readArg("--recommendations") ?? DEFAULT_RECOMMENDATIONS_PATH;
  const outDir = readArg("--out-dir") ?? DEFAULT_OUT_DIR;
  const gate = buildBudgetLiveActionGate({
    delegationPacket: readJson<BudgetDelegationPacket>(delegationPacketPath),
    liveProofValidation: readJson<LiveProofIntakeValidation>(liveProofValidationPath),
    recommendations: readJson<BudgetRecommendations>(recommendationsPath),
    strictLiveActionReadyRequired: hasFlag("--require-live-action-ready"),
  });

  if (!hasFlag("--no-write")) {
    writeGate(gate, outDir);
  }

  if (hasFlag("--json")) {
    console.log(JSON.stringify(gate, null, 2));
  } else {
    console.log(renderMarkdown(gate));
  }

  process.exit(gateExitCode(gate));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
