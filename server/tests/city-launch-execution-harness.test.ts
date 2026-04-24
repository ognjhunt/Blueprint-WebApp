// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsertPaperclipIssue = vi.hoisted(() => vi.fn());
const createPaperclipIssueComment = vi.hoisted(() => vi.fn());
const wakePaperclipAgent = vi.hoisted(() => vi.fn());
const resetPaperclipAgentSession = vi.hoisted(() => vi.fn());
const getPaperclipIssue = vi.hoisted(() => vi.fn());
const summarizeCityLaunchLedgers = vi.hoisted(() => vi.fn());
const writeCityLaunchActivation = vi.hoisted(() => vi.fn());
const readCityLaunchActivation = vi.hoisted(() => vi.fn());
const listCityLaunchChannelAccounts = vi.hoisted(() => vi.fn());
const listCityLaunchSendActions = vi.hoisted(() => vi.fn());
const listCityLaunchReplyConversions = vi.hoisted(() => vi.fn());
const listCityLaunchBuyerTargets = vi.hoisted(() => vi.fn());
const listCityLaunchProspects = vi.hoisted(() => vi.fn());
const upsertCityLaunchChannelAccount = vi.hoisted(() => vi.fn());
const upsertCityLaunchSendAction = vi.hoisted(() => vi.fn());
const resolveCityLaunchPlanningState = vi.hoisted(() => vi.fn());
const loadAndParseCityLaunchResearchArtifact = vi.hoisted(() => vi.fn());
const executeCityLaunchSends = vi.hoisted(() => vi.fn());
const resolveHistoricalRecipientEvidence = vi.hoisted(() => vi.fn());

vi.mock("../utils/paperclip", () => ({
  upsertPaperclipIssue,
  createPaperclipIssueComment,
  wakePaperclipAgent,
  resetPaperclipAgentSession,
  getPaperclipIssue,
}));

vi.mock("../utils/cityLaunchLedgers", () => ({
  summarizeCityLaunchLedgers,
  writeCityLaunchActivation,
  readCityLaunchActivation,
  listCityLaunchChannelAccounts,
  listCityLaunchSendActions,
  listCityLaunchReplyConversions,
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

vi.mock("../utils/cityLaunchRecipientEvidence", () => ({
  resolveHistoricalRecipientEvidence,
}));

vi.mock("../utils/cityLaunchSendExecutor", async () => {
  const actual = await vi.importActual("../utils/cityLaunchSendExecutor");
  return {
    ...actual,
    executeCityLaunchSends,
  };
});

const tempDirs: string[] = [];

function completedPlanningState(city: string, citySlug: string) {
  return {
    city,
    citySlug,
    status: "completed" as const,
    reportsRoot: "/tmp/city-launch",
    cityReportsRoot: `/tmp/city-launch/${citySlug}`,
    canonicalPlaybookPath: `/tmp/city-launch/${citySlug}/canonical.md`,
    runDirectory: `/tmp/city-launch/${citySlug}/run-1`,
    manifestPath: `/tmp/city-launch/${citySlug}/run-1/manifest.json`,
    latestArtifactPath: `/tmp/city-launch/${citySlug}/run-1/99-final-playbook.md`,
    completedArtifactPath: `/tmp/city-launch/${citySlug}/run-1/99-final-playbook.md`,
    latestRunTimestamp: "run-1",
    warnings: [],
  };
}

function activationPayload(city: string, citySlug: string) {
  return {
    schemaVersion: "2026-04-13.city-launch-activation-payload.v1",
    machinePolicyVersion: "2026-04-13.city-launch-doctrine.v1",
    city,
    citySlug,
    cityThesis: "Run one proof-led warehouse wedge.",
    primarySiteLane: "industrial_warehouse" as const,
    primaryWorkflowLane: "dock handoff",
    primaryBuyerProofPath: "exact_site" as const,
    lawfulAccessModes: ["buyer_requested_site" as const],
    preferredLawfulAccessMode: "buyer_requested_site" as const,
    rightsPath: {
      summary: "Private controlled interiors require authorization.",
      privateControlledInteriorsRequireAuthorization: true,
      validationRequired: false,
      sourceUrls: ["https://example.com/rights"],
    },
    validationBlockers: [],
    requiredApprovals: [{ lane: "founder" as const, reason: "go/no-go" }],
    ownerLanes: ["city-launch-agent", "capturer-growth-agent", "analytics-agent"],
    issueSeeds: [],
    metricsDependencies: [
      { key: "robot_team_inbound_captured" as const, kind: "event" as const, status: "required_tracked" as const, ownerLane: "analytics-agent" as const, notes: null },
      { key: "proof_path_assigned" as const, kind: "event" as const, status: "required_tracked" as const, ownerLane: "analytics-agent" as const, notes: null },
      { key: "proof_pack_delivered" as const, kind: "event" as const, status: "required_tracked" as const, ownerLane: "analytics-agent" as const, notes: null },
      { key: "hosted_review_ready" as const, kind: "event" as const, status: "required_tracked" as const, ownerLane: "analytics-agent" as const, notes: null },
      { key: "hosted_review_started" as const, kind: "event" as const, status: "required_tracked" as const, ownerLane: "analytics-agent" as const, notes: null },
      { key: "hosted_review_follow_up_sent" as const, kind: "event" as const, status: "required_tracked" as const, ownerLane: "analytics-agent" as const, notes: null },
      { key: "human_commercial_handoff_started" as const, kind: "event" as const, status: "required_tracked" as const, ownerLane: "analytics-agent" as const, notes: null },
      { key: "proof_motion_stalled" as const, kind: "event" as const, status: "required_tracked" as const, ownerLane: "analytics-agent" as const, notes: null },
    ],
    namedClaims: [],
  };
}

beforeEach(() => {
  upsertPaperclipIssue.mockReset();
  createPaperclipIssueComment.mockReset();
  wakePaperclipAgent.mockReset();
  resetPaperclipAgentSession.mockReset();
  getPaperclipIssue.mockReset();
  summarizeCityLaunchLedgers.mockReset();
  writeCityLaunchActivation.mockReset();
  readCityLaunchActivation.mockReset();
  listCityLaunchChannelAccounts.mockReset();
  listCityLaunchSendActions.mockReset();
  listCityLaunchReplyConversions.mockReset();
  listCityLaunchBuyerTargets.mockReset();
  listCityLaunchProspects.mockReset();
  upsertCityLaunchChannelAccount.mockReset();
  upsertCityLaunchSendAction.mockReset();
  resolveCityLaunchPlanningState.mockReset();
  loadAndParseCityLaunchResearchArtifact.mockReset();
  executeCityLaunchSends.mockReset();
  resolveHistoricalRecipientEvidence.mockReset();
  vi.stubEnv("SENDGRID_API_KEY", "sg-key");
  vi.stubEnv("SENDGRID_FROM_EMAIL", "launches@tryblueprint.io");
  vi.stubEnv("BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION", "verified");
  writeCityLaunchActivation.mockResolvedValue(null);
  readCityLaunchActivation.mockResolvedValue(null);
  createPaperclipIssueComment.mockResolvedValue({ ok: true });
  wakePaperclipAgent.mockResolvedValue({ status: "queued", runId: "run-1" });
  resetPaperclipAgentSession.mockResolvedValue({ ok: true });
  getPaperclipIssue.mockImplementation(async (issueId: string) => ({
    id: issueId,
    status: "todo",
  }));
  listCityLaunchChannelAccounts.mockResolvedValue([]);
  listCityLaunchSendActions.mockResolvedValue([]);
  listCityLaunchReplyConversions.mockResolvedValue([]);
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
  resolveHistoricalRecipientEvidence.mockResolvedValue(new Map());
  executeCityLaunchSends.mockResolvedValue({
    city: "mock-city",
    totalEligible: 0,
    sent: 0,
    skippedApproval: 0,
    skippedNoRecipient: 0,
    skippedAlreadySent: 0,
    failed: 0,
    errors: [],
  });
});

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) =>
      fs.rm(dir, { recursive: true, force: true }),
    ),
  );
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("city launch execution harness", () => {
  it("rejects founder-approved activation when planning is incomplete", async () => {
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
    resolveCityLaunchPlanningState.mockResolvedValue({
      city: "San Jose, CA",
      citySlug: "san-jose-ca",
      status: "in_progress",
      reportsRoot: "/tmp/city-launch",
      cityReportsRoot: "/tmp/city-launch/san-jose-ca",
      canonicalPlaybookPath: "/tmp/city-launch/san-jose-ca/canonical.md",
      runDirectory: "/tmp/city-launch/san-jose-ca/run-1",
      manifestPath: "/tmp/city-launch/san-jose-ca/run-1/manifest.json",
      latestArtifactPath: "/tmp/city-launch/san-jose-ca/run-1/01-initial-research.md",
      completedArtifactPath: null,
      latestRunTimestamp: "run-1",
      warnings: ["City-launch planning has partial artifacts but no final playbook yet."],
    });

    const reportsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "incomplete-city-launch-harness-"),
    );
    tempDirs.push(reportsRoot);

    const { runCityLaunchExecutionHarness } = await import("../utils/cityLaunchExecutionHarness");

    await expect(
      runCityLaunchExecutionHarness({
        city: "San Jose, CA",
        reportsRoot,
        founderApproved: true,
        budgetTier: "zero_budget",
      }),
    ).rejects.toThrow(/completed deep-research/i);
  });

  it("rejects founder-approved activation when the completed playbook lacks an activation payload", async () => {
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
    resolveCityLaunchPlanningState.mockResolvedValue({
      city: "Chicago, IL",
      citySlug: "chicago-il",
      status: "completed",
      reportsRoot: "/tmp/city-launch",
      cityReportsRoot: "/tmp/city-launch/chicago-il",
      canonicalPlaybookPath: "/tmp/city-launch/chicago-il/canonical.md",
      runDirectory: "/tmp/city-launch/chicago-il/run-1",
      manifestPath: "/tmp/city-launch/chicago-il/run-1/manifest.json",
      latestArtifactPath: "/tmp/city-launch/chicago-il/run-1/99-final-playbook.md",
      completedArtifactPath: "/tmp/city-launch/chicago-il/run-1/99-final-playbook.md",
      latestRunTimestamp: "run-1",
      warnings: [],
    });
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      city: "Chicago, IL",
      citySlug: "chicago-il",
      artifactPath: "/tmp/chicago-playbook.md",
      schemaVersion: "2026-04-12.city-launch-research.v1",
      generatedAtIso: "2026-04-17T00:00:00.000Z",
      warnings: [],
      errors: [],
      activationPayload: null,
      captureCandidates: [],
      buyerTargets: [],
      firstTouches: [],
      budgetRecommendations: [],
    });

    const reportsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "missing-activation-payload-harness-"),
    );
    tempDirs.push(reportsRoot);

    const { runCityLaunchExecutionHarness } = await import("../utils/cityLaunchExecutionHarness");

    await expect(
      runCityLaunchExecutionHarness({
        city: "Chicago, IL",
        reportsRoot,
        founderApproved: true,
        budgetTier: "zero_budget",
      }),
    ).rejects.toThrow(/activation payload/i);
  });

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
    resolveCityLaunchPlanningState.mockResolvedValue(
      completedPlanningState("Austin, TX", "austin-tx"),
    );
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      city: "Austin, TX",
      citySlug: "austin-tx",
      artifactPath: "/tmp/austin-playbook.md",
      schemaVersion: "2026-04-12.city-launch-research.v1",
      generatedAtIso: "2026-04-17T00:00:00.000Z",
      warnings: [],
      errors: [],
      activationPayload: activationPayload("Austin, TX", "austin-tx"),
      captureCandidates: [
        {
          stableKey: "prospect_austin-tx_capture_ops",
          name: "Austin Capture Ops",
          sourceBucket: "industrial_warehouse",
          channel: "professional_outreach",
          status: "qualified",
          siteAddress: "100 Industrial Way",
          locationSummary: null,
          lat: null,
          lng: null,
          siteCategory: "warehouse",
          workflowFit: "dock handoff",
          priorityNote: null,
          contactEmail: "ops@austincapture.example.com",
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/austin-playbook.md",
            sourceKey: "capture_location_candidates[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
      ],
      buyerTargets: [],
      firstTouches: [],
      budgetRecommendations: [],
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
    resolveCityLaunchPlanningState.mockResolvedValue(
      completedPlanningState("Austin, TX", "austin-tx"),
    );
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      city: "Austin, TX",
      citySlug: "austin-tx",
      artifactPath: "/tmp/austin-playbook.md",
      schemaVersion: "2026-04-12.city-launch-research.v1",
      generatedAtIso: "2026-04-17T00:00:00.000Z",
      warnings: [],
      errors: [],
      activationPayload: activationPayload("Austin, TX", "austin-tx"),
      captureCandidates: [
        {
          stableKey: "prospect_austin-tx_capture_ops",
          name: "Austin Capture Ops",
          sourceBucket: "industrial_warehouse",
          channel: "professional_outreach",
          status: "qualified",
          siteAddress: "100 Industrial Way",
          locationSummary: null,
          lat: null,
          lng: null,
          siteCategory: "warehouse",
          workflowFit: "dock handoff",
          priorityNote: null,
          contactEmail: "ops@austincapture.example.com",
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/austin-playbook.md",
            sourceKey: "capture_location_candidates[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
      ],
      buyerTargets: [],
      firstTouches: [],
      budgetRecommendations: [],
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
    expect(resetPaperclipAgentSession).toHaveBeenCalled();
    expect(wakePaperclipAgent).toHaveBeenCalled();
    expect(wakePaperclipAgent).toHaveBeenCalledWith(expect.objectContaining({
      reason: expect.stringMatching(/^city-launch-activate:austin-tx:city-target-ledger:/),
      idempotencyKey: expect.stringMatching(
        /^city-launch-activate:austin-tx:city-target-ledger:task-city-target-ledger:/,
      ),
    }));
  });

  it("renders founder approvals as a blocker packet artifact instead of a checklist", async () => {
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
    resolveCityLaunchPlanningState.mockResolvedValue(
      completedPlanningState("Austin, TX", "austin-tx"),
    );
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      city: "Austin, TX",
      citySlug: "austin-tx",
      artifactPath: "/tmp/austin-playbook.md",
      schemaVersion: "2026-04-12.city-launch-research.v1",
      generatedAtIso: "2026-04-17T00:00:00.000Z",
      warnings: [],
      errors: [],
      activationPayload: activationPayload("Austin, TX", "austin-tx"),
      captureCandidates: [],
      buyerTargets: [
        {
          stableKey: "buyer-austin-1",
          companyName: "Austin Robotics",
          workflowFit: "dock handoff",
          proofPath: "exact_site",
          sourceBucket: "buyer_requests",
          status: "qualified",
          contactName: null,
          contactEmail: "alex@austinrobotics.example.com",
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/austin-playbook.md",
            sourceKey: "buyer_targets[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
      ],
      firstTouches: [],
      budgetRecommendations: [],
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
      path.join(os.tmpdir(), "approval-packet-city-launch-harness-"),
    );
    tempDirs.push(reportsRoot);

    const { runAustinLaunchExecutionHarness } = await import("../utils/cityLaunchExecutionHarness");
    const result = await runAustinLaunchExecutionHarness({
      reportsRoot,
      founderApproved: true,
      budgetTier: "zero_budget",
    });

    const approvalsArtifact = await fs.readFile(result.artifacts.approvalsPath, "utf8");
    expect(approvalsArtifact).toContain("Correlation");
    expect(approvalsArtifact).toContain("Blocker id: city-launch-approval-austin-tx");
    expect(approvalsArtifact).toContain("Recommended Answer");
    expect(approvalsArtifact).toContain("What I Need From You");
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
    resolveCityLaunchPlanningState.mockResolvedValue(
      completedPlanningState("Chicago, IL", "chicago-il"),
    );
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      city: "Chicago, IL",
      citySlug: "chicago-il",
      artifactPath: "/tmp/chicago-playbook.md",
      schemaVersion: "2026-04-12.city-launch-research.v1",
      generatedAtIso: "2026-04-17T00:00:00.000Z",
      warnings: [],
      errors: [],
      activationPayload: activationPayload("Chicago, IL", "chicago-il"),
      captureCandidates: [],
      buyerTargets: [
        {
          stableKey: "buyer-chicago-1",
          companyName: "Chicago Robotics",
          workflowFit: "dock handoff",
          proofPath: "exact_site",
          sourceBucket: "buyer_requests",
          status: "researched",
          contactName: null,
          contactEmail: "ops@chicagorobotics.example.com",
          notes: null,
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/chicago-playbook.md",
            sourceKey: "buyer_targets[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
      ],
      firstTouches: [],
      budgetRecommendations: [],
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
    expect(result.paperclip?.rootIssueIdentifier).toBe("BLU-1");
    expect(wakePaperclipAgent).toHaveBeenCalled();
    expect(result.wideningGuard.reasons.join("\n")).toContain("proof_path_assigned is required_tracked.");
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
    resolveCityLaunchPlanningState.mockResolvedValue(
      completedPlanningState("Sacramento, CA", "sacramento-ca"),
    );
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      city: "Sacramento, CA",
      citySlug: "sacramento-ca",
      artifactPath: "/tmp/sacramento-playbook.md",
      schemaVersion: "2026-04-12.city-launch-research.v1",
      generatedAtIso: "2026-04-17T00:00:00.000Z",
      warnings: [],
      errors: [],
      activationPayload: activationPayload("Sacramento, CA", "sacramento-ca"),
      captureCandidates: [
        {
          stableKey: "prospect_sacramento-ca_capture_ops",
          name: "Sacramento Capture Ops",
          sourceBucket: "industrial_warehouse",
          channel: "professional_outreach",
          status: "qualified",
          siteAddress: "100 Industrial Way",
          locationSummary: null,
          lat: null,
          lng: null,
          siteCategory: "warehouse",
          workflowFit: "dock handoff",
          priorityNote: null,
          contactEmail: "ops@saccapture.example.com",
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/sacramento-playbook.md",
            sourceKey: "capture_location_candidates[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
      ],
      buyerTargets: [],
      firstTouches: [],
      budgetRecommendations: [],
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

  it("writes a step-level manifest and error artifact when founder-approved activation crashes mid-run", async () => {
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
    resolveCityLaunchPlanningState.mockResolvedValue({
      city: "Sacramento, CA",
      citySlug: "sacramento-ca",
      status: "completed",
      reportsRoot: "/tmp/city-launch",
      cityReportsRoot: "/tmp/city-launch/sacramento-ca",
      canonicalPlaybookPath: "/tmp/city-launch/sacramento-ca/canonical.md",
      runDirectory: "/tmp/city-launch/sacramento-ca/run-1",
      manifestPath: "/tmp/city-launch/sacramento-ca/run-1/manifest.json",
      latestArtifactPath: "/tmp/city-launch/sacramento-ca/run-1/99-final-playbook.md",
      completedArtifactPath: "/tmp/city-launch/sacramento-ca/run-1/99-final-playbook.md",
      latestRunTimestamp: "run-1",
      warnings: [],
    });
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      city: "Sacramento, CA",
      citySlug: "sacramento-ca",
      artifactPath: "/tmp/sacramento-playbook.md",
      schemaVersion: "2026-04-12.city-launch-research.v1",
      generatedAtIso: "2026-04-17T00:00:00.000Z",
      warnings: [],
      errors: [],
      activationPayload: activationPayload("Sacramento, CA", "sacramento-ca"),
      captureCandidates: [
        {
          stableKey: "prospect_sacramento-ca_capture_ops",
          name: "Sacramento Capture Ops",
          sourceBucket: "industrial_warehouse",
          channel: "professional_outreach",
          status: "qualified",
          siteAddress: "100 Industrial Way",
          locationSummary: null,
          lat: null,
          lng: null,
          siteCategory: "warehouse",
          workflowFit: "dock handoff",
          priorityNote: null,
          contactEmail: "ops@saccapture.example.com",
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/sacramento-playbook.md",
            sourceKey: "capture_location_candidates[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
      ],
      buyerTargets: [],
      firstTouches: [],
      budgetRecommendations: [],
    });
    upsertPaperclipIssue.mockRejectedValue(new Error("Paperclip unavailable"));

    const reportsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "city-launch-step-error-"),
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

    const cityDir = path.join(reportsRoot, "sacramento-ca");
    const runDirs = await fs.readdir(cityDir);
    expect(runDirs.length).toBe(1);

    const runDirectory = path.join(cityDir, runDirs[0]);
    await expect(fs.readFile(path.join(runDirectory, "manifest.json"), "utf8")).resolves.toContain(
      "\"currentStep\"",
    );
    await expect(fs.readFile(path.join(runDirectory, "step-error.json"), "utf8")).resolves.toContain(
      "Paperclip unavailable",
    );
  });

  it("auto-approves and auto-dispatches recipient-backed city-opening sends while excluding manual community posts", async () => {
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
    resolveCityLaunchPlanningState.mockResolvedValue({
      ...completedPlanningState("Chicago, IL", "chicago-il"),
    });
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      city: "Chicago, IL",
      citySlug: "chicago-il",
      artifactPath: "/tmp/chicago-playbook.md",
      schemaVersion: "2026-04-12.city-launch-research.v1",
      generatedAtIso: "2026-04-17T00:00:00.000Z",
      warnings: [],
      errors: [],
      activationPayload: activationPayload("Chicago, IL", "chicago-il"),
      captureCandidates: [
        {
          stableKey: "prospect_chicago-il-pro-capturer",
          name: "Chicago Survey Ops",
          sourceBucket: "industrial_warehouse",
          channel: "professional_outreach",
          status: "qualified",
          siteAddress: "100 Industrial Way",
          locationSummary: null,
          lat: null,
          lng: null,
          siteCategory: "warehouse",
          workflowFit: "dock handoff",
          priorityNote: null,
          contactEmail: "field@chicagosurveyops.com",
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/chicago-playbook.md",
            sourceKey: "capture_location_candidates[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
      ],
      buyerTargets: [
        {
          stableKey: "buyer_target_chicago-il-midwest-robotics",
          companyName: "Midwest Robotics",
          contactName: "Alex Buyer",
          contactEmail: "alex@midwestrobotics.com",
          status: "researched",
          workflowFit: "warehouse autonomy",
          proofPath: "exact_site",
          notes: "Strong exact-site fit.",
          sourceBucket: "warehouse_robotics",
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/chicago-playbook.md",
            sourceKey: "buyer_target_candidates[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
        {
          stableKey: "buyer_target_chicago-il-lakeshore-amr",
          companyName: "Lakeshore AMR",
          contactName: "Jordan Ops",
          contactEmail: "jordan@lakeshoreamr.com",
          status: "researched",
          workflowFit: "warehouse autonomy",
          proofPath: "exact_site",
          notes: "Buyer-linked thread.",
          sourceBucket: "warehouse_robotics",
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/chicago-playbook.md",
            sourceKey: "buyer_target_candidates[1]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
      ],
      firstTouches: [],
      budgetRecommendations: [],
    });
    executeCityLaunchSends.mockResolvedValue({
      city: "Chicago, IL",
      totalEligible: 3,
      sent: 2,
      skippedApproval: 0,
      skippedNoRecipient: 0,
      skippedAlreadySent: 0,
      failed: 0,
      errors: [],
    });

    const reportsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "auto-send-city-launch-harness-"),
    );
    tempDirs.push(reportsRoot);

    const { runCityLaunchExecutionHarness } = await import("../utils/cityLaunchExecutionHarness");
    const result = await runCityLaunchExecutionHarness({
      city: "Chicago, IL",
      reportsRoot,
      founderApproved: true,
      budgetTier: "low_budget",
    });

    expect(
      upsertCityLaunchSendAction.mock.calls.map((call) => (call[0] as { approvalState?: string }).approvalState),
    ).toContain("approved");
    expect(
      upsertCityLaunchSendAction.mock.calls.some(
        (call) => (call[0] as { recipientEmail?: string | null }).recipientEmail === "alex@midwestrobotics.com",
      ),
    ).toBe(true);
    expect(
      upsertCityLaunchSendAction.mock.calls.some(
        (call) => (call[0] as { recipientEmail?: string | null }).recipientEmail === "jordan@lakeshoreamr.com",
      ),
    ).toBe(true);
    expect(
      upsertCityLaunchSendAction.mock.calls.some(
        (call) => (call[0] as { recipientEmail?: string | null }).recipientEmail === "field@chicagosurveyops.com",
      ),
    ).toBe(true);
    expect(
      upsertCityLaunchSendAction.mock.calls.some(
        (call) => (call[0] as { actionType?: string }).actionType === "community_post",
      ),
    ).toBe(false);
    expect(executeCityLaunchSends).toHaveBeenCalledWith({
      city: "Chicago, IL",
    });

    expect(result.sendExecution).toMatchObject({
      city: "Chicago, IL",
      totalEligible: 3,
      sent: 2,
    });
  });

  it("auto-enriches raw playbooks with historical recipient evidence before activation sends", async () => {
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
    resolveCityLaunchPlanningState.mockResolvedValue({
      city: "Sacramento, CA",
      citySlug: "sacramento-ca",
      status: "completed",
      reportsRoot: "/tmp/city-launch",
      cityReportsRoot: "/tmp/city-launch/sacramento-ca",
      canonicalPlaybookPath: "/tmp/city-launch/sacramento-ca/canonical.md",
      runDirectory: "/tmp/city-launch/sacramento-ca/run-1",
      manifestPath: "/tmp/city-launch/sacramento-ca/run-1/manifest.json",
      latestArtifactPath: "/tmp/city-launch/sacramento-ca/run-1/99-final-playbook.md",
      completedArtifactPath: "/tmp/city-launch/sacramento-ca/run-1/99-final-playbook.md",
      latestRunTimestamp: "run-1",
      warnings: [],
    });
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      city: "Sacramento, CA",
      citySlug: "sacramento-ca",
      artifactPath: "/tmp/sacramento-playbook.md",
      schemaVersion: "2026-04-12.city-launch-research.v1",
      generatedAtIso: "2026-04-17T00:00:00.000Z",
      warnings: [],
      errors: [],
      activationPayload: {
        schemaVersion: "2026-04-13.city-launch-activation-payload.v1",
        machinePolicyVersion: "2026-04-13.city-launch-doctrine.v1",
        city: "Sacramento, CA",
        citySlug: "sacramento-ca",
        cityThesis: "Run one proof-led warehouse wedge.",
        primarySiteLane: "industrial_warehouse",
        primaryWorkflowLane: "dock handoff",
        primaryBuyerProofPath: "exact_site",
        lawfulAccessModes: ["buyer_requested_site"],
        preferredLawfulAccessMode: "buyer_requested_site",
        rightsPath: {
          summary: "Private controlled interiors require authorization.",
          privateControlledInteriorsRequireAuthorization: true,
          validationRequired: false,
          sourceUrls: ["https://example.com/rights"],
        },
        validationBlockers: [],
        requiredApprovals: [{ lane: "founder", reason: "go/no-go" }],
        ownerLanes: ["city-launch-agent", "capturer-growth-agent", "analytics-agent"],
        issueSeeds: [
          {
            key: "city-opening-first-wave-pack",
            title: "Assemble first-wave pack",
            phase: "supply",
            ownerLane: "capturer-growth-agent",
            humanLane: "growth-lead",
            summary: "Prepare first-wave outreach and posting assets.",
            dependencyKeys: [],
            successCriteria: ["First-wave pack is ready."],
            metricsDependencies: ["first_lawful_access_path"],
            validationRequired: false,
          },
        ],
        metricsDependencies: [
          { key: "robot_team_inbound_captured", kind: "event", status: "required_tracked", ownerLane: "analytics-agent", notes: null },
          { key: "proof_path_assigned", kind: "event", status: "required_tracked", ownerLane: "analytics-agent", notes: null },
          { key: "proof_pack_delivered", kind: "event", status: "required_tracked", ownerLane: "analytics-agent", notes: null },
          { key: "hosted_review_ready", kind: "event", status: "required_tracked", ownerLane: "analytics-agent", notes: null },
          { key: "hosted_review_started", kind: "event", status: "required_tracked", ownerLane: "analytics-agent", notes: null },
          { key: "hosted_review_follow_up_sent", kind: "event", status: "required_tracked", ownerLane: "analytics-agent", notes: null },
          { key: "human_commercial_handoff_started", kind: "event", status: "required_tracked", ownerLane: "analytics-agent", notes: null },
          { key: "proof_motion_stalled", kind: "event", status: "required_tracked", ownerLane: "analytics-agent", notes: null },
        ],
        namedClaims: [
          {
            subject: "Capital Robotics",
            claimType: "company",
            claim: "Capital Robotics is a named buyer target.",
            validationRequired: false,
            sourceUrls: ["https://example.com/buyer"],
          },
        ],
      },
      captureCandidates: [
        {
          stableKey: "prospect_sacramento-ca-northgate-logistics",
          name: "Northgate Logistics",
          sourceBucket: "industrial_warehouse",
          channel: "professional_outreach",
          status: "qualified",
          siteAddress: "100 Industrial Way",
          locationSummary: null,
          lat: null,
          lng: null,
          siteCategory: "warehouse",
          workflowFit: "dock handoff",
          priorityNote: null,
          contactEmail: null,
          sourceUrls: [],
          explicitFields: ["name"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/sacramento-playbook.md",
            sourceKey: "capture_location_candidates[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["name"],
            inferredFields: [],
          },
        },
      ],
      buyerTargets: [
        {
          stableKey: "buyer_target_sacramento-ca-capital-robotics",
          companyName: "Capital Robotics",
          contactName: "Taylor Buyer",
          contactEmail: null,
          status: "researched",
          workflowFit: "warehouse autonomy",
          proofPath: "exact_site",
          notes: "Named buyer but no direct contact yet.",
          sourceBucket: "warehouse_robotics",
          sourceUrls: [],
          explicitFields: ["company_name"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/sacramento-playbook.md",
            sourceKey: "buyer_target_candidates[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["company_name"],
            inferredFields: [],
          },
        },
      ],
      firstTouches: [],
      budgetRecommendations: [],
    });
    resolveHistoricalRecipientEvidence.mockResolvedValue(
      new Map([
        [
          "capitalrobotics",
          {
            recipientEmail: "taylor@capitalrobotics.com",
            source: "Recipient sourced from real growth campaign delivery evidence for Capital Robotics.",
          },
        ],
        [
          "northgatelogistics",
          {
            recipientEmail: "ops@northgatelogistics.com",
            source: "Recipient sourced from real growth campaign delivery evidence for Northgate Logistics.",
          },
        ],
      ]),
    );
    listCityLaunchSendActions.mockImplementation(async () =>
      upsertCityLaunchSendAction.mock.calls.map((call) => ({
        ...(call[0] as Record<string, unknown>),
        citySlug: "sacramento-ca",
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString(),
      })),
    );
    listCityLaunchChannelAccounts.mockImplementation(async () =>
      upsertCityLaunchChannelAccount.mock.calls.map((call) => ({
        ...(call[0] as Record<string, unknown>),
        citySlug: "sacramento-ca",
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString(),
      })),
    );
    executeCityLaunchSends.mockResolvedValue({
      city: "Sacramento, CA",
      totalEligible: 2,
      sent: 2,
      skippedApproval: 0,
      skippedNoRecipient: 0,
      skippedAlreadySent: 0,
      failed: 0,
      errors: [],
    });

    const reportsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "enriched-outbound-city-launch-harness-"),
    );
    tempDirs.push(reportsRoot);

    const { runCityLaunchExecutionHarness } = await import("../utils/cityLaunchExecutionHarness");
    const result = await runCityLaunchExecutionHarness({
      city: "Sacramento, CA",
      reportsRoot,
      founderApproved: true,
      budgetTier: "low_budget",
    });

    expect(result.outboundReadiness?.status).toBe("ready");
    expect(
      upsertCityLaunchSendAction.mock.calls.some(
        (call) => (call[0] as { recipientEmail?: string | null }).recipientEmail === "taylor@capitalrobotics.com",
      ),
    ).toBe(true);
    expect(
      upsertCityLaunchSendAction.mock.calls.some(
        (call) => (call[0] as { recipientEmail?: string | null }).recipientEmail === "ops@northgatelogistics.com",
      ),
    ).toBe(true);
    expect(executeCityLaunchSends).toHaveBeenCalledWith({
      city: "Sacramento, CA",
    });
  });

  it("creates the issue tree even when no recipient-backed first-wave contacts can be seeded", async () => {
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
    resolveCityLaunchPlanningState.mockResolvedValue({
      city: "Sacramento, CA",
      citySlug: "sacramento-ca",
      status: "completed",
      reportsRoot: "/tmp/city-launch",
      cityReportsRoot: "/tmp/city-launch/sacramento-ca",
      canonicalPlaybookPath: "/tmp/city-launch/sacramento-ca/canonical.md",
      runDirectory: "/tmp/city-launch/sacramento-ca/run-1",
      manifestPath: "/tmp/city-launch/sacramento-ca/run-1/manifest.json",
      latestArtifactPath: "/tmp/city-launch/sacramento-ca/run-1/99-final-playbook.md",
      completedArtifactPath: "/tmp/city-launch/sacramento-ca/run-1/99-final-playbook.md",
      latestRunTimestamp: "run-1",
      warnings: [],
    });
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      city: "Sacramento, CA",
      citySlug: "sacramento-ca",
      artifactPath: "/tmp/sacramento-playbook.md",
      schemaVersion: "2026-04-12.city-launch-research.v1",
      generatedAtIso: "2026-04-17T00:00:00.000Z",
      warnings: [],
      errors: [],
      activationPayload: activationPayload("Sacramento, CA", "sacramento-ca"),
      captureCandidates: [
        {
          stableKey: "prospect_sacramento-ca-public-commercial-1",
          name: "Northgate Logistics",
          sourceBucket: "industrial_warehouse",
          channel: "professional_outreach",
          status: "qualified",
          siteAddress: "100 Industrial Way",
          locationSummary: null,
          lat: null,
          lng: null,
          siteCategory: "warehouse",
          workflowFit: "dock handoff",
          priorityNote: null,
          contactEmail: null,
          sourceUrls: [],
          explicitFields: [],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/sacramento-playbook.md",
            sourceKey: "capture_location_candidates[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: [],
            inferredFields: [],
          },
        },
      ],
      buyerTargets: [
        {
          stableKey: "buyer_target_sacramento-ca-capital-robotics",
          companyName: "Capital Robotics",
          contactName: "Taylor Buyer",
          contactEmail: null,
          status: "researched",
          workflowFit: "warehouse autonomy",
          proofPath: "exact_site",
          notes: "Named buyer but no direct contact yet.",
          sourceBucket: "warehouse_robotics",
          sourceUrls: [],
          explicitFields: [],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/sacramento-playbook.md",
            sourceKey: "buyer_target_candidates[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: [],
            inferredFields: [],
          },
        },
      ],
      firstTouches: [],
      budgetRecommendations: [],
    });

    const reportsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "blocked-outbound-city-launch-harness-"),
    );
    tempDirs.push(reportsRoot);

    const { runCityLaunchExecutionHarness } = await import("../utils/cityLaunchExecutionHarness");

    const result = await runCityLaunchExecutionHarness({
      city: "Sacramento, CA",
      reportsRoot,
      founderApproved: true,
      budgetTier: "low_budget",
    });

    expect(result.status).toBe("founder_approved_activation_ready");
    expect(result.paperclip?.rootIssueId).toBeTruthy();
    expect(result.outboundReadiness?.status).toBe("blocked");
    expect(result.outboundReadiness?.blockers).toContain(
      "No recipient-backed direct-outreach send actions were seeded for Sacramento, CA.",
    );
    expect(executeCityLaunchSends).not.toHaveBeenCalled();
  });

  it("surfaces foreign-bound wake conflicts as degraded wake status instead of skipped success", async () => {
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
    resolveCityLaunchPlanningState.mockResolvedValue({
      ...completedPlanningState("Chicago, IL", "chicago-il"),
    });
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      city: "Chicago, IL",
      citySlug: "chicago-il",
      artifactPath: "/tmp/chicago-playbook.md",
      schemaVersion: "2026-04-12.city-launch-research.v1",
      generatedAtIso: "2026-04-17T00:00:00.000Z",
      warnings: [],
      errors: [],
      activationPayload: activationPayload("Chicago, IL", "chicago-il"),
      captureCandidates: [
        {
          stableKey: "prospect_chicago-il-pro-capturer",
          name: "Chicago Survey Ops",
          sourceBucket: "industrial_warehouse",
          channel: "professional_outreach",
          status: "qualified",
          siteAddress: "100 Industrial Way",
          locationSummary: null,
          lat: null,
          lng: null,
          siteCategory: "warehouse",
          workflowFit: "dock handoff",
          priorityNote: null,
          contactEmail: "field@chicagosurveyops.com",
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/chicago-playbook.md",
            sourceKey: "capture_location_candidates[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
      ],
      buyerTargets: [
        {
          stableKey: "buyer_target_chicago-il-midwest-robotics",
          companyName: "Midwest Robotics",
          contactName: "Alex Buyer",
          contactEmail: "alex@midwestrobotics.com",
          status: "researched",
          workflowFit: "warehouse autonomy",
          proofPath: "exact_site",
          notes: "Strong exact-site fit.",
          sourceBucket: "warehouse_robotics",
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/chicago-playbook.md",
            sourceKey: "buyer_target_candidates[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
      ],
      firstTouches: [],
      budgetRecommendations: [],
    });
    wakePaperclipAgent.mockRejectedValue(
      new Error('Paperclip 409 for /api/issues/task-2: {"error":"Agent run is bound to a different issue"}'),
    );

    const reportsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "degraded-wake-city-launch-harness-"),
    );
    tempDirs.push(reportsRoot);

    const { runCityLaunchExecutionHarness } = await import("../utils/cityLaunchExecutionHarness");
    const result = await runCityLaunchExecutionHarness({
      city: "Chicago, IL",
      reportsRoot,
      founderApproved: true,
      budgetTier: "low_budget",
    });

    expect(result.paperclip?.rootIssueId).toBe("root-1");
    expect(result.paperclip?.error).toContain("lane wakeups degraded");
    expect(
      result.paperclip?.dispatched.some((entry) => entry.wakeStatus === "degraded_binding_conflict"),
    ).toBe(true);
    expect(
      result.paperclip?.dispatched.some((entry) => (entry.wakeError || "").includes("bound to a different issue")),
    ).toBe(true);
  });

  it("keeps buyer-facing sends blocked until a proof-ready asset exists while still dispatching supply-side outbound", async () => {
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
    resolveCityLaunchPlanningState.mockResolvedValue({
      city: "San Jose, CA",
      citySlug: "san-jose-ca",
      status: "completed",
      reportsRoot: "/tmp/city-launch",
      cityReportsRoot: "/tmp/city-launch/san-jose-ca",
      canonicalPlaybookPath: "/tmp/city-launch/san-jose-ca/canonical.md",
      runDirectory: "/tmp/city-launch/san-jose-ca/run-1",
      manifestPath: "/tmp/city-launch/san-jose-ca/run-1/manifest.json",
      latestArtifactPath: "/tmp/city-launch/san-jose-ca/run-1/99-final-playbook.md",
      completedArtifactPath: "/tmp/city-launch/san-jose-ca/run-1/99-final-playbook.md",
      latestRunTimestamp: "run-1",
      warnings: [],
    });
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      city: "San Jose, CA",
      citySlug: "san-jose-ca",
      artifactPath: "/tmp/san-jose-playbook.md",
      schemaVersion: "2026-04-12.city-launch-research.v1",
      generatedAtIso: "2026-04-17T00:00:00.000Z",
      warnings: [],
      errors: [],
      activationPayload: {
        schemaVersion: "2026-04-13.city-launch-activation-payload.v1",
        machinePolicyVersion: "2026-04-13.city-launch-doctrine.v1",
        city: "San Jose, CA",
        citySlug: "san-jose-ca",
        cityThesis: "Run one proof-led warehouse wedge.",
        primarySiteLane: "industrial_warehouse",
        primaryWorkflowLane: "dock handoff",
        primaryBuyerProofPath: "exact_site",
        lawfulAccessModes: ["buyer_requested_site"],
        preferredLawfulAccessMode: "buyer_requested_site",
        rightsPath: {
          summary: "Private controlled interiors require authorization.",
          privateControlledInteriorsRequireAuthorization: true,
          validationRequired: false,
          sourceUrls: ["https://example.com/rights"],
        },
        validationBlockers: [],
        requiredApprovals: [{ lane: "founder", reason: "go/no-go" }],
        ownerLanes: ["city-launch-agent", "capturer-growth-agent", "analytics-agent"],
        issueSeeds: [],
        metricsDependencies: [
          { key: "robot_team_inbound_captured", kind: "event", status: "required_tracked", ownerLane: "analytics-agent", notes: null },
          { key: "proof_path_assigned", kind: "event", status: "required_tracked", ownerLane: "analytics-agent", notes: null },
          { key: "proof_pack_delivered", kind: "event", status: "required_tracked", ownerLane: "analytics-agent", notes: null },
          { key: "hosted_review_ready", kind: "event", status: "required_tracked", ownerLane: "analytics-agent", notes: null },
          { key: "hosted_review_started", kind: "event", status: "required_tracked", ownerLane: "analytics-agent", notes: null },
          { key: "hosted_review_follow_up_sent", kind: "event", status: "required_tracked", ownerLane: "analytics-agent", notes: null },
          { key: "human_commercial_handoff_started", kind: "event", status: "required_tracked", ownerLane: "analytics-agent", notes: null },
          { key: "proof_motion_stalled", kind: "event", status: "required_tracked", ownerLane: "analytics-agent", notes: null },
        ],
        namedClaims: [],
      },
      captureCandidates: [
        {
          stableKey: "prospect_san-jose-ca-pro-capturer",
          name: "Bay Area Capture Ops",
          sourceBucket: "industrial_warehouse",
          channel: "professional_outreach",
          status: "qualified",
          siteAddress: "100 Industrial Way",
          locationSummary: null,
          lat: null,
          lng: null,
          siteCategory: "warehouse",
          workflowFit: "dock handoff",
          priorityNote: null,
          contactEmail: "field@bayareacaptureops.com",
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/san-jose-playbook.md",
            sourceKey: "capture_location_candidates[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
      ],
      buyerTargets: [
        {
          stableKey: "buyer_target_san-jose-ca-locus",
          companyName: "Locus Robotics",
          contactName: "Alex Buyer",
          contactEmail: "alex@locus.example.com",
          status: "researched",
          workflowFit: "warehouse autonomy",
          proofPath: "exact_site",
          notes: "Buyer thread is real but proof is not.",
          sourceBucket: "warehouse_robotics",
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/san-jose-playbook.md",
            sourceKey: "buyer_target_candidates[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
        {
          stableKey: "buyer_target_san-jose-ca-applied-intuition",
          companyName: "Applied Intuition",
          contactName: "Jordan Buyer",
          contactEmail: "jordan@applied.example.com",
          status: "researched",
          workflowFit: "warehouse autonomy",
          proofPath: "exact_site",
          notes: "Second buyer thread.",
          sourceBucket: "warehouse_robotics",
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/san-jose-playbook.md",
            sourceKey: "buyer_target_candidates[1]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
      ],
      firstTouches: [],
      budgetRecommendations: [],
    });
    executeCityLaunchSends.mockResolvedValue({
      city: "San Jose, CA",
      totalEligible: 1,
      sent: 1,
      skippedApproval: 0,
      skippedNoRecipient: 0,
      skippedAlreadySent: 0,
      failed: 0,
      errors: [],
    });

    const reportsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "proof-gated-buyer-launch-harness-"),
    );
    tempDirs.push(reportsRoot);

    const { runCityLaunchExecutionHarness } = await import("../utils/cityLaunchExecutionHarness");
    await runCityLaunchExecutionHarness({
      city: "San Jose, CA",
      reportsRoot,
      founderApproved: true,
      budgetTier: "zero_budget",
    });

    const buyerFacingActions = upsertCityLaunchSendAction.mock.calls
      .map((call) => call[0] as { lane?: string; status?: string; notes?: string | null })
      .filter((entry) =>
        entry.lane === "warehouse-facility-direct" || entry.lane === "buyer-linked-site",
      );

    expect(buyerFacingActions.length).toBeGreaterThan(0);
    expect(buyerFacingActions.every((entry) => entry.status === "blocked")).toBe(true);
    expect(buyerFacingActions.some((entry) => (entry.notes || "").includes("rights-cleared proof pack"))).toBe(true);
    expect(executeCityLaunchSends).toHaveBeenCalledWith({
      city: "San Jose, CA",
    });
  });

  it("dispatches no-signal recovery lanes and draft packs after sent outreach produces no live signal", async () => {
    summarizeCityLaunchLedgers.mockResolvedValue({
      trackedSupplyProspectsContacted: 0,
      trackedBuyerTargetsResearched: 0,
      trackedFirstTouchesSent: 0,
      trackedCityOpeningChannelAccountsReady: 0,
      trackedCityOpeningChannelAccountsCreated: 0,
      trackedCityOpeningChannelAccountsBlocked: 0,
      trackedCityOpeningSendActionsReady: 0,
      trackedCityOpeningSendActionsSent: 2,
      trackedCityOpeningSendActionsBlocked: 0,
      trackedCityOpeningResponsesRecorded: 0,
      trackedCityOpeningResponsesRouted: 0,
      trackedReplyConversionsQueued: 0,
      trackedReplyConversionsRouted: 0,
      trackedReplyConversionsBlocked: 0,
      onboardedCapturers: 0,
      totalRecordedSpendUsd: 0,
      withinPolicySpendUsd: 0,
      outsidePolicySpendUsd: 0,
      recommendedSpendUsd: 0,
      wideningGuard: { mode: "single_city_until_proven", wideningAllowed: false, reasons: [] },
      dataSources: [],
    });
    upsertPaperclipIssue.mockImplementation(async (input: { title?: string }) => {
      if ((input.title || "").startsWith("Launch Durham, NC")) {
        return {
          created: true,
          companyId: "company-1",
          assigneeAgentId: "agent-growth-lead",
          issue: { id: "root-1", identifier: "BLU-ROOT", status: "todo" },
        };
      }
      return {
        created: true,
        companyId: "company-1",
        assigneeAgentId: `agent-${upsertPaperclipIssue.mock.calls.length}`,
        issue: {
          id: `task-${upsertPaperclipIssue.mock.calls.length}`,
          identifier: `BLU-${upsertPaperclipIssue.mock.calls.length}`,
          status: "todo",
        },
      };
    });
    resolveCityLaunchPlanningState.mockResolvedValue(
      completedPlanningState("Durham, NC", "durham-nc"),
    );
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      city: "Durham, NC",
      citySlug: "durham-nc",
      artifactPath: "/tmp/durham-playbook.md",
      schemaVersion: "2026-04-12.city-launch-research.v1",
      generatedAtIso: "2026-04-17T00:00:00.000Z",
      warnings: [],
      errors: [],
      activationPayload: activationPayload("Durham, NC", "durham-nc"),
      captureCandidates: [
        {
          stableKey: "prospect_durham-nc-pro-capturer",
          name: "Triangle Capture Ops",
          sourceBucket: "professional_capturer",
          channel: "professional_outreach",
          status: "identified",
          siteAddress: "100 Warehouse Way",
          locationSummary: null,
          lat: null,
          lng: null,
          siteCategory: "warehouse",
          workflowFit: "dock handoff",
          priorityNote: null,
          contactEmail: "ops@trianglecapture.example",
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/durham-playbook.md",
            sourceKey: "capture_location_candidates[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
      ],
      buyerTargets: [
        {
          stableKey: "buyer_target_durham-nc-botbuilt",
          companyName: "BotBuilt",
          contactName: "Ops",
          contactEmail: "ops@botbuilt.example",
          status: "researched",
          workflowFit: "warehouse autonomy",
          proofPath: "exact_site",
          notes: "Buyer thread exists but no reply yet.",
          sourceBucket: "warehouse_robotics",
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/durham-playbook.md",
            sourceKey: "buyer_target_candidates[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-17T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
      ],
      firstTouches: [],
      budgetRecommendations: [],
    });
    executeCityLaunchSends.mockResolvedValue({
      city: "Durham, NC",
      totalEligible: 2,
      sent: 2,
      skippedApproval: 0,
      skippedNoRecipient: 0,
      skippedAlreadySent: 0,
      failed: 0,
      errors: [],
    });
    const sentActions = [
      {
        id: "send-1",
        city: "Durham, NC",
        citySlug: "durham-nc",
        launchId: "root-1",
        lane: "professional-capturer",
        actionType: "direct_outreach",
        channelAccountId: "channel-1",
        channelLabel: "email",
        targetLabel: "Triangle Capture Ops",
        assetKey: "first-wave",
        ownerAgent: "capturer-growth-agent",
        recipientEmail: "ops@trianglecapture.example",
        emailSubject: "Blueprint Durham capture path",
        emailBody: "Proof-led outreach.",
        status: "sent",
        approvalState: "approved",
        responseIngestState: "awaiting_response",
        issueId: null,
        notes: null,
        sentAtIso: "2026-04-20T00:00:00.000Z",
        firstResponseAtIso: null,
        createdAtIso: "2026-04-20T00:00:00.000Z",
        updatedAtIso: "2026-04-20T00:00:00.000Z",
      },
      {
        id: "send-2",
        city: "Durham, NC",
        citySlug: "durham-nc",
        launchId: "root-1",
        lane: "buyer-linked-site",
        actionType: "direct_outreach",
        channelAccountId: "channel-2",
        channelLabel: "email",
        targetLabel: "BotBuilt",
        assetKey: "first-wave",
        ownerAgent: "outbound-sales-agent",
        recipientEmail: "ops@botbuilt.example",
        emailSubject: "Blueprint Durham proof path",
        emailBody: "Proof-led outreach.",
        status: "sent",
        approvalState: "approved",
        responseIngestState: "awaiting_response",
        issueId: null,
        notes: null,
        sentAtIso: "2026-04-20T00:00:00.000Z",
        firstResponseAtIso: null,
        createdAtIso: "2026-04-20T00:00:00.000Z",
        updatedAtIso: "2026-04-20T00:00:00.000Z",
      },
    ];
    listCityLaunchSendActions.mockResolvedValue(sentActions);
    listCityLaunchProspects.mockResolvedValue([
      {
        id: "prospect-1",
        city: "Durham, NC",
        citySlug: "durham-nc",
        launchId: "root-1",
        sourceBucket: "professional_capturer",
        channel: "professional_outreach",
        name: "Triangle Capture Ops",
        email: "ops@trianglecapture.example",
        status: "identified",
        ownerAgent: "capturer-growth-agent",
        notes: null,
        firstContactedAt: null,
        lastContactedAt: null,
        siteAddress: "100 Warehouse Way",
        locationSummary: null,
        lat: null,
        lng: null,
        siteCategory: "warehouse",
        workflowFit: "dock handoff",
        priorityNote: null,
        researchProvenance: null,
        createdAtIso: "2026-04-20T00:00:00.000Z",
        updatedAtIso: "2026-04-20T00:00:00.000Z",
      },
    ]);
    listCityLaunchBuyerTargets.mockResolvedValue([
      {
        id: "buyer-1",
        city: "Durham, NC",
        citySlug: "durham-nc",
        launchId: "root-1",
        companyName: "BotBuilt",
        contactName: "Ops",
        contactEmail: "ops@botbuilt.example",
        status: "researched",
        workflowFit: "warehouse autonomy",
        proofPath: "exact_site",
        ownerAgent: "outbound-sales-agent",
        notes: "No reply yet.",
        sourceBucket: "warehouse_robotics",
        researchProvenance: null,
        createdAtIso: "2026-04-20T00:00:00.000Z",
        updatedAtIso: "2026-04-20T00:00:00.000Z",
      },
    ]);
    listCityLaunchReplyConversions.mockResolvedValue([]);

    const reportsRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "no-signal-city-launch-harness-"),
    );
    tempDirs.push(reportsRoot);

    const { runCityLaunchExecutionHarness } = await import("../utils/cityLaunchExecutionHarness");
    const result = await runCityLaunchExecutionHarness({
      city: "Durham, NC",
      reportsRoot,
      founderApproved: true,
      budgetTier: "zero_budget",
    });

    expect(result.noSignalRecovery?.status).toBe("triggered");
    expect(result.noSignalRecovery?.dispatchStatus).toBe("dispatched");
    expect(result.noSignalRecovery?.signals.sentDirectOutreach).toBe(2);
    expect(result.paperclip?.dispatched.map((entry) => entry.key)).toEqual(
      expect.arrayContaining([
        "no-signal-capturer-source-recovery",
        "no-signal-city-opening-coherence",
        "no-signal-marketing-campaign-mock-pack",
        "no-signal-site-operator-recovery",
        "no-signal-recipient-backed-outbound-recovery",
      ]),
    );

    const campaignMockPack = await fs.readFile(
      result.artifacts.cityOpeningArtifactPack.run.campaignMockPackPath,
      "utf8",
    );
    const siteOperatorPack = await fs.readFile(
      result.artifacts.cityOpeningArtifactPack.run.siteOperatorRecoveryPackPath,
      "utf8",
    );
    const scorecard = await fs.readFile(
      result.artifacts.cityOpeningArtifactPack.run.noSignalScorecardPath,
      "utf8",
    );

    expect(campaignMockPack).toContain("draft-only recovery artifact");
    expect(campaignMockPack).toContain("Short Video / Mock Creative");
    expect(siteOperatorPack).toContain("warehouses, facilities, operators, leasing reps, AEC/survey firms, and site owners");
    expect(scorecard).toContain("explicit no-response outcome");
  });
});
