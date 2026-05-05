// @vitest-environment node
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { summarizeCityLaunchAutonomyCertification } from "../utils/cityLaunchAutonomyCertification";

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
    cityThesis: "One site, one workflow, one hosted review wedge.",
    primarySiteLane: "industrial_warehouse" as const,
    primaryWorkflowLane: "dock handoff",
    primaryBuyerProofPath: "exact_site" as const,
    lawfulAccessModes: ["buyer_requested_site" as const],
    preferredLawfulAccessMode: "buyer_requested_site" as const,
    rightsPath: {
      summary: "Rights summary",
      privateControlledInteriorsRequireAuthorization: true,
      validationRequired: false,
      sourceUrls: ["https://example.com/rights"],
    },
    validationBlockers: [],
    requiredApprovals: [{ lane: "founder" as const, reason: "go/no-go" }],
    ownerLanes: ["city-launch-agent"],
    issueSeeds: [],
    metricsDependencies: [],
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
  vi.stubEnv("SEARCH_API_KEY", "");
  vi.stubEnv("SEARCH_API_PROVIDER", "");
  vi.stubEnv("BLUEPRINT_MARKET_SIGNAL_PROVIDER", "");
  vi.stubEnv("FIREHOSE_API_TOKEN", "fh-token");
  vi.stubEnv("FIREHOSE_BASE_URL", "https://firehose.test");

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
    .mockImplementation(async () => ({
      created: true,
      companyId: "company-1",
      assigneeAgentId: "agent-task",
      issue: { id: `task-${upsertPaperclipIssue.mock.calls.length}`, identifier: null, status: "todo" },
    }));
});

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0, tempDirs.length).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("city launch autonomy regression", () => {
  it("certifies autonomous planning and activation for a recipient-backed city launch", async () => {
    resolveCityLaunchPlanningState.mockResolvedValue(
      completedPlanningState("Chicago, IL", "chicago-il"),
    );
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      city: "Chicago, IL",
      citySlug: "chicago-il",
      artifactPath: "/tmp/chicago-playbook.md",
      schemaVersion: "2026-04-12.city-launch-research.v1",
      generatedAtIso: "2026-04-20T00:00:00.000Z",
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
          status: "qualified",
          contactName: null,
          contactEmail: "ops@chicagorobotics.example.com",
          sourceUrls: [],
          explicitFields: ["contact_email"],
          inferredFields: [],
          provenance: {
            sourceType: "deep_research_playbook",
            artifactPath: "/tmp/chicago-playbook.md",
            sourceKey: "buyer_targets[0]",
            sourceUrls: [],
            parsedAtIso: "2026-04-20T00:00:00.000Z",
            explicitFields: ["contact_email"],
            inferredFields: [],
          },
        },
      ],
      firstTouches: [],
      budgetRecommendations: [],
    });

    const reportsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "autonomy-cert-city-"));
    tempDirs.push(reportsRoot);

    const { runCityLaunchExecutionHarness } = await import("../utils/cityLaunchExecutionHarness");
    const result = await runCityLaunchExecutionHarness({
      city: "Chicago, IL",
      founderApproved: true,
      budgetTier: "zero_budget",
      reportsRoot,
    });
    const certification = summarizeCityLaunchAutonomyCertification(result);

    expect(certification.planningReady).toBe(true);
    expect(certification.activationReady).toBe(true);
    expect(certification.issueTreeReady).toBe(true);
    expect(certification.wakeReady).toBe(true);
    expect(certification.executionEvidenceReady).toBe(false);
    expect(certification.manualInterventionRequired).toBe(true);
    expect(certification.blockingExecutionStates).not.toContain("contacts");
    expect(certification.blockingExecutionStates).toEqual(
      expect.arrayContaining(["proofMotion", "hostedReview"]),
    );
  });

  it("certifies degraded-but-routed execution when contacts, proof, hosted review, and Firehose are missing", async () => {
    vi.stubEnv("SEARCH_API_KEY", "");
    vi.stubEnv("SEARCH_API_PROVIDER", "");
    vi.stubEnv("BLUEPRINT_MARKET_SIGNAL_PROVIDER", "");
    vi.stubEnv("FIREHOSE_API_TOKEN", "");
    vi.stubEnv("FIREHOSE_BASE_URL", "");

    resolveCityLaunchPlanningState.mockResolvedValue(
      completedPlanningState("Sacramento, CA", "sacramento-ca"),
    );
    loadAndParseCityLaunchResearchArtifact.mockResolvedValue({
      city: "Sacramento, CA",
      citySlug: "sacramento-ca",
      artifactPath: "/tmp/sacramento-playbook.md",
      schemaVersion: "2026-04-12.city-launch-research.v1",
      generatedAtIso: "2026-04-20T00:00:00.000Z",
      warnings: [],
      errors: [],
      activationPayload: activationPayload("Sacramento, CA", "sacramento-ca"),
      captureCandidates: [
        {
          stableKey: "capture-sac-1",
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
            parsedAtIso: "2026-04-20T00:00:00.000Z",
            explicitFields: [],
            inferredFields: [],
          },
        },
      ],
      buyerTargets: [],
      firstTouches: [],
      budgetRecommendations: [],
    });

    const reportsRoot = await fs.mkdtemp(path.join(os.tmpdir(), "autonomy-sparse-city-"));
    tempDirs.push(reportsRoot);

    const { runCityLaunchExecutionHarness } = await import("../utils/cityLaunchExecutionHarness");
    const result = await runCityLaunchExecutionHarness({
      city: "Sacramento, CA",
      founderApproved: true,
      budgetTier: "zero_budget",
      reportsRoot,
    });
    const certification = summarizeCityLaunchAutonomyCertification(result);

    expect(certification.planningReady).toBe(true);
    expect(certification.activationReady).toBe(true);
    expect(certification.issueTreeReady).toBe(true);
    expect(certification.wakeReady).toBe(true);
    expect(certification.executionEvidenceReady).toBe(false);
    expect(certification.manualInterventionRequired).toBe(true);
    expect(certification.blockingExecutionStates).toEqual(
      expect.arrayContaining(["contacts", "proofMotion", "hostedReview"]),
    );
    expect(certification.warnings.join("\n")).toContain("External market-signal enrichment unavailable");
  });
});
