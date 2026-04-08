// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const runAgentTask = vi.hoisted(() => vi.fn());
const inboundSet = vi.hoisted(() => vi.fn());
const executePhase2WorkflowActions = vi.hoisted(() => vi.fn());

const fakeDb = {
  collection: vi.fn((name: string) => {
    if (name !== "inboundRequests") {
      throw new Error(`Unexpected collection ${name}`);
    }

    return {
      doc: vi.fn(() => ({
        set: inboundSet,
      })),
    };
  }),
};

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
      },
    },
  },
  dbAdmin: fakeDb,
  storageAdmin: null,
  authAdmin: null,
}));

vi.mock("../config/env", () => ({
  isPhase2LaneEnabled: () => true,
}));

vi.mock("../agents/runtime", () => ({
  runAgentTask,
}));

vi.mock("../agents/phase2-workflow", () => ({
  createPhase2RoutingPolicy: (lane: string) => ({
    lane,
    autoApproveCriteria: () => true,
    alwaysHumanReview: () => false,
    maxDailyAutoSends: 1000,
    contentChecks: false,
  }),
  makeWorkflowDraftStatePatch: (params: { lane: string; queue: string; nextAction: string }) => ({
    phase2_action_state: "draft_ready",
    phase2_action_type: "draft",
    phase2_action_tier: null,
    phase2_action_idempotency_key: null,
    phase2_action_ledger_ref: null,
    phase2_action_error: null,
    phase2_action_auto_approve_reason: null,
    phase2_action_executed_at: null,
    phase2_actions: [],
    phase2_lane: params.lane,
    queue: params.queue,
    next_action: params.nextAction,
  }),
  executePhase2WorkflowActions,
}));

afterEach(() => {
  runAgentTask.mockReset();
  inboundSet.mockReset();
  executePhase2WorkflowActions.mockReset();
  vi.resetModules();
});

const inboundRequest = {
  requestId: "request-1",
  site_submission_id: "request-1",
  createdAt: "2026-03-21T00:00:00.000Z",
  status: "submitted",
  qualification_state: "submitted",
  opportunity_state: "not_applicable",
  priority: "normal",
  owner: {},
  contact: {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    roleTitle: "Operations Lead",
    company: "Analytical Engines",
  },
  request: {
    budgetBucket: "$50K-$300K",
    requestedLanes: ["qualification"],
    helpWith: [],
    buyerType: "site_operator",
    siteName: "Durham Facility",
    siteLocation: "Durham, NC",
    taskStatement: "Review a picking workflow.",
    targetSiteType: "Warehouse picking aisle",
    proofPathPreference: "exact_site_required",
    existingStackReviewWorkflow: "Hosted review before simulator ingestion.",
    humanGateTopics: "Rights review and delivery scope.",
    workflowContext: "Backroom handoff.",
    operatingConstraints: "Restricted dock access.",
    privacySecurityConstraints: "No locker-room cameras.",
    knownBlockers: "Tight turn radius.",
    targetRobotTeam: "Humanoid team",
    captureRights: null,
    derivedScenePermission: null,
    datasetLicensingPermission: null,
    payoutEligibility: null,
    details: "Need a fast feasibility read.",
  },
  context: {
    sourcePageUrl: "http://localhost:5000/contact",
    utm: {},
  },
  enrichment: {},
  events: {},
  ops_automation: {
    status: "pending",
    queue: "inbound_request_review",
    intent: "inbound_qualification",
  },
  debug: {
    schemaVersion: 2,
  },
} as any;

describe("inbound qualification worker", () => {
  it("persists recommendations and review flags", async () => {
    runAgentTask.mockResolvedValue({
      status: "completed",
      provider: "openclaw",
      runtime: "openclaw",
      model: "openai/gpt-5.4",
      tool_mode: "api",
      requires_human_review: false,
      requires_approval: false,
      output: {
        automation_status: "blocked",
        block_reason_code: "missing_site_evidence",
        retryable: true,
        qualification_state_recommendation: "needs_more_evidence",
        opportunity_state_recommendation: "not_applicable",
        confidence: 0.83,
        requires_human_review: true,
        next_action: "Request missing site evidence",
        rationale: "The request is promising but incomplete.",
        internal_summary: "Missing site evidence and rights clarity.",
        missing_information: ["Current floor plan", "Capture rights"],
        buyer_follow_up: {
          subject: "A few details needed for Blueprint review",
          body: "Please send the current floor plan and clarify capture rights.",
        },
      },
    });

    const { runInboundQualificationForRequest } = await import("../agents/workflows");
    executePhase2WorkflowActions.mockResolvedValue({
      records: [],
      lastResult: null,
      lastState: "sent",
    });
    const result = await runInboundQualificationForRequest(inboundRequest);

    expect(result.qualification_state_recommendation).toBe("needs_more_evidence");
    expect(runAgentTask).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "inbound_qualification",
        input: expect.objectContaining({
          targetSiteType: "Warehouse picking aisle",
          proofPathPreference: "exact_site_required",
          existingStackReviewWorkflow: "Hosted review before simulator ingestion.",
          humanGateTopics: "Rights review and delivery scope.",
        }),
      }),
    );
    expect(executePhase2WorkflowActions).toHaveBeenCalledWith(
      expect.objectContaining({
        lane: "inbound",
        sourceCollection: "inboundRequests",
        sourceDocId: "request-1",
      }),
    );
    expect(inboundSet).toHaveBeenCalledWith(
      expect.objectContaining({
        human_review_required: true,
        automation_confidence: 0.83,
        status: "needs_more_evidence",
        ops_automation: expect.objectContaining({
          phase2_lane: "inbound",
          phase2_action_state: "draft_ready",
        }),
      }),
      { merge: true },
    );
  }, 15_000);

  it("marks the run failed when the provider times out or returns malformed output", async () => {
    runAgentTask.mockResolvedValue({
      status: "failed",
      provider: "openclaw",
      runtime: "openclaw",
      model: "openai/gpt-5.4",
      tool_mode: "api",
      error: "OpenAI returned non-JSON output",
      requires_human_review: true,
      requires_approval: false,
    });

    const { runInboundQualificationForRequest } = await import("../agents/workflows");

    await expect(runInboundQualificationForRequest(inboundRequest)).rejects.toThrow(
      /non-json/i,
    );

    expect(inboundSet).toHaveBeenCalled();
  });
});
