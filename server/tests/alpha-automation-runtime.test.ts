// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const startActionSession = vi.hoisted(() => vi.fn());
const waitForActionResult = vi.hoisted(() => vi.fn());
const cancelActionSession = vi.hoisted(() => vi.fn());

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

vi.mock("../integrations/openclaw/client", () => ({
  startActionSession,
  waitForActionResult,
  cancelActionSession,
}));

afterEach(() => {
  startActionSession.mockReset();
  waitForActionResult.mockReset();
  cancelActionSession.mockReset();
  vi.resetModules();
});

describe("alpha automation runtime autonomy", () => {
  it("does not emit pending approval for autonomous payout triage lanes", async () => {
    startActionSession.mockResolvedValue({
      accepted: true,
      openclaw_session_id: "session-1",
      openclaw_run_id: "run-1",
      status: "completed",
      result: {
        disposition: "blocked_for_policy",
        automation_status: "blocked",
        block_reason_code: "missing_stripe_context",
        retryable: true,
        queue: "payout_exception_queue",
        confidence: 0.64,
        requires_human_review: false,
        next_action: "Restore the missing Stripe context and rerun the payout automation.",
        rationale: "The payout exception lacks the Stripe linkage needed for safe automated recovery.",
        internal_summary: "Blocked because the payout record is missing Stripe context.",
      },
      error: null,
      raw_output_text: null,
      artifacts: null,
      logs: [],
    });

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

    expect(result.status).toBe("completed");
    expect(result.requires_approval).toBe(false);
    expect(startActionSession).toHaveBeenCalledWith(
      expect.objectContaining({
        policy: expect.objectContaining({
          requires_approval: false,
        }),
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
    expect(startActionSession).not.toHaveBeenCalled();
  });
});
