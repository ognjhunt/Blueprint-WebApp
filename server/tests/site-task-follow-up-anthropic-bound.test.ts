// @vitest-environment node
/**
 * A lane's own output ceiling and correction limit hold on the Anthropic
 * adapter too, so a later provider switch keeps the follow-up picker's bound:
 * a 600-token budget and one request. Lanes without them keep the shared
 * ceiling and the adapter's own correction limit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const stub = vi.hoisted(() => ({
  requests: [] as Array<Record<string, unknown>>,
  respond: (() => { throw new Error("no response queued"); }) as () => unknown,
}));

vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const real = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class Anthropic {
    static APIError = real.default.APIError;
    beta = { messages: { stream: (params: Record<string, unknown>) => {
      stub.requests.push(structuredClone(params));
      return { finalMessage: async () => stub.respond() };
    } } };
  }
  return { ...real, default: Anthropic };
});
vi.mock("../agents/operator-tools", async (importOriginal) => ({
  ...await importOriginal<typeof import("../agents/operator-tools")>(),
  getCompanyHistoryAccess: async () => null,
}));

const usage = { input_tokens: 20, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
const message = (text: string) => ({ id: `msg_${stub.requests.length}`, model: "claude-opus-5-5",
  content: [{ type: "text", text }], usage, stop_reason: "end_turn", stop_details: null });

async function run(definition: Record<string, unknown>, kind = "site_task_follow_up") {
  const { runAnthropicAgentSdkTask } = await import("../agents/adapters/anthropic-agent-sdk");
  return runAnthropicAgentSdkTask({ kind, input: { taskStatement: "t", briefSummary: "b", itemLabels: [], eligible: ["item_weight"] },
    metadata: {}, provider: "anthropic_agent_sdk", runtime: "anthropic_agent_sdk", model: "claude-opus-5-5",
    tool_policy: { mode: "api" }, definition } as never);
}

beforeEach(() => {
  vi.resetModules();
  stub.requests.length = 0;
  vi.stubEnv("ANTHROPIC_API_KEY", "offline-fixture");
  vi.stubEnv("ANTHROPIC_BASE_URL", "");
  vi.stubEnv("BLUEPRINT_ANTHROPIC_AGENT_MAX_OUTPUT_TOKENS", "");
});
afterEach(() => { vi.unstubAllEnvs(); });

describe("Anthropic adapter: a lane's own bound", () => {
  it("sends the follow-up picker's 600-token budget and makes one request for an answer that is not JSON", async () => {
    const { siteTaskFollowUpTask } = await import("../agents/tasks/site-task-follow-up");
    stub.respond = () => message("not json");
    const result = await run(siteTaskFollowUpTask as never);
    expect(stub.requests).toHaveLength(1);
    expect(stub.requests[0].max_tokens).toBe(600);
    expect(result).toMatchObject({ status: "failed", error: "output_correction_limit" });
  });

  it("keeps the shared ceiling when it is the smaller one", async () => {
    vi.stubEnv("BLUEPRINT_ANTHROPIC_AGENT_MAX_OUTPUT_TOKENS", "400");
    const { siteTaskFollowUpTask } = await import("../agents/tasks/site-task-follow-up");
    stub.respond = () => message('{"question_ids":["item_weight"]}');
    const result = await run(siteTaskFollowUpTask as never);
    expect(stub.requests[0].max_tokens).toBe(400);
    expect(result.status).toBe("completed");
  });

  it("leaves a lane without its own bound at the shared ceiling and five corrections", async () => {
    const definition = { build_prompt: () => "Return JSON.", output_schema: z.object({ answer: z.string() }) };
    stub.respond = () => message("not json");
    const result = await run(definition, "preview_diagnosis");
    expect(stub.requests[0].max_tokens).toBe(64_000);
    expect(stub.requests).toHaveLength(6);
    expect(result).toMatchObject({ status: "failed", error: "output_correction_limit" });
  });
});
