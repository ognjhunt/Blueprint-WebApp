// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const openAiCreate = vi.hoisted(() => vi.fn());
const deepSeekChatCreate = vi.hoisted(() => vi.fn());
const anthropicCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  default: class OpenAI {
    responses = {
      create: openAiCreate,
    };
    chat = {
      completions: {
        create: deepSeekChatCreate,
      },
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
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_BASE_URL;
  delete process.env.DEEPSEEK_DEFAULT_MODEL;
  delete process.env.DEEPSEEK_REASONING_EFFORT;
  delete process.env.DEEPSEEK_THINKING;
  delete process.env.DEEPSEEK_OPENROUTER_PROVIDER_ONLY;
  delete process.env.DEEPSEEK_OPENROUTER_PROVIDER_ORDER;
  delete process.env.DEEPSEEK_OPENROUTER_PROVIDER_IGNORE;
  delete process.env.DEEPSEEK_OPENROUTER_ALLOW_FALLBACKS;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ACP_HARNESS_URL;
  delete process.env.ACP_HARNESS_TOKEN;
  openAiCreate.mockReset();
  deepSeekChatCreate.mockReset();
  anthropicCreate.mockReset();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("agent adapters", () => {
  const expectedOpenRouterProviderPreferences = {
    only: ["deepseek", "atlas-cloud/fp8", "novita", "siliconflow/fp8"],
    order: ["deepseek", "atlas-cloud/fp8", "novita", "siliconflow/fp8"],
    ignore: ["parasail", "parasail/fp8", "akashml", "akashml/fp8", "deepinfra", "deepinfra/fp4"],
    allow_fallbacks: false,
  };

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

  it("normalizes DeepSeek chat output and records cache usage", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    process.env.DEEPSEEK_REASONING_EFFORT = "xhigh";
    deepSeekChatCreate.mockResolvedValue({
      id: "deepseek-response-1",
      usage: {
        prompt_tokens: 100,
        completion_tokens: 20,
        total_tokens: 120,
        prompt_cache_hit_tokens: 80,
        prompt_cache_miss_tokens: 20,
      },
      choices: [
        {
          message: {
            content:
              '{"reply":"DeepSeek handled it.","summary":"Handled with DeepSeek.","suggested_actions":["Keep DeepSeek primary"],"requires_human_review":false}',
          },
        },
      ],
    });

    const { runDeepSeekChatTask } = await import("../agents/adapters/deepseek-chat");
    const { operatorThreadTask } = await import("../agents/tasks/operator-thread");

    const result = await runDeepSeekChatTask({
      kind: "operator_thread",
      input: { message: "Status?" },
      provider: "deepseek_chat",
      runtime: "deepseek_chat",
      model: "deepseek-v4-flash",
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

    expect(deepSeekChatCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "deepseek-v4-flash",
        response_format: { type: "json_object" },
        reasoning_effort: "max",
        extra_body: { thinking: { type: "enabled" } },
      }),
    );
    expect(result.status).toBe("completed");
    expect(result.output).toMatchObject({
      reply: "DeepSeek handled it.",
      requires_human_review: false,
    });
    expect(result.artifacts).toMatchObject({
      provider: "deepseek_chat",
      model: "deepseek-v4-flash",
      deepseek_response_id: "deepseek-response-1",
      prompt_tokens: 100,
      completion_tokens: 20,
      total_tokens: 120,
      prompt_cache_hit_tokens: 80,
      prompt_cache_miss_tokens: 20,
      prompt_cache_hit_ratio: 0.8,
      max_tokens: 2000,
    });
  });

  it("normalizes OpenRouter DeepSeek usage and aggregates multi-call cache/cost telemetry", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    process.env.DEEPSEEK_BASE_URL = "https://openrouter.ai/api/v1";
    deepSeekChatCreate
      .mockResolvedValueOnce({
        id: "gen-initial",
        model: "deepseek/deepseek-v4-flash",
        provider: "DeepSeek",
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 20,
          total_tokens: 1020,
          prompt_tokens_details: {
            cached_tokens: 600,
            cache_write_tokens: 200,
          },
          completion_tokens_details: {
            reasoning_tokens: 7,
          },
          cost: 0.0012,
          cost_details: {
            upstream_inference_cost: 0.001,
          },
        },
        choices: [
          {
            message: {
              content: "",
              tool_calls: [
                {
                  id: "tool-1",
                  type: "function",
                  function: {
                    name: "verify_growth_integrations",
                    arguments: "{}",
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        id: "gen-final",
        model: "deepseek/deepseek-v4-flash",
        provider: "DeepSeek",
        provider_routing: {
          order: ["DeepSeek"],
        },
        usage: {
          prompt_tokens: 1200,
          completion_tokens: 100,
          total_tokens: 1300,
          prompt_tokens_details: {
            cached_tokens: 900,
            cache_write_tokens: 50,
          },
          completion_tokens_details: {
            reasoning_tokens: 15,
          },
          cost: "0.0023",
          cost_details: {
            upstream_inference_cost: "0.002",
          },
        },
        choices: [
          {
            message: {
              content:
                '{"reply":"OpenRouter handled it.","summary":"Handled with OpenRouter DeepSeek.","suggested_actions":["Review cache ratio"],"requires_human_review":false}',
            },
          },
        ],
      });

    const { runDeepSeekChatTask } = await import("../agents/adapters/deepseek-chat");
    const { operatorThreadTask } = await import("../agents/tasks/operator-thread");

    const result = await runDeepSeekChatTask({
      kind: "operator_thread",
      input: { message: "Check runtime", context: { workspace: "Blueprint" } },
      provider: "deepseek_chat",
      runtime: "deepseek_chat",
      model: "deepseek/deepseek-v4-flash",
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
    expect(deepSeekChatCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        model: "deepseek/deepseek-v4-flash",
        provider: expectedOpenRouterProviderPreferences,
      }),
    );
    expect(deepSeekChatCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        model: "deepseek/deepseek-v4-flash",
        provider: expectedOpenRouterProviderPreferences,
      }),
    );
    expect(result.artifacts).toMatchObject({
      route: "deepseek_via_openrouter",
      generation_id: "gen-final",
      openrouter_generation_id: "gen-final",
      openrouter_model: "deepseek/deepseek-v4-flash",
      openrouter_provider: "DeepSeek",
      prompt_tokens: 2200,
      completion_tokens: 120,
      total_tokens: 2320,
      cached_tokens: 1500,
      cache_write_tokens: 250,
      reasoning_tokens: 22,
      cost_usd: 0.0035,
      prompt_cache_hit_ratio: 1500 / 2200,
      openrouter_provider_preferences: expectedOpenRouterProviderPreferences,
      calls: 2,
    });
    expect(result.logs?.filter((log) => log.event_type === "provider.response.created")).toHaveLength(2);
    expect(result.logs?.find((log) => log.event_type === "provider.telemetry.aggregated")).toMatchObject({
      event_type: "provider.telemetry.aggregated",
      usage: expect.objectContaining({
        cached_tokens: 1500,
        cost_usd: 0.0035,
      }),
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
