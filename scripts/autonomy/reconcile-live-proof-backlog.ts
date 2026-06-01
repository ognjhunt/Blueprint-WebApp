#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";

const DEFAULT_BACKLOG_PATH = "output/autonomous-org/budget/latest/live-proof-backlog.json";
const DEFAULT_SPEND_SNAPSHOT_PATH = "output/autonomous-org/budget/spend-snapshots/latest.json";
const DEFAULT_OUT_DIR = "output/autonomous-org/budget/latest";

const ITEM_SOURCE_MAP: Record<string, string[]> = {
  "deepseek-openrouter-usage-export": ["deepseek_balance", "openrouter_credits"],
  "render-billing-export": ["render_inventory"],
  "digitalocean-cloudflare-billing": ["digitalocean_billing", "cloudflare_billing_profile"],
  "firebase-gcp-billing-export": ["gcp_firebase_billing_export", "firebase_project_config"],
  "redis-upstash-billing": ["upstash_redis_usage"],
  "email-human-reply-slack-billing-readiness": ["sendgrid_credits", "slack_billing"],
  "analytics-billing-kpi-proof": ["posthog_usage"],
  "search-research-api-billing": ["search_research_api_spend"],
  "recipient-evidence-enrichment-receipts": ["recipient_evidence_enrichment"],
  "profiles-listings-receipts": ["profiles_owned_growth_ops"],
  "ad-spend-paused-draft-proof": ["meta_ads_spend", "google_ads_billing"],
  "live-paperclip-routine-propagation": ["paperclip_declared_agent_envelope"],
};

type ReconciliationStatus = "closed" | "partial_source_proof" | "open";
type SourceProofStatus = "budget_actual" | "partial" | "missing";

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
    budget_line: string;
    target_usd: number;
    status: string;
    proof_boundary: string;
  };
  openai_api_guardrail: {
    budget_line: string;
    target_usd: number;
    current_usd: number;
    status: string;
    proof_path: string;
    proof_boundary: string;
  };
  safe_resume_commands: string[];
  remaining_items: LiveProofBacklogItem[];
};

type SpendSnapshotSource = {
  id: string;
  label?: string;
  provider?: string;
  owner_system?: string;
  budget_line?: string;
  status: string;
  proof_level: string;
  target_usd: number | null;
  amount_usd_current_period: number | null;
  credit_balance_usd?: number | null;
  can_count_toward_budget_actuals?: boolean;
  live_read_attempted: boolean;
  live_mutation_attempted: boolean;
  missing_to_verify?: string[];
  error: string | null;
};

type SpendProofSnapshot = {
  schema: string;
  generated_at: string;
  registry_path: string;
  mode?: {
    live_read_enabled?: boolean;
    live_mutation_attempted?: boolean;
    secrets_persisted?: boolean;
    keychain_enabled?: boolean;
    keychain_loaded_env?: string[];
  };
  sources?: SpendSnapshotSource[];
};

type SourceEvidence = {
  id: string;
  status: string;
  proof_level: string;
  target_usd: number | null;
  amount_usd_current_period: number | null;
  credit_balance_usd: number | null;
  can_count_toward_budget_actuals: boolean;
  live_read_attempted: boolean;
  live_mutation_attempted: boolean;
  missing_to_verify: string[];
  error: string | null;
  proof_status: SourceProofStatus;
};

type ReconciledItem = {
  id: string;
  closeout_gap: string;
  budget_line: string;
  target_usd: number;
  owner_system: string;
  source_ids: string[];
  source_evidence: SourceEvidence[];
  missing_source_ids: string[];
  reconciliation_status: ReconciliationStatus;
  currently_have: string;
  remaining_proof_needed: string;
  safe_proof_command: string;
  approval_required_before_live_spend_change: boolean;
  live_mutation_allowed: boolean;
  next_action: string;
};

type Reconciliation = {
  schema: "blueprint/autonomous-budget-live-proof-reconciliation/v1";
  generated_at: string;
  state: string;
  blocker_id: string;
  backlog_path: string;
  spend_snapshot_path: string;
  spend_snapshot_generated_at: string;
  no_live_provider_calls_made_by_reconciliation: boolean;
  no_live_mutation_attempted: boolean;
  secrets_persisted: boolean;
  live_read_enabled_in_input_snapshot: boolean;
  keychain_enabled_in_input_snapshot: boolean;
  total_items: number;
  closed_items: number;
  partial_items: number;
  open_items: number;
  all_live_mutation_allowed: boolean;
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
    latest_source_status: string | null;
    latest_source_proof_level: string | null;
    verified_zero: boolean;
    proof_boundary: string;
  };
  items: ReconciledItem[];
  safe_resume_commands: string[];
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

function formatUsd(value: number | null) {
  return value === null ? "unknown" : `$${value.toFixed(2)}`;
}

function normalizeCell(value: string) {
  return value.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
}

function sourceHasBudgetActualProof(source: SpendSnapshotSource) {
  return source.can_count_toward_budget_actuals === true
    && source.live_mutation_attempted === false
    && source.error === null
    && (
      source.status === "live_billing_verified"
      || source.status === "manual_export_loaded"
    )
    && (
      typeof source.amount_usd_current_period === "number"
      || source.target_usd === 0
    );
}

function sourceHasPartialProof(source: SpendSnapshotSource) {
  if (sourceHasBudgetActualProof(source)) {
    return false;
  }

  return source.live_read_attempted === true
    || source.error !== null
    || source.proof_level !== "missing"
    || source.status === "credential_presence_only"
    || source.status === "live_usage_verified"
    || source.status === "live_credit_balance_verified";
}

function sourceEvidence(source: SpendSnapshotSource): SourceEvidence {
  const proofStatus: SourceProofStatus = sourceHasBudgetActualProof(source)
    ? "budget_actual"
    : sourceHasPartialProof(source)
      ? "partial"
      : "missing";

  return {
    id: source.id,
    status: source.status,
    proof_level: source.proof_level,
    target_usd: source.target_usd,
    amount_usd_current_period: source.amount_usd_current_period,
    credit_balance_usd: source.credit_balance_usd ?? null,
    can_count_toward_budget_actuals: source.can_count_toward_budget_actuals === true,
    live_read_attempted: source.live_read_attempted,
    live_mutation_attempted: source.live_mutation_attempted,
    missing_to_verify: source.missing_to_verify ?? [],
    error: source.error,
    proof_status: proofStatus,
  };
}

function reconcileItem(
  item: LiveProofBacklogItem,
  sourcesById: Map<string, SpendSnapshotSource>,
): ReconciledItem {
  const sourceIds = ITEM_SOURCE_MAP[item.id] ?? [];
  const existingSources = sourceIds
    .map((sourceId) => sourcesById.get(sourceId))
    .filter((source): source is SpendSnapshotSource => Boolean(source));
  const missingSourceIds = sourceIds.filter((sourceId) => !sourcesById.has(sourceId));
  const evidence = existingSources.map(sourceEvidence);
  const hasBudgetActualProof =
    sourceIds.length > 0
    && missingSourceIds.length === 0
    && existingSources.every(sourceHasBudgetActualProof);
  const hasPartialProof =
    existingSources.some(sourceHasPartialProof)
    || evidence.some((source) => source.proof_status === "budget_actual")
    || missingSourceIds.length > 0;
  const reconciliationStatus: ReconciliationStatus = hasBudgetActualProof
    ? "closed"
    : hasPartialProof
      ? "partial_source_proof"
      : "open";

  const nextAction = reconciliationStatus === "closed"
    ? "No live-spend change is authorized; keep this proof attached and rerun the budget verifier."
    : `Attach the requested proof or confirmation, then rerun the safe proof command. Required input: ${item.exact_input_needed}`;

  return {
    id: item.id,
    closeout_gap: item.closeout_gap,
    budget_line: item.budget_line,
    target_usd: item.target_usd,
    owner_system: item.owner_system,
    source_ids: sourceIds,
    source_evidence: evidence,
    missing_source_ids: missingSourceIds,
    reconciliation_status: reconciliationStatus,
    currently_have: item.currently_have,
    remaining_proof_needed: reconciliationStatus === "closed" ? "No remaining billing proof gap for this item." : item.proof_needed,
    safe_proof_command: item.safe_proof_command,
    approval_required_before_live_spend_change: item.approval_required_before_live_spend_change,
    live_mutation_allowed: item.live_mutation_allowed,
    next_action: nextAction,
  };
}

function renderMarkdown(reconciliation: Reconciliation) {
  const lines = [
    "# Live Proof Reconciliation",
    "",
    `Generated: ${reconciliation.generated_at}`,
    `State: \`${reconciliation.state}\``,
    `Blocker id: \`${reconciliation.blocker_id}\``,
    "",
    "No live provider calls were made by this reconciliation command. It only read the repo-local backlog and the existing redacted spend snapshot.",
    "",
    "## Summary",
    "",
    `- Total live-proof items: ${reconciliation.total_items}`,
    `- Closed items: ${reconciliation.closed_items}`,
    `- Partial source proof items: ${reconciliation.partial_items}`,
    `- Open/blocking items: ${reconciliation.open_items}`,
    `- Live mutation attempted: ${reconciliation.no_live_mutation_attempted ? "no" : "yes"}`,
    `- Secrets persisted: ${reconciliation.secrets_persisted ? "yes" : "no"}`,
    `- Codex OAuth/Pro target: ${formatUsd(reconciliation.codex_oauth_pro.target_usd)} and excluded from the $500 launch/growth budget`,
    `- OpenAI API current-period spend: ${formatUsd(reconciliation.openai_api_guardrail.current_usd)} with target ${formatUsd(reconciliation.openai_api_guardrail.target_usd)}`,
    "",
    "## Items",
    "",
    "| Item | Status | Sources | Remaining Proof | Next Action |",
    "|---|---:|---|---|---|",
  ];

  for (const item of reconciliation.items) {
    const sources = item.source_evidence
      .map((source) => `${source.id}:${source.proof_status}`)
      .concat(item.missing_source_ids.map((sourceId) => `${sourceId}:missing_source`))
      .join(", ");
    lines.push(
      `| \`${item.id}\` | \`${item.reconciliation_status}\` | ${normalizeCell(sources || "none")} | ${normalizeCell(item.remaining_proof_needed)} | ${normalizeCell(item.next_action)} |`,
    );
  }

  lines.push(
    "",
    "## Guardrails",
    "",
    "- Partial proof is not spend proof. Credit balances, service inventory, credential presence, and repo-local config do not close a budget line.",
    "- Spend-affecting moves still require human approval before live systems act.",
    "- This packet does not authorize sends, ads, provider jobs, payment actions, production mutations, hosted-session fulfillment, city activation, or Operational Launch Ready claims.",
    "",
    "## Safe Resume Commands",
    "",
    ...reconciliation.safe_resume_commands.map((command) => `- \`${command}\``),
  );

  return lines.join("\n");
}

function reconcile() {
  const backlogPath = readArg("--backlog") ?? DEFAULT_BACKLOG_PATH;
  const spendSnapshotPath = readArg("--spend-snapshot") ?? DEFAULT_SPEND_SNAPSHOT_PATH;
  const outDir = readArg("--out-dir") ?? DEFAULT_OUT_DIR;
  const backlog = readJson<LiveProofBacklog>(backlogPath);
  const spendSnapshot = readJson<SpendProofSnapshot>(spendSnapshotPath);
  const sourcesById = new Map((spendSnapshot.sources ?? []).map((source) => [source.id, source]));
  const items = backlog.remaining_items.map((item) => reconcileItem(item, sourcesById));
  const openAiSource = sourcesById.get("openai_api_costs") ?? null;
  const noLiveMutationAttempted =
    backlog.no_live_mutation_attempted === true
    && spendSnapshot.mode?.live_mutation_attempted !== true
    && (spendSnapshot.sources ?? []).every((source) => source.live_mutation_attempted === false);
  const safeResumeCommands = Array.from(new Set([
    ...backlog.safe_resume_commands,
    "npm run autonomy:budget:live-proof:reconcile",
    "npm run autonomy:budget:verify",
  ]));

  const reconciliation: Reconciliation = {
    schema: "blueprint/autonomous-budget-live-proof-reconciliation/v1",
    generated_at: new Date().toISOString(),
    state: backlog.state,
    blocker_id: backlog.blocker_id,
    backlog_path: backlogPath,
    spend_snapshot_path: spendSnapshotPath,
    spend_snapshot_generated_at: spendSnapshot.generated_at,
    no_live_provider_calls_made_by_reconciliation: true,
    no_live_mutation_attempted: noLiveMutationAttempted,
    secrets_persisted: spendSnapshot.mode?.secrets_persisted === true,
    live_read_enabled_in_input_snapshot: spendSnapshot.mode?.live_read_enabled === true,
    keychain_enabled_in_input_snapshot: spendSnapshot.mode?.keychain_enabled === true,
    total_items: items.length,
    closed_items: items.filter((item) => item.reconciliation_status === "closed").length,
    partial_items: items.filter((item) => item.reconciliation_status === "partial_source_proof").length,
    open_items: items.filter((item) => item.reconciliation_status !== "closed").length,
    all_live_mutation_allowed: items.every((item) => item.live_mutation_allowed === true),
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
      latest_source_status: openAiSource?.status ?? null,
      latest_source_proof_level: openAiSource?.proof_level ?? null,
      verified_zero: backlog.openai_api_guardrail.target_usd === 0
        && backlog.openai_api_guardrail.current_usd === 0
        && openAiSource?.status === "live_billing_verified"
        && openAiSource?.amount_usd_current_period === 0,
      proof_boundary: backlog.openai_api_guardrail.proof_boundary,
    },
    items,
    safe_resume_commands: safeResumeCommands,
  };

  if (!hasFlag("--no-write")) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "live-proof-reconciliation.json"),
      `${JSON.stringify(reconciliation, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(outDir, "live-proof-reconciliation.md"),
      `${renderMarkdown(reconciliation)}\n`,
    );
  }

  if (hasFlag("--json")) {
    console.log(JSON.stringify(reconciliation, null, 2));
  } else {
    console.log(renderMarkdown(reconciliation));
  }
}

reconcile();
