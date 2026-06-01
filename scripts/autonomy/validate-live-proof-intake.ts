#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_TEMPLATE_PATH = "output/autonomous-org/budget/latest/live-proof-intake-template.json";
const DEFAULT_OUT_DIR = "output/autonomous-org/budget/latest";

export type IntakeItem = {
  id: string;
  target_usd: number;
  current_reconciliation_status: "closed" | "partial_source_proof" | "open" | "not_reconciled";
  approval_required_before_live_spend_change: boolean;
  live_mutation_allowed: boolean;
  artifact_intake_template: {
    artifact_path: string;
    artifact_type: string;
    owner_system_account_label?: string;
    billing_period_start?: string;
    billing_period_end?: string;
    current_period_amount_usd: number | null;
    currency?: string;
    source_system_generated_at?: string;
    source_system_export_id_or_invoice_id?: string;
    redaction_notes?: string;
    human_confirmation: string;
  };
};

export type IntakeTemplate = {
  schema: string;
  state: string;
  blocker_id: string;
  no_live_provider_calls_made: boolean;
  no_live_mutation_attempted: boolean;
  secrets_persisted: boolean;
  codex_oauth_pro: {
    target_usd: number;
    status: string;
    excluded_from_500_budget: boolean;
  };
  openai_api_guardrail: {
    target_usd: number;
    current_usd: number;
    status: string;
  };
  accepted_artifact_types: string[];
  required_artifact_fields: string[];
  instructions: string[];
  items: IntakeItem[];
};

export type ValidationStatus = "accepted_for_manual_review" | "missing_submission" | "rejected";

export type ValidationItem = {
  id: string;
  validation_status: ValidationStatus;
  current_reconciliation_status: IntakeItem["current_reconciliation_status"];
  target_usd: number;
  artifact_path: string;
  artifact_type: string;
  amount_usd: number | null;
  errors: string[];
  warnings: string[];
  ready_for_manual_review: boolean;
  counts_as_live_billing_proof: false;
  approval_required_before_live_spend_change: boolean;
  live_mutation_allowed: boolean;
};

export type ValidationReport = {
  schema: "blueprint/autonomous-budget-live-proof-intake-validation/v1";
  generated_at: string;
  state: string;
  blocker_id: string;
  template_path: string;
  intake_path: string;
  no_live_provider_calls_made: boolean;
  no_live_mutation_attempted: boolean;
  secrets_persisted: boolean;
  command_passed: boolean;
  intake_complete: boolean;
  proof_ready_to_count_as_live_billing: false;
  codex_oauth_pro: IntakeTemplate["codex_oauth_pro"];
  openai_api_guardrail: IntakeTemplate["openai_api_guardrail"];
  totals: {
    total_items: number;
    accepted_for_manual_review: number;
    missing_submission: number;
    rejected: number;
  };
  items: ValidationItem[];
  required_next_commands: string[];
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

function parseDate(value: string | undefined) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatUsd(value: number | null) {
  return value === null ? "missing" : `$${value.toFixed(2)}`;
}

function currentMonthRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
  return { start, end };
}

function overlapsCurrentMonth(start: Date, end: Date, now = new Date()) {
  const month = currentMonthRange(now);
  return start <= month.end && end >= month.start;
}

function looksLikeSecretPath(artifactPath: string) {
  const normalized = artifactPath.toLowerCase();
  return normalized.includes(".env")
    || normalized.includes("secret")
    || normalized.includes("token")
    || normalized.includes("credential")
    || normalized.endsWith(".pem")
    || normalized.endsWith(".key");
}

function missing(value: string | undefined) {
  return !value || !value.trim();
}

export function validateItem(item: IntakeItem, acceptedArtifactTypes: string[], now = new Date()): ValidationItem {
  const artifact = item.artifact_intake_template;
  const errors: string[] = [];
  const warnings: string[] = [];
  const artifactPath = artifact.artifact_path?.trim() ?? "";
  const artifactType = artifact.artifact_type?.trim() ?? "";
  const periodStart = parseDate(artifact.billing_period_start);
  const periodEnd = parseDate(artifact.billing_period_end);
  const generatedAt = parseDate(artifact.source_system_generated_at);

  if (item.approval_required_before_live_spend_change !== true) {
    errors.push("approval_required_before_live_spend_change must remain true");
  }
  if (item.live_mutation_allowed !== false) {
    errors.push("live_mutation_allowed must remain false");
  }
  if (missing(artifactPath)) {
    errors.push("artifact_path is required");
  } else if (looksLikeSecretPath(artifactPath)) {
    errors.push("artifact_path appears to reference a secret/token/credential file");
  } else if (!fs.existsSync(path.resolve(artifactPath))) {
    warnings.push("artifact_path does not exist locally yet; attach the artifact before counting this as proof");
  }
  if (missing(artifactType)) {
    errors.push("artifact_type is required");
  } else if (!acceptedArtifactTypes.includes(artifactType)) {
    errors.push(`artifact_type must be one of: ${acceptedArtifactTypes.join(", ")}`);
  }
  if (missing(artifact.owner_system_account_label)) {
    errors.push("owner_system_account_label is required");
  }
  if (!periodStart) {
    errors.push("billing_period_start must be a valid date");
  }
  if (!periodEnd) {
    errors.push("billing_period_end must be a valid date");
  }
  if (periodStart && periodEnd) {
    if (periodEnd < periodStart) {
      errors.push("billing_period_end must be on or after billing_period_start");
    }
    if (!overlapsCurrentMonth(periodStart, periodEnd, now)) {
      errors.push("billing period must overlap the current reconciliation month");
    }
  }
  if (typeof artifact.current_period_amount_usd !== "number" || !Number.isFinite(artifact.current_period_amount_usd)) {
    errors.push("current_period_amount_usd must be a non-negative number");
  } else if (artifact.current_period_amount_usd < 0) {
    errors.push("current_period_amount_usd must be non-negative");
  }
  if ((artifact.currency ?? "").toUpperCase() !== "USD") {
    errors.push("currency must be USD for this budget reconciliation");
  }
  if (!generatedAt) {
    errors.push("source_system_generated_at must be a valid date");
  }
  if (missing(artifact.source_system_export_id_or_invoice_id)) {
    errors.push("source_system_export_id_or_invoice_id is required");
  }
  if (!artifact.human_confirmation.includes("does not authorize live mutation")) {
    errors.push("human_confirmation must preserve the no-live-mutation boundary");
  }

  const blankSubmission = [
    artifactPath,
    artifactType,
    artifact.owner_system_account_label ?? "",
    artifact.source_system_generated_at ?? "",
    artifact.source_system_export_id_or_invoice_id ?? "",
  ].every((value) => !value.trim()) && artifact.current_period_amount_usd === null;
  const validationStatus: ValidationStatus = blankSubmission
    ? "missing_submission"
    : errors.length > 0
      ? "rejected"
      : "accepted_for_manual_review";
  const reportedErrors = blankSubmission ? [] : errors;
  const reportedWarnings = blankSubmission ? ["no artifact submitted yet"] : warnings;

  return {
    id: item.id,
    validation_status: validationStatus,
    current_reconciliation_status: item.current_reconciliation_status,
    target_usd: item.target_usd,
    artifact_path: artifactPath,
    artifact_type: artifactType,
    amount_usd: artifact.current_period_amount_usd,
    errors: reportedErrors,
    warnings: reportedWarnings,
    ready_for_manual_review: validationStatus === "accepted_for_manual_review",
    counts_as_live_billing_proof: false,
    approval_required_before_live_spend_change: item.approval_required_before_live_spend_change,
    live_mutation_allowed: item.live_mutation_allowed,
  };
}

function renderMarkdown(report: ValidationReport) {
  const lines = [
    "# Live Proof Intake Validation",
    "",
    `Generated: ${report.generated_at}`,
    `State: \`${report.state}\``,
    `Blocker id: \`${report.blocker_id}\``,
    "",
    "This validator makes no provider calls and does not count artifacts as live billing proof. Accepted rows are only ready for manual review and later reconciliation.",
    "",
    "## Summary",
    "",
    `- Total items: ${report.totals.total_items}`,
    `- Accepted for manual review: ${report.totals.accepted_for_manual_review}`,
    `- Missing submissions: ${report.totals.missing_submission}`,
    `- Rejected submissions: ${report.totals.rejected}`,
    `- Intake complete: ${report.intake_complete ? "yes" : "no"}`,
    `- Proof ready to count as live billing: ${report.proof_ready_to_count_as_live_billing ? "yes" : "no"}`,
    `- Codex OAuth/Pro target: ${formatUsd(report.codex_oauth_pro.target_usd)} and excluded from the $500 budget`,
    `- OpenAI API current-period spend: ${formatUsd(report.openai_api_guardrail.current_usd)}`,
    "",
    "## Items",
    "",
    "| Item | Status | Amount | Errors | Warnings |",
    "|---|---:|---:|---|---|",
  ];

  for (const item of report.items) {
    lines.push(
      `| \`${item.id}\` | \`${item.validation_status}\` | ${formatUsd(item.amount_usd)} | ${item.errors.join("; ") || ""} | ${item.warnings.join("; ") || ""} |`,
    );
  }

  lines.push(
    "",
    "## Required Next Commands",
    "",
    ...report.required_next_commands.map((command) => `- \`${command}\``),
  );

  return lines.join("\n");
}

export function buildValidationReport({
  template,
  intake,
  templatePath,
  intakePath,
  now = new Date(),
}: {
  template: IntakeTemplate;
  intake: IntakeTemplate;
  templatePath: string;
  intakePath: string;
  now?: Date;
}): ValidationReport {
  const items = intake.items.map((item) => validateItem(item, template.accepted_artifact_types, now));
  return {
    schema: "blueprint/autonomous-budget-live-proof-intake-validation/v1",
    generated_at: new Date().toISOString(),
    state: intake.state,
    blocker_id: intake.blocker_id,
    template_path: templatePath,
    intake_path: intakePath,
    no_live_provider_calls_made: true,
    no_live_mutation_attempted:
      template.no_live_mutation_attempted === true
      && intake.no_live_mutation_attempted === true
      && items.every((item) => item.live_mutation_allowed === false),
    secrets_persisted: false,
    command_passed: true,
    intake_complete: items.every((item) => item.validation_status === "accepted_for_manual_review"),
    proof_ready_to_count_as_live_billing: false,
    codex_oauth_pro: intake.codex_oauth_pro,
    openai_api_guardrail: intake.openai_api_guardrail,
    totals: {
      total_items: items.length,
      accepted_for_manual_review: items.filter((item) => item.validation_status === "accepted_for_manual_review").length,
      missing_submission: items.filter((item) => item.validation_status === "missing_submission").length,
      rejected: items.filter((item) => item.validation_status === "rejected").length,
    },
    items,
    required_next_commands: [
      "npm run autonomy:budget:live-proof:reconcile",
      "npm run autonomy:budget:live-proof:template",
      "npm run autonomy:budget:live-proof:validate",
      "npm run autonomy:budget:verify",
    ],
  };
}

export function validationExitCode(report: ValidationReport, requireComplete: boolean) {
  return requireComplete && (!report.intake_complete || report.totals.rejected > 0) ? 1 : 0;
}

function validate() {
  const templatePath = readArg("--template") ?? DEFAULT_TEMPLATE_PATH;
  const intakePath = readArg("--intake") ?? templatePath;
  const outDir = readArg("--out-dir") ?? DEFAULT_OUT_DIR;
  const requireComplete = hasFlag("--require-complete");
  const template = readJson<IntakeTemplate>(templatePath);
  const intake = readJson<IntakeTemplate>(intakePath);
  const report = buildValidationReport({ template, intake, templatePath, intakePath });

  if (!hasFlag("--no-write")) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, "live-proof-intake-validation.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(outDir, "live-proof-intake-validation.md"),
      `${renderMarkdown(report)}\n`,
    );
  }

  if (hasFlag("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderMarkdown(report));
  }

  const exitCode = validationExitCode(report, requireComplete);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validate();
}
