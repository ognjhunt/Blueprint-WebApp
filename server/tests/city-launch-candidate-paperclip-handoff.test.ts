// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upsertPaperclipIssue = vi.hoisted(() => vi.fn());
const createPaperclipIssueComment = vi.hoisted(() => vi.fn());
const resetPaperclipAgentSession = vi.hoisted(() => vi.fn());
const wakePaperclipAgent = vi.hoisted(() => vi.fn());

vi.mock("../utils/paperclip", () => ({
  upsertPaperclipIssue,
  createPaperclipIssueComment,
  resetPaperclipAgentSession,
  wakePaperclipAgent,
}));

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "candidate-durham-1",
    dedupeKey: "durham:circle-k",
    creatorId: "creator-1",
    city: "Durham, NC",
    citySlug: "durham-nc",
    name: "Circle K - Convenience Store",
    address: "2503 NC-55, Durham, NC, 27713",
    lat: 35.94,
    lng: -78.89,
    provider: "apple_mapkit",
    providerPlaceId: "mapkit:circle-k-abc123",
    types: ["store"],
    sourceContext: "app_open_scan",
    status: "in_review",
    reviewState: "needs_review_evidence",
    sourceUrls: [],
    sourceEvidenceSummary: null,
    sourceQueries: [],
    publicAccessPosture: null,
    allowedCaptureZones: [],
    avoidCaptureZones: [],
    indoorCapturePosture: null,
    cameraPolicyNotes: null,
    confidence: null,
    verificationStatus: null,
    rejectionReason: null,
    estimatedPublicAreaSqft: null,
    estimatedCaptureMinutes: null,
    estimatedCaptureComplexity: null,
    demandScore: null,
    suggestedPayoutCents: null,
    payoutBasis: null,
    lastVerifiedAt: null,
    reviewedByAgent: null,
    seedStatus: null,
    seedNotes: null,
    reviewedAtIso: null,
    reviewedBy: null,
    reviewDecision: null,
    reviewReasons: [],
    promotedProspectId: null,
    seenCount: 1,
    submittedAtIso: "2026-04-26T01:35:00.000Z",
    lastSeenAtIso: "2026-04-26T01:35:00.000Z",
    ...overrides,
  };
}

function review(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: "2026-04-26T01:35:05.000Z",
    city: "Durham, NC",
    reviewedBy: "public-space-review-agent",
    dryRun: false,
    reviewedCount: 1,
    promotedCount: 0,
    keptInReviewCount: 1,
    rejectedCount: 0,
    notifications: [],
    outcomes: [
      {
        candidateId: "candidate-durham-1",
        candidateName: "Circle K - Convenience Store",
        decision: "keep_in_review",
        reviewState: "needs_review_evidence",
        reasons: ["missing source URLs", "missing source evidence summary"],
        promotedProspectId: null,
      },
    ],
    ...overrides,
  };
}

describe("city launch candidate Paperclip handoff", () => {
  beforeEach(() => {
    upsertPaperclipIssue.mockReset();
    createPaperclipIssueComment.mockReset();
    resetPaperclipAgentSession.mockReset();
    wakePaperclipAgent.mockReset();
    delete process.env.BLUEPRINT_CITY_LAUNCH_CANDIDATE_PAPERCLIP_HANDOFF_ENABLED;
    delete process.env.BLUEPRINT_PAPERCLIP_COMPANY_ID;
    delete process.env.PAPERCLIP_API_URL;
    delete process.env.PAPERCLIP_API_KEY;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("skips Paperclip work unless the handoff is explicitly configured", async () => {
    const { dispatchCityLaunchCandidatePaperclipHandoff } = await import(
      "../utils/cityLaunchCandidatePaperclipHandoff"
    );

    const result = await dispatchCityLaunchCandidatePaperclipHandoff({
      candidates: [candidate()],
      review: review(),
    });

    expect(result.enabled).toBe(false);
    expect(result.attempted).toBe(false);
    expect(upsertPaperclipIssue).not.toHaveBeenCalled();
    expect(wakePaperclipAgent).not.toHaveBeenCalled();
  });

  it("creates and wakes a public-space review issue for configured app-open batches", async () => {
    process.env.BLUEPRINT_PAPERCLIP_COMPANY_ID = "company-1";
    upsertPaperclipIssue.mockResolvedValue({
      companyId: "company-1",
      projectId: "project-1",
      assigneeAgentId: "agent-public-review",
      created: true,
      issue: {
        id: "issue-1",
        identifier: "BLU-123",
        title: "Review app-open nearby candidates: Durham, NC",
        status: "todo",
        priority: "high",
      },
    });
    createPaperclipIssueComment.mockResolvedValue({ ok: true });
    resetPaperclipAgentSession.mockResolvedValue({ ok: true });
    wakePaperclipAgent.mockResolvedValue({ status: "queued", runId: "run-1" });

    const { dispatchCityLaunchCandidatePaperclipHandoff } = await import(
      "../utils/cityLaunchCandidatePaperclipHandoff"
    );
    const result = await dispatchCityLaunchCandidatePaperclipHandoff({
      candidates: [candidate()],
      review: review(),
      source: "creator_city_launch_candidate_signals",
    });

    expect(result).toEqual(
      expect.objectContaining({
        enabled: true,
        attempted: true,
        issueId: "issue-1",
        issueIdentifier: "BLU-123",
        issueCreated: true,
        wakeStatus: "queued",
        wakeRunId: "run-1",
        error: null,
      }),
    );
    expect(upsertPaperclipIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: "blueprint-webapp",
        assigneeKey: "public-space-review-agent",
        title: "Review app-open nearby candidates: Durham, NC",
        priority: "high",
        status: "todo",
        originKind: "city_launch_app_candidate_batch",
        originId: expect.stringMatching(/^durham-nc:[a-f0-9]{16}$/),
        description: expect.stringContaining("these are not approved capture permissions"),
      }),
    );
    expect(createPaperclipIssueComment).toHaveBeenCalledWith(
      "issue-1",
      expect.stringContaining("App-open nearby candidate batch reviewed"),
    );
    expect(resetPaperclipAgentSession).toHaveBeenCalledWith(
      "agent-public-review",
      "issue-1",
      "company-1",
    );
    expect(wakePaperclipAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "agent-public-review",
        companyId: "company-1",
        reason: "city_launch_app_candidate_batch_review",
        payload: expect.objectContaining({
          city: "Durham, NC",
          candidateIds: ["candidate-durham-1"],
          keptInReviewCount: 1,
        }),
      }),
    );
  });

  it("falls back to the city-launch agent when the public-space review agent is not synced", async () => {
    process.env.BLUEPRINT_PAPERCLIP_COMPANY_ID = "company-1";
    upsertPaperclipIssue
      .mockRejectedValueOnce(new Error("Paperclip agent not found: public-space-review-agent"))
      .mockResolvedValueOnce({
        companyId: "company-1",
        projectId: "project-1",
        assigneeAgentId: "agent-city-launch",
        created: true,
        issue: {
          id: "issue-2",
          identifier: "BLU-124",
          title: "Review app-open nearby candidates: Durham, NC",
          status: "todo",
          priority: "high",
        },
      });
    createPaperclipIssueComment.mockResolvedValue({ ok: true });
    resetPaperclipAgentSession.mockResolvedValue({ ok: true });
    wakePaperclipAgent.mockResolvedValue({ status: "queued", runId: "run-2" });

    const { dispatchCityLaunchCandidatePaperclipHandoff } = await import(
      "../utils/cityLaunchCandidatePaperclipHandoff"
    );
    const result = await dispatchCityLaunchCandidatePaperclipHandoff({
      candidates: [candidate()],
      review: review(),
      source: "creator_city_launch_candidate_signals",
    });

    expect(result).toEqual(
      expect.objectContaining({
        issueId: "issue-2",
        wakeStatus: "queued",
        wakeRunId: "run-2",
        error: null,
      }),
    );
    expect(upsertPaperclipIssue).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        assigneeKey: "public-space-review-agent",
      }),
    );
    expect(upsertPaperclipIssue).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        assigneeKey: "city-launch-agent",
        description: expect.stringContaining("assignee_key: city-launch-agent"),
      }),
    );
    expect(wakePaperclipAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "agent-city-launch",
        payload: expect.objectContaining({
          issueId: "issue-2",
          candidateIds: ["candidate-durham-1"],
        }),
      }),
    );
  });
});
