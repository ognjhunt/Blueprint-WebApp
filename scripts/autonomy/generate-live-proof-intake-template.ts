#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

const DEFAULT_BACKLOG_PATH = "output/autonomous-org/budget/latest/live-proof-backlog.json";
const DEFAULT_RECONCILIATION_PATH = "output/autonomous-org/budget/latest/live-proof-reconciliation.json";
const DEFAULT_OUT_DIR = "output/autonomous-org/budget/latest";

type LiveProofBacklogItem = {
  id: string;
  closeout_gap: string;
  budget_line: string;
  target_usd: number;
  owner_system: string;
  status: string;
  currently_have: string;
  proof_needed: string;
  safe_proof_command: string;
  exact_input_needed: string;
  approval_required_before_live_spend_change: boolean;
  live_mutation_allowed: boolean;
  disallowed_workaround: string;
};

type LiveProofBacklog = {
  schema: string;
  state: string;
  blocker_id: string;
  no_live_mutation_attempted: boolean;
  codex_oauth_pro: {
    target_usd: number;
    status: string;
    proof_boundary: string;
  };
  openai_api_guardrail: {
    target_usd: number;
    current_usd: number;
    status: string;
    proof_path: string;
    proof_boundary: string;
  };
  remaining_items: LiveProofBacklogItem[];
};

type Reconciliation = {
  schema: string;
  blocker_id: string;
  no_live_provider_calls_made_by_reconciliation: boolean;
  no_live_mutation_attempted: boolean;
  secrets_persisted: boolean;
  total_items: number;
  closed_items: number;
  partial_items: number;
  open_items: number;
  items: Array<{
    id: string;
    reconciliation_status: "closed" | "partial_source_proof" | "open";
    source_ids: string[];
    missing_source_ids: string[];
  }>;
};

type IntakeTemplateItem = {
  id: string;
  closeout_gap: string;
  budget_line: string;
  target_usd: number;
  owner_system: string;
  current_reconciliation_status: "closed" | "partial_source_proof" | "open" | "not_reconciled";
  source_ids: string[];
  missing_source_ids: string[];
  currently_have: string;
  proof_needed: string;
  exact_input_needed: string;
  safe_proof_command_after_attachment: string;
  approval_required_before_live_spend_change: boolean;
  live_mutation_allowed: boolean;
  disallowed_workaround: string;
  artifact_intake_template: {
    artifact_path: string;
    artifact_type: string;
    owner_system_account_label: string;
    billing_period_start: string;
    billing_period_end: string;
    current_period_amount_usd: number | null;
    currency: string;
    source_system_generated_at: string;
    source_system_export_id_or_invoice_id: string;
    redaction_notes: string;
    human_confirmation: string;
  };
  acceptance_criteria: string[];
};

type IntakeTemplate = {
  schema: "blueprint/autonomous-budget-live-proof-intake-template/v1";
  generated_at: string;
  state: string;
  blocker_id: string;
  backlog_path: string;
  reconciliation_path: string;
  no_live_provider_calls_made: boolean;
  no_live_mutation_attempted: boolean;
  secrets_persisted: boolean;
  codex_oauth_pro: {
    target_usd: number;
    status: string;
    excluded_from_500_budget: boolean;
    proof_boundary: string;
  };
  openai_api_guardrail: {
    target_usd: number;
    current_usd: number;
    status: string;
    proof_path: string;
    proof_boundary: string;
  };
  accepted_artifact_types: string[];
  required_artifact_fields: string[];
  instructions: string[];
  items: IntakeTemplateItem[];
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

function normalizeCell(value: string) {
  return value.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
}

function monthBounds() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function buildItem(
  item: LiveProofBacklogItem,
  reconciliationById: Map<string, Reconciliation["items"][number]>,
): IntakeTemplateItem {
  const month = monthBounds();
  const reconciliation = reconciliationById.get(item.id);
  return {
    id: item.id,
    closeout_gap: item.closeout_gap,
    budget_line: item.budget_line,
    target_usd: item.target_usd,
    owner_system: item.owner_system,
    current_reconciliation_status: reconciliation?.reconciliation_status ?? "not_reconciled",
    source_ids: reconciliation?.source_ids ?? [],
    missing_source_ids: reconciliation?.missing_source_ids ?? [],
    currently_have: item.currently_have,
    proof_needed: item.proof_needed,
    exact_input_needed: item.exact_input_needed,
    safe_proof_command_after_attachment: item.safe_proof_command,
    approval_required_before_live_spend_change: item.approval_required_before_live_spend_change,
    live_mutation_allowed: item.live_mutation_allowed,
    disallowed_workaround: item.disallowed_workaround,
    artifact_intake_template: {
      artifact_path: "",
      artifact_type: "",
      owner_system_account_label: "",
      billing_period_start: month.start,
      billing_period_end: month.end,
      current_period_amount_usd: null,
      currency: "USD",
      source_system_generated_at: "",
      source_system_export_id_or_invoice_id: "",
      redaction_notes: "",
      human_confirmation: "I confirm this artifact came from the named owner system and does not authorize live mutation or live spend movement.",
    },
    acceptance_criteria: [
      "Artifact path points to a local file or output artifact that is not a secret file.",
      "Artifact came from the named owner system, dashboard, invoice, billing export, or explicit no-spend confirmation.",
      "Billing period overlaps the current reconciliation month.",
      "Amount is a non-negative USD current-period value, or the item explicitly states no spend for the period.",
      "Artifact does not authorize live sends, ads, provider jobs, payments, payouts, production mutations, hosted-session fulfillment, city activation, or Operational Launch Ready claims.",
    ],
  };
}

function renderMarkdown(template: IntakeTemplate) {
  const lines = [
    "# Live Proof Intake Template",
    "",
    `Generated: ${template.generated_at}`,
    `State: \`${template.state}\``,
    `Blocker id: \`${template.blocker_id}\``,
    "",
    "This is a fillable template for owner-system billing/export proof. It does not verify spend by itself, call providers, store secrets, or authorize live mutation.",
    "",
    "## Guardrails",
    "",
    `- Codex OAuth/Pro target: ${formatUsd(template.codex_oauth_pro.target_usd)} and excluded from the $500 launch/growth budget.`,
    `- OpenAI API target: ${formatUsd(template.openai_api_guardrail.target_usd)}; current verified amount: ${formatUsd(template.openai_api_guardrail.current_usd)}.`,
    "- Partial source proof remains blocking until owner-system proof is attached and the verifier passes.",
    "- Live spend movement still requires explicit human approval after proof is attached.",
    "",
    "## Accepted Artifact Types",
    "",
    ...template.accepted_artifact_types.map((type) => `- \`${type}\``),
    "",
    "## Required Fields",
    "",
    ...template.required_artifact_fields.map((field) => `- \`${field}\``),
    "",
    "## Items",
    "",
    "| Item | Status | Target | Owner System | Needed Proof |",
    "|---|---:|---:|---|---|",
  ];

  for (const item of template.items) {
    lines.push(
      `| \`${item.id}\` | \`${item.current_reconciliation_status}\` | ${formatUsd(item.target_usd)} | ${normalizeCell(item.owner_system)} | ${normalizeCell(item.proof_needed)} |`,
    );
  }

  lines.push(
    "",
    "## Fillable JSON Shape",
    "",
    "Copy one `artifact_intake_template` block per proof artifact, fill it in, and keep the resulting proof intake local unless explicitly approved for a safe repo artifact.",
  );

  return lines.join("\n");
}

function generateTemplate() {
  const backlogPath = readArg("--backlog") ?? DEFAULT_BACKLOG_PATH;
  const reconciliationPath = readArg("--reconciliation") ?? DEFAULT_RECONCILIATION_PATH;
  const outDir = readArg("--out-dir") ?? DEFAULT_OUT_DIR;
  const backlog = readJson<LiveProofBacklog>(backlogPath);
  const reconciliation = readJson<Reconciliation>(reconciliationPath);
  const reconciliationById = new Map(reconciliation.items.map((item) => [item.id, item]));
  const template: IntakeTemplate = {
    schema: "blueprint/autonomous-budget-live-proof-intake-template/v1",
    generated_at: new Date().toISOString(),
    state: backlog.state,
    blocker_id: backlog.blocker_id,
    backlog_path: backlogPath,
    reconciliation_path: reconciliationPath,
    no_live_provider_calls_made: true,
    no_live_mutation_attempted:
      backlog.no_live_mutation_attempted === true
      && reconciliation.no_live_mutation_attempted === true,
    secrets_persisted: false,
    codex_oauth_pro: {
      target_usd: backlog.codex_oauth_pro.target_usd,
      status: backlog.codex_oauth_pro.status,
      excluded_from_500_budget: backlog.codex_oauth_pro.target_usd === 0
        && backlog.codex_oauth_pro.status === "outside_budget_excluded",
      proof_boundary: backlog.codex_oauth_pro.proof_boundary,
    },
    openai_api_guardrail: {
      target_usd: backlog.openai_api_guardrail.target_usd,
      current_usd: backlog.openai_api_guardrail.current_usd,
      status: backlog.openai_api_guardrail.status,
      proof_path: backlog.openai_api_guardrail.proof_path,
      proof_boundary: backlog.openai_api_guardrail.proof_boundary,
    },
    accepted_artifact_types: [
      "billing_export_json",
      "invoice_pdf",
      "dashboard_screenshot",
      "provider_usage_csv",
      "read_only_api_snapshot",
      "receipt",
      "explicit_no_spend_confirmation",
    ],
    required_artifact_fields: [
      "artifact_path",
      "artifact_type",
      "owner_system_account_label",
      "billing_period_start",
      "billing_period_end",
      "current_period_amount_usd",
      "currency",
      "source_system_generated_at",
      "source_system_export_id_or_invoice_id",
      "human_confirmation",
    ],
    instructions: [
      "Fill one artifact_intake_template block per provider proof artifact.",
      "Keep credential files, raw secrets, OAuth refresh tokens, and private keys out of the artifact path.",
      "Use explicit_no_spend_confirmation only when the owner system or account owner confirms no current-period spend.",
      "After attaching proof, rerun the relevant spend snapshot command, then npm run autonomy:budget:live-proof:reconcile, npm run autonomy:budget:live-proof:validate, and npm run autonomy:budget:verify.",
      "Do not treat this template as spend proof until the verifier and source-system evidence agree.",
    ],
    items: backlog.remaining_items.map((item) => buildItem(item, reconciliationById)),
  };

  if (!hasFlag("--no-write")) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "live-proof-intake-template.json"),
      `${JSON.stringify(template, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(outDir, "live-proof-intake-template.md"),
      `${renderMarkdown(template)}\n`,
    );
  }

  if (hasFlag("--json")) {
    console.log(JSON.stringify(template, null, 2));
  } else {
    console.log(renderMarkdown(template));
  }
}

generateTemplate();
