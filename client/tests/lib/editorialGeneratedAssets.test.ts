import { describe, expect, it } from "vitest";

import {
  editorialGeneratedAssets,
  humanoidReadinessAssets,
} from "@/lib/editorialGeneratedAssets";
import { hostedFilmstripFrames } from "@/lib/siteEditorialContent";

const oldWheeledRobotAssets = [
  "/generated/editorial/world-models-hero.png",
  "/generated/editorial/pricing-hero.png",
  "/generated/editorial/hosted-hero.png",
  "/generated/editorial/grocery-fulfillment.png",
  "/generated/editorial/cross-dock.png",
  "/generated/editorial/manufacturing-plant.png",
  "/generated/editorial/cold-storage.png",
  "/generated/editorial/retail-store.png",
  "/generated/editorial/proof-board.png",
];

describe("humanoid readiness editorial assets", () => {
  it("keeps public robot visual slots pointed at the humanoid asset set", () => {
    const humanoidAssetValues = Object.values(humanoidReadinessAssets);

    expect(humanoidAssetValues).toHaveLength(8);
    humanoidAssetValues.forEach((src) => {
      expect(src).toMatch(
        /^\/generated\/humanoid-readiness-2026-06-03\/|^\/editorial\/2026-06-06\//,
      );
    });

    const publicRobotVisualSlots = [
      editorialGeneratedAssets.groceryBackroom,
      editorialGeneratedAssets.warehouseAisle,
      editorialGeneratedAssets.operatorControlEntry,
      editorialGeneratedAssets.proofBoardDeliverables,
      editorialGeneratedAssets.hostedReviewHero,
      editorialGeneratedAssets.proofBoardGovernance,
      editorialGeneratedAssets.careersStudio,
      ...hostedFilmstripFrames.map((frame) => frame.src),
    ];

    publicRobotVisualSlots.forEach((src) => {
      expect(src).toContain("/generated/humanoid-readiness-2026-06-03/");
      expect(oldWheeledRobotAssets).not.toContain(src);
    });
  });
});
