// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const runOpenAIResponsesTask = vi.hoisted(() => vi.fn());
const dispatchRuntimeApprovalHumanBlocker = vi.hoisted(() => vi.fn());
const safelyDispatchHumanBlocker = vi.hoisted(() =>
  vi.fn(async (_label: string, dispatcher: () => Promise<unknown>) => dispatcher()),
);

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

vi.mock("../utils/human-blocker-autonomy", () => ({
  dispatchRuntimeApprovalHumanBlocker,
  safelyDispatchHumanBlocker,
}));

afterEach(() => {
  runOpenAIResponsesTask.mockReset();
  dispatchRuntimeApprovalHumanBlocker.mockReset();
  safelyDispatchHumanBlocker.mockClear();
  vi.resetModules();
});

describe("alpha automation runtime autonomy", () => {
  it("honors explicit approval policies for sensitive automation lanes", async () => {
    const { runAgentTask } = await import("../agents/runtime");
    const result = await runAgentTask({
      kind: "support_triage",
      input: {
        id: "support-1",
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
    expect(dispatchRuntimeApprovalHumanBlocker).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.objectContaining({
          kind: "support_triage",
        }),
        approvalReason: expect.any(String),
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
    expect(dispatchRuntimeApprovalHumanBlocker).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.objectContaining({
          kind: "operator_thread",
        }),
      }),
    );
  });
});
