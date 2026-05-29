import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  analyzeAgentImprovementArtifacts,
  renderAgentImprovementReport,
  writeObserverOutputs,
} from "./agent-improvement-observer.ts";
import {
  AI_FAILURE_FAMILY_CLASSIFICATION_SCHEMA,
  validateAiFailureFamilyClassifications,
} from "./ai-failure-family-classifier.ts";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

async function makeFixtureRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-agent-improvement-observer-"));
  tempRoots.push(root);
  await fs.mkdir(path.join(root, "artifacts", "codex"), { recursive: true });
  await fs.mkdir(path.join(root, "artifacts", "autoagent"), { recursive: true });
  await fs.mkdir(path.join(root, "artifacts", "hosted-session"), { recursive: true });

  await fs.writeFile(
    path.join(root, "artifacts", "codex", "run-1.jsonl"),
    [
      JSON.stringify({
        type: "response_item",
        item: {
          type: "message",
          text: "No execution adapter available: codex_local: Weekly limit exhausted until 2026-05-11T22:34:58.000Z",
        },
      }),
      JSON.stringify({
        type: "response_item",
        item: {
          type: "message",
          text: "ERROR codex_core::tools::router: exec_command failed: Failed to create unified exec process",
        },
      }),
    ].join("\n"),
  );
  await fs.writeFile(
    path.join(root, "artifacts", "codex", "run-2.log"),
    "No execution adapter available: codex_local: usage limit exhausted during a Paperclip goal run.\n",
  );
  await fs.writeFile(
    path.join(root, "artifacts", "autoagent", "no-change.md"),
    "This no-change closeout does not show completed movement because there is no changed artifact and no new proof.\n",
  );
  await fs.writeFile(
    path.join(root, "artifacts", "hosted-session", "proof-gap.json"),
    JSON.stringify({
      failure_reason:
        "Hosted-session proof gap: no entitlement, runtime session, or provider artifact proves hosted-session fulfillment.",
    }),
  );

  return root;
}

describe("recursive agent improvement observer", () => {
  it("accepts strict, evidence-backed AI failure-family classifications", async () => {
    const root = await makeFixtureRoot();
    const evidencePath = path.join(root, "artifacts", "codex", "run-2.log");
    const result = await validateAiFailureFamilyClassifications({
      cwd: root,
      rawJson: {
        failure_families: [
          {
            family_id: "codex_usage_limit_adapter_unavailable",
            title: "Codex usage limit adapter unavailable",
            failure_mode:
              "Codex local adapter repeatedly failed because usage limits were exhausted.",
            evidence_paths: ["artifacts/codex/run-2.log"],
            affected_lane: "support_triage",
            risk_tier: "low",
            suggested_eval_intent:
              "Add a local adapter-capacity negative control before issue execution.",
            suggested_negative_controls: [
              "usage-limit evidence must block execution-ready claims",
            ],
            disallowed_claims: ["Codex issue execution is available"],
            confidence: 0.84,
            reasons: [
              "The evidence names Codex usage-limit exhaustion and adapter unavailability.",
            ],
          },
        ],
      },
    });

    expect(AI_FAILURE_FAMILY_CLASSIFICATION_SCHEMA.required).toEqual([
      "family_id",
      "title",
      "failure_mode",
      "evidence_paths",
      "affected_lane",
      "risk_tier",
      "suggested_eval_intent",
      "suggested_negative_controls",
      "disallowed_claims",
      "confidence",
      "reasons",
    ]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
    expect(result.accepted[0]).toMatchObject({
      family_id: "codex_usage_limit_adapter_unavailable",
      affected_lane: "support_triage",
      risk_tier: "low",
      report_only: false,
    });
    expect(result.accepted[0].resolved_evidence_paths).toEqual([evidencePath]);
  });

  it("rejects missing evidence paths, duplicate family ids, and high-risk AI classifications", async () => {
    const root = await makeFixtureRoot();
    const result = await validateAiFailureFamilyClassifications({
      cwd: root,
      rawJson: {
        failure_families: [
          {
            family_id: "missing_evidence_family",
            title: "Missing evidence family",
            failure_mode:
              "The classifier references evidence that does not exist locally.",
            evidence_paths: ["artifacts/missing/run.log"],
            affected_lane: "support_triage",
            risk_tier: "low",
            suggested_eval_intent:
              "Add a deterministic fixture after local evidence exists.",
            suggested_negative_controls: ["missing evidence must fail validation"],
            disallowed_claims: ["local evidence exists"],
            confidence: 0.71,
            reasons: ["The proposed evidence path is absent from disk."],
          },
          {
            family_id: "payments_policy_bypass",
            title: "Payments policy bypass",
            failure_mode:
              "The classifier tries to promote a payment lane without owner-system proof.",
            evidence_paths: ["artifacts/codex/run-2.log"],
            affected_lane: "payments",
            risk_tier: "permanently_blocked",
            suggested_eval_intent:
              "Promote a payment automation candidate from local artifacts.",
            suggested_negative_controls: ["payment mutation must stay blocked"],
            disallowed_claims: ["payment automation can be promoted"],
            confidence: 0.8,
            reasons: ["The evidence mentions local adapter failure, not payment proof."],
          },
          {
            family_id: "payments_policy_bypass",
            title: "Duplicate payments policy bypass",
            failure_mode:
              "The duplicate family id should be rejected deterministically.",
            evidence_paths: ["artifacts/codex/run-2.log"],
            affected_lane: "payments",
            risk_tier: "permanently_blocked",
            suggested_eval_intent:
              "Promote a duplicate payment automation candidate from local artifacts.",
            suggested_negative_controls: ["duplicates must fail validation"],
            disallowed_claims: ["duplicate classifications are usable"],
            confidence: 0.8,
            reasons: ["The family id repeats a previous AI classification."],
          },
        ],
      },
    });

    expect(result.accepted).toHaveLength(0);
    expect(result.rejected.map((entry) => entry.family_id)).toEqual([
      "missing_evidence_family",
      "payments_policy_bypass",
      "payments_policy_bypass",
    ]);
    expect(result.rejected.flatMap((entry) => entry.reasons).join(" ")).toMatch(
      /evidence path does not exist|high-risk lane cannot be promoted|duplicate family_id/i,
    );
  });

  it("keeps no-change churn report-only unless local evidence shows real movement", async () => {
    const root = await makeFixtureRoot();
    const result = await validateAiFailureFamilyClassifications({
      cwd: root,
      rawJson: {
        failure_families: [
          {
            family_id: "no_change_closeout_churn",
            title: "No-change closeout churn",
            failure_mode:
              "The run claimed completion while producing no changed artifact and no new proof.",
            evidence_paths: ["artifacts/autoagent/no-change.md"],
            affected_lane: "support_triage",
            risk_tier: "low",
            suggested_eval_intent:
              "Report no-change churn without promoting a patch until there is real movement.",
            suggested_negative_controls: [
              "no-change closeout must remain report-only without changed artifacts",
            ],
            disallowed_claims: ["run produced durable movement"],
            confidence: 0.9,
            reasons: ["The evidence explicitly says there is no changed artifact."],
          },
        ],
      },
    });

    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].report_only).toBe(true);
    expect(result.accepted[0].validation_reasons).toContain(
      "no-change churn is report-only without local evidence of real movement",
    );
  });

  it("rejects hosted-session proof inferred from sample/demo/runtime-adjacent text", async () => {
    const root = await makeFixtureRoot();
    await fs.writeFile(
      path.join(root, "artifacts", "hosted-session", "demo-copy.md"),
      "Sample/demo runtime-adjacent copy says a hosted-session proof is available, but there is no entitlement, runtime session artifact, or package manifest.",
      "utf8",
    );

    const result = await validateAiFailureFamilyClassifications({
      cwd: root,
      rawJson: {
        failure_families: [
          {
            family_id: "hosted_session_sample_proof_inference",
            title: "Hosted-session sample proof inference",
            failure_mode:
              "The classifier infers hosted-session fulfillment from sample/demo runtime-adjacent text.",
            evidence_paths: ["artifacts/hosted-session/demo-copy.md"],
            affected_lane: "preview_diagnosis",
            risk_tier: "shadow_only",
            suggested_eval_intent:
              "Use sample demo copy as hosted-session fulfillment proof.",
            suggested_negative_controls: [
              "sample/demo text must not become hosted-session proof",
            ],
            disallowed_claims: ["hosted-session fulfillment completed"],
            confidence: 0.82,
            reasons: ["The evidence is sample/demo runtime-adjacent copy."],
          },
        ],
      },
    });

    expect(result.accepted).toHaveLength(0);
    expect(result.rejected[0].reasons.join(" ")).toMatch(/hosted-session proof/i);
  });

  it("rejects public-copy polish that becomes operational proof", async () => {
    const root = await makeFixtureRoot();
    await fs.writeFile(
      path.join(root, "artifacts", "autoagent", "public-copy.md"),
      "Public-copy polish claims operational launch readiness from a polished buyer page.",
      "utf8",
    );

    const result = await validateAiFailureFamilyClassifications({
      cwd: root,
      rawJson: {
        failure_families: [
          {
            family_id: "public_copy_operational_proof",
            title: "Public copy operational proof",
            failure_mode:
              "Public-copy polish is being converted into operational launch readiness proof.",
            evidence_paths: ["artifacts/autoagent/public-copy.md"],
            affected_lane: "support_triage",
            risk_tier: "low",
            suggested_eval_intent:
              "Treat public copy polish as operational launch readiness proof.",
            suggested_negative_controls: [
              "public-copy polish must not become operational proof",
            ],
            disallowed_claims: ["operational launch readiness"],
            confidence: 0.76,
            reasons: ["The evidence only references polished public copy."],
          },
        ],
      },
    });

    expect(result.accepted).toHaveLength(0);
    expect(result.rejected[0].reasons.join(" ")).toMatch(/public-copy polish/i);
  });

  it("classifies recurring local artifact failures into ranked improvement candidates", async () => {
    const root = await makeFixtureRoot();
    const summary = await analyzeAgentImprovementArtifacts({
      cwd: root,
      inputRoots: ["artifacts"],
      now: new Date("2026-05-28T12:00:00.000Z"),
      top: 5,
    });

    expect(summary.mode).toBe("read_only_local_files");
    expect(summary.scanned_files).toBe(4);
    expect(summary.top_5.length).toBeGreaterThan(0);

    const codexCapacity = summary.improvement_candidates.find(
      (candidate) => candidate.failure_family === "codex_usage_limit_adapter_unavailable",
    );
    expect(codexCapacity).toMatchObject({
      failure_family: "codex_usage_limit_adapter_unavailable",
      recurrence_count: 2,
    });
    expect(codexCapacity?.evidence_paths).toEqual([
      "artifacts/codex/run-1.jsonl:1",
      "artifacts/codex/run-2.log:1",
    ]);
    expect(codexCapacity?.blocked_claims).toContain("Codex issue execution is available");

    const noChange = summary.improvement_candidates.find(
      (candidate) => candidate.failure_family === "no_change_closeout_churn",
    );
    expect(noChange?.recommended_eval_or_policy_change).toContain("negative-control eval");

    const hostedSession = summary.improvement_candidates.find(
      (candidate) => candidate.failure_family === "hosted_session_proof_gap",
    );
    expect(hostedSession?.blocked_claims).toContain("hosted-session fulfillment completed");
  });

  it("writes the markdown report and machine-readable JSON contract", async () => {
    const root = await makeFixtureRoot();
    const summary = await analyzeAgentImprovementArtifacts({
      cwd: root,
      inputRoots: ["artifacts"],
      now: new Date("2026-05-28T12:00:00.000Z"),
    });
    const outputDir = path.join(root, "out");
    const outputs = await writeObserverOutputs({ outputDir, summary });

    const report = await fs.readFile(outputs.reportPath, "utf8");
    const rawJson = await fs.readFile(outputs.jsonPath, "utf8");
    const parsed = JSON.parse(rawJson) as typeof summary;

    expect(report).toContain("# Recursive Agent Improvement Observer");
    expect(report).toContain("Mode: read-only local files");
    expect(report).toContain("codex_usage_limit_adapter_unavailable");
    expect(parsed.improvement_candidates[0]).toEqual(
      expect.objectContaining({
        failure_family: expect.any(String),
        severity: expect.any(String),
        recurrence_count: expect.any(Number),
        evidence_paths: expect.any(Array),
        recommended_eval_or_policy_change: expect.any(String),
        blocked_claims: expect.any(Array),
      }),
    );
  });

  it("renders a no-candidates report without requiring live services", async () => {
    const summary = {
      generated_at: "2026-05-28T12:00:00.000Z",
      analyzer: "blueprint_recursive_agent_improvement_observer" as const,
      mode: "read_only_local_files" as const,
      input_roots: ["artifacts"],
      scanned_files: 0,
      skipped_roots: [],
      improvement_candidates: [],
      top_5: [],
    };

    const report = renderAgentImprovementReport(summary);

    expect(report).toContain("No failure-family candidates were detected");
    expect(report).toContain("does not call Paperclip, Notion, providers, Stripe, Firebase, Render, Slack, Gmail");
  });
});
