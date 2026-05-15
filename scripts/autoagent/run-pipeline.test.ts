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

    expect(result.totalCases).toBe(6);
    expect(result.totalPassed).toBe(6);
    expect(result.totalFailed).toBe(0);
    expect(result.totalNegativeControls).toBe(6);
    expect(result.totalNegativeControlsBlocked).toBe(6);
    expect(result.laneSummaries.waitlist_triage.totalCases).toBeGreaterThan(0);
    expect(result.laneSummaries.support_triage.totalCases).toBeGreaterThan(0);
    expect(result.laneSummaries.preview_diagnosis.totalCases).toBeGreaterThan(0);
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
    expect(result.localEval.totalCases).toBe(6);
    expect(result.localEval.totalFailed).toBe(0);
    expect(result.localEval.totalNegativeControlsBlocked).toBe(6);
    expect(result.counts.waitlist_triage.dev + result.counts.waitlist_triage.holdout).toBeGreaterThan(0);
    expect(result.counts.support_triage.dev + result.counts.support_triage.holdout).toBeGreaterThan(0);
    expect(result.counts.preview_diagnosis.dev + result.counts.preview_diagnosis.holdout).toBeGreaterThan(0);
  });
});
