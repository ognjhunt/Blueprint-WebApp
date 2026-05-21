// @vitest-environment node
import { describe, expect, it } from "vitest";
import { runHeadlessAgentSmoke } from "./headless-hosted-session-smoke";

describe("headless hosted-session smoke", () => {
  it("exercises the catalog to export happy path against the mock flow", async () => {
    const result = await runHeadlessAgentSmoke({ mode: "mock", stdout: () => undefined });

    expect(result.mode).toBe("mock");
    expect(result.ok).toBe(true);
    expect(result.steps.map((step) => step.name)).toEqual([
      "catalog",
      "commerce.quote",
      "commerce.checkoutDryRun",
      "commerce.entitlement",
      "commerce.entitlementReadiness",
      "session.create",
      "session.reset",
      "session.step",
      "session.runBatch",
      "session.control",
      "session.explorerRender",
      "session.export",
    ]);
    expect(result.sessionId).toBe("mock-session-1");
  });
});
