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
    "DEEPSEEK_API_KEY", "ZAI_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY",
    "ACP_HARNESS_URL", "OPENCLAW_BASE_URL", "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER",
    "BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER", "ANTHROPIC_OPERATOR_THREAD_MODEL", "OPENAI_OPERATOR_THREAD_MODEL",
    "ANTHROPIC_BASE_URL"]) {
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
  it("does not select Anthropic when ANTHROPIC_BASE_URL names another host, and says why without the value", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://api.other-company.example/anthropic");
    const { getAgentRuntimeConnectionMetadata } = await import("../agents/runtime-connectivity");
    const metadata = getAgentRuntimeConnectionMetadata();
    expect(metadata).toMatchObject({ provider: "openai_responses",
      anthropic_not_configured_reason: "anthropic_base_url_names_another_host" });
    expect(JSON.stringify(metadata)).not.toContain("other-company");
  });

  it("prefers configured Anthropic runtime metadata when selected", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
    process.env.ANTHROPIC_OPERATOR_THREAD_MODEL = "claude-sonnet-test";

    const { getAgentRuntimeConnectionMetadata } = await import(
      "../agents/runtime-connectivity"
    );

    // The global report follows the setting; the operator lane, whose tools
    // read jobs and company history, stays on OpenAI (the data-class gate).
    expect(getAgentRuntimeConnectionMetadata()).toMatchObject({
      provider: "anthropic_agent_sdk",
      configured: true,
      default_model: "gpt-6-luna",
      task_providers: { operator_thread: "openai_responses" },
    });
  });

  it("runs smoke tests on the operator lane's own provider, and refuses one the gate does not permit", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
    {
      const { runAgentRuntimeSmokeTest } = await import("../agents/runtime-connectivity");
      // Anthropic only: the operator lane may not run there, so the smoke test sends nothing.
      await expect(runAgentRuntimeSmokeTest()).rejects.toThrow("permitted_provider_not_configured");
      expect(runAgentTask).not.toHaveBeenCalled();
    }
    process.env.OPENAI_API_KEY = "openai-key";
    vi.resetModules();
    runAgentTask.mockResolvedValue({
      status: "completed",
      provider: "openai_responses",
      runtime: "openai_responses",
      model: "gpt-6-luna",
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
        kind: "operator_thread",
        provider: "openai_responses",
        runtime: "openai_responses",
      }),
    );
  });

  it("ignores a key left set for a removed provider", async () => {
    // DeepSeek and Z.ai are removed: a key still set in a deployment selects nothing.
    process.env.DEEPSEEK_API_KEY = "left-over-key";
    process.env.ZAI_API_KEY = "left-over-key";
    process.env.OPENAI_API_KEY = "openai-key";

    const { getAgentRuntimeConnectionMetadata } = await import(
      "../agents/runtime-connectivity"
    );

    expect(getAgentRuntimeConnectionMetadata()).toMatchObject({
      provider: "openai_responses",
      configured: true,
    });
  });

  it("prefers local Codex when the auth file is present", async () => {
    process.env.CODEX_LOCAL_AVAILABLE = "1";
    process.env.CODEX_DEFAULT_MODEL = "gpt-5.4-mini";

    const { getAgentRuntimeConnectionMetadata } = await import(
      "../agents/runtime-connectivity"
    );

    // The global report is local Codex; the operator lane may not run there,
    // so its model is the OpenAI one it would use (and, with no key, it sends nothing).
    expect(getAgentRuntimeConnectionMetadata()).toMatchObject({
      provider: "codex_local",
      configured: true,
      default_model: "gpt-6-luna",
    });
  });
});
