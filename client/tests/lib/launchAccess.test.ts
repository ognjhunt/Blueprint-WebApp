import { describe, expect, it } from "vitest";
import {
  buildLaunchAccessWaitlistPayload,
  getLaunchAccessRoleLabel,
  normalizeLaunchAccessCity,
} from "@/lib/launchAccess";

describe("launch access helpers", () => {
  it("normalizes the prefilled city label", () => {
    expect(normalizeLaunchAccessCity("  Durham,   NC  ")).toBe("Durham, NC");
  });

  it("maps role labels for the page UI", () => {
    expect(getLaunchAccessRoleLabel("capturer")).toBe("Boots-on-the-ground capturer");
    expect(getLaunchAccessRoleLabel("site_operator")).toBe("Site operator");
    expect(getLaunchAccessRoleLabel("capturer_and_site_operator")).toBe("Both");
  });

  it("builds the waitlist payload with future-city context", () => {
    expect(
      buildLaunchAccessWaitlistPayload({
        email: "  Ops@Example.com ",
        city: " Durham, NC ",
        role: "capturer_and_site_operator",
        company: "Triangle Robotics",
        notes: "Can help seed warehouse and retail sites.",
      }),
    ).toEqual({
      email: "ops@example.com",
      locationType: "Future city power user interest · Triangle Robotics",
      market: "Durham, NC",
      role: "capturer_and_site_operator",
      device: "launch_access_page",
      company: "Triangle Robotics",
      notes: "Can help seed warehouse and retail sites.",
      phone: undefined,
      source: "capture_app_launch_access",
    });
  });
});
