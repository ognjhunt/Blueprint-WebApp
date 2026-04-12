// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const runAgentTask = vi.hoisted(() => vi.fn());
const decryptInboundRequestForAdmin = vi.hoisted(() => vi.fn());
const dispatchWorkflowHumanReviewBlocker = vi.hoisted(() => vi.fn());
const safelyDispatchHumanBlocker = vi.hoisted(() =>
  vi.fn(async (_label: string, dispatcher: () => Promise<unknown>) => dispatcher()),
);
const docSet = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
      },
    },
  },
  dbAdmin: {
    collection(name: string) {
      if (name !== "inboundRequests") {
        throw new Error(`Unexpected collection ${name}`);
      }
      return {
        where() {
          return {
            limit() {
              return {
                async get() {
                  return {
                    docs: [
                      {
                        id: "request-1",
                        data: () => ({}),
                        ref: {
                          set: docSet,
                        },
                      },
                    ],
                  };
                },
              };
            },
          };
        },
      };
    },
  },
}));

vi.mock("../agents/runtime", () => ({
  runAgentTask,
}));

vi.mock("../utils/field-encryption", () => ({
  decryptInboundRequestForAdmin,
}));

vi.mock("../utils/human-blocker-autonomy", () => ({
  dispatchWorkflowHumanReviewBlocker,
  safelyDispatchHumanBlocker,
}));

afterEach(() => {
  runAgentTask.mockReset();
  decryptInboundRequestForAdmin.mockReset();
  dispatchWorkflowHumanReviewBlocker.mockReset();
  safelyDispatchHumanBlocker.mockClear();
  docSet.mockClear();
  vi.resetModules();
});

describe("workflow human blocker adoption", () => {
  it("dispatches the standard blocker packet for preview diagnosis human-review outputs", async () => {
    decryptInboundRequestForAdmin.mockResolvedValue({
      requestId: "request-1",
      deployment_readiness: {
        provider_run: {
          status: "failed",
        },
      },
      pipeline: {
        artifacts: {},
      },
      ops_automation: {},
    });
    runAgentTask.mockResolvedValue({
      status: "completed",
      provider: "openai_responses",
      runtime: "openai_responses",
      model: "gpt-5.4",
      tool_mode: "api",
      output: {
        disposition: "provider_escalation",
        automation_status: "blocked",
        block_reason_code: "provider_escalation",
        retryable: true,
        retry_recommended: false,
        confidence: 0.42,
        requires_human_review: true,
        next_action: "Inspect the provider failure and decide whether to rerun or escalate.",
        rationale: "Preview provider returned a failed run with no safe automated recovery path.",
        internal_summary: "Preview diagnosis needs technical review.",
      },
    });

    const { runPreviewDiagnosisLoop } = await import("../agents/workflows");
    const result = await runPreviewDiagnosisLoop({ limit: 1 });

    expect(result.processedCount).toBe(1);
    expect(dispatchWorkflowHumanReviewBlocker).toHaveBeenCalledWith(
      expect.objectContaining({
        lane: "preview",
        sourceCollection: "inboundRequests",
        sourceDocId: "request-1",
        recommendedPath: "provider_escalation",
        blockReasonCode: "provider_escalation",
      }),
    );
  });
});
