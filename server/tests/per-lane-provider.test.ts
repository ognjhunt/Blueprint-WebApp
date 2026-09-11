/**
 * One lane on a different model from the rest.
 *
 * The model was already per-lane; the provider was not. Every structured task
 * called `getStructuredAutomationProvider()` with no argument, so
 * `BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER` moved all seven lanes at once —
 * waitlist triage, support triage, payout exceptions, preview diagnosis,
 * post-signup scheduling, the operator thread and robot capability extraction
 * travelled with inbound qualification. That made "run qualification on Luna"
 * an all-or-nothing change, and it meant `openai_responses: "gpt-5.6-luna"`
 * could sit in the deployed code doing nothing because nothing routed to it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = [
  "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER",
  "BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER",
  "BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER",
  "BLUEPRINT_SUPPORT_TRIAGE_PROVIDER",
  "BLUEPRINT_OPERATOR_THREAD_PROVIDER",
  "CODEX_LOCAL_AVAILABLE",
  "DEEPSEEK_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "ACP_HARNESS_URL",
  "OPENCLAW_BASE_URL",
];

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

beforeEach(() => {
  clearEnv();
  vi.resetModules();
  // Deterministic: this machine may have a real ~/.codex/auth.json.
  process.env.CODEX_LOCAL_AVAILABLE = "0";
});

afterEach(() => {
  clearEnv();
  vi.resetModules();
});

/** The shape the founder would actually set on Render. */
function lunaOnQualificationOnly() {
  process.env.DEEPSEEK_API_KEY = "deepseek-key";
  process.env.OPENAI_API_KEY = "openai-key";
  process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "deepseek_chat";
  process.env.BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER = "openai_responses";
  vi.resetModules();
}

describe("per-lane provider override", () => {
  it("moves one lane to OpenAI and leaves the others on DeepSeek", async () => {
    lunaOnQualificationOnly();
    const { getStructuredAutomationProvider } = await import("../agents/provider-config");

    expect(getStructuredAutomationProvider("inbound_qualification")).toBe("openai_responses");
    expect(getStructuredAutomationProvider("support_triage")).toBe("deepseek_chat");
    expect(getStructuredAutomationProvider("waitlist_triage")).toBe("deepseek_chat");
    expect(getStructuredAutomationProvider("operator_thread")).toBe("deepseek_chat");
    expect(getStructuredAutomationProvider()).toBe("deepseek_chat");
  });

  it("pairs the moved lane with that provider's own model", async () => {
    lunaOnQualificationOnly();
    const { getStructuredAutomationProvider, getTaskModelByProvider } = await import(
      "../agents/provider-config"
    );

    const provider = getStructuredAutomationProvider("inbound_qualification");
    expect(getTaskModelByProvider("inbound_qualification")[provider]).toBe("gpt-5.6-luna");
  });

  it("leaves every lane on the global provider when no override is set", async () => {
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "deepseek_chat";
    vi.resetModules();
    const { getStructuredAutomationProvider } = await import("../agents/provider-config");

    expect(getStructuredAutomationProvider("inbound_qualification")).toBe("deepseek_chat");
    expect(getStructuredAutomationProvider("support_triage")).toBe("deepseek_chat");
  });

  it("keeps the lane running when the override names a provider with no key", async () => {
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "deepseek_chat";
    process.env.BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER = "openai_responses";
    vi.resetModules();
    const { getStructuredAutomationProvider } = await import("../agents/provider-config");

    // Falling back beats taking the most consequential lane offline.
    expect(getStructuredAutomationProvider("inbound_qualification")).toBe("deepseek_chat");
  });

  it("says the override was not honoured rather than falling back silently", async () => {
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "deepseek_chat";
    process.env.BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER = "openai_responses";
    vi.resetModules();
    const { describeStructuredAutomationProvider } = await import("../agents/provider-config");

    expect(describeStructuredAutomationProvider("inbound_qualification")).toEqual({
      provider: "deepseek_chat",
      lane_env_key: "BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER",
      lane_request: "openai_responses",
      lane_request_honored: false,
      reason: "lane_request_not_configured",
    });
  });

  it("reports a honoured override as honoured", async () => {
    lunaOnQualificationOnly();
    const { describeStructuredAutomationProvider } = await import("../agents/provider-config");

    expect(describeStructuredAutomationProvider("inbound_qualification")).toMatchObject({
      provider: "openai_responses",
      lane_request: "openai_responses",
      lane_request_honored: true,
      reason: "lane_override",
    });
  });

  it("ignores a provider name that is not a provider", async () => {
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "deepseek_chat";
    process.env.BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER = "luna";
    vi.resetModules();
    const { describeStructuredAutomationProvider } = await import("../agents/provider-config");

    expect(describeStructuredAutomationProvider("inbound_qualification")).toMatchObject({
      provider: "deepseek_chat",
      lane_request: "luna",
      lane_request_honored: false,
      reason: "lane_request_unrecognized",
    });
  });

  it("keeps the fallback provider distinct from the lane's own provider", async () => {
    lunaOnQualificationOnly();
    const { getStructuredAutomationFallbackProvider } = await import(
      "../agents/provider-config"
    );

    expect(getStructuredAutomationFallbackProvider("inbound_qualification")).toBe(
      "deepseek_chat",
    );
  });
});

describe("task definitions", () => {
  it("wires the qualification task to its own lane provider", async () => {
    lunaOnQualificationOnly();
    const { inboundQualificationTask } = await import(
      "../agents/tasks/inbound-qualification"
    );

    expect(inboundQualificationTask.default_provider).toBe("openai_responses");
    expect(inboundQualificationTask.model_by_provider?.openai_responses).toBe(
      "gpt-5.6-luna",
    );
  });

  it("leaves a lane without an override on the global provider", async () => {
    lunaOnQualificationOnly();
    const { supportTriageTask } = await import("../agents/tasks/support-triage");

    expect(supportTriageTask.default_provider).toBe("deepseek_chat");
  });
});

describe("runtime connectivity metadata", () => {
  it("reports the provider and model each lane will actually use", async () => {
    lunaOnQualificationOnly();
    const { getAgentRuntimeConnectionMetadata } = await import(
      "../agents/runtime-connectivity"
    );

    const metadata = getAgentRuntimeConnectionMetadata();
    expect(metadata.task_providers.inbound_qualification).toBe("openai_responses");
    expect(metadata.task_providers.support_triage).toBe("deepseek_chat");
    expect(metadata.task_models.inbound_qualification).toBe("gpt-5.6-luna");
    expect(metadata.task_models.support_triage).toBe("deepseek-v4-pro");
  });

  it("surfaces a lane override that did not take effect", async () => {
    process.env.DEEPSEEK_API_KEY = "deepseek-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "deepseek_chat";
    process.env.BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER = "openai_responses";
    vi.resetModules();
    const { getAgentRuntimeConnectionMetadata } = await import(
      "../agents/runtime-connectivity"
    );

    expect(getAgentRuntimeConnectionMetadata().unhonored_lane_providers).toEqual([
      {
        task_kind: "inbound_qualification",
        env_key: "BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER",
        requested: "openai_responses",
        using: "deepseek_chat",
        reason: "lane_request_not_configured",
      },
    ]);
  });

  it("reports nothing unhonoured when every lane got what it asked for", async () => {
    lunaOnQualificationOnly();
    const { getAgentRuntimeConnectionMetadata } = await import(
      "../agents/runtime-connectivity"
    );

    expect(getAgentRuntimeConnectionMetadata().unhonored_lane_providers).toEqual([]);
  });
});

describe("documented env keys", () => {
  /**
   * The key name is derived from the lane's model suffix, so it is easy to
   * document one spelling and ship another. An operator who sets a misspelled
   * variable on Render gets silence, not an error.
   */
  it("documents the real key for every lane that has one", async () => {
    const fs = await import("node:fs");
    const example = fs.readFileSync("render.optional.env.example", "utf8");
    const { getLaneProviderEnvKey } = await import("../agents/provider-config");

    const lanes = [
      "waitlist_triage",
      "inbound_qualification",
      "post_signup_scheduling",
      "support_triage",
      "payout_exception_triage",
      "preview_diagnosis",
      "operator_thread",
      "robot_capability_extraction",
    ] as const;

    for (const lane of lanes) {
      const key = getLaneProviderEnvKey(lane);
      expect(key, `${lane} should have a lane provider key`).toBeTruthy();
      expect(example, `${key} should appear in render.optional.env.example`).toContain(
        key!,
      );
    }
  });
});
