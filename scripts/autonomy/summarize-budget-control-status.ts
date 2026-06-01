#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SUMMARY_PATH = "output/autonomous-org/budget/latest/summary.json";
const DEFAULT_AUDIT_PATH = "output/autonomous-org/budget/latest/completion-audit.json";
const DEFAULT_VERIFICATION_PATH = "output/autonomous-org/budget/latest/verification.json";
const DEFAULT_DELEGATION_PATH = "output/autonomous-org/budget/latest/budget-delegation-packet.json";
const DEFAULT_LIVE_ACTION_GATE_PATH = "output/autonomous-org/budget/latest/live-action-gate.json";
const DEFAULT_OUT_DIR = "output/autonomous-org/budget/latest";

type BudgetSummary = {
  state_claimed: string;
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
  live_proof_gaps: string[];
};

type CompletionAudit = {
  state_claimed_for_live_budget_truth: string;
  live_mutation_attempted: boolean;
  completion_summary: {
    repo_local_budget_controls_complete: boolean;
    live_billing_truth_complete: boolean;
    goal_can_be_marked_complete_without_billing_exports: boolean;
  };
};

type BudgetVerification = {
  pass: boolean;
  computed: {
    declared_agent_budget_usd: number;
    active_routines: number;
    paused_routines: number;
    budget_ledger_target_total_usd: number;
    spend_registry_target_total_usd: number;
    next_goal_queue_items: number;
    budget_delegation_work_orders: number;
    budget_delegation_spend_without_approval_items: number;
    live_action_gate_blocker_count: number;
    live_action_allowed: boolean;
  };
  proof_boundary: {
    repo_local_controls_verified: boolean;
    live_billing_verified: boolean;
    live_mutation_attempted: boolean;
    goal_complete_without_billing_exports: boolean;
  };
};

type DelegationPacket = {
  state: string;
  budget_cap_usd: number;
  target_total_usd: number;
  live_billing_verified: boolean;
  no_live_mutation_authorized: boolean;
  proof_gate: {
    proof_ready_to_count_as_live_billing: boolean;
    missing_submission: number;
    rejected: number;
  };
  work_orders: Array<{
    can_spend_without_human_approval: boolean;
    can_mutate_live_systems: boolean;
    live_mutation_allowed: boolean;
    requires_human_approval_before_live_action: boolean;
  }>;
  required_checks_before_any_live_action: string[];
  live_delegation_blockers: string[];
};

type LiveActionGate = {
  state: string;
  validation_pass: boolean;
  live_action_allowed: boolean;
  repo_local_work_allowed: boolean;
  blocker_count: number;
  error_count: number;
  mode: {
    no_live_provider_calls_made: boolean;
    no_live_mutation_attempted: boolean;
    secrets_persisted: boolean;
  };
  blockers: string[];
  errors: string[];
  required_before_live_action: string[];
};

type StatusCheck = {
  id: string;
  pass: boolean;
  severity: "error" | "blocker" | "info";
  evidence: string;
};

export type BudgetControlStatus = {
  schema: "blueprint/autonomous-budget-control-status/v1";
  generated_at: string;
  state: "repo_local_controls_ready_live_action_blocked" | "live_action_ready" | "control_error";
  validation_pass: boolean;
  budget_cap_usd: number;
  target_total_usd: number;
  can_allocate_repo_local: boolean;
  can_delegate_repo_local: boolean;
  can_mutate_live_spend: boolean;
  can_claim_live_budget_complete: boolean;
  can_claim_operational_launch_ready: false;
  codex_oauth_pro_excluded_from_budget: true;
  openai_api_target_usd: 0;
  paperclip_declared_envelope_usd: number;
  active_routines: number;
  paused_routines: number;
  next_goal_queue_items: number;
  delegation_work_orders: number;
  delegation_spend_without_approval_items: number;
  delegation_live_mutation_allowed_items: number;
  live_action_gate_blockers: number;
  live_proof_gaps: string[];
  required_before_live_action: string[];
  next_safe_agent_actions: string[];
  checks: StatusCheck[];
  errors: string[];
  blockers: string[];
  mode: {
    no_live_provider_calls_made: true;
    no_live_mutation_attempted: true;
    secrets_persisted: false;
    strict_live_action_ready_required: boolean;
  };
};

type BuildInput = {
  summary: BudgetSummary;
  audit: CompletionAudit;
  verification: BudgetVerification;
  delegation: DelegationPacket;
  liveActionGate: LiveActionGate;
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

function statusCheck(id: string, pass: boolean, severity: StatusCheck["severity"], evidence: string): StatusCheck {
  return { id, pass, severity, evidence };
}

export function buildBudgetControlStatus(input: BuildInput): BudgetControlStatus {
  const delegationSpendWithoutApprovalItems = input.delegation.work_orders.filter(
    (order) => order.can_spend_without_human_approval,
  );
  const delegationLiveMutationAllowedItems = input.delegation.work_orders.filter(
    (order) => order.can_mutate_live_systems || order.live_mutation_allowed,
  );
  const delegationMissingHumanGate = input.delegation.work_orders.filter(
    (order) => order.requires_human_approval_before_live_action !== true,
  );
  const strict = input.strictLiveActionReadyRequired === true;

  const checks: StatusCheck[] = [
    statusCheck("budget_cap", input.summary.budget_cap_usd === 500 && input.summary.target_total_usd === 500, "error", "Budget cap and target total must remain $500."),
    statusCheck("verification_pass", input.verification.pass === true, "error", "Budget verifier must pass before agents rely on the packet."),
    statusCheck("repo_local_controls", input.summary.proof_scope.repo_local_controls_implemented === true && input.audit.completion_summary.repo_local_budget_controls_complete === true && input.verification.proof_boundary.repo_local_controls_verified === true, "error", "Repo-local budget controls must be implemented and verified."),
    statusCheck("delegation_safe", delegationSpendWithoutApprovalItems.length === 0 && delegationLiveMutationAllowedItems.length === 0 && delegationMissingHumanGate.length === 0, "error", "Delegation work orders must not allow spend, live mutation, or missing human gates."),
    statusCheck("live_action_gate_valid", input.liveActionGate.validation_pass === true && input.liveActionGate.error_count === 0, "error", "Live-action gate must pass local validation."),
    statusCheck("no_live_side_effects", input.summary.proof_scope.live_mutation_attempted === false && input.audit.live_mutation_attempted === false && input.liveActionGate.mode.no_live_mutation_attempted === true, "error", "Status command depends on artifacts that must show no live mutation."),
    statusCheck("codex_oauth_excluded", input.summary.live_proof_gaps.every((gap) => !gap.toLowerCase().includes("codex")), "error", "Codex OAuth/Pro must remain outside the $500 live proof gaps."),
    statusCheck("live_billing_complete", input.summary.proof_scope.live_billing_verified === true && input.audit.completion_summary.live_billing_truth_complete === true && input.verification.proof_boundary.live_billing_verified === true, "blocker", "Live billing proof is required before live spend action."),
    statusCheck("proof_intake_complete", input.delegation.proof_gate.proof_ready_to_count_as_live_billing === true && input.delegation.proof_gate.missing_submission === 0 && input.delegation.proof_gate.rejected === 0, "blocker", "Live proof intake must be complete before live spend action."),
    statusCheck("live_action_allowed", input.liveActionGate.live_action_allowed === true, "blocker", "Strict live-action gate must allow live action before any spend mutation."),
    statusCheck("approval_artifact", input.delegation.no_live_mutation_authorized === false, "blocker", "A current human approval artifact must authorize live action."),
  ];

  const errors = checks
    .filter((check) => check.severity === "error" && !check.pass)
    .map((check) => `${check.id}: ${check.evidence}`);
  const blockers = checks
    .filter((check) => check.severity === "blocker" && !check.pass)
    .map((check) => `${check.id}: ${check.evidence}`);
  const validationPass = errors.length === 0;
  const canAllocateRepoLocal = validationPass && input.liveActionGate.repo_local_work_allowed;
  const canDelegateRepoLocal = canAllocateRepoLocal && delegationSpendWithoutApprovalItems.length === 0 && delegationLiveMutationAllowedItems.length === 0;
  const canMutateLiveSpend = validationPass && blockers.length === 0 && input.liveActionGate.live_action_allowed;
  const state = !validationPass
    ? "control_error"
    : canMutateLiveSpend
      ? "live_action_ready"
      : "repo_local_controls_ready_live_action_blocked";

  return {
    schema: "blueprint/autonomous-budget-control-status/v1",
    generated_at: (input.now ?? new Date()).toISOString(),
    state,
    validation_pass: validationPass,
    budget_cap_usd: input.summary.budget_cap_usd,
    target_total_usd: input.summary.target_total_usd,
    can_allocate_repo_local: canAllocateRepoLocal,
    can_delegate_repo_local: canDelegateRepoLocal,
    can_mutate_live_spend: canMutateLiveSpend,
    can_claim_live_budget_complete: input.audit.completion_summary.live_billing_truth_complete === true && canMutateLiveSpend,
    can_claim_operational_launch_ready: false,
    codex_oauth_pro_excluded_from_budget: true,
    openai_api_target_usd: 0,
    paperclip_declared_envelope_usd: input.summary.paperclip_compression.declared_agent_budget_after_usd,
    active_routines: input.summary.paperclip_compression.active_routines_after,
    paused_routines: input.summary.paperclip_compression.paused_routines_after,
    next_goal_queue_items: input.verification.computed.next_goal_queue_items,
    delegation_work_orders: input.delegation.work_orders.length,
    delegation_spend_without_approval_items: delegationSpendWithoutApprovalItems.length,
    delegation_live_mutation_allowed_items: delegationLiveMutationAllowedItems.length,
    live_action_gate_blockers: input.liveActionGate.blocker_count,
    live_proof_gaps: input.summary.live_proof_gaps,
    required_before_live_action: input.liveActionGate.required_before_live_action,
    next_safe_agent_actions: [
      "npm run autonomy:budget:control-suite",
      "npm run autonomy:budget:verify",
      "npm run autonomy:budget:live-action-gate",
      "npm run autonomy:budget:live-action-gate -- --require-live-action-ready",
    ],
    checks,
    errors,
    blockers,
    mode: {
      no_live_provider_calls_made: true,
      no_live_mutation_attempted: true,
      secrets_persisted: false,
      strict_live_action_ready_required: strict,
    },
  };
}

export function statusExitCode(status: BudgetControlStatus) {
  if (!status.validation_pass) {
    return 1;
  }
  if (status.mode.strict_live_action_ready_required && !status.can_mutate_live_spend) {
    return 1;
  }
  return 0;
}

function formatBoolean(value: boolean) {
  return value ? "yes" : "no";
}

export function renderMarkdown(status: BudgetControlStatus) {
  const lines = [
    "# Autonomous Budget Control Status",
    "",
    `Generated: ${status.generated_at}`,
    `State: ${status.state}`,
    `Validation pass: ${formatBoolean(status.validation_pass)}`,
    `Repo-local allocation allowed: ${formatBoolean(status.can_allocate_repo_local)}`,
    `Repo-local delegation allowed: ${formatBoolean(status.can_delegate_repo_local)}`,
    `Live spend mutation allowed: ${formatBoolean(status.can_mutate_live_spend)}`,
    `Live budget complete claim allowed: ${formatBoolean(status.can_claim_live_budget_complete)}`,
    `Operational Launch Ready claim allowed: ${formatBoolean(status.can_claim_operational_launch_ready)}`,
    "",
    "This status command reads local artifacts only. It makes no provider calls, persists no secrets, and attempts no live mutation.",
    "",
    "## Budget State",
    "",
    `- Budget cap: $${status.budget_cap_usd.toFixed(2)}`,
    `- Paperclip declared envelope: $${status.paperclip_declared_envelope_usd.toFixed(2)}`,
    `- Active routines: ${status.active_routines}`,
    `- Paused routines: ${status.paused_routines}`,
    `- Next-goal queue items: ${status.next_goal_queue_items}`,
    `- Delegation work orders: ${status.delegation_work_orders}`,
    `- Delegation spend-without-approval items: ${status.delegation_spend_without_approval_items}`,
    `- Delegation live-mutation items: ${status.delegation_live_mutation_allowed_items}`,
    `- Live-action gate blockers: ${status.live_action_gate_blockers}`,
    "",
    "## Checks",
    "",
    "| Check | Pass | Severity | Evidence |",
    "|---|---:|---|---|",
    ...status.checks.map((check) => `| ${check.id} | ${formatBoolean(check.pass)} | ${check.severity} | ${check.evidence} |`),
  ];

  if (status.blockers.length > 0) {
    lines.push("", "## Live-Action Blockers", "", ...status.blockers.map((blocker) => `- ${blocker}`));
  }

  if (status.errors.length > 0) {
    lines.push("", "## Local-Control Errors", "", ...status.errors.map((error) => `- ${error}`));
  }

  lines.push(
    "",
    "## Required Before Live Action",
    "",
    ...status.required_before_live_action.map((command) => `- \`${command}\``),
    "",
    "## Next Safe Agent Actions",
    "",
    ...status.next_safe_agent_actions.map((command) => `- \`${command}\``),
  );

  return lines.join("\n");
}

export function writeStatus(status: BudgetControlStatus, outDir = DEFAULT_OUT_DIR) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "control-status.json"), `${JSON.stringify(status, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "control-status.md"), `${renderMarkdown(status)}\n`);
}

function main() {
  const summaryPath = readArg("--summary") ?? DEFAULT_SUMMARY_PATH;
  const auditPath = readArg("--audit") ?? DEFAULT_AUDIT_PATH;
  const verificationPath = readArg("--verification") ?? DEFAULT_VERIFICATION_PATH;
  const delegationPath = readArg("--delegation") ?? DEFAULT_DELEGATION_PATH;
  const liveActionGatePath = readArg("--live-action-gate") ?? DEFAULT_LIVE_ACTION_GATE_PATH;
  const outDir = readArg("--out-dir") ?? DEFAULT_OUT_DIR;

  const status = buildBudgetControlStatus({
    summary: readJson<BudgetSummary>(summaryPath),
    audit: readJson<CompletionAudit>(auditPath),
    verification: readJson<BudgetVerification>(verificationPath),
    delegation: readJson<DelegationPacket>(delegationPath),
    liveActionGate: readJson<LiveActionGate>(liveActionGatePath),
    strictLiveActionReadyRequired: hasFlag("--require-live-action-ready"),
  });

  if (!hasFlag("--no-write")) {
    writeStatus(status, outDir);
  }

  if (hasFlag("--json")) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    console.log(renderMarkdown(status));
  }

  const exitCode = statusExitCode(status);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
