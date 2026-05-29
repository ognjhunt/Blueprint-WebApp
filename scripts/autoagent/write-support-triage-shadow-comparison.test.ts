import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { seedCanonicalCases } from "./seed-canonical-cases.ts";
import { runSupportTriageShadowComparison } from "./write-support-triage-shadow-comparison.ts";

const tempRoots: string[] = [];

async function makeTempDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-support-shadow-"));
  tempRoots.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("support triage shadow comparison writer", () => {
  it("writes clean machine-readable support_triage shadow proof from deterministic fixtures", async () => {
    const root = await makeTempDir();
    const fixtureRoot = path.join(root, "tasks");
    const outputDir = path.join(root, "shadow-comparison");
    await seedCanonicalCases({
      lanes: ["support_triage"],
      outputRoot: fixtureRoot,
    });

    const result = await runSupportTriageShadowComparison({
      fixtureRoot,
      outputDir,
      sampleCount: 20,
      noRegressionWindowDays: 14,
      now: new Date("2026-05-29T18:00:00.000Z"),
    });

    expect(result.summary).toMatchObject({
      lane: "support_triage",
      sampleCount: 20,
      cleanSampleCount: 20,
      regressionCount: 0,
      safetyBlockers: [],
      mismatchedDecisionFields: [],
      noRegressionWindowDays: 14,
    });

    const recordsArtifact = JSON.parse(await fs.readFile(result.recordsPath, "utf8"));
    expect(recordsArtifact.records).toHaveLength(20);
    expect(recordsArtifact.records[0].comparison.promote).toBe(true);
    expect(recordsArtifact.records[0].comparison.shadow_mode).toBe("observation_only");
    expect(recordsArtifact.records[0].comparison.live_action_authority).toBe("primary_result_only");

    const report = await fs.readFile(result.reportPath, "utf8");
    expect(report).toContain("Primary decision source: fixture expected.json records");
    expect(report).toContain("This is repo-local deterministic shadow comparison evidence only");
  });

  it("fails closed when the deterministic sample threshold is not satisfied", async () => {
    const root = await makeTempDir();
    const fixtureRoot = path.join(root, "tasks");
    await seedCanonicalCases({
      lanes: ["support_triage"],
      outputRoot: fixtureRoot,
    });

    await expect(runSupportTriageShadowComparison({
      fixtureRoot,
      outputDir: path.join(root, "shadow-comparison"),
      sampleCount: 21,
      noRegressionWindowDays: 14,
    })).rejects.toThrow(/requested 21 samples/);
  });
});
