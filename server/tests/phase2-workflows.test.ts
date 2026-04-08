// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const runAgentTask = vi.hoisted(() => vi.fn());
const docSet = vi.hoisted(() => vi.fn());
const executePhase2WorkflowActions = vi.hoisted(() => vi.fn());

const supportDoc = {
  id: "contact-1",
  data: () => ({
    requestSource: "contact_request",
    name: "Ada Lovelace",
    email: "ada@example.com",
    company: "Analytical Engines",
    city: "Durham",
    state: "NC",
    companyWebsite: "https://analytical.example",
    message: "Please help with onboarding.",
    summary: "Support request",
    ops_automation: {},
  }),
  ref: {
    set: docSet,
  },
};

const payoutDoc = {
  id: "payout-1",
  data: () => ({
    creator_id: "creator-1",
    capture_id: "capture-1",
    status: "review_required",
    stripe_payout_id: null,
    failure_reason: "Webhook timeout",
    qualification_state: "qualified_ready",
    opportunity_state: "handoff_ready",
    recommendation: {},
    ops_automation: {},
  }),
  ref: {
    set: docSet,
  },
};

const fakeDb = {
  collection: vi.fn((name: string) => {
    if (name === "contactRequests") {
      return {
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ docs: [supportDoc] }),
          })),
        })),
      };
    }

    if (name === "creatorPayouts") {
      return {
        where: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ docs: [payoutDoc] }),
          })),
        })),
      };
    }

    throw new Error(`Unexpected collection ${name}`);
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

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

afterEach(() => {
  runAgentTask.mockReset();
  docSet.mockReset();
  executePhase2WorkflowActions.mockReset();
  vi.resetModules();
});

describe("Phase 2 workflow execution", () => {
  it("routes support triage through Phase 2 actions", async () => {
    runAgentTask.mockResolvedValue({
      status: "completed",
      provider: "openclaw",
      runtime: "openclaw",
      model: "openai/gpt-5.4",
      tool_mode: "api",
      output: {
        automation_status: "completed",
        block_reason_code: null,
        retryable: false,
        category: "general_support",
        queue: "support_general",
        priority: "normal",
        confidence: 0.92,
        requires_human_review: false,
        next_action: "Send reply",
        rationale: "Routine support request.",
        internal_summary: "Safe support reply.",
        suggested_response: {
          subject: "Thanks for reaching out",
          body: "We received your message and will follow up shortly with the next step.",
        },
      },
    });
    executePhase2WorkflowActions.mockResolvedValue({
      records: [],
      lastResult: null,
      lastState: "sent",
    });

    const { runSupportTriageLoop } = await import("../agents/workflows");
    const result = await runSupportTriageLoop({ limit: 1 });

    expect(result.ok).toBe(true);
    expect(executePhase2WorkflowActions).toHaveBeenCalledWith(
      expect.objectContaining({
        lane: "support",
        sourceCollection: "contactRequests",
        sourceDocId: "contact-1",
      }),
    );
    expect(docSet).toHaveBeenCalledWith(
      expect.objectContaining({
        ops_automation: expect.objectContaining({
          phase2_lane: "support",
          phase2_action_state: "draft_ready",
        }),
      }),
      expect.objectContaining({ merge: true }),
    );
  }, 15_000);

  it("runs a support AutoAgent shadow pass when enabled", async () => {
    vi.stubEnv("BLUEPRINT_AUTOAGENT_SHADOW_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_AUTOAGENT_SHADOW_LANES", "support_triage");
    vi.stubEnv("BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER", "acp_harness");

    runAgentTask
      .mockResolvedValueOnce({
        status: "completed",
        provider: "openclaw",
        runtime: "openclaw",
        model: "openai/gpt-5.4",
        tool_mode: "api",
        output: {
          automation_status: "completed",
          block_reason_code: null,
          retryable: false,
          category: "general_support",
          queue: "support_general",
          priority: "normal",
          confidence: 0.92,
          requires_human_review: false,
          next_action: "Send reply",
          rationale: "Routine support request.",
          internal_summary: "Safe support reply.",
          suggested_response: {
            subject: "Thanks for reaching out",
            body: "We received your message and will follow up shortly with the next step.",
          },
        },
      })
      .mockResolvedValueOnce({
        status: "completed",
        provider: "acp_harness",
        runtime: "acp_harness",
        model: "codex",
        tool_mode: "external_harness",
        requires_human_review: false,
        requires_approval: false,
        output: {
          automation_status: "completed",
          block_reason_code: null,
          retryable: false,
          category: "general_support",
          queue: "support_general",
          priority: "normal",
          confidence: 0.88,
          requires_human_review: false,
          next_action: "Send reply",
          rationale: "Shadow support request.",
          internal_summary: "Shadow support reply.",
          suggested_response: {
            subject: "Thanks for reaching out",
            body: "We received your message and will follow up shortly with the next step.",
          },
        },
      });
    executePhase2WorkflowActions.mockResolvedValue({
      records: [],
      lastResult: null,
      lastState: "sent",
    });

    const { runSupportTriageLoop } = await import("../agents/workflows");
    await runSupportTriageLoop({ limit: 1 });

    expect(runAgentTask).toHaveBeenCalledTimes(2);
    expect(runAgentTask).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        kind: "support_triage",
        provider: "acp_harness",
        session_key: "support:contact-1:shadow:autoagent",
      }),
    );
    expect(docSet).toHaveBeenCalledWith(
      expect.objectContaining({
        ops_automation: expect.objectContaining({
          shadow_runs: expect.objectContaining({
            autoagent: expect.objectContaining({
              kind: "support_triage",
              provider: "acp_harness",
              status: "completed",
            }),
          }),
        }),
      }),
      expect.objectContaining({ merge: true }),
    );
  }, 15_000);

  it("routes payout triage through Phase 2 internal queue updates only", async () => {
    runAgentTask.mockResolvedValue({
      status: "completed",
      provider: "openclaw",
      runtime: "openclaw",
      model: "openai/gpt-5.4",
      tool_mode: "api",
      output: {
        disposition: "collect_missing_info",
        automation_status: "blocked",
        block_reason_code: "missing_payout_info",
        retryable: true,
        queue: "finance_review",
        confidence: 0.74,
        requires_human_review: true,
        next_action: "Send to finance",
        rationale: "Payout data is incomplete.",
        internal_summary: "Needs finance review.",
      },
    });
    executePhase2WorkflowActions.mockResolvedValue({
      records: [],
      lastResult: null,
      lastState: "sent",
    });

    const { runPayoutExceptionTriageLoop } = await import("../agents/workflows");
    const result = await runPayoutExceptionTriageLoop({ limit: 1 });

    expect(result.ok).toBe(true);
    expect(executePhase2WorkflowActions).toHaveBeenCalledWith(
      expect.objectContaining({
        lane: "payout",
        sourceCollection: "creatorPayouts",
        sourceDocId: "payout-1",
      }),
    );
    expect(docSet).toHaveBeenCalledWith(
      expect.objectContaining({
        ops_automation: expect.objectContaining({
          phase2_lane: "payout",
          phase2_action_state: "draft_ready",
        }),
      }),
      expect.objectContaining({ merge: true }),
    );
  });
});
