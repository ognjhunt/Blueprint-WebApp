import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildLocalQuotaFallbackDescriptor,
  buildClaudeFallbackAdapterConfig,
  buildCodexFallbackAdapterConfig,
  buildHermesFallbackAdapterConfig,
  buildNextHermesFallbackAdapterConfig,
  buildQuotaFallbackRetryRecord,
  DEFAULT_HERMES_FALLBACK_MODEL,
  DEFAULT_HERMES_FALLBACK_MODELS,
  extractLogicalSucceededRunFailure,
  FALLBACK_ORIGIN_ADAPTER_CONFIG_KEY,
  HERMES_MODEL_LADDER_CONFIG_KEY,
  getWorkspaceAdapterCooldownKey,
  isDisallowedHermesFallbackModel,
  isFreshSessionRetryableFailure,
  isIncompatibleHermesFreeRoutingModel,
  isProcessLossFailure,
  isProviderCreditFailure,
  isProviderTimeoutFailure,
  isQuotaOrRateLimitFailure,
  isSharedOpenRouterFreePoolRateLimitFailure,
  parseQuotaResetAt,
  resolveHermesFallbackModels,
  resolveQuotaCooldownUntil,
  selectWorkspaceQuotaFallbackTargets,
  syncExecutionPolicyToAdapter,
} from "./quota-fallback.js";

describe("quota fallback helpers", () => {
  beforeEach(() => {
    vi.stubEnv("BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL", DEFAULT_HERMES_FALLBACK_MODEL);
    vi.stubEnv(
      "BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODELS",
      DEFAULT_HERMES_FALLBACK_MODELS.join(","),
    );
    vi.stubEnv("BLUEPRINT_PAPERCLIP_HERMES_ALLOW_PAID_MODELS", "0");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("detects common quota and rate-limit failures", () => {
    expect(isQuotaOrRateLimitFailure("Claude run failed: subtype=success: You've hit your limit · resets 8pm (UTC)")).toBe(true);
    expect(isQuotaOrRateLimitFailure("429 RESOURCE_EXHAUSTED: You exceeded your current quota and billing details.")).toBe(true);
    expect(isQuotaOrRateLimitFailure("rate limit exceeded")).toBe(true);
    expect(isQuotaOrRateLimitFailure("HTTP 402: Insufficient credits. Add more using https://openrouter.ai/settings/credits")).toBe(true);
    expect(isQuotaOrRateLimitFailure("adapter exited with code 1")).toBe(false);
  });

  it("detects provider credit and spend-limit failures", () => {
    expect(isProviderCreditFailure("HTTP 402: Insufficient credits. Add more using https://openrouter.ai/settings/credits")).toBe(true);
    expect(isProviderCreditFailure("API key USD spend limit exceeded.")).toBe(true);
    expect(isProviderCreditFailure("HTTP 429: Rate limit exceeded: free-models-per-min.")).toBe(false);
  });

  it("extracts terminal logical-failure text from succeeded-run logs", () => {
    expect(
      extractLogicalSucceededRunFailure(
        `
          [hermes] Starting Hermes Agent
          Final error: HTTP 429: Rate limit exceeded: free-models-per-min.
          API call failed after 3 retries: HTTP 429: Rate limit exceeded: free-models-per-min.
          [hermes] Exit code: 0, timed out: false
        `,
      ),
    ).toContain("HTTP 429: Rate limit exceeded: free-models-per-min.");

    expect(
      extractLogicalSucceededRunFailure(
        `
          [hermes] Starting Hermes Agent
          HTTP 404: No endpoints found for stepfun/step-3.5-flash:free.
          Non-retryable client error (HTTP 404). Aborting.
          [hermes] Exit code: 0, timed out: false
        `,
      ),
    ).toContain("HTTP 404: No endpoints found for stepfun/step-3.5-flash:free.");

    expect(extractLogicalSucceededRunFailure("[hermes] Exit code: 0, timed out: false")).toBeNull();
  });

  it("detects fresh-session retryable context and output-limit failures", () => {
    expect(
      isFreshSessionRetryableFailure(
        "Codex ran out of room in the model's context window. Start a new thread or clear earlier history before retrying.",
      ),
    ).toBe(true);
    expect(
      isFreshSessionRetryableFailure(
        "stream disconnected before completion: Incomplete response returned, reason: max_output_tokens",
      ),
    ).toBe(true);
    expect(isFreshSessionRetryableFailure("Process lost -- child pid 2156045 is no longer running")).toBe(false);
  });

  it("detects recoverable provider timeouts and process-loss failures", () => {
    expect(
      isProviderTimeoutFailure(
        "Hermes timed out while running arcee-ai/trinity-large-preview:free via openrouter.",
      ),
    ).toBe(true);
    expect(isProviderTimeoutFailure("Timed out")).toBe(true);
    expect(isProviderTimeoutFailure("429 RESOURCE_EXHAUSTED")).toBe(false);

    expect(isProcessLossFailure("Process lost -- child pid 2156045 is no longer running")).toBe(true);
    expect(isProcessLossFailure("Process lost -- server may have restarted")).toBe(true);
    expect(isProcessLossFailure("Timed out")).toBe(false);
  });

  it("builds a codex adapter config from a claude config", () => {
    expect(
      buildCodexFallbackAdapterConfig(
        {
          cwd: "/tmp/project",
          model: "claude-sonnet-4-6",
          dangerouslySkipPermissions: true,
          timeoutSec: 1800,
        },
        { model: "gpt-5.4-mini", modelReasoningEffort: "medium" },
      ),
    ).toEqual({
      cwd: "/tmp/project",
      timeoutSec: 1800,
      model: "gpt-5.4-mini",
      modelReasoningEffort: "medium",
      dangerouslyBypassApprovalsAndSandbox: true,
    });
  });

  it("builds a claude adapter config from a codex config", () => {
    expect(
      buildClaudeFallbackAdapterConfig({
        cwd: "/tmp/project",
        model: "gpt-5.4-mini",
        modelReasoningEffort: "high",
        dangerouslyBypassApprovalsAndSandbox: true,
        timeoutSec: 1800,
      }),
    ).toEqual({
      cwd: "/tmp/project",
      timeoutSec: 1800,
      model: "claude-sonnet-4-6",
      dangerouslySkipPermissions: true,
    });
  });

  it("builds a hermes adapter config with the stable free-model default", () => {
    expect(
      buildHermesFallbackAdapterConfig({
        cwd: "/tmp/project",
        model: "qwen/qwen3.6-plus-preview:free",
        timeoutSec: 1800,
      }),
    ).toEqual({
      cwd: "/tmp/project",
      model: DEFAULT_HERMES_FALLBACK_MODEL,
      [HERMES_MODEL_LADDER_CONFIG_KEY]: [...DEFAULT_HERMES_FALLBACK_MODELS],
      modelReasoningEffort: "medium",
      timeoutSec: 1800,
    });
  });

  it("does not carry Codex or Claude model ids onto Hermes free fallback", () => {
    expect(isIncompatibleHermesFreeRoutingModel("gpt-5.4-mini")).toBe(true);
    expect(isIncompatibleHermesFreeRoutingModel("claude-sonnet-4-6")).toBe(true);
    expect(isIncompatibleHermesFreeRoutingModel("arcee-ai/trinity-large-preview:free")).toBe(false);
    expect(isIncompatibleHermesFreeRoutingModel("openai/gpt-oss-120b:free")).toBe(false);

    expect(
      buildHermesFallbackAdapterConfig({
        cwd: "/tmp/capture",
        model: "gpt-5.4-mini",
        dangerouslyBypassApprovalsAndSandbox: true,
        timeoutSec: 900,
      }),
    ).toEqual({
      cwd: "/tmp/capture",
      model: DEFAULT_HERMES_FALLBACK_MODEL,
      [HERMES_MODEL_LADDER_CONFIG_KEY]: [...DEFAULT_HERMES_FALLBACK_MODELS],
      modelReasoningEffort: "medium",
      timeoutSec: 900,
    });
  });

  it("rejects deprecated qwen3.6-plus fallback ids even when env drift reintroduces them", () => {
    vi.stubEnv("BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL", "openrouter/qwen/qwen3.6-plus:free");
    vi.stubEnv(
      "BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODELS",
      [
        "openrouter/qwen/qwen3.6-plus:free",
        "qwen/qwen3.6-plus:free",
        "arcee-ai/trinity-large-preview:free",
        "openrouter/free",
      ].join(","),
    );

    expect(isDisallowedHermesFallbackModel("openrouter/qwen/qwen3.6-plus:free")).toBe(true);
    expect(isDisallowedHermesFallbackModel("qwen/qwen3.6-plus:free")).toBe(true);
    expect(isDisallowedHermesFallbackModel("arcee-ai/trinity-large-preview:free")).toBe(false);
    const resolved = resolveHermesFallbackModels({ cwd: "/tmp/project" });
    expect(resolved[0]).toBe(DEFAULT_HERMES_FALLBACK_MODEL);
    expect(resolved).not.toContain("openrouter/qwen/qwen3.6-plus:free");
    expect(resolved).not.toContain("qwen/qwen3.6-plus:free");
    expect(resolved).not.toContain("openrouter/free");
    const config = buildHermesFallbackAdapterConfig({
      cwd: "/tmp/project",
      model: "qwen/qwen3.6-plus:free",
    });
    expect(config.cwd).toBe("/tmp/project");
    expect(config.model).toBe(DEFAULT_HERMES_FALLBACK_MODEL);
    expect(config[HERMES_MODEL_LADDER_CONFIG_KEY]).not.toContain("openrouter/qwen/qwen3.6-plus:free");
    expect(config[HERMES_MODEL_LADDER_CONFIG_KEY]).not.toContain("qwen/qwen3.6-plus:free");
    expect(config.modelReasoningEffort).toBe("medium");
    expect(config.timeoutSec).toBe(1800);
  });

  it("rejects removed stepfun free-model ids even when env drift reintroduces them", () => {
    vi.stubEnv("BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL", "stepfun/step-3.5-flash:free");
    vi.stubEnv(
      "BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODELS",
      [
        "stepfun/step-3.5-flash:free",
        "arcee-ai/trinity-large-preview:free",
        "openrouter/free",
      ].join(","),
    );

    expect(isDisallowedHermesFallbackModel("stepfun/step-3.5-flash:free")).toBe(true);
    const resolved = resolveHermesFallbackModels({ cwd: "/tmp/project" });
    expect(resolved).not.toContain("stepfun/step-3.5-flash:free");
    const config = buildHermesFallbackAdapterConfig({
      cwd: "/tmp/project",
      model: "stepfun/step-3.5-flash:free",
    });
    expect(config.model).toBe(DEFAULT_HERMES_FALLBACK_MODEL);
    expect(config[HERMES_MODEL_LADDER_CONFIG_KEY]).not.toContain("stepfun/step-3.5-flash:free");
  });

  it("rejects the openrouter/free alias and invalid nvidia fallback ids", () => {
    vi.stubEnv(
      "BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODELS",
      [
        "openrouter/free",
        "nvidia/nemotron-3-super:free",
        "arcee-ai/trinity-large-preview:free",
        "openai/gpt-oss-120b:free",
      ].join(","),
    );

    expect(isDisallowedHermesFallbackModel("openrouter/free")).toBe(true);
    expect(isDisallowedHermesFallbackModel("nvidia/nemotron-3-super:free")).toBe(true);

    const resolved = resolveHermesFallbackModels({ cwd: "/tmp/project" });
    expect(resolved).not.toContain("openrouter/free");
    expect(resolved).not.toContain("nvidia/nemotron-3-super:free");
  });

  it("resolves a deterministic hermes free-model ladder", () => {
    expect(
      resolveHermesFallbackModels({
        cwd: "/tmp/project",
        model: "arcee-ai/trinity-large-preview:free",
      }),
    ).toEqual([...DEFAULT_HERMES_FALLBACK_MODELS]);
  });

  it("filters paid openrouter models unless explicitly re-enabled", () => {
    vi.stubEnv(
      "BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODELS",
      [
        "arcee-ai/trinity-large-preview:free",
        "arcee-ai/trinity-large-thinking",
        "z-ai/glm-5.1",
        "qwen/qwen3-coder:free",
      ].join(","),
    );

    expect(resolveHermesFallbackModels({ cwd: "/tmp/project" })).toEqual([
      "arcee-ai/trinity-large-preview:free",
      "qwen/qwen3-coder:free",
      "openai/gpt-oss-120b:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "z-ai/glm-4.5-air:free",
      "minimax/minimax-m2.5:free",
    ]);

    vi.stubEnv("BLUEPRINT_PAPERCLIP_HERMES_ALLOW_PAID_MODELS", "1");

    expect(resolveHermesFallbackModels({ cwd: "/tmp/project" })).toContain("arcee-ai/trinity-large-thinking");
    expect(resolveHermesFallbackModels({ cwd: "/tmp/project" })).toContain("z-ai/glm-5.1");
  });

  it("advances hermes to the next free model before changing adapters", () => {
    expect(
      buildNextHermesFallbackAdapterConfig({
        cwd: "/tmp/project",
        model: "arcee-ai/trinity-large-preview:free",
        [HERMES_MODEL_LADDER_CONFIG_KEY]: [
          "arcee-ai/trinity-large-preview:free",
          "openai/gpt-oss-120b:free",
          "nvidia/nemotron-3-super-120b-a12b:free",
        ],
      }),
    ).toEqual({
      cwd: "/tmp/project",
      model: "openai/gpt-oss-120b:free",
      [HERMES_MODEL_LADDER_CONFIG_KEY]: [...DEFAULT_HERMES_FALLBACK_MODELS],
      modelReasoningEffort: "medium",
      timeoutSec: 1800,
    });
  });

  it("replaces a leaked Codex model with the first free Hermes ladder step", () => {
    expect(
      buildNextHermesFallbackAdapterConfig({
        cwd: "/tmp/project",
        model: "gpt-5.4-mini",
        [HERMES_MODEL_LADDER_CONFIG_KEY]: [
          "gpt-5.4-mini",
          "arcee-ai/trinity-large-preview:free",
          "openai/gpt-oss-120b:free",
        ],
      }),
    ).toEqual({
      cwd: "/tmp/project",
      model: "arcee-ai/trinity-large-preview:free",
      [HERMES_MODEL_LADDER_CONFIG_KEY]: [...DEFAULT_HERMES_FALLBACK_MODELS],
      modelReasoningEffort: "medium",
      timeoutSec: 1800,
    });
  });

  it("detects shared OpenRouter free-pool rate limits", () => {
    expect(
      isSharedOpenRouterFreePoolRateLimitFailure("HTTP 429: Rate limit exceeded: free-models-per-min."),
    ).toBe(true);
    expect(
      isSharedOpenRouterFreePoolRateLimitFailure("HTTP 429: Rate limit exceeded: free-models-per-day-high-balance."),
    ).toBe(true);
    expect(
      isSharedOpenRouterFreePoolRateLimitFailure("HTTP 429: Too Many Requests."),
    ).toBe(false);
  });

  it("moves hermes directly to codex when the shared OpenRouter free pool is exhausted", () => {
    expect(
      buildLocalQuotaFallbackDescriptor({
        currentAdapterType: "hermes_local",
        currentAdapterConfig: {
          cwd: "/tmp/project",
          model: "arcee-ai/trinity-large-preview:free",
          [HERMES_MODEL_LADDER_CONFIG_KEY]: [...DEFAULT_HERMES_FALLBACK_MODELS],
        },
        desiredAdapterType: "hermes_local",
        desiredAdapterConfig: {
          cwd: "/tmp/project",
        },
        failureReason: "HTTP 429: Rate limit exceeded: free-models-per-min.",
      }),
    ).toEqual({
      adapterType: "codex_local",
      reason: "quota_fallback_to_codex_local_after_shared_openrouter_free_pool_limit",
      adapterConfig: {
        cwd: "/tmp/project",
        model: "gpt-5.4-mini",
        modelReasoningEffort: "medium",
        dangerouslyBypassApprovalsAndSandbox: true,
        [FALLBACK_ORIGIN_ADAPTER_CONFIG_KEY]: "hermes_local",
      },
    });
  });

  it("moves authored hermes agents from exhausted hermes models to claude, then codex", () => {
    const exhaustedHermesModel = DEFAULT_HERMES_FALLBACK_MODELS[DEFAULT_HERMES_FALLBACK_MODELS.length - 1];

    expect(
      buildLocalQuotaFallbackDescriptor({
        currentAdapterType: "hermes_local",
        currentAdapterConfig: {
          cwd: "/tmp/project",
          model: exhaustedHermesModel,
          [HERMES_MODEL_LADDER_CONFIG_KEY]: [...DEFAULT_HERMES_FALLBACK_MODELS],
        },
        desiredAdapterType: "hermes_local",
        desiredAdapterConfig: {
          cwd: "/tmp/project",
        },
      }),
    ).toEqual({
      adapterType: "codex_local",
      reason: "quota_fallback_to_codex_local",
      adapterConfig: {
        cwd: "/tmp/project",
        model: "gpt-5.4-mini",
        modelReasoningEffort: "medium",
        dangerouslyBypassApprovalsAndSandbox: true,
        [FALLBACK_ORIGIN_ADAPTER_CONFIG_KEY]: "hermes_local",
      },
    });

    expect(
      buildLocalQuotaFallbackDescriptor({
        currentAdapterType: "claude_local",
        currentAdapterConfig: {
          cwd: "/tmp/project",
          model: "claude-sonnet-4-6",
          dangerouslySkipPermissions: true,
          [FALLBACK_ORIGIN_ADAPTER_CONFIG_KEY]: "hermes_local",
        },
        desiredAdapterType: "hermes_local",
        desiredAdapterConfig: {
          cwd: "/tmp/project",
        },
      }),
    ).toEqual({
      adapterType: "codex_local",
      reason: "quota_fallback_to_codex_local",
      adapterConfig: {
        cwd: "/tmp/project",
        model: "gpt-5.4-mini",
        modelReasoningEffort: "medium",
        dangerouslyBypassApprovalsAndSandbox: true,
        [FALLBACK_ORIGIN_ADAPTER_CONFIG_KEY]: "hermes_local",
      },
    });

    expect(
      buildLocalQuotaFallbackDescriptor({
        currentAdapterType: "codex_local",
        currentAdapterConfig: {
          cwd: "/tmp/project",
          model: "gpt-5.4-mini",
          modelReasoningEffort: "medium",
          dangerouslyBypassApprovalsAndSandbox: true,
          [FALLBACK_ORIGIN_ADAPTER_CONFIG_KEY]: "hermes_local",
        },
        desiredAdapterType: "hermes_local",
        desiredAdapterConfig: {
          cwd: "/tmp/project",
        },
      }),
    ).toBeNull();
  });

  it("normalizes retry record defaults", () => {
    expect(
      buildQuotaFallbackRetryRecord({
        attemptedAt: "2026-03-29T00:00:00.000Z",
        status: "retried",
        agentId: "agent-1",
        reason: "quota_retry",
      }),
    ).toEqual({
      attemptedAt: "2026-03-29T00:00:00.000Z",
      status: "retried",
      agentId: "agent-1",
      issueId: null,
      taskKey: null,
      reason: "quota_retry",
      fallbackAdapterType: null,
      wakeupRunId: null,
      note: null,
    });
  });

  it("selects same-workspace agents for quota fallback", () => {
    expect(
      selectWorkspaceQuotaFallbackTargets(
        {
          id: "intake-agent",
          adapterType: "claude_local",
          adapterConfig: { cwd: "/tmp/webapp", model: "claude-sonnet-4-6" },
        },
        [
          {
            id: "intake-agent",
            adapterType: "claude_local",
            adapterConfig: { cwd: "/tmp/webapp", model: "claude-sonnet-4-6" },
          },
          {
            id: "growth-lead",
            adapterType: "claude_local",
            adapterConfig: { cwd: "/tmp/webapp", model: "claude-sonnet-4-6" },
          },
          {
            id: "finance-support-agent",
            adapterType: "claude_local",
            adapterConfig: { cwd: "/tmp/webapp", model: "claude-sonnet-4-6" },
          },
          {
            id: "webapp-codex",
            adapterType: "codex_local",
            adapterConfig: { cwd: "/tmp/webapp", model: "gpt-5.4-mini" },
          },
          {
            id: "pipeline-review",
            adapterType: "claude_local",
            adapterConfig: { cwd: "/tmp/pipeline", model: "claude-sonnet-4-6" },
          },
        ],
      ).map((agent) => agent.id),
    ).toEqual(["intake-agent", "growth-lead", "finance-support-agent"]);
  });

  it("parses explicit quota reset timestamps", () => {
    expect(
      parseQuotaResetAt(
        "Claude run failed: You've hit your limit · resets Mar 31, 6pm (UTC)",
        new Date("2026-03-30T15:00:00.000Z"),
      ),
    ).toBe("2026-03-31T18:00:00.000Z");
  });

  it("falls back to a default cooldown when reset time is absent", () => {
    expect(
      resolveQuotaCooldownUntil("429 RESOURCE_EXHAUSTED", {
        now: new Date("2026-03-30T10:00:00.000Z"),
        defaultCooldownMs: 2 * 60 * 60 * 1000,
      }),
    ).toBe("2026-03-30T12:00:00.000Z");
  });

  it("builds stable workspace cooldown keys", () => {
    expect(getWorkspaceAdapterCooldownKey("/tmp/webapp", "claude_local")).toBe(
      "/tmp/webapp::claude_local",
    );
  });

  it("syncs execution policy order to the active adapter", () => {
    expect(
      syncExecutionPolicyToAdapter(
        {
          executionPolicy: {
            mode: "prefer_available",
            preferredAdapterTypes: ["claude_local", "hermes_local", "codex_local"],
            compatibleAdapterTypes: ["claude_local", "hermes_local", "codex_local"],
            perAdapterConfig: {
              codex_local: { model: "gpt-5.4-mini" },
            },
          },
        },
        "codex_local",
      ),
    ).toEqual({
      executionPolicy: {
        mode: "prefer_available",
        preferredAdapterTypes: ["codex_local", "claude_local", "hermes_local"],
        compatibleAdapterTypes: ["codex_local", "claude_local", "hermes_local"],
        perAdapterConfig: {
          codex_local: { model: "gpt-5.4-mini" },
        },
      },
    });
  });

  it("creates a fallback execution policy when one is missing", () => {
    expect(syncExecutionPolicyToAdapter({}, "hermes_local")).toEqual({
      executionPolicy: {
        mode: "prefer_available",
        preferredAdapterTypes: ["hermes_local", "codex_local"],
        compatibleAdapterTypes: ["hermes_local", "codex_local"],
      },
    });
  });
});
