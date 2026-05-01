import { describe, expect, it, vi } from "vitest";
import type { PluginContext } from "@paperclipai/plugin-sdk";
import { buildAnalyticsOutputProof } from "./analytics-report.js";

describe("analytics report proof", () => {
  it("marks the writer blocked when required report sections are missing", async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      state: { set },
    } as unknown as PluginContext;

    const result = await buildAnalyticsOutputProof(ctx, {}, "company-1", {
      cadence: "daily",
    });

    expect(result.outcome).toBe("blocked");
    expect(result.failureReason).toContain("Missing summaryBullets for analytics report.");
    expect(result.issueComment).toContain("Validation Errors");
    expect(result.data.outcome).toBe("blocked");
    expect(result.data.validationErrors).toContain("Missing recommendedFollowUps for analytics report.");
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeKind: "company",
        scopeId: "company-1",
        namespace: "blueprint-automation",
        stateKey: "analytics-daily-latest",
      }),
      expect.objectContaining({
        outcome: "blocked",
      }),
    );
  });
});
