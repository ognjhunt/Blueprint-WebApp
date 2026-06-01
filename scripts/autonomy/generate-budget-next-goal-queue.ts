#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_OUT_DIR = "output/autonomous-org/budget/latest";

export type NextGoal = {
  rank: number;
  goal_command: string;
  lane: string;
  owner: string;
  budget_boundary_usd: number | null;
  safe_commands: string[];
  success_criteria: string[];
  blocked_claims: string[];
  why_goal_is_appropriate: string;
  requires_human_approval_before_live_action: boolean;
  live_mutation_allowed: boolean;
  live_mutation_allowed_without_human_approval: boolean;
  codex_oauth_pro_budget_treatment: "excluded_from_500_budget";
  openai_api_budget_treatment: "target_zero_unless_approved";
};

export type NextGoalQueue = {
  schema: "blueprint/autonomous-budget-next-goal-queue/v1";
  generated_at: string;
  state: "awaiting_human_decision";
  budget_cap_usd: 500;
  paperclip_declared_envelope_usd: 173;
  deepseek_direct_model_reserve_usd: 80;
  no_live_mutation_authorized: true;
  codex_oauth_pro_excluded_from_budget: true;
  openai_api_target_usd: 0;
  queue: NextGoal[];
};

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function queue(): NextGoal[] {
  return [
    {
      rank: 1,
      goal_command: "/goal Build a live-billing evidence packet for the $500 budget without mutating providers",
      lane: "billing-proof",
      owner: "finance-support-agent",
      budget_boundary_usd: 500,
      safe_commands: [
        "npm run autonomy:spend:snapshot",
        "npm run autonomy:spend:snapshot:keychain -- --live-read --out-dir output/autonomous-org/budget/spend-snapshots/keychain-live-read-2026-06-01",
        "npm run autonomy:budget:live-proof:reconcile",
        "npm run autonomy:budget:live-proof:template",
        "npm run autonomy:budget:live-proof:validate -- --require-complete",
        "npm run autonomy:budget:control-suite",
      ],
      success_criteria: [
        "Owner-system exports or explicit no-spend confirmations are attached for each live-proof backlog line.",
        "The strict intake validator passes for the filled proof packet.",
        "The budget verifier still shows Codex OAuth/Pro excluded and OpenAI API target $0.",
      ],
      blocked_claims: [
        "Does not authorize spend movement.",
        "Does not claim live billing complete until owner-system proof is accepted and reconciled.",
        "Does not claim Operational Launch Ready.",
      ],
      why_goal_is_appropriate: "This is the top blocker for completing the budget objective without weakening truth/provenance boundaries.",
      requires_human_approval_before_live_action: true,
      live_mutation_allowed: false,
      live_mutation_allowed_without_human_approval: false,
      codex_oauth_pro_budget_treatment: "excluded_from_500_budget",
      openai_api_budget_treatment: "target_zero_unless_approved",
    },
    {
      rank: 2,
      goal_command: "/goal Produce the Exact-Site Hosted Review first-send approval packet with no sends",
      lane: "exact-site-hosted-review",
      owner: "growth-lead",
      budget_boundary_usd: 0,
      safe_commands: [
        "npm run gtm:hosted-review:audit",
        "npm run gtm:recipient-evidence:validate -- --human-recipient-evidence-path <local-proof.json>",
        "npm run autonomy:outcomes:snapshot",
        "npm run autonomy:budget:recommend",
      ],
      success_criteria: [
        "Recipient evidence, send copy, target list, and approval asks are packaged without sending.",
        "Hosted-review outcome proof source is ready for future allocator scoring.",
        "Human approval requirements are explicit before any outreach.",
      ],
      blocked_claims: [
        "No outreach sent.",
        "No reply durability claimed.",
        "No customer traction or hosted-session fulfillment claimed.",
      ],
      why_goal_is_appropriate: "Exact-site hosted review is the primary wedge that can justify future budget reallocations once proof exists.",
      requires_human_approval_before_live_action: true,
      live_mutation_allowed: false,
      live_mutation_allowed_without_human_approval: false,
      codex_oauth_pro_budget_treatment: "excluded_from_500_budget",
      openai_api_budget_treatment: "target_zero_unless_approved",
    },
    {
      rank: 3,
      goal_command: "/goal Build the one-city launch proof packet under a $10 paid-test ceiling",
      lane: "city-launch-proof",
      owner: "city-launch-agent",
      budget_boundary_usd: 10,
      safe_commands: [
        "npm run city-launch:preflight -- --city \"<city>\"",
        "npm run city-launch:coverage:plan -- --city \"<city>\"",
        "npm run autonomy:budget:recommend",
      ],
      success_criteria: [
        "City blockers, targets, proof artifacts, and optional paid-test request are packaged.",
        "Any paid-test proposal is capped at $10 and requires approval.",
        "No activation or ad launch happens in the packet.",
      ],
      blocked_claims: [
        "No city-live claim.",
        "No ad activation claim.",
        "No active coverage or customer traction claim.",
      ],
      why_goal_is_appropriate: "A bounded city packet connects budget allocation to launch learning while preserving approval gates.",
      requires_human_approval_before_live_action: true,
      live_mutation_allowed: false,
      live_mutation_allowed_without_human_approval: false,
      codex_oauth_pro_budget_treatment: "excluded_from_500_budget",
      openai_api_budget_treatment: "target_zero_unless_approved",
    },
    {
      rank: 4,
      goal_command: "/goal Harden support_triage cost/cadence proof from cache and no-change suppression",
      lane: "support-triage-cost-control",
      owner: "support_triage canary owner",
      budget_boundary_usd: 0,
      safe_commands: [
        "npm run agent:cost-cache-report",
        "npm run autoagent:run -- --sample 3",
        "npm run autoagent:recursive-improve -- --dry-run",
      ],
      success_criteria: [
        "Support triage cost/cache proof is current and separated from live billing proof.",
        "No-change suppression is explicit for repeated support-triage runs.",
        "Flash-first or deterministic routine paths are preserved.",
      ],
      blocked_claims: [
        "No live Paperclip/Hermes mutation.",
        "No broad automation quality claim from fixture proof.",
        "No production support readiness claim.",
      ],
      why_goal_is_appropriate: "Support triage is a P0 canary lane and needs recurring cost discipline inside the compressed Paperclip envelope.",
      requires_human_approval_before_live_action: true,
      live_mutation_allowed: false,
      live_mutation_allowed_without_human_approval: false,
      codex_oauth_pro_budget_treatment: "excluded_from_500_budget",
      openai_api_budget_treatment: "target_zero_unless_approved",
    },
    {
      rank: 5,
      goal_command: "/goal Run a Public Launch Ready conversion audit for the world-model buyer route",
      lane: "public-launch-ready-conversion",
      owner: "webapp-review",
      budget_boundary_usd: 0,
      safe_commands: [
        "npm run qa:polish",
        "npm run smoke:launch:local",
        "npm run autonomy:budget:control-suite",
      ],
      success_criteria: [
        "Public Launch Ready copy remains polished and conversion-oriented.",
        "Unsupported operational claims are blocked or scoped precisely.",
        "Buyer route findings are tied back to world-model-product-first doctrine.",
      ],
      blocked_claims: [
        "No customer, payment, rights, hosted-session fulfillment, or Operational Launch Ready claim.",
        "No broad not-launched/apology language added only because live ops are gated.",
        "No live production smoke or provider mutation.",
      ],
      why_goal_is_appropriate: "The public route can improve conversion while the budget and live proof systems remain human-gated.",
      requires_human_approval_before_live_action: true,
      live_mutation_allowed: false,
      live_mutation_allowed_without_human_approval: false,
      codex_oauth_pro_budget_treatment: "excluded_from_500_budget",
      openai_api_budget_treatment: "target_zero_unless_approved",
    },
  ];
}

export function buildNextGoalQueue(now = new Date()): NextGoalQueue {
  return {
    schema: "blueprint/autonomous-budget-next-goal-queue/v1",
    generated_at: now.toISOString(),
    state: "awaiting_human_decision",
    budget_cap_usd: 500,
    paperclip_declared_envelope_usd: 173,
    deepseek_direct_model_reserve_usd: 80,
    no_live_mutation_authorized: true,
    codex_oauth_pro_excluded_from_budget: true,
    openai_api_target_usd: 0,
    queue: queue(),
  };
}

export function renderMarkdown(report: NextGoalQueue) {
  const lines = [
    "# Autonomous Budget Next Goal Queue",
    "",
    `Generated: ${report.generated_at}`,
    `State: ${report.state}`,
    `Budget cap: $${report.budget_cap_usd.toFixed(2)}`,
    `Paperclip envelope: $${report.paperclip_declared_envelope_usd.toFixed(2)}`,
    `DeepSeek direct model reserve: $${report.deepseek_direct_model_reserve_usd.toFixed(2)}`,
    "",
    "Codex OAuth/Pro is excluded from the $500 budget. OpenAI API target remains $0 unless explicitly approved.",
    "All queue items are local planning goals. No live mutation is authorized by this artifact.",
    "",
  ];

  for (const item of report.queue) {
    lines.push(
      `## ${item.rank}. ${item.goal_command}`,
      "",
      `Lane: ${item.lane}`,
      `Owner: ${item.owner}`,
      `Budget boundary: ${item.budget_boundary_usd === null ? "n/a" : `$${item.budget_boundary_usd.toFixed(2)}`}`,
      `Requires approval before live action: ${item.requires_human_approval_before_live_action ? "yes" : "no"}`,
      `Live mutation allowed: ${item.live_mutation_allowed ? "yes" : "no"}`,
      "",
      "Safe commands:",
      ...item.safe_commands.map((command) => `- \`${command}\``),
      "",
      "Success criteria:",
      ...item.success_criteria.map((criterion) => `- ${criterion}`),
      "",
      "Blocked claims:",
      ...item.blocked_claims.map((claim) => `- ${claim}`),
      "",
    );
  }

  return lines.join("\n");
}

export function writeNextGoalQueue(report: NextGoalQueue, outDir = DEFAULT_OUT_DIR) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "next-goal-queue.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "next-goal-queue.md"), `${renderMarkdown(report)}\n`);
}

function main() {
  const outDir = readArg("--out-dir") ?? DEFAULT_OUT_DIR;
  const report = buildNextGoalQueue();

  if (!hasFlag("--no-write")) {
    writeNextGoalQueue(report, outDir);
  }

  if (hasFlag("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderMarkdown(report));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
