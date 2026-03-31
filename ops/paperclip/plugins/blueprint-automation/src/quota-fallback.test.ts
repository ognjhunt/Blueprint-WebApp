import { describe, expect, it } from "vitest";
import {
  buildClaudeFallbackAdapterConfig,
  buildCodexFallbackAdapterConfig,
  buildQuotaFallbackRetryRecord,
  getWorkspaceAdapterCooldownKey,
  isQuotaOrRateLimitFailure,
  parseQuotaResetAt,
  resolveQuotaCooldownUntil,
  selectWorkspaceQuotaFallbackTargets,
} from "./quota-fallback.js";

describe("quota fallback helpers", () => {
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
            id: "pipeline-claude",
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
});
