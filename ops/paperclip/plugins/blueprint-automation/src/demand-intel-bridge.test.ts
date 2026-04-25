import { describe, expect, it } from "vitest";
import { assessDemandIntelBridgeReadiness } from "./demand-intel-bridge.js";

describe("demand intel bridge readiness", () => {
  it("requires a live Firehose bridge before city-demand claims", () => {
    const assessment = assessDemandIntelBridgeReadiness("city-demand", null);

    expect(assessment.ok).toBe(false);
    expect(assessment.bridgeState).toBe("missing");
    expect(assessment.scopeLine).toBe("Firehose bridge: missing");
    expect(assessment.failureReason).toContain("City-demand demand intel requires the Firehose bridge");
  });

  it("allows city-demand claims when Firehose is configured", () => {
    const assessment = assessDemandIntelBridgeReadiness("city-demand", {
      apiToken: "secret-token",
      baseUrl: "https://marketing.example.com/firehose",
      defaultTopics: ["robot-teams"],
      maxSignalsPerRead: 20,
    });

    expect(assessment.ok).toBe(true);
    expect(assessment.bridgeState).toBe("live");
    expect(assessment.scopeLine).toContain("Firehose bridge: live");
  });

  it("does not require Firehose for non-city-demand lanes", () => {
    const assessment = assessDemandIntelBridgeReadiness("cross-lane", null);

    expect(assessment.ok).toBe(true);
    expect(assessment.bridgeState).toBe("not-required");
  });
});
