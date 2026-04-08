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
  FALLBACK_ORIGIN_ADAPTER_CONFIG_KEY,
  HERMES_MODEL_LADDER_CONFIG_KEY,
  getWorkspaceAdapterCooldownKey,
  isIncompatibleHermesFreeRoutingModel,
  isQuotaOrRateLimitFailure,
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
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("detects common quota and rate-limit failures", () => {
    expect(isQuotaOrRateLimitFailure("Claude run failed: subtype=success: You've hit your limit · resets 8pm (UTC)")).toBe(true);
    expect(isQuotaOrRateLimitFailure("429 RESOURCE_EXHAUSTED: You exceeded your current quota and billing details.")).toBe(true);
    expect(isQuotaOrRateLimitFailure("rate limit exceeded")).toBe(true);
    expect(isQuotaOrRateLimitFailure("adapter exited with code 1")).toBe(false);
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
        { model: "gpt-5.4-mini", modelReasoningEffort: "xhigh" },
      ),
    ).toEqual({
      cwd: "/tmp/project",
      timeoutSec: 1800,
      model: "gpt-5.4-mini",
      modelReasoningEffort: "xhigh",
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
      modelReasoningEffort: "xhigh",
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
      modelReasoningEffort: "xhigh",
      timeoutSec: 900,
    });
  });

  it("resolves a deterministic hermes free-model ladder", () => {
    expect(
      resolveHermesFallbackModels({
        cwd: "/tmp/project",
        model: "arcee-ai/trinity-large-preview:free",
      }),
    ).toEqual([...DEFAULT_HERMES_FALLBACK_MODELS]);
  });

  it("advances hermes to the next free model before changing adapters", () => {
    expect(
      buildNextHermesFallbackAdapterConfig({
        cwd: "/tmp/project",
        model: "arcee-ai/trinity-large-preview:free",
        [HERMES_MODEL_LADDER_CONFIG_KEY]: [
          "arcee-ai/trinity-large-preview:free",
          "openrouter/free",
          "stepfun/step-3.5-flash:free",
        ],
      }),
    ).toEqual({
      cwd: "/tmp/project",
      model: "openrouter/free",
      [HERMES_MODEL_LADDER_CONFIG_KEY]: [...DEFAULT_HERMES_FALLBACK_MODELS],
      modelReasoningEffort: "xhigh",
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
          "openrouter/free",
        ],
      }),
    ).toEqual({
      cwd: "/tmp/project",
      model: "arcee-ai/trinity-large-preview:free",
      [HERMES_MODEL_LADDER_CONFIG_KEY]: [...DEFAULT_HERMES_FALLBACK_MODELS],
      modelReasoningEffort: "xhigh",
      timeoutSec: 1800,
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
      adapterType: "claude_local",
      reason: "quota_fallback_to_claude_local",
      adapterConfig: {
        cwd: "/tmp/project",
        model: "claude-sonnet-4-6",
        dangerouslySkipPermissions: true,
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
        modelReasoningEffort: "xhigh",
        dangerouslyBypassApprovalsAndSandbox: true,
        [FALLBACK_ORIGIN_ADAPTER_CONFIG_KEY]: "hermes_local",
      },
    });
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
            preferredAdapterTypes: ["claude_local", "hermes_local", "opencode_local", "codex_local"],
            compatibleAdapterTypes: ["claude_local", "hermes_local", "opencode_local", "codex_local"],
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
        preferredAdapterTypes: ["codex_local", "claude_local", "hermes_local", "opencode_local"],
        compatibleAdapterTypes: ["codex_local", "claude_local", "hermes_local", "opencode_local"],
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
        preferredAdapterTypes: ["hermes_local", "claude_local", "codex_local", "opencode_local"],
        compatibleAdapterTypes: ["hermes_local", "claude_local", "codex_local", "opencode_local"],
      },
    });
  });
});
