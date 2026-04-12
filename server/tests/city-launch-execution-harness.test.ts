// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsertPaperclipIssue = vi.hoisted(() => vi.fn());
const createPaperclipIssueComment = vi.hoisted(() => vi.fn());
const summarizeCityLaunchLedgers = vi.hoisted(() => vi.fn());
const writeCityLaunchActivation = vi.hoisted(() => vi.fn());
const readCityLaunchActivation = vi.hoisted(() => vi.fn());

vi.mock("../utils/paperclip", () => ({
  upsertPaperclipIssue,
  createPaperclipIssueComment,
}));

vi.mock("../utils/cityLaunchLedgers", () => ({
  summarizeCityLaunchLedgers,
  writeCityLaunchActivation,
  readCityLaunchActivation,
}));

const tempDirs: string[] = [];

beforeEach(() => {
  writeCityLaunchActivation.mockResolvedValue(null);
  readCityLaunchActivation.mockResolvedValue(null);
  createPaperclipIssueComment.mockResolvedValue({ ok: true });
});

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
  vi.clearAllMocks();
});

describe("city launch execution harness", () => {
  it("reuses existing agent lanes for Austin execution", async () => {
    const { buildAustinExecutionTasks } = await import("../utils/cityLaunchExecutionHarness");
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

  it("writes the Austin execution artifacts and dispatches the live issue tree", async () => {
    summarizeCityLaunchLedgers.mockResolvedValue({
      trackedSupplyProspectsContacted: 0,
      trackedBuyerTargetsResearched: 0,
      trackedFirstTouchesSent: 0,
      onboardedCapturers: 0,
      totalRecordedSpendUsd: 0,
      withinPolicySpendUsd: 0,
      outsidePolicySpendUsd: 0,
      wideningGuard: { mode: "single_city_until_proven", wideningAllowed: false, reasons: [] },
      dataSources: [],
    });
    upsertPaperclipIssue
      .mockResolvedValueOnce({
        created: true,
        issue: { id: "root-1", identifier: "BLU-ROOT", status: "todo" },
      })
      .mockImplementation(async (_input: unknown) => ({
        created: true,
        issue: {
          id: `task-${upsertPaperclipIssue.mock.calls.length}`,
          identifier: `BLU-${upsertPaperclipIssue.mock.calls.length}`,
          status: "todo",
        },
      }));

    const reportsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "austin-launch-harness-"),
    );
    tempDirs.push(reportsRoot);

    const { runAustinLaunchExecutionHarness } = await import("../utils/cityLaunchExecutionHarness");
    const result = await runAustinLaunchExecutionHarness({
      reportsRoot,
      founderApproved: true,
      budgetTier: "low_budget",
    });

    expect(result.status).toBe("founder_approved_activation_ready");
    expect(result.paperclip?.rootIssueId).toBe("root-1");
    expect((result.paperclip?.dispatched.length || 0) > 5).toBe(true);
    expect(writeCityLaunchActivation).toHaveBeenCalled();

    const systemDoc = await fs.readFile(result.artifacts.systemDocPath, "utf8");
    const issueBundle = await fs.readFile(result.artifacts.issueBundlePath, "utf8");
    const targetLedger = await fs.readFile(result.artifacts.targetLedgerPath, "utf8");

    expect(systemDoc).toContain("Austin, TX Launch System");
    expect(systemDoc).toContain("Machine-Readable Budget Policy");
    expect(issueBundle).toContain("Austin, TX Launch Issue Bundle");
    expect(targetLedger).toContain("Austin, TX Capture Target Ledger");
  });

  it("supports generic cities beyond the original focus-city list", async () => {
    summarizeCityLaunchLedgers.mockResolvedValue({
      trackedSupplyProspectsContacted: 0,
      trackedBuyerTargetsResearched: 0,
      trackedFirstTouchesSent: 0,
      onboardedCapturers: 0,
      totalRecordedSpendUsd: 0,
      withinPolicySpendUsd: 0,
      outsidePolicySpendUsd: 0,
      wideningGuard: { mode: "single_city_until_proven", wideningAllowed: false, reasons: [] },
      dataSources: [],
    });
    upsertPaperclipIssue.mockResolvedValue({
      created: true,
      issue: { id: "issue-1", identifier: "BLU-1", status: "backlog" },
    });

    const reportsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "generic-city-launch-harness-"),
    );
    tempDirs.push(reportsRoot);

    const { runCityLaunchExecutionHarness } = await import("../utils/cityLaunchExecutionHarness");
    const result = await runCityLaunchExecutionHarness({
      city: "Chicago, IL",
      reportsRoot,
      budgetTier: "funded",
    });

    const systemDoc = await fs.readFile(result.artifacts.systemDocPath, "utf8");
    const targetLedger = await fs.readFile(result.artifacts.targetLedgerPath, "utf8");

    expect(result.citySlug).toBe("chicago-il");
    expect(systemDoc).toContain("Chicago, IL Launch System");
    expect(targetLedger).toContain("Chicago, IL Capture Target Ledger");
    expect(result.paperclip?.rootIssueIdentifier).toBe("BLU-1");
  });
});
