import { describe, expect, it } from "vitest";
import { siteSignupDestination } from "./siteOnboarding";
describe("site signup destinations", () => {
  it.each(["//other.test", "https://other.test", "/app", "/claim/x/other", "/claim/x?returnTo=//other.test", "/claim/x\\other"])("refuses an arbitrary or malformed destination %s", returnTo => {
    expect(siteSignupDestination(`?returnTo=${encodeURIComponent(returnTo)}`)).toBe("/contact/site-operator");
  });
  it("keeps a verification return on its signed job", () => {
    expect(siteSignupDestination("?returnTo=%2Fclaim%2Fsigned.token%3Fauto%3D1")).toBe("/claim/signed.token?auto=1");
  });
});
