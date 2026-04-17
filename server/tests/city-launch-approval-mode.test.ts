// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  resolveCityLaunchActivationFounderApproval,
  resolveCityLaunchFounderApproval,
  shouldDispatchCityLaunchApproval,
} from "../utils/cityLaunchApprovalMode";

describe("city launch approval mode", () => {
  it("auto-approves full city-launch runs by default", () => {
    const founderApproved = resolveCityLaunchFounderApproval({
      phase: "full",
      founderApprovedFlag: false,
      requireFounderApproval: false,
    });

    expect(founderApproved).toBe(true);
    expect(
      shouldDispatchCityLaunchApproval({
        phase: "full",
        founderApproved,
        requireFounderApproval: false,
      }),
    ).toBe(false);
  });

  it("keeps manual approval available when explicitly required", () => {
    const founderApproved = resolveCityLaunchFounderApproval({
      phase: "full",
      founderApprovedFlag: false,
      requireFounderApproval: true,
    });

    expect(founderApproved).toBe(false);
    expect(
      shouldDispatchCityLaunchApproval({
        phase: "full",
        founderApproved,
        requireFounderApproval: true,
      }),
    ).toBe(true);
  });

  it("defaults activation requests to founder-approved unless explicitly forced manual", () => {
    expect(
      resolveCityLaunchActivationFounderApproval({
        founderApproved: undefined,
        requireFounderApproval: undefined,
      }),
    ).toBe(true);

    expect(
      resolveCityLaunchActivationFounderApproval({
        founderApproved: false,
        requireFounderApproval: true,
      }),
    ).toBe(false);
  });
});
