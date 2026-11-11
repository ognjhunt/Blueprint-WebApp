// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runAgentTask = vi.hoisted(() => vi.fn());
const automationLaneEnvs = [
  ["BLUEPRINT_WAITLIST_AUTOMATION_ENABLED", "waitlist_triage"],
  ["BLUEPRINT_INBOUND_AUTOMATION_ENABLED", "inbound_qualification"],
  ["BLUEPRINT_SUPPORT_TRIAGE_ENABLED", "support_triage"],
  ["BLUEPRINT_PAYOUT_TRIAGE_ENABLED", "payout_exception_triage"],
  ["BLUEPRINT_PREVIEW_DIAGNOSIS_ENABLED", "preview_diagnosis"],
] as const;

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
    "BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER", "ANTHROPIC_OPERATOR_THREAD_MODEL", "OPENAI_OPERATOR_THREAD_MODEL",
    "OPENAI_DEFAULT_MODEL", "ANTHROPIC_BASE_URL", "BLUEPRINT_OPERATOR_THREAD_PROVIDER"]) {
    vi.stubEnv(name, "");
  }
  for (const provider of ["OPENAI", "ANTHROPIC", "DEEPSEEK", "ZAI", "CODEX", "OPENCLAW"]) {
    vi.stubEnv(`${provider}_DEFAULT_MODEL`, "");
    for (const suffix of ["WAITLIST_AUTOMATION_MODEL", "INBOUND_QUALIFICATION_MODEL",
      "POST_SIGNUP_MODEL", "OPERATOR_THREAD_MODEL", "SUPPORT_TRIAGE_MODEL",
      "PAYOUT_EXCEPTION_MODEL", "PREVIEW_DIAGNOSIS_MODEL", "OUTBOUND_OUTREACH_MODEL"]) {
      vi.stubEnv(`${provider}_${suffix}`, "");
    }
  }
  for (const lane of ["WAITLIST_AUTOMATION", "INBOUND_QUALIFICATION", "POST_SIGNUP",
    "OPERATOR_THREAD", "SUPPORT_TRIAGE", "PAYOUT_EXCEPTION", "PREVIEW_DIAGNOSIS", "OUTBOUND_OUTREACH"]) {
    vi.stubEnv(`BLUEPRINT_${lane}_PROVIDER`, "");
  }
  vi.stubEnv("BLUEPRINT_ALL_AUTOMATION_ENABLED", "");
  for (const [name] of automationLaneEnvs) vi.stubEnv(name, "");
  for (const name of ["BLUEPRINT_SLA_WATCHDOG_ENABLED", "BLUEPRINT_NOTION_SYNC_ENABLED", "BLUEPRINT_ONBOARDING_ENABLED"]) {
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
  it.each(["anthropic-key", ""])("keeps the operator smoke on OpenAI Luna when native key is %s", async (key) => {
    vi.stubEnv("OPENAI_API_KEY", "openai-key");
    vi.stubEnv("ANTHROPIC_API_KEY", key);
    vi.stubEnv("OPENAI_DEFAULT_MODEL", "gpt-6-luna");
    vi.stubEnv("BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", "openai_responses");
    runAgentTask.mockImplementation(async (task) => ({
      status: "completed", provider: task.provider, runtime: task.runtime,
      model: task.model, output: { reply: "passed" },
    }));
    const { getAgentRuntimeConnectionMetadata, runAgentRuntimeSmokeTest } = await import(
      "../agents/runtime-connectivity"
    );
    const metadata = getAgentRuntimeConnectionMetadata();
    expect(metadata).toMatchObject({
      provider: "openai_responses", configured: true, auth_configured: true,
      default_model: "gpt-6-luna",
      task_providers: { operator_thread: "openai_responses", inbound_qualification: "anthropic_agent_sdk" },
      task_models: { operator_thread: "gpt-6-luna", inbound_qualification: "claude-haiku-5-5" },
      task_configured: { operator_thread: true, inbound_qualification: Boolean(key) },
    });
    // Exercise both the admin default and CLI's explicit operator model.
    for (const params of [undefined, { model: metadata.task_models.operator_thread! }]) {
      const result = await runAgentRuntimeSmokeTest(params);
      expect(result.final).toMatchObject({ provider: "openai_responses", model: "gpt-6-luna" });
      expect(runAgentTask).toHaveBeenLastCalledWith(expect.objectContaining({
        kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", model: "gpt-6-luna",
      }));
    }
  });

  it("reports and tests an operator provider override separately from global Anthropic", async () => {
    vi.stubEnv("OPENAI_API_KEY", "openai-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("OPENAI_DEFAULT_MODEL", "gpt-6-luna");
    vi.stubEnv("BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", "anthropic_agent_sdk");
    vi.stubEnv("BLUEPRINT_OPERATOR_THREAD_PROVIDER", "openai_responses");
    runAgentTask.mockResolvedValue({ status: "completed", output: { reply: "passed" } });
    const { getAgentRuntimeConnectionMetadata, runAgentRuntimeSmokeTest } = await import(
      "../agents/runtime-connectivity"
    );
    const metadata = getAgentRuntimeConnectionMetadata();
    const { getOpenAiTimeoutMs } = await import("../agents/provider-config");
    expect(metadata).toMatchObject({
      provider: "openai_responses", fallback_provider: "anthropic_agent_sdk",
      configured: true, default_model: "gpt-6-luna", timeout_ms: getOpenAiTimeoutMs(),
      task_providers: { operator_thread: "openai_responses", preview_diagnosis: "anthropic_agent_sdk" },
    });
    await runAgentRuntimeSmokeTest({ model: metadata.task_models.operator_thread! });
    expect(runAgentTask).toHaveBeenCalledWith(expect.objectContaining({
      kind: "operator_thread", provider: "openai_responses", runtime: "openai_responses", model: "gpt-6-luna",
    }));
  });

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

describe("launch readiness for structured automation", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "openai-key");
    vi.stubEnv("OPENAI_DEFAULT_MODEL", "gpt-6-luna");
    vi.stubEnv("BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", "openai_responses");
  });

  it.each(automationLaneEnvs)("blocks %s without native configuration, while operator smoke remains configured", async (envName, taskKind) => {
    vi.stubEnv(envName, "true");
    const { buildLaunchReadinessSnapshot, listActiveReadinessFindings } = await import("../utils/launch-readiness");
    const snapshot = buildLaunchReadinessSnapshot();
    expect(snapshot.dependencies.agentRuntime.configured).toBe(true);
    expect(snapshot.dependencies.agentRuntime.task_configured[taskKind]).toBe(false);
    expect(snapshot.checks.agentRuntime).toBe(false);
    expect(snapshot.dependencies.launchChecks.agentRuntime.required).toBe(true);
    expect(listActiveReadinessFindings(snapshot)).toContainEqual(expect.objectContaining({
      stableId: "readiness:agentRuntime",
      detail: expect.stringContaining(`${taskKind} (anthropic_agent_sdk/claude-haiku-5-5)`),
    }));
    expect(runAgentTask).not.toHaveBeenCalled();
  });

  it.each(["", "https://api.anthropic.com/"])("accepts native configuration with base URL %s without dispatching a provider", async (baseUrl) => {
    vi.stubEnv("BLUEPRINT_INBOUND_AUTOMATION_ENABLED", "true");
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("ANTHROPIC_BASE_URL", baseUrl);
    const { buildLaunchReadinessSnapshot } = await import("../utils/launch-readiness");
    const snapshot = buildLaunchReadinessSnapshot();
    expect(snapshot.checks.agentRuntime).toBe(true);
    expect(snapshot.dependencies.launchChecks.agentRuntime.detail).toContain("inbound_qualification (anthropic_agent_sdk/claude-haiku-5-5)");
    expect(runAgentTask).not.toHaveBeenCalled();
  });

  it("rejects a proxy endpoint for a migrated native Haiku lane even when an Anthropic key is present", async () => {
    vi.stubEnv("BLUEPRINT_INBOUND_AUTOMATION_ENABLED", "true");
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://proxy.example.invalid");
    const { buildLaunchReadinessSnapshot } = await import("../utils/launch-readiness");
    const snapshot = buildLaunchReadinessSnapshot();
    expect(snapshot.dependencies.agentRuntime.configured).toBe(true);
    expect(snapshot.checks.agentRuntime).toBe(false);
    expect(snapshot.dependencies.agentRuntime.task_configured.inbound_qualification).toBe(false);
  });

  it("requires the configured automation lane without requiring the separate operator provider", async () => {
    vi.stubEnv("BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", "anthropic_agent_sdk");
    vi.stubEnv("BLUEPRINT_INBOUND_AUTOMATION_ENABLED", "true");
    vi.stubEnv("BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER", "openai_responses");
    vi.stubEnv("OPENAI_INBOUND_QUALIFICATION_MODEL", "gpt-6-sol");
    vi.stubEnv("ANTHROPIC_OPERATOR_THREAD_MODEL", "claude-haiku-5-5");
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("ANTHROPIC_BASE_URL", "https://proxy.example.invalid");
    const { buildLaunchReadinessSnapshot } = await import("../utils/launch-readiness");
    const snapshot = buildLaunchReadinessSnapshot();
    expect(snapshot.dependencies.agentRuntime.configured).toBe(false);
    expect(snapshot.dependencies.agentRuntime.task_configured.inbound_qualification).toBe(true);
    expect(snapshot.checks.agentRuntime).toBe(true);
  });

  it("preserves an enabled Sol override and only blocks the unconfigured Luna replacement in mixed lanes", async () => {
    vi.stubEnv("BLUEPRINT_INBOUND_AUTOMATION_ENABLED", "true");
    vi.stubEnv("BLUEPRINT_SUPPORT_TRIAGE_ENABLED", "true");
    vi.stubEnv("OPENAI_SUPPORT_TRIAGE_MODEL", "gpt-6-sol");
    const { buildLaunchReadinessSnapshot } = await import("../utils/launch-readiness");
    const snapshot = buildLaunchReadinessSnapshot();
    expect(snapshot.dependencies.agentRuntime.task_configured.support_triage).toBe(true);
    expect(snapshot.dependencies.agentRuntime.task_models.support_triage).toBe("gpt-6-sol");
    expect(snapshot.checks.agentRuntime).toBe(false);
    expect(snapshot.dependencies.launchChecks.agentRuntime.detail).toContain("inbound_qualification");
    expect(snapshot.dependencies.launchChecks.agentRuntime.detail).not.toContain("support_triage");
    vi.stubEnv("BLUEPRINT_INBOUND_AUTOMATION_ENABLED", "false");
    expect(buildLaunchReadinessSnapshot().checks.agentRuntime).toBe(true);
  });

  it("honors explicit task opt-outs under the umbrella and leaves deterministic workers to their own checks", async () => {
    vi.stubEnv("BLUEPRINT_ALL_AUTOMATION_ENABLED", "true");
    for (const [name] of automationLaneEnvs) vi.stubEnv(name, "false");
    const { buildLaunchReadinessSnapshot } = await import("../utils/launch-readiness");
    const snapshot = buildLaunchReadinessSnapshot();
    expect(snapshot.checks.agentRuntime).toBe(true);
    expect(snapshot.dependencies.launchChecks.agentRuntime.required).toBe(false);
    expect(snapshot.dependencies.launchChecks.notionSync.required).toBe(true);
    expect(snapshot.blockers.some((blocker) => blocker.startsWith("agentRuntime:"))).toBe(false);
    vi.stubEnv("BLUEPRINT_INBOUND_AUTOMATION_ENABLED", "");
    expect(buildLaunchReadinessSnapshot().checks.agentRuntime).toBe(false);
  });
});
