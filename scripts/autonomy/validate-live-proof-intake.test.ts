// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildValidationReport,
  validationExitCode,
  type IntakeItem,
  type IntakeTemplate,
} from "./validate-live-proof-intake";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function baseItem(overrides: Partial<IntakeItem> = {}): IntakeItem {
  return {
    id: "render-billing-export",
    target_usd: 25,
    current_reconciliation_status: "partial_source_proof",
    approval_required_before_live_spend_change: true,
    live_mutation_allowed: false,
    artifact_intake_template: {
      artifact_path: "",
      artifact_type: "",
      owner_system_account_label: "",
      billing_period_start: "2026-06-01",
      billing_period_end: "2026-06-30",
      current_period_amount_usd: null,
      currency: "USD",
      source_system_generated_at: "",
      source_system_export_id_or_invoice_id: "",
      redaction_notes: "",
      human_confirmation: "I confirm this artifact came from the named owner system and does not authorize live mutation or live spend movement.",
    },
    ...overrides,
  };
}

function templateWith(items: IntakeItem[]): IntakeTemplate {
  return {
    schema: "blueprint/autonomous-budget-live-proof-intake-template/v1",
    state: "awaiting_human_decision",
    blocker_id: "autonomous-org-budget-live-proof-20260601",
    no_live_provider_calls_made: true,
    no_live_mutation_attempted: true,
    secrets_persisted: false,
    codex_oauth_pro: {
      target_usd: 0,
      status: "outside_budget_excluded",
      excluded_from_500_budget: true,
    },
    openai_api_guardrail: {
      target_usd: 0,
      current_usd: 0,
      status: "live_verified_zero",
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
    instructions: [],
    items,
  };
}

function reportFor(item: IntakeItem) {
  const template = templateWith([item]);
  return buildValidationReport({
    template,
    intake: template,
    templatePath: "template.json",
    intakePath: "intake.json",
    now: NOW,
  });
}

describe("live proof intake validation", () => {
  it("treats blank template rows as missing submissions without failing default mode", () => {
    const report = reportFor(baseItem());

    expect(report.totals).toMatchObject({
      total_items: 1,
      accepted_for_manual_review: 0,
      missing_submission: 1,
      rejected: 0,
    });
    expect(report.items[0]).toMatchObject({
      validation_status: "missing_submission",
      errors: [],
      warnings: ["no artifact submitted yet"],
      counts_as_live_billing_proof: false,
    });
    expect(validationExitCode(report, false)).toBe(0);
    expect(validationExitCode(report, true)).toBe(1);
  });

  it("accepts a complete current-month proof row only for manual review", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "blueprint-proof-"));
    const proofPath = path.join(tempDir, "render-invoice.json");
    fs.writeFileSync(proofPath, JSON.stringify({ amount_usd: 12.34 }));
    const report = reportFor(baseItem({
      artifact_intake_template: {
        artifact_path: proofPath,
        artifact_type: "billing_export_json",
        owner_system_account_label: "Render account redacted",
        billing_period_start: "2026-06-01",
        billing_period_end: "2026-06-30",
        current_period_amount_usd: 12.34,
        currency: "USD",
        source_system_generated_at: "2026-06-15T10:00:00.000Z",
        source_system_export_id_or_invoice_id: "render-redacted-2026-06",
        redaction_notes: "account id redacted",
        human_confirmation: "I confirm this artifact came from the named owner system and does not authorize live mutation or live spend movement.",
      },
    }));

    expect(report.totals).toMatchObject({
      accepted_for_manual_review: 1,
      missing_submission: 0,
      rejected: 0,
    });
    expect(report.intake_complete).toBe(true);
    expect(report.proof_ready_to_count_as_live_billing).toBe(false);
    expect(report.items[0]).toMatchObject({
      validation_status: "accepted_for_manual_review",
      ready_for_manual_review: true,
      counts_as_live_billing_proof: false,
    });
    expect(validationExitCode(report, true)).toBe(0);
  });

  it("rejects secret-like artifact paths even when other fields are complete", () => {
    const report = reportFor(baseItem({
      artifact_intake_template: {
        artifact_path: ".env.spend.local",
        artifact_type: "billing_export_json",
        owner_system_account_label: "Render account redacted",
        billing_period_start: "2026-06-01",
        billing_period_end: "2026-06-30",
        current_period_amount_usd: 12.34,
        currency: "USD",
        source_system_generated_at: "2026-06-15T10:00:00.000Z",
        source_system_export_id_or_invoice_id: "render-redacted-2026-06",
        redaction_notes: "account id redacted",
        human_confirmation: "I confirm this artifact came from the named owner system and does not authorize live mutation or live spend movement.",
      },
    }));

    expect(report.totals).toMatchObject({
      accepted_for_manual_review: 0,
      missing_submission: 0,
      rejected: 1,
    });
    expect(report.items[0].errors.join("\n")).toContain("secret/token/credential");
    expect(validationExitCode(report, true)).toBe(1);
  });
});
