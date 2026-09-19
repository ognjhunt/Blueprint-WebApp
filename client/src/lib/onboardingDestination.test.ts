import { describe, expect, it } from "vitest";
import { onboardingDestination } from "./onboardingDestination";
describe("onboarding destination", () => {
  it("preserves signed claims and selected task context", () => {
    expect(onboardingDestination("site_operator", "?returnTo=%2Fclaim%2Fsigned-token")).toBe("/claim/signed-token");
    expect(onboardingDestination("robot_team", "?sceneId=task-1&source=catalog")).toBe("/contact/robot-team?source=catalog&sceneId=task-1");
  });
  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "/signup/business", "javascript:alert(1)"])("rejects unsafe or looping target %s", target => {
    expect(onboardingDestination("site_operator", `?returnTo=${encodeURIComponent(target)}`)).toBe("/contact/site-operator");
  });
});
