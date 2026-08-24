import { describe, expect, it } from "vitest";

import { humanoidShare } from "@/data/deploymentMarket";

/**
 * Two shares live in this figure and they are easy to conflate:
 *
 *   - 97% is who *built* the robot (Bloomberg: "China humanoid makers hold 97%
 *     of global shipments").
 *   - 85% is where the robot *went* (Smart Analytics Global: "China represented
 *     more than 85% of global demand").
 *
 * The 97% headlines, on an owner decision. That makes the demand bar
 * load-bearing rather than decorative: on its own the supply share argues China
 * is better at manufacturing, which sits across this site's thesis that supply
 * was never the binding constraint. The demand row is what turns it into a
 * deployment argument.
 *
 * These assertions keep the two from swapping places or being relabelled as
 * each other — "shipped from" and "deployed into" are different claims.
 */
describe("humanoid share", () => {
  it("headlines the supply figure, by owner decision of 2026-08-24", () => {
    expect(humanoidShare.headline).toContain(String(humanoidShare.chineseVendorSharePct));
  });

  it("keeps both shares, because the pair says more than either alone", () => {
    expect(humanoidShare.chinaDemandSharePct).toBe(85);
    expect(humanoidShare.chineseVendorSharePct).toBe(97);
  });

  it("states each share at the published floor, since both sources say 'more than'", () => {
    // Rounding either up would overstate a figure the source deliberately bounded.
    expect(humanoidShare.chinaDemandSharePct).toBeLessThanOrEqual(85);
    expect(humanoidShare.chineseVendorSharePct).toBeLessThanOrEqual(97);
  });

  it("derives each rest-of-world share as the complement of its own bar", () => {
    expect(
      humanoidShare.chinaDemandSharePct + humanoidShare.restOfWorldDemandSharePct,
    ).toBe(100);
    expect(
      humanoidShare.chineseVendorSharePct + humanoidShare.restOfWorldSharePct,
    ).toBe(100);
  });

  it("shows the rest of the world receiving more humanoids than it builds", () => {
    // The point the two bars make together: this is not a supply problem.
    expect(humanoidShare.restOfWorldDemandSharePct).toBeGreaterThan(
      humanoidShare.restOfWorldSharePct,
    );
  });

  it("carries both primary sources at a published grade", () => {
    expect(humanoidShare.basis).toBe("published");
    expect(humanoidShare.sources.length).toBeGreaterThanOrEqual(2);
    for (const source of humanoidShare.sources) {
      expect(source.href).toMatch(/^https:\/\//);
    }
  });
});

describe("HumanoidShareFigure labelling", () => {
  it("labels the two bars as different claims", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("client/src/components/site/runway/figures.tsx", "utf8"),
    );
    const figure = source.slice(source.indexOf("export function HumanoidShareFigure"));
    const block = figure.slice(0, figure.indexOf("\n}\n"));
    // Conflating these is the exact error this figure exists to avoid.
    expect(block).toContain("shipped from");
    expect(block).toContain("deployed into");
  });
});
