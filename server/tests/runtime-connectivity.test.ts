// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const runAgentTask = vi.hoisted(() => vi.fn());

vi.mock("../agents/runtime", () => ({
  runAgentTask,
}));

afterEach(() => {
  delete process.env.CODEX_LOCAL_AVAILABLE;
  delete process.env.CODEX_AUTH_FILE;
  delete process.env.CODEX_DEFAULT_MODEL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ACP_HARNESS_URL;
  delete process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER;
  delete process.env.BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER;
  delete process.env.ANTHROPIC_OPERATOR_THREAD_MODEL;
  delete process.env.OPENAI_OPERATOR_THREAD_MODEL;
  runAgentTask.mockReset();
  vi.resetModules();
});

describe("runtime connectivity", () => {
  it("prefers configured Anthropic runtime metadata when selected", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
    process.env.ANTHROPIC_OPERATOR_THREAD_MODEL = "claude-sonnet-test";

    const { getAgentRuntimeConnectionMetadata } = await import(
      "../agents/runtime-connectivity"
    );

    expect(getAgentRuntimeConnectionMetadata()).toMatchObject({
      provider: "anthropic_agent_sdk",
      configured: true,
      default_model: "claude-sonnet-test",
    });
  });

  it("runs smoke tests against the selected provider instead of hardcoding OpenAI", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
    runAgentTask.mockResolvedValue({
      status: "completed",
      provider: "anthropic_agent_sdk",
      runtime: "anthropic_agent_sdk",
      model: "claude-sonnet-4-5",
      tool_mode: "api",
      output: {
        reply: "Agent runtime smoke test passed.",
        summary: "Smoke test completed successfully.",
        suggested_actions: ["Continue integration"],
        requires_human_review: false,
      },
      requires_human_review: false,
      requires_approval: false,
      error: null,
    });

    const { runAgentRuntimeSmokeTest } = await import(
      "../agents/runtime-connectivity"
    );

    const result = await runAgentRuntimeSmokeTest();

    expect(result.ok).toBe(true);
    expect(runAgentTask).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "anthropic_agent_sdk",
        runtime: "anthropic_agent_sdk",
      }),
    );
  });

  it("prefers local Codex when the auth file is present", async () => {
    process.env.CODEX_LOCAL_AVAILABLE = "1";
    process.env.CODEX_DEFAULT_MODEL = "gpt-5.4-mini";

    const { getAgentRuntimeConnectionMetadata } = await import(
      "../agents/runtime-connectivity"
    );

    expect(getAgentRuntimeConnectionMetadata()).toMatchObject({
      provider: "codex_local",
      configured: true,
      default_model: "gpt-5.4-mini",
    });
  });
});
