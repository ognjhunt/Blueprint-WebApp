#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SUMMARY_PATH = "output/autonomous-org/budget/latest/summary.json";
const DEFAULT_CONTROL_STATUS_PATH = "output/autonomous-org/budget/latest/control-status.json";
const DEFAULT_OUT_DIR = "output/autonomous-org/budget/latest";

type BudgetLine = {
  line: string;
  target_usd: number;
  owner_system: string;
  proof_level: string;
};

type BudgetSummary = {
  budget_cap_usd: number;
  target_total_usd: number;
  paperclip_compression: {
    declared_agent_budget_after_usd: number;
  };
  budget_ledger: BudgetLine[];
};

type BudgetControlStatus = {
  state: string;
  validation_pass: boolean;
  can_allocate_repo_local: boolean;
  can_delegate_repo_local: boolean;
  can_mutate_live_spend: boolean;
  can_claim_live_budget_complete: boolean;
  can_claim_operational_launch_ready: boolean;
  live_proof_gaps: string[];
};

type ApprovalItem = {
  id: string;
  budget_line: string;
  owner_system: string;
  max_usd: number;
  purpose: string;
  expires_on: string;
  allowed_actions: string[];
  blocked_actions: string[];
  proof_required_before_reporting_actuals: string[];
};

export type LaunchNowApprovalPacket = {
  schema: "blueprint/autonomous-budget-launch-now-approval-packet/v1";
  generated_at: string;
  state: "pending_human_signature";
  approval_effective: false;
  no_live_mutation_attempted: true;
  no_provider_calls_made: true;
  secrets_persisted: false;
  budget_cap_usd: 500;
  repo_local_paperclip_envelope_usd: number;
  requested_live_spend_ceiling_usd: number;
  combined_budget_ceiling_usd: number;
  codex_oauth_pro_excluded_from_budget: true;
  openai_api_target_usd: 0;
  control_status: {
    state: string;
    can_allocate_repo_local: boolean;
    can_delegate_repo_local: boolean;
    can_mutate_live_spend: boolean;
    can_claim_live_budget_complete: boolean;
    can_claim_operational_launch_ready: boolean;
  };
  approval_capture: {
    human_approved: false;
    approver: null;
    approved_at: null;
    source: null;
    exact_text_received: null;
  };
  approval_items: ApprovalItem[];
  non_spend_guardrails: Array<{
    budget_line: string;
    max_usd: number;
    rule: string;
  }>;
  live_proof_gaps_still_required: string[];
  exact_human_approval_text: string;
  activation_instructions: string[];
};

type BuildInput = {
  summary: BudgetSummary;
  controlStatus: BudgetControlStatus;
  now?: Date;
  expiresOn?: string;
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

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function purposeForLine(line: string) {
  if (line.includes("DeepSeek")) {
    return "Billable model reserve for launch/growth synthesis, cached reasoning, and high-value triage through the DeepSeek lane.";
  }
  if (line.includes("Render")) {
    return "Keep the WebApp hosting path available for launch traffic while billing proof is collected.";
  }
  if (line.includes("Paperclip VPS")) {
    return "Keep the Paperclip host/tunnel path available for control-room and agent runtime proof.";
  }
  if (line.includes("Firebase")) {
    return "Cover Firebase, Firestore, storage, and related launch telemetry/data needs within the cap.";
  }
  if (line.includes("Redis")) {
    return "Cover cache/runtime support for launch flows within the cap.";
  }
  if (line.includes("Email") || line.includes("Slack")) {
    return "Cover sender readiness, human reply path, and Slack/Gmail/SendGrid support costs without authorizing live sends.";
  }
  if (line.includes("Search")) {
    return "Cover search/research API usage for proof-backed GTM and city-launch research.";
  }
  if (line.includes("Recipient evidence")) {
    return "Cover recipient evidence enrichment for the Exact-Site Hosted Review wedge.";
  }
  if (line.includes("Profiles")) {
    return "Cover owned growth profiles, listings, and launch profile operations.";
  }
  if (line.includes("Paid city")) {
    return "Cover tightly capped paid city/launch experiments; ad launch still needs the ad-system approval trail.";
  }
  return "Launch/growth budget line within the approved $500 monthly ceiling.";
}

function liveSpendEligible(line: BudgetLine) {
  if (line.target_usd <= 0) {
    return false;
  }
  if (line.line.includes("Paperclip agent/runtime")) {
    return false;
  }
  if (line.line.includes("Codex OAuth")) {
    return false;
  }
  if (line.line.includes("OpenAI API")) {
    return false;
  }
  return true;
}

function findBudgetLine(summary: BudgetSummary, matcher: (line: BudgetLine) => boolean) {
  return summary.budget_ledger.find(matcher) ?? null;
}

function buildApprovalItems(summary: BudgetSummary, expiresOn: string): ApprovalItem[] {
  return summary.budget_ledger
    .filter(liveSpendEligible)
    .map((line) => ({
      id: slug(line.line),
      budget_line: line.line,
      owner_system: line.owner_system,
      max_usd: line.target_usd,
      purpose: purposeForLine(line.line),
      expires_on: expiresOn,
      allowed_actions: [
        "Prepare owner-system work under this exact line cap.",
        "Record receipts, dashboard proof, usage exports, or no-spend confirmations back into the budget proof packet.",
        "Use the line only for the stated launch/growth purpose.",
      ],
      blocked_actions: [
        "Do not exceed the line cap or the combined $500 monthly budget.",
        "Do not send live outreach, launch ads, start provider jobs, mutate production infrastructure, or claim Operational Launch Ready from this approval alone.",
        "Do not move OpenAI API spend above $0 or count Codex OAuth/Pro inside this budget.",
      ],
      proof_required_before_reporting_actuals: [
        "Owner-system billing export, receipt, dashboard proof, read-only billing snapshot, or explicit no-spend confirmation.",
        "Updated live-proof intake validation and reconciliation artifacts.",
        "Strict live-action gate rerun before any spend-affecting live mutation.",
      ],
    }));
}

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`;
}

export function buildLaunchNowApprovalPacket(input: BuildInput): LaunchNowApprovalPacket {
  const now = input.now ?? new Date();
  const expiresOn = input.expiresOn ?? isoDate(addDays(now, 30));
  const approvalItems = buildApprovalItems(input.summary, expiresOn);
  const requestedLiveSpendCeiling = approvalItems.reduce((sum, item) => sum + item.max_usd, 0);
  const repoLocalPaperclipEnvelope = input.summary.paperclip_compression.declared_agent_budget_after_usd;
  const combinedBudgetCeiling = repoLocalPaperclipEnvelope + requestedLiveSpendCeiling;
  const codexLine = findBudgetLine(input.summary, (line) => line.line.includes("Codex OAuth"));
  const openAiLine = findBudgetLine(input.summary, (line) => line.line.includes("OpenAI API"));

  if (input.summary.budget_cap_usd !== 500 || input.summary.target_total_usd !== 500) {
    throw new Error("Launch-now approval requires the current $500 budget ledger.");
  }

  if (combinedBudgetCeiling !== input.summary.budget_cap_usd) {
    throw new Error(
      `Launch-now approval caps must sum to ${input.summary.budget_cap_usd}; got ${combinedBudgetCeiling}.`,
    );
  }

  if (!codexLine || codexLine.target_usd !== 0) {
    throw new Error("Codex OAuth/Pro must remain excluded from the $500 launch/growth budget.");
  }

  if (!openAiLine || openAiLine.target_usd !== 0) {
    throw new Error("OpenAI API spend must remain at a $0 target for this launch-now approval packet.");
  }

  const exactHumanApprovalText = [
    `I, Nijel Hunt, approve the Blueprint launch-now bounded spend caps in output/autonomous-org/budget/latest/launch-now-approval-packet.json generated at ${now.toISOString()}.`,
    `This approval is capped at ${formatUsd(requestedLiveSpendCeiling)} in live launch/growth spend plus the existing ${formatUsd(repoLocalPaperclipEnvelope)} repo-local Paperclip envelope, for a combined ceiling of ${formatUsd(combinedBudgetCeiling)} through ${expiresOn}.`,
    "OpenAI API spend remains $0.00 and Codex OAuth/Pro remains excluded from the $500 budget.",
    "This approval does not by itself authorize live sends, ad launch, provider jobs, production infrastructure mutation, hosted-session fulfillment, rights/legal clearance, customer/traction claims, or Operational Launch Ready claims without the separate owner-system proof and gates listed in the packet.",
  ].join(" ");

  return {
    schema: "blueprint/autonomous-budget-launch-now-approval-packet/v1",
    generated_at: now.toISOString(),
    state: "pending_human_signature",
    approval_effective: false,
    no_live_mutation_attempted: true,
    no_provider_calls_made: true,
    secrets_persisted: false,
    budget_cap_usd: 500,
    repo_local_paperclip_envelope_usd: repoLocalPaperclipEnvelope,
    requested_live_spend_ceiling_usd: requestedLiveSpendCeiling,
    combined_budget_ceiling_usd: combinedBudgetCeiling,
    codex_oauth_pro_excluded_from_budget: true,
    openai_api_target_usd: 0,
    control_status: {
      state: input.controlStatus.state,
      can_allocate_repo_local: input.controlStatus.can_allocate_repo_local,
      can_delegate_repo_local: input.controlStatus.can_delegate_repo_local,
      can_mutate_live_spend: input.controlStatus.can_mutate_live_spend,
      can_claim_live_budget_complete: input.controlStatus.can_claim_live_budget_complete,
      can_claim_operational_launch_ready: input.controlStatus.can_claim_operational_launch_ready,
    },
    approval_capture: {
      human_approved: false,
      approver: null,
      approved_at: null,
      source: null,
      exact_text_received: null,
    },
    approval_items: approvalItems,
    non_spend_guardrails: [
      {
        budget_line: "Codex OAuth / Pro subscription seat",
        max_usd: 0,
        rule: "Excluded from the $500 launch/growth envelope.",
      },
      {
        budget_line: "OpenAI API costs (approval-only guardrail)",
        max_usd: 0,
        rule: "Target remains $0 unless a separate explicit OpenAI API approval artifact exists.",
      },
      {
        budget_line: "Analytics",
        max_usd: 0,
        rule: "Use free/native analytics until an owner-system billing proof and approval exists.",
      },
    ],
    live_proof_gaps_still_required: input.controlStatus.live_proof_gaps,
    exact_human_approval_text: exactHumanApprovalText,
    activation_instructions: [
      "Have the human approver send or commit the exact_human_approval_text without editing caps, dates, or guardrails.",
      "Record the received text, approver, timestamp, and source in a separate approval-capture artifact before treating this packet as effective.",
      "Rerun npm run autonomy:budget:live-proof:validate -- --require-complete, npm run autonomy:budget:live-action-gate -- --require-live-action-ready, npm run autonomy:budget:status -- --require-live-action-ready, and npm run autonomy:budget:control-suite.",
      "Do not use this pending packet to execute live sends, launch ads, start provider jobs, mutate production infrastructure, or claim Operational Launch Ready.",
    ],
  };
}

export function renderMarkdown(packet: LaunchNowApprovalPacket) {
  const lines = [
    "# Launch-Now Budget Approval Packet",
    "",
    `Generated: ${packet.generated_at}`,
    `State: ${packet.state}`,
    `Approval effective: ${packet.approval_effective ? "yes" : "no"}`,
    `Requested live spend ceiling: ${formatUsd(packet.requested_live_spend_ceiling_usd)}`,
    `Repo-local Paperclip envelope: ${formatUsd(packet.repo_local_paperclip_envelope_usd)}`,
    `Combined budget ceiling: ${formatUsd(packet.combined_budget_ceiling_usd)}`,
    `OpenAI API target: ${formatUsd(packet.openai_api_target_usd)}`,
    "Codex OAuth/Pro excluded: yes",
    "",
    "This packet is a pending approval artifact. It makes no provider calls, persists no secrets, and attempts no live mutation.",
    "",
    "## Exact Approval Text",
    "",
    packet.exact_human_approval_text,
    "",
    "## Approval Items",
    "",
    "| Budget line | Owner system | Max | Expires | Purpose |",
    "|---|---|---:|---|---|",
    ...packet.approval_items.map((item) => `| ${item.budget_line} | ${item.owner_system} | ${formatUsd(item.max_usd)} | ${item.expires_on} | ${item.purpose} |`),
    "",
    "## Non-Spend Guardrails",
    "",
    ...packet.non_spend_guardrails.map((item) => `- ${item.budget_line}: ${formatUsd(item.max_usd)}. ${item.rule}`),
    "",
    "## Still Required Before Live Action",
    "",
    ...packet.live_proof_gaps_still_required.map((gap) => `- ${gap}`),
    "",
    "## Activation Instructions",
    "",
    ...packet.activation_instructions.map((item) => `- ${item}`),
  ];

  return lines.join("\n");
}

export function writePacket(packet: LaunchNowApprovalPacket, outDir = DEFAULT_OUT_DIR) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "launch-now-approval-packet.json"), `${JSON.stringify(packet, null, 2)}\n`);
  fs.writeFileSync(path.join(outDir, "launch-now-approval-packet.md"), `${renderMarkdown(packet)}\n`);
}

function main() {
  const summaryPath = readArg("--summary") ?? DEFAULT_SUMMARY_PATH;
  const controlStatusPath = readArg("--control-status") ?? DEFAULT_CONTROL_STATUS_PATH;
  const outDir = readArg("--out-dir") ?? DEFAULT_OUT_DIR;
  const expiresOn = readArg("--expires-on") ?? undefined;
  const packet = buildLaunchNowApprovalPacket({
    summary: readJson<BudgetSummary>(summaryPath),
    controlStatus: readJson<BudgetControlStatus>(controlStatusPath),
    expiresOn,
  });

  if (!hasFlag("--no-write")) {
    writePacket(packet, outDir);
  }

  if (hasFlag("--json")) {
    console.log(JSON.stringify(packet, null, 2));
  } else {
    console.log(renderMarkdown(packet));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
