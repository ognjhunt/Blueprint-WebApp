import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ensureKbReportArtifact } from "./kb-artifacts";

const tempRoots: string[] = [];

async function makeRepoRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kb-artifacts-"));
  tempRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0, tempRoots.length).map(async (root) => {
      await fs.rm(root, { recursive: true, force: true });
    }),
  );
});

describe("ensureKbReportArtifact", () => {
  it("generates a default report artifact under knowledge/reports", async () => {
    const repoRoot = await makeRepoRoot();
    const result = await ensureKbReportArtifact({
      repoRoot,
      defaultCategory: "market-intel",
      title: "Market Intel Daily Digest - 2026-04-07",
      generatedAt: "2026-04-07T12:00:00.000Z",
      owner: "market-intel-agent",
      summary: "Daily market digest.",
      evidence: ["Signal one", "Signal two"],
      recommendedFollowUp: ["Review the highest-signal action."],
      issueId: "issue_123",
    });

    expect(result.generated).toBe(true);
    expect(result.repoRelativePath).toBe(
      "knowledge/reports/market-intel/2026-04-07-market-intel-daily-digest-2026-04-07.md",
    );

    const written = await fs.readFile(path.join(repoRoot, result.repoRelativePath), "utf8");
    expect(written).toContain("## Summary");
    expect(written).toContain("paperclip://issue/issue_123");
  });

  it("fails closed when a missing explicit path is outside knowledge/reports", async () => {
    const repoRoot = await makeRepoRoot();

    await expect(
      ensureKbReportArtifact({
        repoRoot,
        requestedPath: "knowledge/compiled/market-intel/custom-page.md",
        defaultCategory: "market-intel",
        title: "Market Intel Daily Digest - 2026-04-07",
        generatedAt: "2026-04-07T12:00:00.000Z",
        owner: "market-intel-agent",
        summary: "Daily market digest.",
        evidence: ["Signal one"],
        recommendedFollowUp: ["Review the action."],
      }),
    ).rejects.toThrow("Auto-generation only supports knowledge/reports/");
  });
});
