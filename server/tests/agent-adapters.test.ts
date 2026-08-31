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
      metadata: {
        expected_prompt_cache_reuse_count: 1,
        expected_prompt_cache_reuse_probability: 1,
      },
    });

    expect(result.status).toBe("completed");
    expect(result.output).toMatchObject({
      reply: "Done.",
      requires_human_review: false,
    });
  });

  it("sends stable explicit GPT-5.6 cache controls and retains read/write usage", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    openAiCreate.mockResolvedValue({
      id: "resp-cache-1",
      output_text:
        '{"reply":"Done.","summary":"Handled.","suggested_actions":[],"requires_human_review":false}',
      output: [],
      usage: {
        input_tokens: 2_000,
        output_tokens: 20,
        input_tokens_details: { cached_tokens: 1_200, cache_write_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 5 },
      },
    });

    const { runOpenAIResponsesTask } = await import("../agents/adapters/openai-responses");
    const { operatorThreadTask } = await import("../agents/tasks/operator-thread");
    const base = {
      kind: "operator_thread" as const,
      provider: "openai_responses" as const,
      runtime: "openai_responses" as const,
      model: "gpt-5.6-sol",
      tool_policy: {
        mode: "mixed" as const,
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
        dispatch_mode: "collect" as const,
        lane: "session",
        max_concurrent: 1,
      },
      outcome_contract: {
        objective: "Return status",
        success_criteria: [],
        self_checks: [],
        proof_requirements: [],
        pass_threshold: 1,
      },
      definition: operatorThreadTask,
      metadata: {
        expected_prompt_cache_reuse_count: 1,
        expected_prompt_cache_reuse_probability: 1,
      },
    };
    const first = await runOpenAIResponsesTask({
      ...base,
      input: { message: "Status for run unique-a?" },
    });
    await runOpenAIResponsesTask({
      ...base,
      input: { message: "Status for run unique-b?" },
    });

    const firstRequest = openAiCreate.mock.calls[0][0] as any;
    const secondRequest = openAiCreate.mock.calls[1][0] as any;
    expect(firstRequest).toMatchObject({
      store: false,
      prompt_cache_options: { mode: "explicit", ttl: "30m" },
    });
    expect(firstRequest.prompt_cache_key).toBe(secondRequest.prompt_cache_key);
    expect(firstRequest.input.map((item: any) => item.role)).toEqual(["developer", "user"]);
    expect(firstRequest.input[0].content[0].prompt_cache_breakpoint).toEqual({ mode: "explicit" });
    expect(firstRequest.input[1].content).toContain("unique-a");
    expect(secondRequest.input[1].content).toContain("unique-b");
    expect(first.artifacts).toMatchObject({
      cache_family: "operator_thread",
      cache_decision: "reusable",
      usage: {
        input_tokens: 2_000,
        cached_tokens: 1_200,
        cache_write_tokens: 0,
      },
    });
    expect(JSON.stringify(first.artifacts)).not.toContain("Status for run unique-a");
    expect(JSON.stringify(first.artifacts)).not.toContain("blueprint:cache:v1:");
  });

  it("fails closed at the legacy previous-response migration boundary", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    openAiCreate.mockResolvedValue({
      id: "resp_legacy_continuation",
      output: [],
      output_text:
        '{"reply":"Continued.","summary":"Safe legacy continuation.","suggested_actions":[],"requires_human_review":false}',
      usage: {
        input_tokens: 100,
        output_tokens: 20,
        input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
      },
    });
    const { runOpenAIResponsesTask } = await import("../agents/adapters/openai-responses");
    const { operatorThreadTask } = await import("../agents/tasks/operator-thread");
    const result = await runOpenAIResponsesTask({
      kind: "operator_thread",
      input: { message: "Continue" },
      provider: "openai_responses",
      runtime: "openai_responses",
      model: "gpt-5.6-sol",
      metadata: {
        previous_response_id: "resp_prior_dynamic_history",
        expected_prompt_cache_reuse_count: 1,
        expected_prompt_cache_reuse_probability: 1,
      },
      tool_policy: {
        mode: "none",
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
      outcome_contract: {
        objective: "Continue safely",
        success_criteria: [],
        self_checks: [],
        proof_requirements: [],
        pass_threshold: 1,
      },
      definition: operatorThreadTask,
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("requires a fresh store-false replay session");
    expect(openAiCreate).not.toHaveBeenCalled();
  });

  it("replays store-false GPT-5.6 history with the original breakpoint first", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    openAiCreate.mockResolvedValue({
      id: "resp_replayed",
      output: [],
      output_text:
        '{"reply":"Replayed.","summary":"History preserved.","suggested_actions":[],"requires_human_review":false}',
      usage: {
        input_tokens: 2_100,
        output_tokens: 20,
        input_tokens_details: { cached_tokens: 1_200, cache_write_tokens: 0 },
      },
    });
    const { runOpenAIResponsesTask } = await import("../agents/adapters/openai-responses");
    const { operatorThreadTask } = await import("../agents/tasks/operator-thread");
    const { stableAgentDeveloperPrefix } = await import("../utils/openaiPromptCache");
    const replay = [
      {
        role: "developer",
        content: [{
          type: "input_text",
          text: stableAgentDeveloperPrefix("operator_thread"),
          prompt_cache_breakpoint: { mode: "explicit" },
        }],
      },
      { role: "user", content: "Prior dynamic message" },
      { type: "message", role: "assistant", content: [] },
    ];
    const result = await runOpenAIResponsesTask({
      kind: "operator_thread",
      input: { message: "New dynamic message" },
      provider: "openai_responses",
      runtime: "openai_responses",
      model: "gpt-5.6-sol",
      metadata: {
        previous_response_id: "resp_should_not_be_used",
        openai_replay_input: replay,
        expected_prompt_cache_reuse_count: 1,
        expected_prompt_cache_reuse_probability: 0.5,
      },
      tool_policy: {
        mode: "none",
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
      session_policy: { dispatch_mode: "collect", lane: "session", max_concurrent: 1 },
      outcome_contract: {
        objective: "Continue safely",
        success_criteria: [],
        self_checks: [],
        proof_requirements: [],
        pass_threshold: 1,
      },
      definition: operatorThreadTask,
    });

    expect(result.status).toBe("completed");
    const request = openAiCreate.mock.calls[0][0] as any;
    expect(request.previous_response_id).toBeUndefined();
    expect(request.input.slice(0, replay.length)).toEqual(replay);
    expect(request.input.at(-1).content).toContain("New dynamic message");
    expect(JSON.stringify(request.input).match(/prompt_cache_breakpoint/g)).toHaveLength(1);
    expect(result.continuation_state?.openai_replay_input).toEqual([
      ...request.input,
    ]);

    const stale = structuredClone(replay);
    stale[0].content[0].text = "stale developer contract";
    const staleResult = await runOpenAIResponsesTask({
      kind: "operator_thread",
      input: { message: "Do not send stale state" },
      provider: "openai_responses",
      runtime: "openai_responses",
      model: "gpt-5.6-sol",
      metadata: {
        openai_replay_input: stale,
        expected_prompt_cache_reuse_count: 1,
        expected_prompt_cache_reuse_probability: 0.5,
      },
      tool_policy: {
        mode: "none", prefer_direct_api: true, browser_fallback_allowed: false,
        isolated_runtime_required: false, allowed_mcp_servers: [], allowed_domains: [],
        allowed_actions: [],
      },
      approval_policy: {
        require_human_approval: false, sensitive_actions: [], allow_preapproval: false,
      },
      session_policy: { dispatch_mode: "collect", lane: "session", max_concurrent: 1 },
      outcome_contract: {
        objective: "Continue safely", success_criteria: [], self_checks: [],
        proof_requirements: [], pass_threshold: 1,
      },
      definition: operatorThreadTask,
    });
    expect(staleResult.status).toBe("failed");

    const lateBreakpoint = [
      ...replay,
      {
        role: "user",
        content: [{
          type: "input_text",
          text: "dynamic secret-bearing history",
          prompt_cache_breakpoint: { mode: "explicit" },
        }],
      },
    ];
    const lateResult = await runOpenAIResponsesTask({
      kind: "operator_thread",
      input: { message: "Do not cache dynamic history" },
      provider: "openai_responses",
      runtime: "openai_responses",
      model: "gpt-5.6-sol",
      metadata: {
        openai_replay_input: lateBreakpoint,
        expected_prompt_cache_reuse_count: 1,
        expected_prompt_cache_reuse_probability: 0.5,
      },
      tool_policy: {
        mode: "none", prefer_direct_api: true, browser_fallback_allowed: false,
        isolated_runtime_required: false, allowed_mcp_servers: [], allowed_domains: [],
        allowed_actions: [],
      },
      approval_policy: {
        require_human_approval: false, sensitive_actions: [], allow_preapproval: false,
      },
      session_policy: { dispatch_mode: "collect", lane: "session", max_concurrent: 1 },
      outcome_contract: {
        objective: "Continue safely", success_criteria: [], self_checks: [],
        proof_requirements: [], pass_threshold: 1,
      },
      definition: operatorThreadTask,
    });
    expect(lateResult.status).toBe("failed");
    expect(openAiCreate).toHaveBeenCalledTimes(1);
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
      model: "deepseek-v4-pro",
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
        model: "deepseek-v4-pro",
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
      model: "deepseek-v4-pro",
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
        model: "deepseek/deepseek-v4-pro",
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
        model: "deepseek/deepseek-v4-pro",
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
      model: "deepseek/deepseek-v4-pro",
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
        model: "deepseek/deepseek-v4-pro",
        provider: expectedOpenRouterProviderPreferences,
      }),
    );
    expect(deepSeekChatCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        model: "deepseek/deepseek-v4-pro",
        provider: expectedOpenRouterProviderPreferences,
      }),
    );
    expect(result.artifacts).toMatchObject({
      route: "deepseek_via_openrouter",
      generation_id: "gen-final",
      openrouter_generation_id: "gen-final",
      openrouter_model: "deepseek/deepseek-v4-pro",
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
