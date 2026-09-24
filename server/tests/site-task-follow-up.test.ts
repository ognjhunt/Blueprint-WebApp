import { afterEach, describe, expect, it, vi } from "vitest";

import { allowedFollowUps, selectFollowUps } from "../utils/siteTaskFollowUp";

afterEach(() => vi.unstubAllEnvs());

describe("site task follow-up selection", () => {
  it("rejects invented and repeated model topics and caps the page at three", () => {
    expect(allowedFollowUps(
      ["success_target", "made_up", "success_target", "item_weight", "item_make_model", "item_photos"],
      ["success_target", "item_weight", "item_make_model", "item_photos"],
    )).toEqual(["success_target", "item_weight", "item_make_model"]);
  });

  it("still offers short, usable questions when the model is not configured", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(await selectFollowUps({
      taskStatement: "Move boxes",
      briefSummary: "Move boxes to a pallet",
      itemLabels: ["Boxes"],
      eligible: ["success_target", "item_photos", "item_weight", "item_make_model"],
    })).toEqual(["success_target", "item_photos", "item_weight"]);
  });
});
