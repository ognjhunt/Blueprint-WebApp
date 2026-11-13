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
  "OPENAI_DEFAULT_MODEL",
  "CODEX_LOCAL_AVAILABLE",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "ACP_HARNESS_URL",
  "OPENCLAW_BASE_URL",
];

function isolateEnv() {
  for (const key of ENV_KEYS) vi.stubEnv(key, "");
}

beforeEach(() => {
  isolateEnv();
  vi.resetModules();
  // Deterministic: this machine may have a real ~/.codex/auth.json.
  process.env.CODEX_LOCAL_AVAILABLE = "0";
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** The shape the founder would actually set on Render. */
function lunaOnQualificationOnly() {
  process.env.ANTHROPIC_API_KEY = "anthropic-key";
  process.env.OPENAI_API_KEY = "openai-key";
  process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
  process.env.BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER = "openai_responses";
  vi.resetModules();
}

describe("per-lane provider override", () => {
  it("moves one lane to OpenAI and leaves lanes without a default on the global provider where the gate permits it", async () => {
    lunaOnQualificationOnly();
    const { getStructuredAutomationProvider, describeStructuredAutomationProvider } = await import("../agents/provider-config");

    expect(getStructuredAutomationProvider("inbound_qualification")).toBe("openai_responses");
    // Public material: Anthropic may receive it, so the global setting holds.
    expect(getStructuredAutomationProvider("robot_capability_extraction")).toBe("anthropic_agent_sdk");
    // A job's records: Anthropic may not receive them; the global setting is refused for this lane.
    expect(describeStructuredAutomationProvider("preview_diagnosis")).toMatchObject({ provider: "openai_responses",
      refused_settings: [{ env_key: "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", requested: "anthropic_agent_sdk",
        reason: "privacy_not_permitted", blocked_by: ["job_records"] }] });
    expect(getStructuredAutomationProvider()).toBe("anthropic_agent_sdk");
  });

  it("pairs the moved lane with that provider's own model", async () => {
    lunaOnQualificationOnly();
    const { getStructuredAutomationProvider, getTaskModelByProvider } = await import(
      "../agents/provider-config"
    );

    const provider = getStructuredAutomationProvider("inbound_qualification");
    expect(getTaskModelByProvider("inbound_qualification")[provider]).toBe("gpt-6-luna");
  });

  it("sends the lanes that write to people to OpenAI by default, and nothing else", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
    vi.resetModules();
    const { describeStructuredAutomationProvider, getStructuredAutomationProvider } = await import(
      "../agents/provider-config"
    );

    for (const lane of ["outbound_outreach", "waitlist_triage", "inbound_qualification", "support_triage", "post_signup_scheduling"] as const) {
      expect(describeStructuredAutomationProvider(lane)).toMatchObject({
        provider: "openai_responses",
        reason: "lane_default",
      });
    }
    expect(getStructuredAutomationProvider("operator_thread")).toBe("anthropic_agent_sdk");
  });

  it("fails an email lane closed when OpenAI has no key: Anthropic may not receive personal information", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
    vi.resetModules();
    const { describeStructuredAutomationProvider } = await import("../agents/provider-config");

    expect(describeStructuredAutomationProvider("outbound_outreach")).toMatchObject({
      provider: "openai_responses",
      lane_request_honored: false,
      reason: "lane_default_not_configured",
      fails_closed: "permitted_provider_not_configured",
    });
  });

  it("fails the lane closed when the override names a provider with no key and no other permitted provider has one", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
    process.env.BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER = "openai_responses";
    vi.resetModules();
    const { getStructuredAutomationProvider } = await import("../agents/provider-config");

    // Not by moving its data to a provider the Privacy Policy does not name for
    // it: without an OpenAI key the lane fails closed and sends nothing.
    expect(getStructuredAutomationProvider("inbound_qualification")).toBe("openai_responses");
  });

  it("says the override was not honoured rather than falling back silently", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
    process.env.BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER = "openai_responses";
    vi.resetModules();
    const { describeStructuredAutomationProvider } = await import("../agents/provider-config");

    expect(describeStructuredAutomationProvider("inbound_qualification")).toEqual({
      provider: "openai_responses",
      lane_env_key: "BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER",
      lane_request: "openai_responses",
      lane_request_honored: false,
      lane_setting_names_removed_provider: false,
      reason: "lane_request_not_configured",
      refused_settings: [{ env_key: "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", requested: "anthropic_agent_sdk",
        reason: "privacy_not_permitted", blocked_by: ["personal_info", "site_job_text"] }],
      fails_closed: "permitted_provider_not_configured",
      anthropic_model_not_supported: null,
      provider_list: null,
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
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
    process.env.BLUEPRINT_INBOUND_QUALIFICATION_PROVIDER = "luna";
    vi.resetModules();
    const { describeStructuredAutomationProvider } = await import("../agents/provider-config");

    expect(describeStructuredAutomationProvider("inbound_qualification")).toMatchObject({
      provider: "openai_responses",
      fails_closed: "permitted_provider_not_configured",
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

    // Anthropic may not receive the qualification lane's data, so it has no fallback.
    expect(getStructuredAutomationFallbackProvider("inbound_qualification")).toBeNull();
    expect(getStructuredAutomationFallbackProvider("robot_capability_extraction")).toBe("openai_responses");
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
      "gpt-6-luna",
    );
  });

  it("puts an email lane on OpenAI and a lane with no default on the global provider", async () => {
    lunaOnQualificationOnly();
    const { supportTriageTask } = await import("../agents/tasks/support-triage");
    const { robotCapabilityExtractionTask } = await import("../agents/tasks/robot-capability-extraction");
    const { previewDiagnosisTask } = await import("../agents/tasks/preview-diagnosis");

    expect(supportTriageTask.default_provider).toBe("openai_responses");
    expect(robotCapabilityExtractionTask.default_provider).toBe("anthropic_agent_sdk");
    // A job's records stay on OpenAI: the gate refuses the global setting for that lane.
    expect(previewDiagnosisTask.default_provider).toBe("openai_responses");
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
    expect(metadata.task_providers.support_triage).toBe("openai_responses");
    // The staff lane fails closed: it shows no provider and no model.
    expect(metadata.task_providers.operator_thread).toBeNull();
    expect(metadata.task_models.inbound_qualification).toBe("gpt-6-luna");
    expect(metadata.task_models.outbound_outreach).toBe("gpt-6-luna");
    expect(metadata.task_models.operator_thread).toBeNull();
  });

  it("surfaces a lane override that did not take effect", async () => {
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER = "anthropic_agent_sdk";
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
        using: "openai_responses",
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
