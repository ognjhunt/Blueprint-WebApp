// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const openAiCreate = vi.hoisted(() => vi.fn());
const anthropicCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: class OpenAI {
    responses = {
      create: openAiCreate,
    };
  },
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class Anthropic {
    messages = {
      create: anthropicCreate,
    };
  },
}));

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ACP_HARNESS_URL;
  delete process.env.ACP_HARNESS_TOKEN;
  openAiCreate.mockReset();
  anthropicCreate.mockReset();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("agent adapters", () => {
  it("normalizes OpenAI structured output", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    openAiCreate.mockResolvedValue({
      output_text:
        '{"reply":"Done.","summary":"Handled.","suggested_actions":["Ship it"],"requires_human_review":false}',
    });

    const { runOpenAIResponsesTask } = await import("../agents/adapters/openai-responses");
    const { operatorThreadTask } = await import("../agents/tasks/operator-thread");

    const result = await runOpenAIResponsesTask({
      kind: "operator_thread",
      input: { message: "Status?" },
      provider: "openai_responses",
      runtime: "openai_responses",
      model: "gpt-5.4",
      tool_policy: {
        mode: "mixed",
        prefer_direct_api: true,
        browser_fallback_allowed: false,
        isolated_runtime_required: false,
        allowed_mcp_servers: [],
        allowed_domains: [],
        allowed_actions: [],
      },
      approval_policy: {
        require_human_approval: false,
        sensitive_actions: [],
        allow_preapproval: false,
      },
      session_policy: {
        dispatch_mode: "collect",
        lane: "session",
        max_concurrent: 1,
      },
      definition: operatorThreadTask,
    });

    expect(result.status).toBe("completed");
    expect(result.output).toMatchObject({
      reply: "Done.",
      requires_human_review: false,
    });
  });

  it("normalizes Anthropic structured output", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    anthropicCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: '{"reply":"Queued.","summary":"Handled.","suggested_actions":["Review"],"requires_human_review":true}',
        },
      ],
    });

    const { runAnthropicAgentSdkTask } = await import("../agents/adapters/anthropic-agent-sdk");
    const { operatorThreadTask } = await import("../agents/tasks/operator-thread");

    const result = await runAnthropicAgentSdkTask({
      kind: "operator_thread",
      input: { message: "Status?" },
      provider: "anthropic_agent_sdk",
      runtime: "anthropic_agent_sdk",
      model: "claude-sonnet-4-5",
      tool_policy: {
        mode: "local_tools",
        prefer_direct_api: true,
        browser_fallback_allowed: false,
        isolated_runtime_required: false,
        allowed_mcp_servers: [],
        allowed_domains: [],
        allowed_actions: [],
      },
      approval_policy: {
        require_human_approval: false,
        sensitive_actions: [],
        allow_preapproval: false,
      },
      session_policy: {
        dispatch_mode: "collect",
        lane: "session",
        max_concurrent: 1,
      },
      definition: operatorThreadTask,
    });

    expect(result.status).toBe("completed");
    expect(result.output).toMatchObject({
      summary: "Handled.",
      requires_human_review: true,
    });
  });

  it("normalizes ACP harness responses", async () => {
    process.env.ACP_HARNESS_URL = "https://acp.example.com/runs";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "completed",
          output: {
            reply: "Started Codex.",
            summary: "Harness accepted the task.",
            suggested_actions: ["Monitor the run"],
            requires_human_review: false,
          },
        }),
      }),
    );

    const { runAcpHarnessTask } = await import("../agents/adapters/acp-harness");
    const { externalHarnessThreadTask } = await import(
      "../agents/tasks/external-harness-thread"
    );

    const result = await runAcpHarnessTask({
      kind: "external_harness_thread",
      input: { message: "Run this in Codex", harness: "codex" },
      provider: "acp_harness",
      runtime: "acp_harness",
      model: "codex",
      tool_policy: {
        mode: "external_harness",
        prefer_direct_api: false,
        browser_fallback_allowed: false,
        isolated_runtime_required: true,
        allowed_mcp_servers: [],
        allowed_domains: [],
        allowed_actions: [],
      },
      approval_policy: {
        require_human_approval: false,
        sensitive_actions: [],
        allow_preapproval: false,
      },
      session_policy: {
        dispatch_mode: "collect",
        lane: "external_harness",
        max_concurrent: 1,
      },
      definition: externalHarnessThreadTask,
    });

    expect(result.status).toBe("completed");
    expect(result.output).toMatchObject({
      reply: "Started Codex.",
    });
  });
});
