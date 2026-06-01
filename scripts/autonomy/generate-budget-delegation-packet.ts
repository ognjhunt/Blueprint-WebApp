#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SUMMARY_PATH = "output/autonomous-org/budget/latest/summary.json";
const DEFAULT_RECOMMENDATIONS_PATH = "output/autonomous-org/budget/dynamic/latest/recommendations.json";
const DEFAULT_NEXT_GOAL_QUEUE_PATH = "output/autonomous-org/budget/latest/next-goal-queue.json";
const DEFAULT_LIVE_PROOF_VALIDATION_PATH = "output/autonomous-org/budget/latest/live-proof-intake-validation.json";
const DEFAULT_OUT_DIR = "output/autonomous-org/budget/latest";

type BudgetSummary = {
  budget_cap_usd: number;
  target_total_usd: number;
  proof_scope: {
    repo_local_controls_implemented: boolean;
    live_billing_verified: boolean;
    live_mutation_attempted: boolean;
    operational_launch_ready_claimed: boolean;
  };
  paperclip_compression: {
    declared_agent_budget_after_usd: number;
    active_routines_after: number;
    paused_routines_after: number;
  };
  budget_ledger: Array<{
    line: string;
    target_usd: number;
    owner_system: string;
    proof_level: string;
  }>;
  live_proof_gaps: string[];
};

type BudgetRecommendations = {
  budget_cap_usd: number;
  projected_target_total_usd: number;
  projected_budget_lines: Record<string, number>;
  human_approval_required: boolean;
  live_proof_gaps: string[];
  recommendations: Array<{
    id: string;
    action: string;
    from_budget_line: string | null;
    to_budget_line: string | null;
    amount_usd: number;
    approval_required: boolean;
    proof_level: string;
    evidence_refs: string[];
    missing_proof: string[];
    advisory_only: boolean;
    live_mutation_attempted: boolean;
  }>;
};

type NextGoalQueue = {
  queue: Array<{
    rank: number;
    goal_command: string;
    lane: string;
    owner: string;
    budget_boundary_usd: number | null;
    safe_commands: string[];
    success_criteria: string[];
    blocked_claims: string[];
    requires_human_approval_before_live_action: boolean;
    live_mutation_allowed: boolean;
  }>;
};

type LiveProofIntakeValidation = {
  proof_ready_to_count_as_live_billing: boolean;
  totals: {
    total_items: number;
    accepted_for_manual_review: number;
    missing_submission: number;
    rejected: number;
  };
  items: Array<{
    id: string;
    validation_status: string;
    target_usd: number;
    approval_required_before_live_spend_change: boolean;
    live_mutation_allowed: boolean;
  }>;
};

type BudgetLineDelegation = {
  budget_line: string;
  target_usd: number;
  owner: string;
  lane: string;
  authority: "observe_and_report" | "prepare_approval_packet" | "repo_local_execution_only" | "blocked_until_proof";
  proof_level: string | null;
  spend_release_status: "not_spendable" | "approval_packet_only" | "repo_local_budget_target";
  required_before_spend: string[];
};

type DelegationWorkOrder = {
  rank: number;
  owner: string;
  lane: string;
  goal_command: string;
  budget_boundary_usd: number | null;
  authorization_scope: "repo_local_proof_planning_or_review_only";
  safe_commands: string[];
  success_criteria: string[];
  blocked_claims: string[];
  required_checks: string[];
  can_start_without_live_approval: boolean;
  can_spend_without_human_approval: false;
  can_mutate_live_systems: false;
  requires_human_approval_before_live_action: boolean;
  live_mutation_allowed: false;
};

export type BudgetDelegationPacket = {
  schema: "blueprint/autonomous-budget-delegation-packet/v1";
  generated_at: string;
  state: "awaiting_human_decision";
  budget_cap_usd: 500;
  target_total_usd: 500;
  paperclip_declared_envelope_usd: number;
  active_routines: number;
  paused_routines: number;
  codex_oauth_pro_excluded_from_budget: true;
  openai_api_target_usd: 0;
  no_live_mutation_authorized: true;
  live_billing_verified: false;
  allocator: {
    recommendation_count: number;
    spend_affecting_recommendation_count: number;
    recommendation_state: string;
    projected_target_total_usd: number;
    human_approval_required: boolean;
    live_mutation_attempted: boolean;
  };
  proof_gate: {
    proof_ready_to_count_as_live_billing: boolean;
    total_items: number;
    accepted_for_manual_review: number;
    missing_submission: number;
    rejected: number;
  };
  budget_line_delegations: BudgetLineDelegation[];
  work_orders: DelegationWorkOrder[];
  required_checks_before_any_live_action: string[];
  live_delegation_blockers: string[];
};

type BuildInput = {
  summary: BudgetSummary;
  recommendations: BudgetRecommendations;
  nextGoalQueue: NextGoalQueue;
  liveProofValidation: LiveProofIntakeValidation;
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

function ownerForBudgetLine(line: string) {
  if (line.includes("Paperclip agent/runtime")) {
    return { owner: "blueprint-chief-of-staff", lane: "paperclip-cadence-control" };
  }
  if (line.includes("OpenAI") || line.includes("DeepSeek")) {
    return { owner: "finance-support-agent", lane: "model-spend-control" };
  }
  if (line.includes("Render") || line.includes("Paperclip VPS") || line.includes("Firebase") || line.includes("Redis")) {
    return { owner: "blueprint-cto", lane: "runtime-hosting-cost-control" };
  }
  if (line.includes("Email") || line.includes("Slack")) {
    return { owner: "blueprint-chief-of-staff", lane: "sender-readiness-and-human-reply-cost" };
  }
  if (line.includes("Analytics")) {
    return { owner: "analytics-agent", lane: "outcome-proof" };
  }
  if (line.includes("Search") || line.includes("Recipient evidence") || line.includes("Profiles")) {
    return { owner: "growth-lead", lane: "exact-site-hosted-review-growth" };
  }
  if (line.includes("Paid city")) {
    return { owner: "city-launch-agent", lane: "paid-city-experiment-approval" };
  }
  return { owner: "blueprint-chief-of-staff", lane: "budget-control" };
}

function authorityForBudgetLine(line: { line: string; target_usd: number; proof_level: string }, proofReady: boolean) {
  if (line.line.includes("Codex OAuth")) {
    return {
      authority: "observe_and_report" as const,
      spend_release_status: "not_spendable" as const,
      required_before_spend: ["Codex OAuth/Pro subscription usage is excluded from the $500 launch/growth budget and is not a spendable budget line."],
    };
  }
  if (line.line.includes("OpenAI API")) {
    return {
      authority: "observe_and_report" as const,
      spend_release_status: "not_spendable" as const,
      required_before_spend: ["Explicit human approval artifact before any nonzero OpenAI API target."],
    };
  }
  if (line.target_usd > 0 && !proofReady && line.proof_level !== "repo-local") {
    return {
      authority: "prepare_approval_packet" as const,
      spend_release_status: "approval_packet_only" as const,
      required_before_spend: ["Owner-system billing/export proof accepted for manual review.", "Human approval before live spend movement."],
    };
  }
  if (line.proof_level === "repo-local") {
    return {
      authority: "repo_local_execution_only" as const,
      spend_release_status: "repo_local_budget_target" as const,
      required_before_spend: ["Keep action inside repo-local config or report artifacts.", "Do not mutate live Paperclip without separate approval."],
    };
  }
  return {
    authority: "blocked_until_proof" as const,
    spend_release_status: "not_spendable" as const,
    required_before_spend: ["Attach source-system proof before counting this line as live budget truth."],
  };
}

function spendAffectingActions(recommendations: BudgetRecommendations) {
  return recommendations.recommendations.filter((entry) => ["reallocate", "increase", "reduce"].includes(entry.action));
}

export function buildBudgetDelegationPacket(input: BuildInput): BudgetDelegationPacket {
  const now = input.now ?? new Date();
  const spendAffecting = spendAffectingActions(input.recommendations);
  const recommendationState = input.recommendations.recommendations[0]?.id ?? "none";
  const proofReady = input.liveProofValidation.proof_ready_to_count_as_live_billing;

  const budgetLineDelegations = input.summary.budget_ledger.map((line) => {
    const owner = ownerForBudgetLine(line.line);
    const authority = authorityForBudgetLine(line, proofReady);
    return {
      budget_line: line.line,
      target_usd: line.target_usd,
      owner: owner.owner,
      lane: owner.lane,
      authority: authority.authority,
      proof_level: line.proof_level,
      spend_release_status: authority.spend_release_status,
      required_before_spend: authority.required_before_spend,
    };
  });

  const workOrders = input.nextGoalQueue.queue.map<DelegationWorkOrder>((item) => ({
    rank: item.rank,
    owner: item.owner,
    lane: item.lane,
    goal_command: item.goal_command,
    budget_boundary_usd: item.budget_boundary_usd,
    authorization_scope: "repo_local_proof_planning_or_review_only",
    safe_commands: item.safe_commands,
    success_criteria: item.success_criteria,
    blocked_claims: item.blocked_claims,
    required_checks: [
      "npm run autonomy:budget:verify",
      "npm run autonomy:budget:control-suite",
      "npm run autonomy:budget:delegate",
      "npm run autonomy:budget:live-action-gate -- --require-live-action-ready",
    ],
    can_start_without_live_approval: true,
    can_spend_without_human_approval: false,
    can_mutate_live_systems: false,
    requires_human_approval_before_live_action: item.requires_human_approval_before_live_action,
    live_mutation_allowed: false,
  }));

  return {
    schema: "blueprint/autonomous-budget-delegation-packet/v1",
    generated_at: now.toISOString(),
    state: "awaiting_human_decision",
    budget_cap_usd: 500,
    target_total_usd: 500,
    paperclip_declared_envelope_usd: input.summary.paperclip_compression.declared_agent_budget_after_usd,
    active_routines: input.summary.paperclip_compression.active_routines_after,
    paused_routines: input.summary.paperclip_compression.paused_routines_after,
    codex_oauth_pro_excluded_from_budget: true,
    openai_api_target_usd: 0,
    no_live_mutation_authorized: true,
    live_billing_verified: false,
    allocator: {
      recommendation_count: input.recommendations.recommendations.length,
      spend_affecting_recommendation_count: spendAffecting.length,
      recommendation_state: recommendationState,
      projected_target_total_usd: input.recommendations.projected_target_total_usd,
      human_approval_required: input.recommendations.human_approval_required,
      live_mutation_attempted: input.recommendations.recommendations.some((entry) => entry.live_mutation_attempted),
    },
    proof_gate: {
      proof_ready_to_count_as_live_billing: proofReady,
      total_items: input.liveProofValidation.totals.total_items,
      accepted_for_manual_review: input.liveProofValidation.totals.accepted_for_manual_review,
      missing_submission: input.liveProofValidation.totals.missing_submission,
      rejected: input.liveProofValidation.totals.rejected,
    },
    budget_line_delegations: budgetLineDelegations,
    work_orders: workOrders,
    required_checks_before_any_live_action: [
      "npm run autonomy:budget:live-proof:validate -- --require-complete",
      "npm run autonomy:budget:recommend",
      "npm run autonomy:budget:dynamic:verify",
      "npm run autonomy:budget:delegate",
      "npm run autonomy:budget:live-action-gate -- --require-live-action-ready",
      "npm run autonomy:budget:control-suite",
    ],
    live_delegation_blockers: [
      ...input.summary.live_proof_gaps,
      ...input.recommendations.live_proof_gaps,
      ...input.liveProofValidation.items
        .filter((item) => item.validation_status !== "accepted_for_manual_review")
        .map((item) => `${item.id}: ${item.validation_status}`),
    ],
  };
}

export function renderMarkdown(packet: BudgetDelegationPacket) {
  const lines = [
    "# Autonomous Budget Delegation Packet",
    "",
    `Generated: ${packet.generated_at}`,
    `State: ${packet.state}`,
    `Budget cap: $${packet.budget_cap_usd.toFixed(2)}`,
    `Paperclip envelope: $${packet.paperclip_declared_envelope_usd.toFixed(2)}`,
    `Live billing verified: ${packet.live_billing_verified ? "yes" : "no"}`,
    "",
    "This packet delegates repo-local proof, planning, and review work only. It does not authorize live spend, live sends, provider jobs, ads, deploys, production mutations, rights/legal decisions, city activation, hosted-session fulfillment, customer claims, or Operational Launch Ready claims.",
    "",
    "## Allocator State",
    "",
    `- Recommendation state: ${packet.allocator.recommendation_state}`,
    `- Spend-affecting recommendations: ${packet.allocator.spend_affecting_recommendation_count}`,
    `- Projected target total: $${packet.allocator.projected_target_total_usd.toFixed(2)}`,
    `- Proof ready to count as live billing: ${packet.proof_gate.proof_ready_to_count_as_live_billing ? "yes" : "no"}`,
    `- Missing proof submissions: ${packet.proof_gate.missing_submission}`,
    "",
    "## Owner Work Orders",
    "",
  ];

  for (const item of packet.work_orders) {
    lines.push(
      `### ${item.rank}. ${item.owner} - ${item.lane}`,
      "",
      `Goal: \`${item.goal_command}\``,
      `Budget boundary: ${item.budget_boundary_usd === null ? "n/a" : `$${item.budget_boundary_usd.toFixed(2)}`}`,
      `Authorization: ${item.authorization_scope}`,
      `Live mutation allowed: ${item.live_mutation_allowed ? "yes" : "no"}`,
      "",
      "Required checks:",
      ...item.required_checks.map((command) => `- \`${command}\``),
      "",
    );
  }

  lines.push(
    "## Budget Line Delegations",
    "",
    "| Budget line | Target | Owner | Authority | Release status |",
    "|---|---:|---|---|---|",
  );
  for (const line of packet.budget_line_delegations) {
    lines.push(`| ${line.budget_line} | $${line.target_usd.toFixed(2)} | ${line.owner} | ${line.authority} | ${line.spend_release_status} |`);
  }

  lines.push(
    "",
    "## Live Delegation Blockers",
    "",
    ...packet.live_delegation_blockers.map((blocker) => `- ${blocker}`),
    "",
    "## Required Checks Before Any Live Action",
    "",
    ...packet.required_checks_before_any_live_action.map((command) => `- \`${command}\``),
  );

  return lines.join("\n");
}

export function writeBudgetDelegationPacket(packet: BudgetDelegationPacket, outDir = DEFAULT_OUT_DIR) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "budget-delegation-packet.json"), `${JSON.stringify(packet, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "budget-delegation-packet.md"), `${renderMarkdown(packet)}\n`);
}

function main() {
  const summaryPath = readArg("--summary") ?? DEFAULT_SUMMARY_PATH;
  const recommendationsPath = readArg("--recommendations") ?? DEFAULT_RECOMMENDATIONS_PATH;
  const nextGoalQueuePath = readArg("--next-goal-queue") ?? DEFAULT_NEXT_GOAL_QUEUE_PATH;
  const liveProofValidationPath = readArg("--live-proof-validation") ?? DEFAULT_LIVE_PROOF_VALIDATION_PATH;
  const outDir = readArg("--out-dir") ?? DEFAULT_OUT_DIR;

  const packet = buildBudgetDelegationPacket({
    summary: readJson<BudgetSummary>(summaryPath),
    recommendations: readJson<BudgetRecommendations>(recommendationsPath),
    nextGoalQueue: readJson<NextGoalQueue>(nextGoalQueuePath),
    liveProofValidation: readJson<LiveProofIntakeValidation>(liveProofValidationPath),
  });

  if (!hasFlag("--no-write")) {
    writeBudgetDelegationPacket(packet, outDir);
  }

  if (hasFlag("--json")) {
    console.log(JSON.stringify(packet, null, 2));
  } else {
    console.log(renderMarkdown(packet));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
