// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const dispatchHumanBlocker = vi.hoisted(() =>
  vi.fn(async (input: unknown) => input),
);

vi.mock("../utils/human-blocker-dispatch", () => ({
  dispatchHumanBlocker,
}));

afterEach(() => {
  dispatchHumanBlocker.mockReset();
});

describe("human blocker autonomy", () => {
  it("queues runtime approval blockers for chief-of-staff review", async () => {
    const { dispatchRuntimeApprovalHumanBlocker } = await import("../utils/human-blocker-autonomy");

    await dispatchRuntimeApprovalHumanBlocker({
      runId: "run-1",
      approvalReason: "requires_human_approval",
      task: {
        kind: "preview_diagnosis",
      } as never,
      sessionId: "session-1",
      sessionKey: "session-key-1",
    });

    expect(dispatchHumanBlocker).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_mode: "review_required",
        review_owner: "blueprint-chief-of-staff",
        sender_owner: "blueprint-chief-of-staff",
        execution_owner: "webapp-codex",
        blocker_kind: "technical",
      }),
    );
  });

  it("queues workflow blockers for chief-of-staff review", async () => {
    const { dispatchWorkflowHumanReviewBlocker } = await import("../utils/human-blocker-autonomy");

    await dispatchWorkflowHumanReviewBlocker({
      lane: "waitlist",
      sourceCollection: "waitlistEntries",
      sourceDocId: "entry-1",
      nextAction: "Resume the waitlist follow-through.",
      recommendedPath: "manual_review",
      blockReasonCode: "requires_human_review",
    });

    expect(dispatchHumanBlocker).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_mode: "review_required",
        review_owner: "blueprint-chief-of-staff",
        sender_owner: "blueprint-chief-of-staff",
        execution_owner: "ops-lead",
        blocker_kind: "ops_commercial",
      }),
    );
  });
});
