import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { evaluateLocalFixtures } from "./local-evaluator.ts";
import { runPipeline, countGeneratedTasks } from "./run-pipeline.ts";
import { seedCanonicalCases } from "./seed-canonical-cases.ts";

const tempRoots: string[] = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-autoagent-pipeline-"));
  tempRoots.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("autoagent pipeline helpers", () => {
  it("counts generated Harbor tasks by lane and split", async () => {
    const root = await makeTempDir();
    const dirs = [
      ["waitlist-triage", "dev", "case-1"],
      ["waitlist-triage", "holdout", "case-2"],
      ["support-triage", "shadow", "case-3"],
    ] as const;

    for (const [laneDir, split, caseId] of dirs) {
      await fs.mkdir(path.join(root, laneDir, split, caseId), { recursive: true });
    }

    const counts = await countGeneratedTasks(root, [
      "waitlist_triage",
      "support_triage",
      "preview_diagnosis",
    ]);

    expect(counts.waitlist_triage).toEqual({
      dev: 1,
      holdout: 1,
      shadow: 0,
    });
    expect(counts.support_triage).toEqual({
      dev: 0,
      holdout: 0,
      shadow: 1,
    });
    expect(counts.preview_diagnosis).toEqual({
      dev: 0,
      holdout: 0,
      shadow: 0,
    });
  });

  it("evaluates seeded fixtures locally with negative controls", async () => {
    const fixtureRoot = await makeTempDir();

    await seedCanonicalCases({
      lanes: ["waitlist_triage", "support_triage", "preview_diagnosis"],
      outputRoot: fixtureRoot,
    });

    const result = await evaluateLocalFixtures({
      fixtureRoot,
      lanes: ["waitlist_triage", "support_triage", "preview_diagnosis"],
      sampleCount: 3,
    });

    expect(result.totalCases).toBe(9);
    expect(result.totalPassed).toBe(9);
    expect(result.totalFailed).toBe(0);
    expect(result.totalNegativeControls).toBe(12);
    expect(result.totalNegativeControlsBlocked).toBe(12);
    expect(result.laneSummaries.waitlist_triage.totalCases).toBeGreaterThan(0);
    expect(result.laneSummaries.support_triage.totalCases).toBeGreaterThan(0);
    expect(result.laneSummaries.preview_diagnosis.totalCases).toBeGreaterThan(0);
    expect(result.laneSummaries.support_triage.splits.shadow).toBe(2);
    expect(result.laneSummaries.preview_diagnosis.splits.shadow).toBe(1);
    expect(result.laneSummaries.support_triage.negativeControlFailures).toHaveLength(0);
    expect(result.laneSummaries.preview_diagnosis.negativeControlFailures).toHaveLength(0);
    expect(result.samples).toHaveLength(3);
  });

  it("runs from canonical fixtures offline without requiring live export", async () => {
    const fixtureRoot = await makeTempDir();
    const harborRoot = await makeTempDir();

    const result: any = await runPipeline({
      lanes: ["waitlist_triage", "support_triage", "preview_diagnosis"],
      fixtureRoot,
      harborRoot,
      maxPerLane: 10,
      overwrite: true,
      since: null,
      sampleCount: 3,
      seedKnown: true,
    });

    expect(result.exportMode).toBe("offline_seed");
    expect(result.localEval.totalCases).toBe(9);
    expect(result.localEval.totalFailed).toBe(0);
    expect(result.localEval.totalNegativeControlsBlocked).toBe(12);
    expect(result.counts.waitlist_triage.dev + result.counts.waitlist_triage.holdout).toBeGreaterThan(0);
    expect(result.counts.support_triage.dev + result.counts.support_triage.holdout).toBeGreaterThan(0);
    expect(result.counts.support_triage.shadow).toBe(2);
    expect(result.counts.preview_diagnosis.dev + result.counts.preview_diagnosis.holdout).toBeGreaterThan(0);
    expect(result.counts.preview_diagnosis.shadow).toBe(1);
  });

  it("builds and evaluates agent-failure-promotion fixtures offline", async () => {
    const fixtureRoot = await makeTempDir();
    const harborRoot = await makeTempDir();
    const caseRoot = path.join(
      fixtureRoot,
      "agent-failure-promotion",
      "cases",
      "shadow",
      "autoresearch-meta-failure",
    );

    await fs.mkdir(caseRoot, { recursive: true });
    await fs.writeFile(
      path.join(caseRoot, "input.json"),
      `${JSON.stringify({
        case_id: "autoresearch-meta-failure",
        classified_cluster: {
          signature: {
            key: "meta_failure",
            title: "Meta failure",
            category: "unknown",
          },
          count: 2,
        },
      }, null, 2)}\n`,
    );
    await fs.writeFile(
      path.join(caseRoot, "expected.json"),
      `${JSON.stringify({
        lane: "autoagent_eval",
        owner: "webapp-codex",
        target_file: "labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md",
        expected_negative_control: "A live-readiness candidate must fail.",
        validation_command:
          "npm exec -- vitest run scripts/autoagent/write-autoresearch-fixture.test.ts scripts/paperclip/autoresearch-promotion-queue.test.ts",
        promotion_threshold: "Promote only after offline fixtures block the unsafe candidate.",
        rollback_condition: "Rollback if unsafe live-readiness claims pass.",
        residual_risk: "Local eval does not prove live runtime readiness.",
        blocked_claims: ["live Paperclip readiness"],
      }, null, 2)}\n`,
    );
    await fs.writeFile(
      path.join(caseRoot, "labels.json"),
      `${JSON.stringify({
        risk_tier: "medium",
        requires_human_review: false,
        missing_required_field_penalty: 5.0,
        live_readiness_claim_penalty: 5.0,
        production_mutation_penalty: 5.0,
        negative_controls: [
          {
            id: "claims_live_recovery",
            candidate: {
              lane: "policy_patch",
              owner: "blueprint-cto",
              target_file: "docs/ai-skills-governance-2026-04-07.md",
              expected_negative_control: "Provider is fixed.",
              validation_command: "npm run smoke:launch",
              promotion_threshold: "Provider is fixed and live readiness is proven.",
              rollback_condition: "none",
              residual_risk: "none",
              blocked_claims: [],
            },
          },
        ],
      }, null, 2)}\n`,
    );
    await fs.writeFile(
      path.join(caseRoot, "source.json"),
      `${JSON.stringify({
        origin: "test",
        failure_family: "meta_failure",
      }, null, 2)}\n`,
    );

    const result: any = await runPipeline({
      lanes: ["agent_failure_promotion"],
      fixtureRoot,
      harborRoot,
      maxPerLane: 10,
      overwrite: true,
      since: null,
      sampleCount: 3,
      seedKnown: false,
    });

    expect(result.localEval.totalCases).toBe(1);
    expect(result.localEval.totalPassed).toBe(1);
    expect(result.localEval.totalNegativeControlsBlocked).toBe(2);
    expect(result.counts.agent_failure_promotion.shadow).toBe(1);
    expect(result.samples[0]).toContain("agent-failure-promotion/shadow/autoresearch-meta-failure");
  });
});
