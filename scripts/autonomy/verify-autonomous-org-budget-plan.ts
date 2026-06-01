#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

import yaml from "js-yaml";

const DEFAULT_COMPANY_CONFIG = "ops/paperclip/blueprint-company/.paperclip.yaml";
const DEFAULT_CONTROL_ROOM_MAP = "ops/paperclip/control-room-map.md";
const DEFAULT_PLAN_DOC = "docs/architecture/autonomous-org-500-month-operating-budget-2026-06-01.md";
const DEFAULT_SPEND_SOURCES = "config/autonomy/spend-sources.yaml";
const DEFAULT_SUMMARY_JSON = "output/autonomous-org/budget/latest/summary.json";
const DEFAULT_AUDIT_JSON = "output/autonomous-org/budget/latest/completion-audit.json";
const DEFAULT_OUT_DIR = "output/autonomous-org/budget/latest";

type PaperclipConfig = {
  agents?: Record<string, {
    budgetMonthlyCents?: number;
  }>;
  routines?: Record<string, {
    status?: string;
  }>;
};

type BudgetLine = {
  line: string;
  current_usd: number | null;
  target_usd: number;
  variance_usd: number | null;
  owner_system: string;
  proof_source: string;
  proof_level: "repo-local" | "estimate" | "live-verified";
};

type RepoSpendControlSurface = {
  path: string;
  role: string;
  proof_level: "repo-local";
  live_money_status: string;
};

type SpendSource = {
  id: string;
  budgetLine: string;
  targetUsd?: number | null;
};

type SpendSourceRegistry = {
  schema: string;
  sources?: SpendSource[];
};

type BudgetSummary = {
  schema: string;
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
    declared_agent_budget_before_usd: number;
    declared_agent_budget_after_usd: number;
    declared_agent_budget_target_usd: number;
    active_routines_after: number;
    paused_routines_after: number;
    routines_total: number;
  };
  repo_spend_control_surfaces: RepoSpendControlSurface[];
  budget_ledger: BudgetLine[];
  completion_audit_path: string;
  live_proof_gaps: string[];
};

type CompletionAudit = {
  schema: string;
  state_claimed_for_repo_local_work: string;
  state_claimed_for_live_budget_truth: string;
  live_mutation_attempted: boolean;
  completion_summary: {
    repo_local_budget_controls_complete: boolean;
    live_billing_truth_complete: boolean;
    goal_can_be_marked_complete_without_billing_exports: boolean;
  };
  current_state_evidence: {
    paperclip_inventory_current: {
      declared_monthly_agent_budget_usd: number;
      active_routines: number;
      paused_routines: number;
      true_missing_desired_skills: number;
    };
    repo_spend_control_surfaces?: {
      result: string;
      conclusion: string;
      checked: string[];
      live_money_status: string;
    };
  };
  requirement_audit: Array<{
    requirement: string;
    status: string;
    evidence: string;
  }>;
};

type VerificationResult = {
  schema: "blueprint/autonomous-org-budget-verification/v1";
  generated_at: string;
  pass: boolean;
  errors: string[];
  warnings: string[];
  computed: {
    declared_agent_budget_usd: number;
    active_routines: number;
    paused_routines: number;
    total_routines: number;
    budget_ledger_target_total_usd: number;
    spend_registry_target_total_usd: number;
    repo_local_ledger_target_usd: number;
    estimate_ledger_target_usd: number;
    live_verified_ledger_target_usd: number;
    codex_oauth_pro_target_usd: number;
    openai_api_target_usd: number;
    deepseek_direct_target_usd: number;
  };
  checked_paths: {
    company_config: string;
    control_room_map: string;
    plan_doc: string;
    spend_sources: string;
    summary_json: string;
    completion_audit_json: string;
  };
  proof_boundary: {
    repo_local_controls_verified: boolean;
    live_billing_verified: boolean;
    live_mutation_attempted: boolean;
    goal_complete_without_billing_exports: boolean;
  };
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

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`;
}

function moneyEquals(left: number, right: number) {
  return Math.abs(left - right) < 0.001;
}

function sumBudgetCents(config: PaperclipConfig) {
  return Object.values(config.agents ?? {}).reduce(
    (sum, agent) => sum + (agent.budgetMonthlyCents ?? 0),
    0,
  );
}

function countRoutines(config: PaperclipConfig) {
  return Object.values(config.routines ?? {}).reduce<Record<string, number>>((counts, routine) => {
    const status = routine.status ?? "active";
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
}

function assertCondition(errors: string[], condition: boolean, message: string) {
  if (!condition) {
    errors.push(message);
  }
}

const EXPECTED_SPEND_CONTROL_SURFACES = [
  "docs/agentic-spend-control-plane-2026-04-30.md",
  "ops/paperclip/plugins/blueprint-automation/src/agent-spend-tool.ts",
  "ops/paperclip/plugins/blueprint-automation/src/server-agent-spend-ledger.ts",
  "server/utils/agentSpendPolicy.ts",
  "server/utils/agentSpendProviders.ts",
  "server/utils/agentSpendLedger.ts",
] as const;

function renderMarkdown(result: VerificationResult) {
  const lines = [
    "# Autonomous Org Budget Verification",
    "",
    `Generated: ${result.generated_at}`,
    `Status: ${result.pass ? "pass" : "fail"}`,
    "",
    "## Computed State",
    "",
    `- Declared Paperclip agent budget: ${formatUsd(result.computed.declared_agent_budget_usd)}`,
    `- Routines: ${result.computed.total_routines} total, ${result.computed.active_routines} active, ${result.computed.paused_routines} paused`,
    `- Budget ledger target total: ${formatUsd(result.computed.budget_ledger_target_total_usd)}`,
    `- Spend source registry target total: ${formatUsd(result.computed.spend_registry_target_total_usd)}`,
    `- Repo-local ledger target: ${formatUsd(result.computed.repo_local_ledger_target_usd)}`,
    `- Estimate ledger target: ${formatUsd(result.computed.estimate_ledger_target_usd)}`,
    `- Live-verified ledger target: ${formatUsd(result.computed.live_verified_ledger_target_usd)}`,
    `- Codex OAuth / Pro target: ${formatUsd(result.computed.codex_oauth_pro_target_usd)}`,
    `- OpenAI API target: ${formatUsd(result.computed.openai_api_target_usd)}`,
    `- DeepSeek direct model reserve target: ${formatUsd(result.computed.deepseek_direct_target_usd)}`,
    "",
    "## Proof Boundary",
    "",
    `- Repo-local controls verified: ${result.proof_boundary.repo_local_controls_verified ? "yes" : "no"}`,
    `- Live billing verified: ${result.proof_boundary.live_billing_verified ? "yes" : "no"}`,
    `- Live mutation attempted: ${result.proof_boundary.live_mutation_attempted ? "yes" : "no"}`,
    `- Goal complete without billing exports: ${result.proof_boundary.goal_complete_without_billing_exports ? "yes" : "no"}`,
  ];

  if (result.errors.length > 0) {
    lines.push("", "## Errors", "", ...result.errors.map((error) => `- ${error}`));
  }

  if (result.warnings.length > 0) {
    lines.push("", "## Warnings", "", ...result.warnings.map((warning) => `- ${warning}`));
  }

  lines.push(
    "",
    "## Checked Paths",
    "",
    `- ${result.checked_paths.company_config}`,
    `- ${result.checked_paths.control_room_map}`,
    `- ${result.checked_paths.plan_doc}`,
    `- ${result.checked_paths.spend_sources}`,
    `- ${result.checked_paths.summary_json}`,
    `- ${result.checked_paths.completion_audit_json}`,
    "",
  );

  return lines.join("\n");
}

function verify() {
  const companyConfigPath = readArg("--config") || DEFAULT_COMPANY_CONFIG;
  const controlRoomMapPath = readArg("--control-room-map") || DEFAULT_CONTROL_ROOM_MAP;
  const planDocPath = readArg("--plan-doc") || DEFAULT_PLAN_DOC;
  const spendSourcesPath = readArg("--spend-sources") || DEFAULT_SPEND_SOURCES;
  const summaryJsonPath = readArg("--summary") || DEFAULT_SUMMARY_JSON;
  const auditJsonPath = readArg("--audit") || DEFAULT_AUDIT_JSON;
  const outDir = readArg("--out-dir") || DEFAULT_OUT_DIR;

  const config = yaml.load(fs.readFileSync(companyConfigPath, "utf8")) as PaperclipConfig;
  const controlRoomMap = fs.readFileSync(controlRoomMapPath, "utf8");
  const planDoc = fs.readFileSync(planDocPath, "utf8");
  const spendSourceRegistry = yaml.load(
    fs.readFileSync(spendSourcesPath, "utf8"),
  ) as SpendSourceRegistry;
  const summary = readJson<BudgetSummary>(summaryJsonPath);
  const audit = readJson<CompletionAudit>(auditJsonPath);

  const declaredAgentBudgetUsd = sumBudgetCents(config) / 100;
  const routineCounts = countRoutines(config);
  const activeRoutines = routineCounts.active ?? 0;
  const pausedRoutines = routineCounts.paused ?? 0;
  const totalRoutines = activeRoutines + pausedRoutines;
  const ledgerTargetTotal = summary.budget_ledger.reduce(
    (sum, line) => sum + line.target_usd,
    0,
  );
  const targetByProofLevel = summary.budget_ledger.reduce<Record<string, number>>((totals, line) => {
    totals[line.proof_level] = (totals[line.proof_level] ?? 0) + line.target_usd;
    return totals;
  }, {});
  const spendSources = spendSourceRegistry.sources ?? [];
  const spendSourceTargetTotal = spendSources.reduce(
    (sum, source) => sum + (source.targetUsd ?? 0),
    0,
  );
  const targetByBudgetLine = spendSources.reduce<Map<string, number>>((totals, source) => {
    totals.set(source.budgetLine, (totals.get(source.budgetLine) ?? 0) + (source.targetUsd ?? 0));
    return totals;
  }, new Map<string, number>());
  const targetBySourceId = spendSources.reduce<Map<string, number>>((totals, source) => {
    totals.set(source.id, source.targetUsd ?? 0);
    return totals;
  }, new Map<string, number>());

  const errors: string[] = [];
  const warnings: string[] = [];

  assertCondition(errors, summary.schema === "blueprint/autonomous-org-budget-summary/v1", "summary schema mismatch");
  assertCondition(errors, audit.schema === "blueprint/autonomous-org-budget-completion-audit/v1", "completion audit schema mismatch");
  assertCondition(errors, spendSourceRegistry.schema === "blueprint/autonomous-spend-sources/v1", "spend source registry schema mismatch");
  assertCondition(errors, spendSources.length > 0, "spend source registry must list sources");
  assertCondition(errors, summary.budget_cap_usd === 500, "summary budget cap must be $500");
  assertCondition(errors, summary.target_total_usd === 500, "summary target total must be $500");
  assertCondition(errors, moneyEquals(ledgerTargetTotal, summary.target_total_usd), "budget ledger targets must sum to target_total_usd");
  assertCondition(errors, moneyEquals(spendSourceTargetTotal, summary.target_total_usd), "spend source targets must sum to summary target_total_usd");
  assertCondition(errors, moneyEquals(spendSourceTargetTotal, ledgerTargetTotal), "spend source targets must match budget ledger targets");
  for (const line of summary.budget_ledger) {
    assertCondition(
      errors,
      moneyEquals(targetByBudgetLine.get(line.line) ?? 0, line.target_usd),
      `spend source targets for "${line.line}" must match the summary budget ledger`,
    );
  }
  for (const source of spendSources) {
    if ((source.targetUsd ?? 0) > 0) {
      assertCondition(
        errors,
        summary.budget_ledger.some((line) => line.line === source.budgetLine),
        `positive spend source ${source.id} must map to a summary budget ledger line`,
      );
    }
  }
  assertCondition(errors, targetBySourceId.get("codex_oauth_pro_seat") === 0, "Codex OAuth / Pro subscription target must stay $0 and outside the $500 cap");
  assertCondition(errors, targetBySourceId.get("openai_api_costs") === 0, "OpenAI API costs target must stay $0 unless human-approved");
  assertCondition(errors, targetBySourceId.get("deepseek_balance") === 80, "DeepSeek direct model reserve target must remain $80 in the current $500 allocation");
  assertCondition(errors, declaredAgentBudgetUsd === summary.paperclip_compression.declared_agent_budget_after_usd, "summary Paperclip budget must match .paperclip.yaml");
  assertCondition(errors, declaredAgentBudgetUsd === audit.current_state_evidence.paperclip_inventory_current.declared_monthly_agent_budget_usd, "audit Paperclip budget must match .paperclip.yaml");
  assertCondition(errors, declaredAgentBudgetUsd <= summary.paperclip_compression.declared_agent_budget_target_usd, "declared Paperclip budget must stay under its sub-budget target");
  assertCondition(errors, activeRoutines === summary.paperclip_compression.active_routines_after, "summary active routine count must match .paperclip.yaml");
  assertCondition(errors, activeRoutines === audit.current_state_evidence.paperclip_inventory_current.active_routines, "audit active routine count must match .paperclip.yaml");
  assertCondition(errors, pausedRoutines === summary.paperclip_compression.paused_routines_after, "summary paused routine count must match .paperclip.yaml");
  assertCondition(errors, pausedRoutines === audit.current_state_evidence.paperclip_inventory_current.paused_routines, "audit paused routine count must match .paperclip.yaml");
  assertCondition(errors, totalRoutines === summary.paperclip_compression.routines_total, "summary total routines must match .paperclip.yaml");
  assertCondition(errors, summary.proof_scope.repo_local_controls_implemented === true, "summary must mark repo-local controls implemented");
  assertCondition(errors, summary.proof_scope.live_billing_verified === false, "summary must not mark live billing verified");
  assertCondition(errors, summary.proof_scope.live_mutation_attempted === false, "summary must not mark live mutation attempted");
  assertCondition(errors, summary.proof_scope.operational_launch_ready_claimed === false, "summary must not claim Operational Launch Ready");
  assertCondition(errors, audit.live_mutation_attempted === false, "audit must not mark live mutation attempted");
  assertCondition(errors, audit.completion_summary.repo_local_budget_controls_complete === true, "audit must mark repo-local controls complete");
  assertCondition(errors, audit.completion_summary.live_billing_truth_complete === false, "audit must keep live billing truth incomplete");
  assertCondition(errors, audit.completion_summary.goal_can_be_marked_complete_without_billing_exports === false, "audit must not allow completion without billing exports");
  assertCondition(errors, summary.state_claimed === "awaiting_human_decision", "summary state must remain awaiting_human_decision");
  assertCondition(errors, audit.state_claimed_for_live_budget_truth === "awaiting_human_decision", "audit live budget state must remain awaiting_human_decision");
  assertCondition(errors, audit.current_state_evidence.paperclip_inventory_current.true_missing_desired_skills === 0, "audit must keep true missing desired skills at 0");
  assertCondition(errors, summary.completion_audit_path === auditJsonPath, "summary completion_audit_path must point at the checked audit path");
  assertCondition(errors, summary.live_proof_gaps.length > 0, "summary must list live proof gaps");
  assertCondition(errors, planDoc.includes("## Budget Ledger"), "plan doc must include a Budget Ledger section");
  assertCondition(errors, planDoc.includes("## Repo Spend-Control Surfaces Inspected"), "plan doc must include inspected spend-control surfaces");
  assertCondition(errors, planDoc.includes("## Routine Classification"), "plan doc must include routine classification");
  assertCondition(errors, planDoc.includes("## Model Ladder"), "plan doc must include model ladder");
  assertCondition(errors, planDoc.includes("## Next 5 `/goal` Queue"), "plan doc must include the next 5 goal queue");
  assertCondition(errors, planDoc.includes("State claimed for live budget truth: `awaiting_human_decision`"), "plan doc must keep live budget state human-gated");
  assertCondition(errors, planDoc.includes("Codex Pro/OAuth is treated as pre-existing tooling outside the $500 launch/growth cash envelope"), "plan doc must exclude Codex Pro/OAuth from the $500 cash envelope");
  assertCondition(errors, planDoc.includes("Keep OpenAI API model spend at `$0.00` unless a human explicitly approves it"), "plan doc must keep OpenAI API spend at $0 unless human-approved");
  assertCondition(errors, summary.live_proof_gaps.every((gap) => !gap.toLowerCase().includes("codex")), "live proof gaps must not require Codex Pro/OAuth billing proof for the $500 cap");
  assertCondition(errors, controlRoomMap.includes("| Declared monthly agent budget | $173.00 |"), "control-room map must reflect $173 declared budget");
  assertCondition(errors, controlRoomMap.includes("| Active routines | 26 |"), "control-room map must reflect 26 active routines");
  assertCondition(errors, controlRoomMap.includes("| Paused routines | 36 |"), "control-room map must reflect 36 paused routines");
  assertCondition(errors, Array.isArray(summary.repo_spend_control_surfaces), "summary must list repo spend-control surfaces");
  assertCondition(errors, summary.repo_spend_control_surfaces.length === EXPECTED_SPEND_CONTROL_SURFACES.length, "summary must list all expected repo spend-control surfaces");
  assertCondition(errors, audit.current_state_evidence.repo_spend_control_surfaces?.result === "inspected", "audit must mark repo spend-control surfaces inspected");
  assertCondition(errors, audit.current_state_evidence.repo_spend_control_surfaces?.live_money_status === "disabled or fail-closed", "audit must keep spend-control live money disabled or fail-closed");
  for (const spendControlPath of EXPECTED_SPEND_CONTROL_SURFACES) {
    const summaryEntry = summary.repo_spend_control_surfaces.find((entry) => entry.path === spendControlPath);
    assertCondition(errors, Boolean(summaryEntry), `summary missing spend-control surface ${spendControlPath}`);
    assertCondition(errors, fs.existsSync(spendControlPath), `spend-control surface file missing: ${spendControlPath}`);
    assertCondition(errors, planDoc.includes(spendControlPath), `plan doc must reference spend-control surface ${spendControlPath}`);
    assertCondition(errors, audit.current_state_evidence.repo_spend_control_surfaces?.checked.includes(spendControlPath) === true, `audit must reference spend-control surface ${spendControlPath}`);
    assertCondition(errors, summaryEntry?.proof_level === "repo-local", `spend-control surface ${spendControlPath} must remain repo-local proof`);
  }

  if ((targetByProofLevel["live-verified"] ?? 0) > 0) {
    warnings.push("Budget ledger contains live-verified spend; confirm owner-system proof paths are current.");
  }
  if ((targetByProofLevel.estimate ?? 0) === 0) {
    warnings.push("Budget ledger has no estimate lines; this is unusual before live billing exports are attached.");
  }

  const result: VerificationResult = {
    schema: "blueprint/autonomous-org-budget-verification/v1",
    generated_at: new Date().toISOString(),
    pass: errors.length === 0,
    errors,
    warnings,
    computed: {
      declared_agent_budget_usd: declaredAgentBudgetUsd,
      active_routines: activeRoutines,
      paused_routines: pausedRoutines,
      total_routines: totalRoutines,
      budget_ledger_target_total_usd: ledgerTargetTotal,
      spend_registry_target_total_usd: spendSourceTargetTotal,
      repo_local_ledger_target_usd: targetByProofLevel["repo-local"] ?? 0,
      estimate_ledger_target_usd: targetByProofLevel.estimate ?? 0,
      live_verified_ledger_target_usd: targetByProofLevel["live-verified"] ?? 0,
      codex_oauth_pro_target_usd: targetBySourceId.get("codex_oauth_pro_seat") ?? 0,
      openai_api_target_usd: targetBySourceId.get("openai_api_costs") ?? 0,
      deepseek_direct_target_usd: targetBySourceId.get("deepseek_balance") ?? 0,
    },
    checked_paths: {
      company_config: companyConfigPath,
      control_room_map: controlRoomMapPath,
      plan_doc: planDocPath,
      spend_sources: spendSourcesPath,
      summary_json: summaryJsonPath,
      completion_audit_json: auditJsonPath,
    },
    proof_boundary: {
      repo_local_controls_verified:
        summary.proof_scope.repo_local_controls_implemented
        && audit.completion_summary.repo_local_budget_controls_complete
        && errors.length === 0,
      live_billing_verified: summary.proof_scope.live_billing_verified,
      live_mutation_attempted:
        summary.proof_scope.live_mutation_attempted || audit.live_mutation_attempted,
      goal_complete_without_billing_exports:
        audit.completion_summary.goal_can_be_marked_complete_without_billing_exports,
    },
  };

  if (!hasFlag("--no-write")) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "verification.json"),
      `${JSON.stringify(result, null, 2)}\n`,
    );
    fs.writeFileSync(path.join(outDir, "verification.md"), `${renderMarkdown(result)}\n`);
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

verify();
