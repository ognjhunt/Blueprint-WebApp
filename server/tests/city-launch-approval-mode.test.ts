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

  it("does not re-enable manual approval when requireFounderApproval is set", () => {
    const founderApproved = resolveCityLaunchFounderApproval({
      phase: "full",
      founderApprovedFlag: false,
      requireFounderApproval: true,
    });

    expect(founderApproved).toBe(true);
    expect(
      shouldDispatchCityLaunchApproval({
        phase: "full",
        founderApproved,
        requireFounderApproval: true,
      }),
    ).toBe(false);
  });

  it("auto-approves activation requests unless explicitly disabled", () => {
    expect(
      resolveCityLaunchActivationFounderApproval({
        founderApproved: undefined,
        requireFounderApproval: undefined,
      }),
    ).toBe(true);

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
