// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const runAgentTask = vi.hoisted(() => vi.fn());
const docSet = vi.hoisted(() => vi.fn());
const decryptInboundRequestForAdmin = vi.hoisted(() => vi.fn());

const previewDoc = {
  id: "request-1",
  data: () => ({
    requestId: "request-1",
    deployment_readiness: {
      provider_run: {
        status: "failed",
      },
    },
    ops_automation: {},
  }),
  ref: {
    set: docSet,
  },
};

const fakeDb = {
  collection: vi.fn((name: string) => {
    if (name !== "inboundRequests") {
      throw new Error(`Unexpected collection ${name}`);
    }

    return {
      where: vi.fn(() => ({
        limit: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({ docs: [previewDoc] }),
        })),
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

vi.mock("../agents/runtime", () => ({
  runAgentTask,
}));

vi.mock("../utils/field-encryption", () => ({
  decryptInboundRequestForAdmin,
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
  decryptInboundRequestForAdmin.mockReset();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("preview diagnosis AutoAgent shadow", () => {
  it("runs a preview shadow pass when enabled", async () => {
    vi.stubEnv("BLUEPRINT_AUTOAGENT_SHADOW_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_AUTOAGENT_SHADOW_LANES", "preview_diagnosis");
    vi.stubEnv("BLUEPRINT_AUTOAGENT_SHADOW_PROVIDER", "acp_harness");

    decryptInboundRequestForAdmin.mockResolvedValue({
      requestId: "request-1",
      deployment_readiness: {
        preview_status: "failed",
        provider_run: {
          status: "failed",
          provider_name: "worldlabs",
          provider_model: "wm-preview",
          provider_run_id: "run-1",
          failure_reason: "artifact mismatch",
          preview_manifest_uri: "gs://preview.json",
        },
      },
      pipeline: {
        scene_id: "scene-1",
        artifacts: {
          worldlabs_operation_manifest_uri: "gs://operation.json",
          worldlabs_world_manifest_uri: "gs://world.json",
        },
      },
      ops_automation: {},
    });

    runAgentTask
      .mockResolvedValueOnce({
        status: "completed",
        provider: "openclaw",
        runtime: "openclaw",
        model: "openai/gpt-5.4",
        tool_mode: "api",
        requires_human_review: true,
        requires_approval: false,
        output: {
          disposition: "provider_escalation",
          automation_status: "blocked",
          block_reason_code: "provider_artifact_failure",
          retryable: false,
          queue: "preview_release_review",
          confidence: 0.84,
          requires_human_review: true,
          retry_recommended: false,
          next_action: "Escalate to provider review",
          rationale: "Provider-side artifact issue.",
          internal_summary: "Provider escalation needed.",
        },
      })
      .mockResolvedValueOnce({
        status: "completed",
        provider: "acp_harness",
        runtime: "acp_harness",
        model: "codex",
        tool_mode: "external_harness",
        requires_human_review: true,
        requires_approval: false,
        output: {
          disposition: "provider_escalation",
          automation_status: "blocked",
          block_reason_code: "provider_artifact_failure",
          retryable: false,
          queue: "preview_release_review",
          confidence: 0.82,
          requires_human_review: true,
          retry_recommended: false,
          next_action: "Escalate to provider review",
          rationale: "Shadow provider-side artifact issue.",
          internal_summary: "Shadow provider escalation needed.",
        },
      });

    const { runPreviewDiagnosisLoop } = await import("../agents/workflows");
    const result = await runPreviewDiagnosisLoop({ limit: 1 });

    expect(result.ok).toBe(true);
    expect(runAgentTask).toHaveBeenCalledTimes(2);
    expect(runAgentTask).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        kind: "preview_diagnosis",
        provider: "acp_harness",
        session_key: "preview:request-1:shadow:autoagent",
      }),
    );
    expect(docSet).toHaveBeenCalledWith(
      expect.objectContaining({
        ops_automation: expect.objectContaining({
          shadow_runs: expect.objectContaining({
            autoagent: expect.objectContaining({
              kind: "preview_diagnosis",
              provider: "acp_harness",
              status: "completed",
            }),
          }),
        }),
      }),
      expect.objectContaining({ merge: true }),
    );
  });
});
