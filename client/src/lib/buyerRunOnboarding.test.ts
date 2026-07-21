import { describe, expect, it } from "vitest";

import {
  buyerRunOnboardingTimeline,
  buyerRunReceiveLinks,
} from "@/lib/buyerRunOnboarding";

describe("buyer run onboarding", () => {
  it("publishes a concrete request, scope, run, and receive path", () => {
    expect(buyerRunOnboardingTimeline.map((step) => step.title)).toEqual([
      "Request",
      "Scope",
      "Run",
      "Receive",
    ]);
    expect(buyerRunOnboardingTimeline.some((step) => step.href === "/app/runs")).toBe(true);
    expect(buyerRunOnboardingTimeline.some((step) => step.href === "/beta/buyer-guide")).toBe(true);
  });

  it("sets buyer-facing timeline expectations beyond contact intake", () => {
    const timelineText = buyerRunOnboardingTimeline
      .map((step) => `${step.target} ${step.body}`)
      .join(" ");

    expect(timelineText).toContain("One business day");
    expect(timelineText).toContain("Two to three business days");
    expect(timelineText).toContain("Blocked and degraded states");
    expect(timelineText).toContain("proof-boundary");
  });

  it("links both run delivery and private request-room destinations", () => {
    expect(buyerRunReceiveLinks.map((link) => link.href)).toEqual([
      "/app/runs",
      "/requests/:requestId",
      "/beta/buyer-guide",
    ]);
  });
});
