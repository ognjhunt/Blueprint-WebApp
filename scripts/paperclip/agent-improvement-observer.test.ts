import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  analyzeAgentImprovementArtifacts,
  renderAgentImprovementReport,
  writeObserverOutputs,
} from "./agent-improvement-observer.ts";

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
