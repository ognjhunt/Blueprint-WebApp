/**
 * The residency rule, tested where it is cheap to test.
 *
 * Both enforcement points -- `siteCaptureUrl` in the intake route and
 * `decideCaptureDispatch` -- call `isApprovedCaptureRegion`, so the rule itself
 * is worth pinning once here rather than inferred from either caller.
 */
import { describe, expect, it } from "vitest";

import {
  APPROVED_CAPTURE_REGIONS,
  CAPTURE_REGIONS,
  captureRegionOptions,
  isApprovedCaptureRegion,
  isCaptureRegion,
} from "@/data/captureResidency";

describe("where a walkthrough may be collected from", () => {
  it("approves the region the privacy policy scopes the beta to, and nothing else", () => {
    expect(isApprovedCaptureRegion("us")).toBe(true);
    expect(isApprovedCaptureRegion("non_us")).toBe(false);
  });

  it("treats every unknown value as unapproved", () => {
    // The stricter reading, matching `defaultCaptureMode`: a submission must
    // not be able to relax a gate by omitting a field. Here omitting it would
    // mean collecting with no recorded basis at all.
    for (const value of [undefined, null, "", "US", "usa", "eu", 0, {}, []]) {
      expect(isApprovedCaptureRegion(value), `${JSON.stringify(value)}`).toBe(false);
    }
  });

  it("narrows unknown values out of the region type", () => {
    expect(isCaptureRegion("us")).toBe(true);
    expect(isCaptureRegion("non_us")).toBe(true);
    expect(isCaptureRegion("US")).toBe(false);
    expect(isCaptureRegion(undefined)).toBe(false);
  });

  it("offers every region it recognises, so the form cannot omit one", () => {
    expect(captureRegionOptions.map((option) => option.value)).toEqual([...CAPTURE_REGIONS]);
  });

  it("approves a strict subset, or this whole gate is decorative", () => {
    expect(APPROVED_CAPTURE_REGIONS.length).toBeGreaterThan(0);
    expect(APPROVED_CAPTURE_REGIONS.length).toBeLessThan(CAPTURE_REGIONS.length);
  });
});
