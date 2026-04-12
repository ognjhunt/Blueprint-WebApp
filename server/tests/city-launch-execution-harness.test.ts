// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildAustinExecutionTasks,
  runCityLaunchExecutionHarness,
  runAustinLaunchExecutionHarness,
} from "../utils/cityLaunchExecutionHarness";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
});

describe("city launch execution harness", () => {
  it("reuses existing agent lanes for Austin execution", () => {
    const tasks = buildAustinExecutionTasks();
    const owners = new Set(tasks.map((task) => task.owner));

    expect(owners.has("growth-lead")).toBe(true);
    expect(owners.has("ops-lead")).toBe(true);
    expect(owners.has("capturer-growth-agent")).toBe(true);
    expect(owners.has("capturer-success-agent")).toBe(true);
    expect(owners.has("outbound-sales-agent")).toBe(true);
    expect(owners.has("beta-launch-commander")).toBe(true);
    expect([...owners].every((owner) => !owner.includes("austin"))).toBe(true);
  });

  it("writes the Austin execution artifacts in founder-review mode", async () => {
    const reportsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "austin-launch-harness-"),
    );
    tempDirs.push(reportsRoot);

    const result = await runAustinLaunchExecutionHarness({ reportsRoot });

    expect(result.status).toBe("draft_pending_founder_approval");

    const systemDoc = await fs.readFile(result.artifacts.systemDocPath, "utf8");
    const issueBundle = await fs.readFile(result.artifacts.issueBundlePath, "utf8");
    const targetLedger = await fs.readFile(result.artifacts.targetLedgerPath, "utf8");

    expect(systemDoc).toContain("Austin, TX Launch System");
    expect(systemDoc).toContain("Founder Approvals Required Before Activation");
    expect(issueBundle).toContain("Austin, TX Launch Issue Bundle");
    expect(issueBundle).toContain("Maintain the Austin capture target ledger");
    expect(issueBundle).toContain("Build the Austin capturer prospect list and post package");
    expect(targetLedger).toContain("Austin, TX Capture Target Ledger");
    expect(targetLedger).toContain("Immediate Top 25");
    expect(targetLedger).toContain("Long 300-1000 Universe Model");
  });

  it("supports another active focus city without changing the harness shape", async () => {
    const reportsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "sf-launch-harness-"),
    );
    tempDirs.push(reportsRoot);

    const result = await runCityLaunchExecutionHarness({
      city: "San Francisco, CA",
      reportsRoot,
    });

    const systemDoc = await fs.readFile(result.artifacts.systemDocPath, "utf8");
    const targetLedger = await fs.readFile(result.artifacts.targetLedgerPath, "utf8");

    expect(result.citySlug).toBe("san-francisco-ca");
    expect(systemDoc).toContain("San Francisco, CA Launch System");
    expect(targetLedger).toContain("San Francisco, CA Capture Target Ledger");
  });
});
