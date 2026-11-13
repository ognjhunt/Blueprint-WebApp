// @vitest-environment node
/**
 * Failover on "no funds" only: once per run, to a provider the data-class gate
 * permits for the lane's data, that is configured and priced, recorded on the
 * run. Fake adapters stand for each error class; nothing is sent anywhere.
 */
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runOpenAIResponsesTask = vi.hoisted(() => vi.fn());
const runAnthropicAgentSdkTask = vi.hoisted(() => vi.fn());

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } },
  dbAdmin: null,
  storageAdmin: null,
  authAdmin: null,
}));
vi.mock("../agents/adapters/openai-responses", () => ({ runOpenAIResponsesTask }));
vi.mock("../agents/adapters/anthropic-agent-sdk", () => ({ runAnthropicAgentSdkTask }));

const headers = () => new Headers({ "request-id": "req_fixture" });
const openAiError = (status: number, type: string | undefined, code: string | undefined) =>
  OpenAI.APIError.generate(status, { error: { type, code, message: "wording that can change" } }, undefined, headers());
const anthropicNoFunds = () => Anthropic.APIError.generate(402, { type: "error", error: { type: "billing_error", message: "x" } }, undefined, headers());

const completed = (task: { provider: string; runtime: string; model: string }) => ({
  status: "completed", provider: task.provider, runtime: task.runtime, model: task.model, tool_mode: "api",
  output: { proposals: [], notFound: [], summary: "ok" }, raw_output_text: "{}", requires_human_review: false, requires_approval: false,
  artifacts: { usage: { prompt_tokens: 10, completion_tokens: 2 } },
});
const failedNoFunds = (task: { provider: string; runtime: string; model: string }, extra: Record<string, unknown> = {}) => ({
  status: "failed", provider: task.provider, runtime: task.runtime, model: task.model, tool_mode: "api", error: "anthropic_provider_request_failed",
  requires_human_review: true, requires_approval: false,
  artifacts: { provider_error: { error_class: "no_funds", provider: "anthropic_agent_sdk", sdk: "anthropic", status: 402,
    type: "billing_error", code: null }, provider_responses: [], company_history_tool_calls: [],
    inference_reservation: { reconciled_cost_usd: 0 }, ...extra },
});

const lane = { kind: "robot_capability_extraction", input: { robotTeamId: "t", teamName: "T", currentCapability: {},
  sources: [], allowedValues: {} } } as never;

beforeEach(async () => {
  for (const key of ["BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDER", "BLUEPRINT_STRUCTURED_AUTOMATION_FALLBACK_PROVIDER",
    "BLUEPRINT_ROBOT_CAPABILITY_EXTRACTION_PROVIDERS", "BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDERS", "ANTHROPIC_BASE_URL",
    "OPENAI_BASE_URL", "ACP_HARNESS_URL", "OPENCLAW_BASE_URL", "ANTHROPIC_ROBOT_CAPABILITY_EXTRACTION_MODEL", "ANTHROPIC_DEFAULT_MODEL"]) {
    vi.stubEnv(key, "");
  }
  vi.stubEnv("OPENAI_API_KEY", "offline-fixture");
  vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture");
  vi.stubEnv("CODEX_LOCAL_AVAILABLE", "0");
  vi.resetModules();
  (await import("../agents/provider-funds")).resetProviderFundsStateForTests();
});
afterEach(() => {
  runOpenAIResponsesTask.mockReset();
  runAnthropicAgentSdkTask.mockReset();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("failover on no funds", () => {
  it("switches once to a permitted, configured, priced provider and records it on the run", async () => {
    runOpenAIResponsesTask.mockRejectedValue(openAiError(429, "insufficient_quota", "insufficient_quota"));
    runAnthropicAgentSdkTask.mockImplementation(async (task) => completed(task));
    const { runAgentTask } = await import("../agents/runtime");
    const result = await runAgentTask(lane);
    expect(result.status).toBe("completed");
    expect(result.provider).toBe("anthropic_agent_sdk");
    expect(runAnthropicAgentSdkTask.mock.calls[0][0]).toMatchObject({ provider: "anthropic_agent_sdk", model: "claude-haiku-5-5" });
    expect(result.artifacts?.provider_failover).toMatchObject({ from_provider: "openai_responses", to_provider: "anthropic_agent_sdk",
      to_model: "claude-haiku-5-5", trigger: "no_funds", error: { error_class: "no_funds", http_status: 429, error_code: "insufficient_quota" } });
    expect(result.logs?.some((log) => log.event_type === "provider.failover")).toBe(true);
    const { getAgentRuntimeConnectionMetadata } = await import("../agents/runtime-connectivity");
    expect(getAgentRuntimeConnectionMetadata().providers_out_of_funds).toEqual([expect.objectContaining({
      provider: "openai_responses", error_code: "insufficient_quota", http_status: 429 })]);
  });

  it("skips a provider still cooling down after no funds, without calling it", async () => {
    runOpenAIResponsesTask.mockRejectedValue(openAiError(429, "insufficient_quota", "insufficient_quota"));
    runAnthropicAgentSdkTask.mockImplementation(async (task) => completed(task));
    const { runAgentTask } = await import("../agents/runtime");
    await runAgentTask(lane);
    runOpenAIResponsesTask.mockClear();
    const second = await runAgentTask(lane);
    expect(runOpenAIResponsesTask).not.toHaveBeenCalled();
    expect(second.artifacts?.provider_failover).toMatchObject({ trigger: "cooling_down_no_funds", to_provider: "anthropic_agent_sdk" });
  });

  it.each([
    ["a plain rate limit", openAiError(429, "requests", "rate_limit_exceeded")],
    ["an authentication error", openAiError(401, "invalid_request_error", "invalid_api_key")],
    ["an overload", openAiError(503, "server_error", "server_is_overloaded")],
    ["an unknown error", new Error("socket hang up")],
  ])("does not switch on %s", async (_name, error) => {
    runOpenAIResponsesTask.mockRejectedValue(error);
    const { runAgentTask } = await import("../agents/runtime");
    const result = await runAgentTask(lane);
    expect(result.status).toBe("failed");
    expect(runAnthropicAgentSdkTask).not.toHaveBeenCalled();
    expect(result.artifacts?.provider_failover).toBeUndefined();
  });

  it("switches at most once: when the second provider also has no funds the run fails", async () => {
    runOpenAIResponsesTask.mockRejectedValue(openAiError(429, "insufficient_quota", "insufficient_quota"));
    runAnthropicAgentSdkTask.mockImplementation(async (task) => failedNoFunds(task));
    const { runAgentTask } = await import("../agents/runtime");
    const result = await runAgentTask(lane);
    expect(result.status).toBe("failed");
    expect(runOpenAIResponsesTask).toHaveBeenCalledTimes(1);
    expect(runAnthropicAgentSdkTask).toHaveBeenCalledTimes(1);
    expect((await import("../agents/provider-funds")).isProviderCoolingDown("anthropic_agent_sdk")).toBe(true);
  });

  it("never switches a lane whose data only one provider may receive: it fails as no_provider_with_funds", async () => {
    runOpenAIResponsesTask.mockRejectedValue(openAiError(429, "insufficient_quota", "insufficient_quota"));
    const { runAgentTask } = await import("../agents/runtime");
    const result = await runAgentTask({ kind: "support_triage", input: { message: "Help" } } as never);
    expect(result.status).toBe("failed");
    expect(result.error).toContain("no_provider_with_funds");
    expect(runAnthropicAgentSdkTask).not.toHaveBeenCalled();
    expect(result.artifacts?.provider_failover).toMatchObject({ to_provider: null, from_provider: "openai_responses" });
  });

  it("does not switch after the first provider answered, called a tool or may have charged", async () => {
    vi.stubEnv("BLUEPRINT_ROBOT_CAPABILITY_EXTRACTION_PROVIDERS", "anthropic_agent_sdk,openai_responses");
    vi.resetModules();
    for (const trace of [{ provider_responses: [{ responseId: "r" }] }, { company_history_tool_calls: [{ name: "search" }] },
      { inference_reservation: { reconciled_cost_usd: 0.01 } }]) {
      runAnthropicAgentSdkTask.mockReset();
      runAnthropicAgentSdkTask.mockImplementation(async (task) => failedNoFunds(task, trace));
      const { runAgentTask } = await import("../agents/runtime");
      (await import("../agents/provider-funds")).resetProviderFundsStateForTests();
      const result = await runAgentTask(lane);
      expect(result.status).toBe("failed");
      expect(runOpenAIResponsesTask).not.toHaveBeenCalled();
    }
  });

  it("classifies Anthropic's own no-funds error from the adapter the same way (a 402 at the first request)", async () => {
    vi.stubEnv("BLUEPRINT_ROBOT_CAPABILITY_EXTRACTION_PROVIDERS", "anthropic_agent_sdk,openai_responses");
    vi.resetModules();
    runAnthropicAgentSdkTask.mockRejectedValue(anthropicNoFunds());
    runOpenAIResponsesTask.mockImplementation(async (task) => completed(task));
    const { runAgentTask } = await import("../agents/runtime");
    const result = await runAgentTask(lane);
    expect(result).toMatchObject({ status: "completed", provider: "openai_responses",
      artifacts: { provider_failover: { from_provider: "anthropic_agent_sdk", to_provider: "openai_responses" } } });
  });
});

describe("ordered lists and the Anthropic model check (S2)", () => {
  it("serves the lane from its list, refusing entries the gate does not permit", async () => {
    vi.stubEnv("ACP_HARNESS_URL", "http://harness.invalid");
    vi.stubEnv("BLUEPRINT_ROBOT_CAPABILITY_EXTRACTION_PROVIDERS", "acp_harness,anthropic_agent_sdk,deepseek_chat,openai_responses");
    vi.resetModules();
    const config = await import("../agents/provider-config");
    expect(config.describeStructuredAutomationProvider("robot_capability_extraction")).toMatchObject({
      provider: "anthropic_agent_sdk", reason: "lane_list",
      provider_list: { env_key: "BLUEPRINT_ROBOT_CAPABILITY_EXTRACTION_PROVIDERS", unrecognized: ["removed_provider"] },
      refused_settings: [expect.objectContaining({ env_key: "BLUEPRINT_ROBOT_CAPABILITY_EXTRACTION_PROVIDERS", requested: "acp_harness" })] });
    expect(config.getStructuredProviderOrder("robot_capability_extraction")).toEqual(["anthropic_agent_sdk", "openai_responses"]);
    expect(config.listRemovedProviderSettings()).toContain("BLUEPRINT_ROBOT_CAPABILITY_EXTRACTION_PROVIDERS");
  });

  it("keeps OpenAI first without a list, and a list cannot put a refused provider on a person lane", async () => {
    vi.stubEnv("BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDERS", "anthropic_agent_sdk,openai_responses");
    vi.resetModules();
    const config = await import("../agents/provider-config");
    expect(config.getStructuredProviderOrder("support_triage")).toEqual(["openai_responses"]);
    expect(config.getStructuredProviderOrder("site_task_brief_reading")).toEqual(["openai_responses"]);
    vi.stubEnv("BLUEPRINT_STRUCTURED_AUTOMATION_PROVIDERS", "");
    vi.resetModules();
    expect((await import("../agents/provider-config")).getStructuredProviderOrder("robot_capability_extraction"))
      .toEqual(["openai_responses", "anthropic_agent_sdk"]);
  });

  it("skips Anthropic for a lane whose Anthropic model has no request shape or price row, and says so", async () => {
    vi.stubEnv("ANTHROPIC_ROBOT_CAPABILITY_EXTRACTION_MODEL", "claude-model-without-a-row");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.resetModules();
    const config = await import("../agents/provider-config");
    expect(config.describeStructuredAutomationProvider("robot_capability_extraction")).toMatchObject({
      provider: "openai_responses", fails_closed: "permitted_provider_not_configured",
      anthropic_model_not_supported: "claude-model-without-a-row" });
    const { getAgentRuntimeConnectionMetadata } = await import("../agents/runtime-connectivity");
    expect(getAgentRuntimeConnectionMetadata().lanes.find((entry) => entry.task_kind === "robot_capability_extraction"))
      .toMatchObject({ anthropic_model_not_supported: "claude-model-without-a-row", provider: null });
  });
});
