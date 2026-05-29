import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as content from "@/data/content";

const contentRoot = resolve(process.cwd(), "client/src/data/content");
const barrelPath = resolve(process.cwd(), "client/src/data/content.ts");

describe("public content compatibility barrel", () => {
  it("keeps the legacy content import stable while content lives in doctrine modules", () => {
    expect(
      [
        "index.ts",
        "types.ts",
        "licensing.ts",
        "environmentCatalog.ts",
        "marketplaceCatalog.ts",
        "trainingCatalog.ts",
        "publicPages.ts",
        "pricingCatalog.ts",
      ].map((fileName) => [fileName, existsSync(resolve(contentRoot, fileName))]),
    ).toEqual([
      ["index.ts", true],
      ["types.ts", true],
      ["licensing.ts", true],
      ["environmentCatalog.ts", true],
      ["marketplaceCatalog.ts", true],
      ["trainingCatalog.ts", true],
      ["publicPages.ts", true],
      ["pricingCatalog.ts", true],
    ]);

    expect(readFileSync(barrelPath, "utf8").trim()).toBe(
      'export * from "./content/index";',
    );

    expect(Object.keys(content).sort()).toEqual([
      "bundleFeatureMatrix",
      "bundleTiers",
      "calculateExclusivityPrice",
      "calculateLicensePrice",
      "calculateTotalPrice",
      "caseStudies",
      "defaultDatasetDatasheet",
      "defaultSceneDatasheet",
      "environmentCategories",
      "environmentPolicies",
      "exclusivityOptions",
      "jobs",
      "licenseTiers",
      "marketplaceScenes",
      "premiumCapabilities",
      "sceneRecipes",
      "scenes",
      "syntheticDatasets",
      "trainingDatasets",
    ]);

    expect(content.environmentCategories.map((category) => category.slug)).toEqual([
      "kitchens",
      "grocery-aisles",
      "warehouse-lanes",
      "loading-docks",
      "labs",
      "office-pods",
      "utility-rooms",
      "home-laundry",
    ]);
    expect(content.syntheticDatasets[0]).toMatchObject({
      slug: "prep-line-essentials",
      title: "Prep-Line Essentials",
      description:
        "150-scene bundle covering prep tables, dish pits, and service pass-throughs with drawer, door, and appliance articulation baked in.",
    });
    expect(content.caseStudies[0].body).toContain(
      "It is not presented as a named customer result.",
    );
    expect(content.jobs.map((job) => job.applyEmail)).toEqual([
      "apply+gtm-systems@tryblueprint.io",
      "apply+delivery-systems@tryblueprint.io",
    ]);
    expect(content.bundleTiers.map((tier) => tier.tier)).toEqual([
      "standard",
      "pro",
      "enterprise",
      "foundation",
    ]);
  });
});
