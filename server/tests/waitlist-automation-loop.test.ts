// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const runAgentTask = vi.hoisted(() => vi.fn());
const docSet = vi.hoisted(() => vi.fn());
const executePhase2WorkflowActions = vi.hoisted(() => vi.fn());

const fakeDoc = {
  id: "submission-1",
  data: () => ({
    email: "ada@example.com",
    email_domain: "example.com",
    location_type: "retail",
    market: "Durham",
    market_normalized: "durham",
    role: "capturer",
    role_normalized: "capturer",
    device: "iPhone 15 Pro",
    device_normalized: "iphone",
    phone: "555-000-1212",
    source: "capture_app_private_beta",
    status: "new",
    queue: "capturer_beta_review",
    intent: "capturer_beta_access",
    filter_tags: ["market:durham"],
    ops_automation: {},
  }),
  ref: {
    set: docSet,
  },
};

const fakeDb = {
  collection: vi.fn((name: string) => {
    if (name !== "waitlistSubmissions") {
      throw new Error(`Unexpected collection ${name}`);
    }

    const makeQuery = () => ({
      where: vi.fn(() => makeQuery()),
      limit: vi.fn(() => makeQuery()),
      get: vi.fn().mockResolvedValue({
        docs: [fakeDoc],
      }),
    });

    return {
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          exists: true,
          ...fakeDoc,
        }),
      })),
      where: vi.fn(() => makeQuery()),
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
  docSet.mockReset();
  executePhase2WorkflowActions.mockReset();
  vi.resetModules();
});

describe("waitlist automation loop", () => {
  it("uses the same canonical waitlist_triage task contract", async () => {
    runAgentTask.mockResolvedValue({
      status: "completed",
      provider: "openclaw",
      runtime: "openclaw",
      model: "openai/gpt-5.4",
      tool_mode: "api",
      requires_human_review: false,
      requires_approval: false,
      output: {
        automation_status: "completed",
        block_reason_code: null,
        retryable: false,
        recommendation: "invite_now",
        confidence: 0.91,
        market_fit_score: 88,
        device_fit_score: 93,
        invite_readiness_score: 90,
        recommended_queue: "capturer_beta_invite_review",
        next_action: "Send invite",
        rationale: "Strong fit.",
        market_summary: "Strong local market.",
        requires_human_review: false,
        draft_email: {
          subject: "Invite",
          body: "Welcome",
        },
      },
    });

    const { runWaitlistAutomationLoop } = await import("../utils/waitlistAutomation");
    executePhase2WorkflowActions.mockResolvedValue({
      records: [],
      lastResult: null,
      lastState: "sent",
    });
    const result = await runWaitlistAutomationLoop({ submissionId: "submission-1" });

    expect(result.ok).toBe(true);
    expect(runAgentTask).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "waitlist_triage",
      }),
    );
    expect(executePhase2WorkflowActions).toHaveBeenCalledWith(
      expect.objectContaining({
        lane: "waitlist",
        sourceCollection: "waitlistSubmissions",
        sourceDocId: "submission-1",
      }),
    );
    expect(docSet).toHaveBeenCalled();
  }, 15_000);
});
