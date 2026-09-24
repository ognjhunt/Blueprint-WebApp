// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const runGeminiVideoTask = vi.hoisted(() => vi.fn());
const runCodexLocalTask = vi.hoisted(() => vi.fn());

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } },
  dbAdmin: null,
  storageAdmin: null,
  authAdmin: null,
}));
vi.mock("../agents/adapters/gemini-video", () => ({ runGeminiVideoTask }));
vi.mock("../agents/adapters/codex-local", () => ({ runCodexLocalTask }));

afterEach(() => {
  runGeminiVideoTask.mockReset();
  runCodexLocalTask.mockReset();
  vi.resetModules();
});

describe("video lanes keep their pinned provider", () => {
  // The website host has no codex binary. When the pin was normalised away,
  // the upload privacy screen failed with `spawn codex ENOENT` on every
  // attempt and no capture reached the Pipeline handoff.
  it.each(["site_video_evidence", "capture_coverage"] as const)(
    "%s runs on gemini_video, never codex_local",
    async (kind) => {
      runGeminiVideoTask.mockImplementation(async (task: { provider: string; model: string }) => ({
        status: "completed",
        provider: task.provider,
        runtime: task.provider,
        model: task.model,
        tool_mode: "api",
        output: {},
        requires_human_review: false,
        requires_approval: false,
      }));
      const { runAgentTask } = await import("../agents/runtime");
      const result = await runAgentTask({
        kind,
        input: { requestId: "r", taskVideoUrl: "https://storage.googleapis.com/b/o.mov" },
      } as never);

      expect(runCodexLocalTask).not.toHaveBeenCalled();
      expect(runGeminiVideoTask).toHaveBeenCalledTimes(1);
      expect(runGeminiVideoTask.mock.calls[0][0]).toMatchObject({ provider: "gemini_video" });
      expect(result.provider).toBe("gemini_video");
    },
  );
});
