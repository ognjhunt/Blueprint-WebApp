import { describe, expect, it } from "vitest";
import { siteSignupDestination } from "./siteOnboarding";
describe("site signup destinations", () => {
  it.each(["//other.test", "https://other.test", "/app", "/claim/x/other", "/claim/x?returnTo=//other.test", "/claim/x\\other"])("refuses an arbitrary or malformed destination %s", returnTo => {
    expect(siteSignupDestination(`?returnTo=${encodeURIComponent(returnTo)}`)).toBe("/contact/site-operator");
  });
  // Owner rule: the development consent boxes never reach a public link, so a legacy signup link drops "authoring".
  it("forwards attribution but never the development authoring entry", () => {
    expect(siteSignupDestination("?authoring=development-entry&source=legacy&utm_source=mail"))
      .toBe("/contact/site-operator?source=legacy&utm_source=mail");
    expect(siteSignupDestination("?authoring=another-entry")).toBe("/contact/site-operator");
  });
  it("keeps a verification return on its signed job", () => {
    expect(siteSignupDestination("?returnTo=%2Fclaim%2Fsigned.token%3Fauto%3D1")).toBe("/claim/signed.token?auto=1");
  });
});
