// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  resolveCityLaunchActivationFounderApproval,
  resolveCityLaunchFounderApproval,
  shouldDispatchCityLaunchApproval,
} from "../utils/cityLaunchApprovalMode";

describe("city launch approval mode", () => {
  it("does not auto-approve full city-launch runs by default", () => {
    const founderApproved = resolveCityLaunchFounderApproval({
      phase: "full",
      founderApprovedFlag: false,
      requireFounderApproval: false,
    });

    expect(founderApproved).toBe(false);
    expect(
      shouldDispatchCityLaunchApproval({
        phase: "full",
        founderApproved,
        requireFounderApproval: false,
      }),
    ).toBe(true);
  });

  it("keeps manual approval required when requireFounderApproval is set", () => {
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

  it("requires explicit approval for activation requests", () => {
    expect(
      resolveCityLaunchActivationFounderApproval({
        founderApproved: undefined,
        requireFounderApproval: undefined,
      }),
    ).toBe(false);

    expect(
      resolveCityLaunchActivationFounderApproval({
        founderApproved: true,
        requireFounderApproval: true,
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
