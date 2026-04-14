// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsertPaperclipIssue = vi.hoisted(() => vi.fn());
const createPaperclipIssueComment = vi.hoisted(() => vi.fn());
const wakePaperclipAgent = vi.hoisted(() => vi.fn());
const summarizeCityLaunchLedgers = vi.hoisted(() => vi.fn());
const writeCityLaunchActivation = vi.hoisted(() => vi.fn());
const readCityLaunchActivation = vi.hoisted(() => vi.fn());
const listCityLaunchChannelAccounts = vi.hoisted(() => vi.fn());
const listCityLaunchSendActions = vi.hoisted(() => vi.fn());
const listCityLaunchBuyerTargets = vi.hoisted(() => vi.fn());
const listCityLaunchProspects = vi.hoisted(() => vi.fn());
const upsertCityLaunchChannelAccount = vi.hoisted(() => vi.fn());
const upsertCityLaunchSendAction = vi.hoisted(() => vi.fn());
const resolveCityLaunchPlanningState = vi.hoisted(() => vi.fn());
const loadAndParseCityLaunchResearchArtifact = vi.hoisted(() => vi.fn());

vi.mock("../utils/paperclip", () => ({
  upsertPaperclipIssue,
  createPaperclipIssueComment,
  wakePaperclipAgent,
}));

vi.mock("../utils/cityLaunchLedgers", () => ({
  summarizeCityLaunchLedgers,
  writeCityLaunchActivation,
  readCityLaunchActivation,
  listCityLaunchChannelAccounts,
  listCityLaunchSendActions,
  listCityLaunchBuyerTargets,
  listCityLaunchProspects,
  upsertCityLaunchChannelAccount,
  upsertCityLaunchSendAction,
}));

vi.mock("../utils/cityLaunchPlanningState", () => ({
  resolveCityLaunchPlanningState,
}));

vi.mock("../utils/cityLaunchResearchParser", async () => {
  const actual = await vi.importActual("../utils/cityLaunchResearchParser");
  return {
    ...actual,
    loadAndParseCityLaunchResearchArtifact,
  };
});

const tempDirs: string[] = [];

beforeEach(() => {
  writeCityLaunchActivation.mockResolvedValue(null);
  readCityLaunchActivation.mockResolvedValue(null);
  createPaperclipIssueComment.mockResolvedValue({ ok: true });
  wakePaperclipAgent.mockResolvedValue({ status: "queued", runId: "run-1" });
  listCityLaunchChannelAccounts.mockResolvedValue([]);
  listCityLaunchSendActions.mockResolvedValue([]);
  listCityLaunchBuyerTargets.mockResolvedValue([]);
  listCityLaunchProspects.mockResolvedValue([]);
  upsertCityLaunchChannelAccount.mockImplementation(async (input: unknown) => ({
    ...(input as Record<string, unknown>),
    citySlug: "mock-city",
    createdAtIso: new Date().toISOString(),
    updatedAtIso: new Date().toISOString(),
  }));
  upsertCityLaunchSendAction.mockImplementation(async (input: unknown) => ({
    ...(input as Record<string, unknown>),
    citySlug: "mock-city",
    createdAtIso: new Date().toISOString(),
    updatedAtIso: new Date().toISOString(),
  }));
  resolveCityLaunchPlanningState.mockImplementation(async ({ city }: { city: string }) => ({
    city,
    citySlug: city.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    status: "not_started",
    reportsRoot: "/tmp/city-launch",
    cityReportsRoot: "/tmp/city-launch/city",
    canonicalPlaybookPath: "/tmp/city-launch/canonical.md",
    runDirectory: null,
    manifestPath: null,
    latestArtifactPath: null,
    completedArtifactPath: null,
    latestRunTimestamp: null,
    warnings: ["No city-launch planning artifacts were found for this city."],
  }));
  loadAndParseCityLaunchResearchArtifact.mockResolvedValue(null);
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
    const owners = new Set(tasks.map((task) => task.ownerLane));
    const keys = new Set(tasks.map((task) => task.key));

    expect(owners.has("growth-lead")).toBe(true);
    expect(owners.has("ops-lead")).toBe(true);
    expect(owners.has("city-launch-agent")).toBe(true);
    expect(owners.has("capturer-growth-agent")).toBe(true);
    expect(owners.has("analytics-agent")).toBe(true);
    expect(owners.has("capturer-success-agent")).toBe(true);
    expect(owners.has("outbound-sales-agent")).toBe(true);
    expect(owners.has("beta-launch-commander")).toBe(true);
    expect(keys.has("city-opening-distribution")).toBe(true);
    expect(keys.has("city-opening-cta-routing")).toBe(true);
    expect(keys.has("city-opening-first-wave-pack")).toBe(true);
    expect(keys.has("city-opening-response-tracking")).toBe(true);
    expect(keys.has("city-opening-reply-conversion")).toBe(true);
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
      recommendedSpendUsd: 0,
      wideningGuard: { mode: "single_city_until_proven", wideningAllowed: false, reasons: [] },
      dataSources: [],
    });
    upsertPaperclipIssue
      .mockResolvedValueOnce({
        created: true,
        companyId: "company-1",
        assigneeAgentId: "agent-growth-lead",
        issue: { id: "root-1", identifier: "BLU-ROOT", status: "todo" },
      })
      .mockImplementation(async (_input: unknown) => ({
        created: true,
        companyId: "company-1",
        assigneeAgentId: `agent-${upsertPaperclipIssue.mock.calls.length}`,
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
    expect(wakePaperclipAgent).toHaveBeenCalled();
    expect(
      result.paperclip?.dispatched.every((entry) => entry.wakeStatus === "queued"),
    ).toBe(true);
    expect(
      result.paperclip?.dispatched.length,
    ).toBeGreaterThan(5);

    const systemDoc = await fs.readFile(result.artifacts.systemDocPath, "utf8");
    const issueBundle = await fs.readFile(result.artifacts.issueBundlePath, "utf8");
    const launchPlaybook = await fs.readFile(result.artifacts.launchPlaybookPath, "utf8");
    const demandPlaybook = await fs.readFile(result.artifacts.demandPlaybookPath, "utf8");
    const targetLedger = await fs.readFile(result.artifacts.targetLedgerPath, "utf8");
    const cityOpeningBrief = await fs.readFile(
      result.artifacts.cityOpeningArtifactPack.run.briefPath,
      "utf8",
    );
    const cityOpeningChannelMap = await fs.readFile(
      result.artifacts.cityOpeningArtifactPack.run.channelMapPath,
      "utf8",
    );
    const cityOpeningFirstWavePack = await fs.readFile(
      result.artifacts.cityOpeningArtifactPack.run.firstWavePackPath,
      "utf8",
    );
    const cityOpeningCtaRouting = await fs.readFile(
      result.artifacts.cityOpeningArtifactPack.run.ctaRoutingPath,
      "utf8",
    );
    const cityOpeningResponseTracking = await fs.readFile(
      result.artifacts.cityOpeningArtifactPack.run.responseTrackingPath,
      "utf8",
    );
    const cityOpeningReplyConversion = await fs.readFile(
      result.artifacts.cityOpeningArtifactPack.run.replyConversionPath,
      "utf8",
    );
    const cityOpeningChannelRegistry = await fs.readFile(
      result.artifacts.cityOpeningArtifactPack.run.channelRegistryPath,
      "utf8",
    );
    const cityOpeningSendLedger = await fs.readFile(
      result.artifacts.cityOpeningArtifactPack.run.sendLedgerPath,
      "utf8",
    );
    const cityOpeningExecutionReport = await fs.readFile(
      result.artifacts.cityOpeningArtifactPack.run.executionReportPath,
      "utf8",
    );

    expect(systemDoc).toContain("Austin, TX Launch System");
    expect(systemDoc).toContain("Machine-Readable Budget Policy");
    expect(systemDoc).toContain("Activation Payload Highlights");
    expect(systemDoc).toContain("city-opening brief, channel map, first-wave outreach/posting pack, CTA / intake path, response-tracking view, reply-conversion cadence lane, channel/account registry, send ledger, and city-opening execution report");
    expect(issueBundle).toContain("Austin, TX Launch Issue Bundle");
    expect(issueBundle).toContain("Build the Austin city-opening distribution brief and channel map");
    expect(issueBundle).toContain("Publish Austin city-opening response tracking");
    expect(issueBundle).toContain("Run the Austin city-opening reply-conversion and follow-up cadence lane");
    expect(launchPlaybook).toContain("Austin, TX — Blueprint City Launch Plan");
    expect(launchPlaybook).toContain("## City-Opening Distribution Layer");
    expect(launchPlaybook).toContain("## Response Signal Standard");
    expect(launchPlaybook).toContain("## Reply Conversion Cadence");
    expect(demandPlaybook).toContain("Austin, TX — Blueprint City Demand Plan");
    expect(targetLedger).toContain("Austin, TX Capture Target Ledger");
    expect(cityOpeningBrief).toContain("Austin, TX City-Opening Brief");
    expect(cityOpeningChannelMap).toContain("Austin, TX City Channel Map");
    expect(cityOpeningFirstWavePack).toContain("Austin, TX City-Opening First-Wave Pack");
    expect(cityOpeningCtaRouting).toContain("Austin, TX City-Opening CTA Routing");
    expect(cityOpeningResponseTracking).toContain("Austin, TX City-Opening Response Tracking");
    expect(cityOpeningReplyConversion).toContain("Austin, TX City-Opening Reply Conversion");
    expect(cityOpeningChannelRegistry).toContain("Austin, TX City-Opening Channel Registry");
    expect(cityOpeningSendLedger).toContain("Austin, TX City-Opening Send Ledger");
    expect(cityOpeningExecutionReport).toContain("Austin, TX City-Opening Execution Report");
  });

  it("re-wakes existing founder-approved city-launch issues on rerun", async () => {
    summarizeCityLaunchLedgers.mockResolvedValue({
      trackedSupplyProspectsContacted: 0,
      trackedBuyerTargetsResearched: 0,
      trackedFirstTouchesSent: 0,
      onboardedCapturers: 0,
      totalRecordedSpendUsd: 0,
      withinPolicySpendUsd: 0,
      outsidePolicySpendUsd: 0,
      recommendedSpendUsd: 0,
      wideningGuard: { mode: "single_city_until_proven", wideningAllowed: false, reasons: [] },
      dataSources: [],
    });
    readCityLaunchActivation.mockResolvedValue({
      city: "Austin, TX",
      citySlug: "austin-tx",
      budgetTier: "zero_budget",
      budgetPolicy: {
        tier: "zero_budget",
        label: "Zero Budget",
        maxTotalApprovedUsd: 0,
        operatorAutoApproveUsd: 0,
        allowPaidAcquisition: false,
        allowReferralRewards: false,
        allowTravelReimbursement: false,
        founderApprovalRequiredAboveUsd: 0,
        founderApprovalTriggers: [],
        operatorLane: "growth-lead",
      },
      founderApproved: true,
      status: "activation_ready",
      rootIssueId: "root-existing",
      taskIssueIds: {
        "city-target-ledger": "task-city-target-ledger",
      },
      machineReadablePolicyVersion: "2026-04-13.city-launch-doctrine.v1",
      wideningGuard: { mode: "single_city_until_proven", wideningAllowed: false, reasons: [] },
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    });
    upsertPaperclipIssue.mockImplementation(async (input: unknown) => {
      const typed = input as {
        existingIssueId?: string | null;
        originId: string;
      };
      const issueId = typed.existingIssueId
        || `task-${typed.originId.replace(/[^a-z0-9]+/gi, "-")}`;
      return {
        created: false,
        companyId: "company-1",
        assigneeAgentId: `agent-${typed.originId}`,
        issue: {
          id: issueId,
          identifier: `BLU-${issueId}`,
          status: "todo",
        },
      };
    });

    const reportsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "existing-city-launch-harness-"),
    );
    tempDirs.push(reportsRoot);

    const { runAustinLaunchExecutionHarness } = await import("../utils/cityLaunchExecutionHarness");
    const result = await runAustinLaunchExecutionHarness({
      reportsRoot,
      founderApproved: true,
      budgetTier: "zero_budget",
    });

    expect(result.paperclip?.createdRootIssue).toBe(false);
    expect(result.paperclip?.dispatched.every((entry) => entry.created === false)).toBe(true);
    expect(result.paperclip?.dispatched.every((entry) => entry.wakeStatus === "queued")).toBe(true);
    expect(wakePaperclipAgent).toHaveBeenCalled();
    expect(wakePaperclipAgent).toHaveBeenCalledWith(expect.objectContaining({
      reason: expect.stringMatching(/^city-launch-activate:austin-tx:city-target-ledger:/),
      idempotencyKey: expect.stringMatching(
        /^city-launch-activate:austin-tx:city-target-ledger:task-city-target-ledger:/,
      ),
    }));
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
      recommendedSpendUsd: 0,
      wideningGuard: { mode: "single_city_until_proven", wideningAllowed: false, reasons: [] },
      dataSources: [],
    });
    upsertPaperclipIssue.mockResolvedValue({
      created: true,
      companyId: "company-1",
      assigneeAgentId: "agent-1",
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
    const launchPlaybook = await fs.readFile(result.artifacts.launchPlaybookPath, "utf8");
    const demandPlaybook = await fs.readFile(result.artifacts.demandPlaybookPath, "utf8");
    const targetLedger = await fs.readFile(result.artifacts.targetLedgerPath, "utf8");

    expect(result.citySlug).toBe("chicago-il");
    expect(systemDoc).toContain("Chicago, IL Launch System");
    expect(launchPlaybook).toContain("Chicago, IL — Blueprint City Launch Plan");
    expect(demandPlaybook).toContain("proof_path_assigned");
    expect(targetLedger).toContain("Chicago, IL Capture Target Ledger");
    expect(targetLedger).toContain("Priority Proof Targets");
    expect(targetLedger).toContain("Queued Lawful-Access Buckets");
    expect(targetLedger).toContain("No research-backed named targets are available yet.");
    expect(result.paperclip?.rootIssueIdentifier).toBe("BLU-1");
    expect(wakePaperclipAgent).not.toHaveBeenCalled();
    expect(result.wideningGuard.reasons.join("\n")).toContain(
      "Required proof-motion analytics contract is missing from the activation payload.",
    );
  });

  it("fails closed on founder-approved activation when the live Paperclip tree is not created or updated", async () => {
    summarizeCityLaunchLedgers.mockResolvedValue({
      trackedSupplyProspectsContacted: 0,
      trackedBuyerTargetsResearched: 0,
      trackedFirstTouchesSent: 0,
      onboardedCapturers: 0,
      totalRecordedSpendUsd: 0,
      withinPolicySpendUsd: 0,
      outsidePolicySpendUsd: 0,
      recommendedSpendUsd: 0,
      wideningGuard: { mode: "single_city_until_proven", wideningAllowed: false, reasons: [] },
      dataSources: [],
    });
    upsertPaperclipIssue.mockRejectedValue(new Error("Paperclip unavailable"));

    const reportsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "founder-approved-fail-closed-"),
    );
    tempDirs.push(reportsRoot);

    const { runCityLaunchExecutionHarness } = await import("../utils/cityLaunchExecutionHarness");

    await expect(
      runCityLaunchExecutionHarness({
        city: "Sacramento, CA",
        reportsRoot,
        founderApproved: true,
        budgetTier: "zero_budget",
      }),
    ).rejects.toThrow(/failed closed/i);
  });
});
