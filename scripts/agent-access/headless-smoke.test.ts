// @vitest-environment node
import { describe, expect, it } from "vitest";
import { runHeadlessAgentSmoke } from "./headless-hosted-session-smoke";

describe("headless hosted-session smoke", () => {
  it("exercises the catalog to export happy path against the mock flow", async () => {
    const result = await runHeadlessAgentSmoke({ mode: "mock", stdout: () => undefined });

    expect(result.mode).toBe("mock");
    expect(result.ok).toBe(true);
    expect(result.steps.map((step) => step.name)).toEqual([
      "discover",
      "agentAccess.manifest",
      "agentAccess.openapi",
      "catalog",
      "siteWorld.search",
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
    expect(result.truthLabels).toEqual(
      expect.arrayContaining([
        "capture_grounded",
        "sample_demo",
        "public_demo_eligible",
        "request_gated",
        "protected_robot_team",
        "dry_run_order",
      ]),
    );
    expect(result.searchRequestCandidateIntakeOnly).toBe(true);
  });
});
