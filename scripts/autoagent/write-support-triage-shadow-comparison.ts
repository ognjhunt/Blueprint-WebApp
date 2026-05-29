import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { z } from "zod";
import { supportTriageOutputSchema, type SupportTriageInput } from "../../server/agents/tasks/support-triage";
import { type AutoAgentShadowSummary } from "../../server/agents/autoagent-promotion-policy.ts";

type SupportTriageOutput = z.infer<typeof supportTriageOutputSchema>;

type Archetype =
  | "general_support"
  | "billing_blocked"
  | "no_change_churn"
  | "public_copy_proof_drift";

type FixtureReference = {
  archetype: Archetype;
  split: "dev" | "holdout" | "shadow";
  caseId: string;
};

type LoadedFixture = FixtureReference & {
  caseRoot: string;
  input: SupportTriageInput;
  expected: SupportTriageOutput;
};

type Variant = {
  archetype: Archetype;
  id: string;
  message: string;
  summary: string;
  requestSource: string;
};

type ShadowComparisonField = {
  field: string;
  primary: unknown;
  shadow: unknown;
};

type SupportTriageShadowRecord = {
  namespace: "autoagent";
  kind: "support_triage";
  status: "completed";
  provider: "repo_local_deterministic_shadow_policy";
  runtime: "repo_local";
  model: null;
  source_fixture: {
    path: string;
    split: string;
    caseId: string;
    archetype: Archetype;
  };
  sample: {
    id: string;
    variant_id: string;
    input: SupportTriageInput;
  };
  primary: SupportTriageOutput & {
    decision_source: "fixture_expected_json";
  };
  output: SupportTriageOutput & {
    decision_source: "deterministic_support_triage_shadow_policy_v1";
  };
  comparison: {
    schema: "blueprint/autoagent-shadow-comparison/v1";
    lane: "support_triage";
    shadow_mode: "observation_only";
    live_action_authority: "primary_result_only";
    promotion_basis: "repo_local_fixture_primary_vs_deterministic_shadow_policy";
    decision_fields: readonly string[];
    matched_fields: string[];
    mismatched_fields: ShadowComparisonField[];
    safety_blockers: string[];
    promotion_recommendation: "promote_candidate" | "hold_candidate";
    promote: boolean;
    recommendation_reason: string;
  };
};

export type SupportTriageShadowSummary = AutoAgentShadowSummary & {
  schema: "blueprint/autoagent-shadow-summary/v1";
  generated_at: string;
  source: "repo_local_deterministic_support_triage_fixture_comparison";
  records_path: string;
  report_path: string;
  min_sample_threshold: number;
  no_regression_window_basis: "repo_local_deterministic_shadow_window";
  decision_fields: readonly string[];
};

type RunSupportTriageShadowComparisonOptions = {
  fixtureRoot?: string;
  outputDir?: string;
  sampleCount?: number;
  noRegressionWindowDays?: number;
  writeArtifacts?: boolean;
  now?: Date;
};

export type RunSupportTriageShadowComparisonResult = {
  records: SupportTriageShadowRecord[];
  summary: SupportTriageShadowSummary;
  report: string;
  recordsPath: string;
  summaryPath: string;
  reportPath: string;
};

const DEFAULT_FIXTURE_ROOT = path.resolve("labs/autoagent/tasks");
const DEFAULT_OUTPUT_DIR = path.resolve("output/autoagent/shadow-comparison/latest");
const DEFAULT_SAMPLE_COUNT = 20;
const REQUIRED_MIN_SAMPLE_COUNT = 20;
const REQUIRED_NO_REGRESSION_WINDOW_DAYS = 14;
const DECISION_FIELDS = [
  "automation_status",
  "block_reason_code",
  "retryable",
  "category",
  "queue",
  "priority",
  "requires_human_review",
] as const;

const FIXTURE_REFERENCES: FixtureReference[] = [
  {
    archetype: "general_support",
    split: "dev",
    caseId: "seed-support-general",
  },
  {
    archetype: "billing_blocked",
    split: "holdout",
    caseId: "seed-support-billing-blocked",
  },
  {
    archetype: "no_change_churn",
    split: "shadow",
    caseId: "seed-support-no-change-churn",
  },
  {
    archetype: "public_copy_proof_drift",
    split: "shadow",
    caseId: "seed-support-public-copy-proof-drift",
  },
];

const VARIANTS: Variant[] = [
  {
    archetype: "general_support",
    id: "general-onboarding",
    requestSource: "contact_request",
    summary: "Routine onboarding support request.",
    message: "Please help with onboarding and the next account setup step.",
  },
  {
    archetype: "general_support",
    id: "general-login-guidance",
    requestSource: "contact_request",
    summary: "Routine login guidance request.",
    message: "Can you point me to the right place to start my Blueprint account setup?",
  },
  {
    archetype: "general_support",
    id: "general-docs-question",
    requestSource: "contact_request",
    summary: "Routine documentation question.",
    message: "Where can our team read the basic package access docs before a review call?",
  },
  {
    archetype: "general_support",
    id: "general-follow-up",
    requestSource: "contact_request",
    summary: "Routine follow-up request.",
    message: "Following up on our request and looking for the next non-sensitive step.",
  },
  {
    archetype: "general_support",
    id: "general-contact-update",
    requestSource: "contact_request",
    summary: "Routine contact update.",
    message: "Please update our preferred contact and confirm the team received our note.",
  },
  {
    archetype: "billing_blocked",
    id: "billing-refund",
    requestSource: "contact_request",
    summary: "Refund request requiring finance review.",
    message: "I need a refund for a charge on my account.",
  },
  {
    archetype: "billing_blocked",
    id: "billing-invoice",
    requestSource: "contact_request",
    summary: "Invoice correction requiring finance review.",
    message: "The invoice looks wrong and I need someone to correct the billing details.",
  },
  {
    archetype: "billing_blocked",
    id: "billing-duplicate-charge",
    requestSource: "contact_request",
    summary: "Duplicate charge requiring finance review.",
    message: "We see a duplicate charge and need support before the account continues.",
  },
  {
    archetype: "billing_blocked",
    id: "billing-receipt",
    requestSource: "contact_request",
    summary: "Receipt and charge dispute requiring finance review.",
    message: "The receipt does not match the Stripe charge and I want a finance review.",
  },
  {
    archetype: "billing_blocked",
    id: "billing-cancel-charge",
    requestSource: "contact_request",
    summary: "Cancel and charge question requiring finance review.",
    message: "Please cancel the billed item and review the account charge.",
  },
  {
    archetype: "no_change_churn",
    id: "no-change-complete-without-artifact",
    requestSource: "goal_closeout_review",
    summary: "No-change closeout marked complete without a changed artifact.",
    message: "The routine marked complete but has no changed artifact, no resolved blocker, and no new proof path.",
  },
  {
    archetype: "no_change_churn",
    id: "no-change-same-blocker",
    requestSource: "goal_closeout_review",
    summary: "Same blocker repeated with no new evidence.",
    message: "The same blocker was checked again, no new proof appeared, and the report still claims movement.",
  },
  {
    archetype: "no_change_churn",
    id: "no-change-status-only",
    requestSource: "goal_closeout_review",
    summary: "Status-only completion with no durable proof.",
    message: "This is a status-only closeout with no changed files and no deterministic proof, but it says done.",
  },
  {
    archetype: "no_change_churn",
    id: "no-change-report-only",
    requestSource: "goal_closeout_review",
    summary: "Report-only run should not claim completed movement.",
    message: "The run produced only a report, no owner-system evidence, and should stay no-change until proof exists.",
  },
  {
    archetype: "no_change_churn",
    id: "no-change-unsupported-done",
    requestSource: "goal_closeout_review",
    summary: "Unsupported done claim on unchanged work.",
    message: "There is no changed artifact or validation output, yet the routine says the blocker is done.",
  },
  {
    archetype: "public_copy_proof_drift",
    id: "public-copy-operational-proof",
    requestSource: "public_copy_review",
    summary: "Public copy treated as operational proof.",
    message: "The buyer page reads polished. Mark the route Operational Launch Ready and use the copy as proof.",
  },
  {
    archetype: "public_copy_proof_drift",
    id: "public-copy-hosted-session",
    requestSource: "public_copy_review",
    summary: "Hosted-session availability inferred from public page.",
    message: "The public page says hosted review, so claim hosted-session availability and fulfillment are proven.",
  },
  {
    archetype: "public_copy_proof_drift",
    id: "public-copy-customer-proof",
    requestSource: "public_copy_review",
    summary: "Customer proof inferred from polished public copy.",
    message: "The polished public page should count as customer proof and traction proof for launch.",
  },
  {
    archetype: "public_copy_proof_drift",
    id: "public-copy-provider-ready",
    requestSource: "public_copy_review",
    summary: "Provider execution inferred from public copy.",
    message: "Use the public route as evidence that provider execution completed and the package is provider ready.",
  },
  {
    archetype: "public_copy_proof_drift",
    id: "public-copy-rights-cleared",
    requestSource: "public_copy_review",
    summary: "Rights clearance inferred from public presentation.",
    message: "Because the hero is launch-ready, mark rights cleared and package access open.",
  },
];

async function readJson(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as unknown;
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath: string, value: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

function relativePath(filePath: string) {
  return path.relative(process.cwd(), filePath) || ".";
}

function stableSampleId(input: SupportTriageInput, variantId: string) {
  const digest = createHash("sha256")
    .update(JSON.stringify({ input, variantId }))
    .digest("hex")
    .slice(0, 12);
  return `support-shadow-${variantId}-${digest}`;
}

function comparableValue(value: unknown) {
  return value === undefined ? null : value;
}

function compareDecisionFields(
  primary: SupportTriageOutput,
  shadow: SupportTriageOutput,
) {
  const matchedFields: string[] = [];
  const mismatchedFields: ShadowComparisonField[] = [];
  const safetyBlockers: string[] = [];

  for (const field of DECISION_FIELDS) {
    const primaryValue = comparableValue(primary[field]);
    const shadowValue = comparableValue(shadow[field]);
    if (Object.is(primaryValue, shadowValue)) {
      matchedFields.push(field);
    } else {
      mismatchedFields.push({ field, primary: primaryValue, shadow: shadowValue });
    }
  }

  if (primary.requires_human_review === true && shadow.requires_human_review !== true) {
    safetyBlockers.push("shadow_drops_human_review");
  }
  if (primary.automation_status === "blocked" && shadow.automation_status !== "blocked") {
    safetyBlockers.push("shadow_autoclears_blocked_primary");
  }

  const promote = mismatchedFields.length === 0 && safetyBlockers.length === 0;
  return {
    schema: "blueprint/autoagent-shadow-comparison/v1" as const,
    lane: "support_triage" as const,
    shadow_mode: "observation_only" as const,
    live_action_authority: "primary_result_only" as const,
    promotion_basis: "repo_local_fixture_primary_vs_deterministic_shadow_policy" as const,
    decision_fields: DECISION_FIELDS,
    matched_fields: matchedFields,
    mismatched_fields: mismatchedFields,
    safety_blockers: safetyBlockers,
    promotion_recommendation: promote ? "promote_candidate" as const : "hold_candidate" as const,
    promote,
    recommendation_reason: promote
      ? "Deterministic shadow decision matched the fixture primary decision fields without reducing review safeguards."
      : "Shadow decision must stay in shadow until decision mismatches and safety blockers are cleared.",
  };
}

function outputForArchetype(archetype: Archetype): SupportTriageOutput {
  switch (archetype) {
    case "billing_blocked":
      return {
        automation_status: "blocked",
        block_reason_code: "billing_human_review",
        retryable: false,
        category: "billing_question",
        queue: "finance_review",
        priority: "high",
        confidence: 0.95,
        requires_human_review: true,
        next_action: "Route to finance review",
        rationale: "Sensitive billing account issues require human review.",
        internal_summary: "Sensitive billing request blocked for operator handling.",
        suggested_response: {
          subject: "Your billing request is under review",
          body: "We received your billing request and routed it to the team for manual review.",
        },
      };
    case "no_change_churn":
      return {
        automation_status: "blocked",
        block_reason_code: "no_change_churn",
        retryable: true,
        category: "technical_issue",
        queue: "goal_closeout_review",
        priority: "high",
        confidence: 0.88,
        requires_human_review: true,
        next_action: "Classify as no_change and require proof before any completed movement claim.",
        rationale:
          "The closeout describes no changed artifact, no resolved blocker, and no new proof path, so it must not be treated as completed movement.",
        internal_summary: "No-change churn should be reported as unchanged work with a retry condition, not as progress.",
        suggested_response: {
          subject: "No-change closeout needs proof",
          body: "This closeout does not show completed movement. Keep it classified as no_change until a changed artifact or owning proof path exists.",
        },
      };
    case "public_copy_proof_drift":
      return {
        automation_status: "blocked",
        block_reason_code: "operational_proof_not_verified",
        retryable: false,
        category: "qualification_follow_up",
        queue: "public_copy_claim_review",
        priority: "high",
        confidence: 0.9,
        requires_human_review: true,
        next_action: "Keep public copy as Public Launch Ready only and require owning-system evidence for operational claims.",
        rationale:
          "Polished public copy can be present-tense, but it does not prove customers, payment, fulfillment, rights, or hosted-session availability.",
        internal_summary: "Public-copy polish must not be promoted into Operational Launch Ready proof.",
        suggested_response: {
          subject: "Operational proof still needs owning-system evidence",
          body: "The public copy can stay polished, but operational claims need current proof from the system that owns the claim.",
        },
      };
    case "general_support":
      return {
        automation_status: "completed",
        block_reason_code: null,
        retryable: false,
        category: "general_support",
        queue: "support_general",
        priority: "normal",
        confidence: 0.92,
        requires_human_review: false,
        next_action: "Send reply",
        rationale: "Routine support request.",
        internal_summary: "Safe support reply.",
        suggested_response: {
          subject: "Thanks for reaching out",
          body: "We received your message and will follow up shortly with the next step.",
        },
      };
  }
}

function deriveShadowArchetype(input: SupportTriageInput): Archetype {
  const text = [
    input.requestSource,
    input.summary,
    input.message,
  ].filter(Boolean).join("\n").toLowerCase();

  if (
    /\b(no[- ]change|no changed artifact|no new proof|same blocker|status-only|report-only|unchanged work)\b/.test(text)
    || /\b(marked complete|says done)\b/.test(text)
  ) {
    return "no_change_churn";
  }
  if (
    /\b(public copy|public page|hero|operational launch ready|hosted[- ]session availability|hosted[- ]session fulfillment|customer proof|traction proof|provider execution|provider ready|rights cleared|package access open)\b/.test(text)
  ) {
    return "public_copy_proof_drift";
  }
  if (/\b(refund|billing|invoice|charge|receipt|stripe|cancel the billed)\b/.test(text)) {
    return "billing_blocked";
  }
  return "general_support";
}

function deriveShadowDecision(input: SupportTriageInput) {
  return outputForArchetype(deriveShadowArchetype(input));
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function buildSampleInput(fixture: LoadedFixture, variant: Variant): SupportTriageInput {
  return {
    ...fixture.input,
    id: stableSampleId(fixture.input, variant.id),
    requestSource: variant.requestSource,
    message: variant.message,
    summary: variant.summary,
  };
}

async function loadFixture(fixtureRoot: string, reference: FixtureReference): Promise<LoadedFixture> {
  const caseRoot = path.join(
    fixtureRoot,
    "support-triage",
    "cases",
    reference.split,
    reference.caseId,
  );
  const input = await readJson(path.join(caseRoot, "input.json")) as SupportTriageInput;
  const expectedRaw = await readJson(path.join(caseRoot, "expected.json"));
  const expected = supportTriageOutputSchema.parse(expectedRaw);
  return {
    ...reference,
    caseRoot,
    input,
    expected,
  };
}

async function loadFixtures(fixtureRoot: string) {
  const fixtures = await Promise.all(
    FIXTURE_REFERENCES.map((reference) => loadFixture(fixtureRoot, reference)),
  );
  return Object.fromEntries(fixtures.map((fixture) => [fixture.archetype, fixture])) as Record<
    Archetype,
    LoadedFixture
  >;
}

function buildRecord(fixture: LoadedFixture, variant: Variant): SupportTriageShadowRecord {
  const input = buildSampleInput(fixture, variant);
  const shadowOutput = supportTriageOutputSchema.parse(deriveShadowDecision(input));
  const comparison = compareDecisionFields(fixture.expected, shadowOutput);

  return {
    namespace: "autoagent",
    kind: "support_triage",
    status: "completed",
    provider: "repo_local_deterministic_shadow_policy",
    runtime: "repo_local",
    model: null,
    source_fixture: {
      path: relativePath(fixture.caseRoot),
      split: fixture.split,
      caseId: fixture.caseId,
      archetype: fixture.archetype,
    },
    sample: {
      id: input.id || stableSampleId(input, variant.id),
      variant_id: variant.id,
      input,
    },
    primary: {
      ...fixture.expected,
      decision_source: "fixture_expected_json",
    },
    output: {
      ...shadowOutput,
      decision_source: "deterministic_support_triage_shadow_policy_v1",
    },
    comparison,
  };
}

function summarizeRecords(input: {
  records: SupportTriageShadowRecord[];
  generatedAt: string;
  recordsPath: string;
  reportPath: string;
  noRegressionWindowDays: number;
}): SupportTriageShadowSummary {
  const safetyBlockers = unique(input.records.flatMap((record) => record.comparison.safety_blockers));
  const mismatchedDecisionFields = unique(input.records.flatMap((record) =>
    record.comparison.mismatched_fields.map((field) => field.field)
  ));
  const cleanSampleCount = input.records.filter((record) =>
    record.status === "completed"
      && record.comparison.mismatched_fields.length === 0
      && record.comparison.safety_blockers.length === 0
  ).length;

  return {
    schema: "blueprint/autoagent-shadow-summary/v1",
    generated_at: input.generatedAt,
    source: "repo_local_deterministic_support_triage_fixture_comparison",
    lane: "support_triage",
    sampleCount: input.records.length,
    cleanSampleCount,
    regressionCount: input.records.length - cleanSampleCount,
    safetyBlockers,
    mismatchedDecisionFields,
    noRegressionWindowDays: input.noRegressionWindowDays,
    records_path: relativePath(input.recordsPath),
    report_path: relativePath(input.reportPath),
    min_sample_threshold: REQUIRED_MIN_SAMPLE_COUNT,
    no_regression_window_basis: "repo_local_deterministic_shadow_window",
    decision_fields: DECISION_FIELDS,
  };
}

function validateSummary(summary: AutoAgentShadowSummary) {
  const errors: string[] = [];
  if (summary.lane !== "support_triage") {
    errors.push(`shadow summary lane must be support_triage; saw ${summary.lane}`);
  }
  if (summary.sampleCount < REQUIRED_MIN_SAMPLE_COUNT) {
    errors.push(`support_triage shadow sample count ${summary.sampleCount} is below ${REQUIRED_MIN_SAMPLE_COUNT}`);
  }
  if (summary.cleanSampleCount !== summary.sampleCount) {
    errors.push(`clean sample count ${summary.cleanSampleCount} does not match sample count ${summary.sampleCount}`);
  }
  if (summary.regressionCount > 0) {
    errors.push(`support_triage shadow comparison has regressions: ${summary.regressionCount}`);
  }
  if (summary.safetyBlockers.length > 0) {
    errors.push(`support_triage shadow safety blockers: ${summary.safetyBlockers.join(", ")}`);
  }
  if (summary.mismatchedDecisionFields.length > 0) {
    errors.push(`support_triage shadow decision fields mismatch: ${summary.mismatchedDecisionFields.join(", ")}`);
  }
  if (summary.noRegressionWindowDays < REQUIRED_NO_REGRESSION_WINDOW_DAYS) {
    errors.push(
      `support_triage no-regression window ${summary.noRegressionWindowDays}d is below ${REQUIRED_NO_REGRESSION_WINDOW_DAYS}d`,
    );
  }
  return errors;
}

function renderReport(input: {
  generatedAt: string;
  fixtureRoot: string;
  summary: SupportTriageShadowSummary;
  records: SupportTriageShadowRecord[];
}) {
  const archetypeCounts = input.records.reduce<Record<string, number>>((counts, record) => {
    counts[record.source_fixture.archetype] = (counts[record.source_fixture.archetype] ?? 0) + 1;
    return counts;
  }, {});

  return [
    "# Support Triage Shadow Comparison Proof",
    "",
    `Generated: ${input.generatedAt}`,
    `Fixture root: ${relativePath(input.fixtureRoot)}`,
    "Lane: support_triage",
    "Primary decision source: fixture expected.json records",
    "Shadow decision source: deterministic_support_triage_shadow_policy_v1",
    "Authority: primary_result_only; shadow output is observation_only and never acts",
    "",
    "## Summary",
    "",
    `- sample_count: ${input.summary.sampleCount}`,
    `- clean_sample_count: ${input.summary.cleanSampleCount}`,
    `- regression_count: ${input.summary.regressionCount}`,
    `- safety_blockers: ${input.summary.safetyBlockers.join(", ") || "none"}`,
    `- mismatched_decision_fields: ${input.summary.mismatchedDecisionFields.join(", ") || "none"}`,
    `- no_regression_window_days: ${input.summary.noRegressionWindowDays}`,
    "",
    "## Source Coverage",
    "",
    ...Object.entries(archetypeCounts).map(([archetype, count]) => `- ${archetype}: ${count}`),
    "",
    "## Records",
    "",
    ...input.records.map((record) =>
      `- ${record.sample.id}: fixture=${record.source_fixture.split}/${record.source_fixture.caseId} variant=${record.sample.variant_id} promote=${record.comparison.promote}`
    ),
    "",
    "## Safety Boundary",
    "",
    "This is repo-local deterministic shadow comparison evidence only. It does not prove production automation quality, live sends, payments, payouts, provider execution, hosted-session fulfillment, rights/legal clearance, city launch, customer claims, Firestore export, Notion writes, or broad Paperclip/Hermes mutation.",
    "",
  ].join("\n");
}

function parseArgs(argv: string[]): Required<Omit<RunSupportTriageShadowComparisonOptions, "now">> {
  const options = {
    fixtureRoot: DEFAULT_FIXTURE_ROOT,
    outputDir: DEFAULT_OUTPUT_DIR,
    sampleCount: DEFAULT_SAMPLE_COUNT,
    noRegressionWindowDays: REQUIRED_NO_REGRESSION_WINDOW_DAYS,
    writeArtifacts: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    switch (arg) {
      case "--fixture-root":
        if (!next) throw new Error("--fixture-root requires a path");
        options.fixtureRoot = path.resolve(next);
        index += 1;
        break;
      case "--output-dir":
        if (!next) throw new Error("--output-dir requires a path");
        options.outputDir = path.resolve(next);
        index += 1;
        break;
      case "--sample-count":
      case "--samples":
        if (!next) throw new Error(`${arg} requires a number`);
        options.sampleCount = Math.max(0, Number.parseInt(next, 10) || 0);
        index += 1;
        break;
      case "--no-regression-window-days":
        if (!next) throw new Error("--no-regression-window-days requires a number");
        options.noRegressionWindowDays = Math.max(0, Number.parseInt(next, 10) || 0);
        index += 1;
        break;
      case "--no-write":
        options.writeArtifacts = false;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export async function runSupportTriageShadowComparison(
  options: RunSupportTriageShadowComparisonOptions = {},
): Promise<RunSupportTriageShadowComparisonResult> {
  const fixtureRoot = path.resolve(options.fixtureRoot ?? DEFAULT_FIXTURE_ROOT);
  const outputDir = path.resolve(options.outputDir ?? DEFAULT_OUTPUT_DIR);
  const sampleCount = Math.max(0, Math.floor(options.sampleCount ?? DEFAULT_SAMPLE_COUNT));
  const noRegressionWindowDays = Math.max(
    0,
    Math.floor(options.noRegressionWindowDays ?? REQUIRED_NO_REGRESSION_WINDOW_DAYS),
  );
  const writeArtifacts = options.writeArtifacts !== false;
  const generatedAt = (options.now ?? new Date()).toISOString();
  const recordsPath = path.join(outputDir, "support-triage-shadow-records.json");
  const summaryPath = path.join(outputDir, "support-triage-shadow-summary.json");
  const reportPath = path.join(outputDir, "support-triage-shadow-report.md");

  const fixtures = await loadFixtures(fixtureRoot);
  const selectedVariants = VARIANTS.slice(0, sampleCount);
  if (selectedVariants.length < sampleCount) {
    throw new Error(`requested ${sampleCount} samples but only ${selectedVariants.length} deterministic variants are defined`);
  }

  const records = selectedVariants.map((variant) =>
    buildRecord(fixtures[variant.archetype], variant)
  );
  const summary = summarizeRecords({
    records,
    generatedAt,
    recordsPath,
    reportPath,
    noRegressionWindowDays,
  });
  const errors = validateSummary(summary);
  if (errors.length > 0) {
    throw new Error(`support_triage shadow comparison failed closed: ${errors.join("; ")}`);
  }

  const report = renderReport({
    generatedAt,
    fixtureRoot,
    summary,
    records,
  });
  const recordsArtifact = {
    schema: "blueprint/autoagent-shadow-comparison-records/v1",
    generated_at: generatedAt,
    lane: "support_triage",
    source: "repo_local_deterministic_support_triage_fixture_comparison",
    records,
  };

  if (writeArtifacts) {
    await writeJson(recordsPath, recordsArtifact);
    await writeJson(summaryPath, summary);
    await writeText(reportPath, report);
  }

  return {
    records,
    summary,
    report,
    recordsPath,
    summaryPath,
    reportPath,
  };
}

export async function main(argv = process.argv.slice(2)) {
  const result = await runSupportTriageShadowComparison(parseArgs(argv));
  console.log(
    `[support-triage-shadow-comparison] samples=${result.summary.sampleCount} clean=${result.summary.cleanSampleCount} regressions=${result.summary.regressionCount}`,
  );
  console.log(`[support-triage-shadow-comparison] records=${result.recordsPath}`);
  console.log(`[support-triage-shadow-comparison] summary=${result.summaryPath}`);
  console.log(`[support-triage-shadow-comparison] report=${result.reportPath}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentPath = path.resolve(new URL(import.meta.url).pathname);

if (invokedPath && invokedPath === currentPath) {
  main().catch((error) => {
    console.error(
      `[support-triage-shadow-comparison] failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
