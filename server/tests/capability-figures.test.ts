/**
 * Figure-to-band conversion.
 *
 * These exist because the alternative is a person deciding what band 20 kg
 * belongs in while typing a seed file, which is unreviewable and drifts.
 */
import { describe, expect, it } from "vitest";

import {
  cycleSecondsToBand,
  payloadKgToBand,
  poundsToKg,
  shiftVolumeToBand,
  successRateToBand,
} from "../utils/capabilityFigures";

describe("payload", () => {
  it("places a figure in the band a site operator would read it into", () => {
    expect(payloadKgToBand(1.5)).toBe("under_2kg");
    expect(payloadKgToBand(5)).toBe("two_to_ten");
    expect(payloadKgToBand(20)).toBe("ten_to_twentyfive");
    expect(payloadKgToBand(30)).toBe("over_25kg");
  });

  it("gives each band its upper bound", () => {
    // The label says "2-10 kg", so 10 belongs there, not in the band above.
    expect(payloadKgToBand(2)).toBe("under_2kg");
    expect(payloadKgToBand(10)).toBe("two_to_ten");
    expect(payloadKgToBand(25)).toBe("ten_to_twentyfive");
  });

  it("refuses nonsense rather than guessing", () => {
    expect(payloadKgToBand(0)).toBeNull();
    expect(payloadKgToBand(-5)).toBeNull();
    expect(payloadKgToBand(Number.NaN)).toBeNull();
  });
});

describe("cycle time", () => {
  it("bands a figure in seconds", () => {
    expect(cycleSecondsToBand(12)).toBe("under_30s");
    expect(cycleSecondsToBand(45)).toBe("thirty_to_two_min");
    expect(cycleSecondsToBand(300)).toBe("two_to_ten_min");
    expect(cycleSecondsToBand(900)).toBe("over_ten_min");
  });
});

describe("success rate", () => {
  it("rounds down to the band a figure actually reaches", () => {
    expect(successRateToBand(99.9)).toBe("ninetynine_plus");
    expect(successRateToBand(99)).toBe("ninetynine");
    // 94 is not 95. Rounding up here puts a team in front of a site it cannot
    // satisfy.
    expect(successRateToBand(94)).toBe("ninety");
    expect(successRateToBand(95)).toBe("ninetyfive");
  });

  it("treats a figure below the lowest band as unknown, not as the lowest", () => {
    expect(successRateToBand(80)).toBeNull();
  });
});

describe("shift volume", () => {
  it("bands a cycle count", () => {
    expect(shiftVolumeToBand(20)).toBe("under_50");
    expect(shiftVolumeToBand(200)).toBe("fifty_to_250");
    expect(shiftVolumeToBand(900)).toBe("250_to_1000");
    expect(shiftVolumeToBand(5000)).toBe("over_1000");
  });
});

describe("unit conversion", () => {
  it("converts a published pound figure into the right band", () => {
    // Agility publish Digit as "35 pound carrying capacity". The quote stays
    // verbatim in the record; the band is derived here.
    expect(payloadKgToBand(poundsToKg(35))).toBe("ten_to_twentyfive");
    expect(payloadKgToBand(poundsToKg(10))).toBe("two_to_ten"); // 4.5 kg
    expect(payloadKgToBand(poundsToKg(4))).toBe("under_2kg"); // 1.8 kg
    expect(payloadKgToBand(poundsToKg(70))).toBe("over_25kg");
  });
});
