// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runAgentTask = vi.hoisted(() => vi.fn());

vi.mock("../agents/runtime", () => ({
  runAgentTask,
}));

beforeEach(() => {
  // Provider preference tests must not depend on the developer's configured
  // house provider or local auth. Restore ambient values without reading them.
  for (const name of ["CODEX_LOCAL_AVAILABLE", "CODEX_AUTH_FILE", "CODEX_DEFAULT_MODEL",
    "DEEPSEEK_API_KEY", "DEEPSEEK_DEFAULT_MODEL", "DEEPSEEK_OPERATOR_THREAD_MODEL", "DEEPSEEK_TIMEOUT_MS",
    "ZAI_API_KEY", "ZAI_DEFAULT_MODEL", "ZAI_OPERATOR_THREAD_MODEL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
    "ACP_HARNESS_URL", "OPENCLAW_BASE_URL", "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER",
    "BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER", "ANTHROPIC_OPERATOR_THREAD_MODEL", "OPENAI_OPERATOR_THREAD_MODEL"]) {
    vi.stubEnv(name, "");
  }
  vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
});

afterEach(() => {
  vi.unstubAllEnvs();
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

  it("prefers DeepSeek when a DeepSeek key is configured", async () => {
    process.env.DEEPSEEK_API_KEY = "deepseek-key";

    const { getAgentRuntimeConnectionMetadata } = await import(
      "../agents/runtime-connectivity"
    );

    expect(getAgentRuntimeConnectionMetadata()).toMatchObject({
      provider: "deepseek_chat",
      configured: true,
      default_model: "deepseek-v4-pro",
    });
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
