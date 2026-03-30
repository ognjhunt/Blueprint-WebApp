import { describe, expect, it } from "vitest";
import {
  buildClaudeFallbackAdapterConfig,
  buildCodexFallbackAdapterConfig,
  buildQuotaFallbackRetryRecord,
  isQuotaOrRateLimitFailure,
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
});
