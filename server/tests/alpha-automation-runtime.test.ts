// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const runOpenAIResponsesTask = vi.hoisted(() => vi.fn());

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
      },
    },
  },
  dbAdmin: null,
  storageAdmin: null,
  authAdmin: null,
}));

vi.mock("../agents/adapters/openai-responses", () => ({
  runOpenAIResponsesTask,
}));

afterEach(() => {
  runOpenAIResponsesTask.mockReset();
  vi.resetModules();
});

describe("alpha automation runtime autonomy", () => {
  it("honors explicit approval policies for sensitive automation lanes", async () => {
    const { runAgentTask } = await import("../agents/runtime");
    const result = await runAgentTask({
      kind: "payout_exception_triage",
      input: {
        id: "payout-1",
      },
      approval_policy: {
        require_human_approval: true,
        sensitive_actions: ["payout", "financial"],
        allow_preapproval: false,
      },
    });

    expect(result.status).toBe("pending_approval");
    expect(result.requires_approval).toBe(true);
    expect(runOpenAIResponsesTask).not.toHaveBeenCalled();
  });

  it("keeps payout triage executable while marking the result for human review", async () => {
    runOpenAIResponsesTask.mockResolvedValue({
      status: "completed",
      provider: "openai_responses",
      runtime: "openai_responses",
      model: "gpt-5.4",
      tool_mode: "api",
      output: {
        disposition: "blocked_for_policy",
        automation_status: "blocked",
        block_reason_code: "missing_stripe_context",
        retryable: true,
        queue: "payout_exception_queue",
        confidence: 0.64,
        requires_human_review: true,
        next_action: "Restore the missing Stripe context and rerun the payout automation.",
        rationale: "The payout exception lacks the Stripe linkage needed for safe automated recovery.",
        internal_summary: "Blocked because the payout record is missing Stripe context.",
      },
      raw_output_text: null,
      requires_human_review: true,
      requires_approval: false,
    });

    const { runAgentTask } = await import("../agents/runtime");
    const result = await runAgentTask({
      kind: "payout_exception_triage",
      provider: "openai_responses",
      runtime: "openai_responses",
      input: {
        id: "payout-1",
      },
    });

    expect(result.status).toBe("completed");
    expect(result.requires_approval).toBe(false);
    expect(result.requires_human_review).toBe(true);
    expect(runOpenAIResponsesTask).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai_responses",
        runtime: "openai_responses",
      }),
    );
  });

  it("still allows manual operator sessions to enter the approval path", async () => {
    const { runAgentTask } = await import("../agents/runtime");
    const result = await runAgentTask({
      kind: "operator_thread",
      input: {
        message: "Move payout funds immediately.",
      },
      approval_policy: {
        require_human_approval: true,
        sensitive_actions: ["payout", "financial"],
        allow_preapproval: false,
      },
    });

    expect(result.status).toBe("pending_approval");
    expect(runOpenAIResponsesTask).not.toHaveBeenCalled();
  });
});
