// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildCreativeCampaignKit,
  type CreativeBriefInput,
  type RemotionStoryboardFrame,
} from "../utils/creative-pipeline";

function baseBrief(overrides?: Partial<CreativeBriefInput>): CreativeBriefInput {
  return {
    skuName: "Exact-Site Hosted Review",
    audience: "robotics deployment leads",
    siteType: "warehouse",
    workflow: "pre-deployment site review",
    proofPoints: ["One real facility, not a synthetic stand-in."],
    callToAction: "Book a 30-minute exact-site hosted-review scoping call.",
    differentiators: ["Rights and provenance stay explicit."],
    assetGoal: "landing_page",
    ...overrides,
  };
}

describe("buildCreativeCampaignKit", () => {
  it("produces a 4-frame storyboard at expected timings", () => {
    const kit = buildCreativeCampaignKit(baseBrief());
    expect(kit.remotionStoryboard).toHaveLength(4);

    const frames: RemotionStoryboardFrame[] = kit.remotionStoryboard;
    expect(frames[0].startFrame).toBe(0);
    expect(frames[0].durationFrames).toBe(90);
    expect(frames[1].startFrame).toBe(90);
    expect(frames[2].startFrame).toBe(180);
    expect(frames[3].startFrame).toBe(270);
  });

  it("limits proof bullets and preserves provenance guardrails", () => {
    const kit = buildCreativeCampaignKit(
      baseBrief({
        proofPoints: [
          "Point one.",
          "Point two.",
          "Point three.",
          "Point four.",
          "Point five.",
          "Point six.",
          "Point seven.",
        ],
        differentiators: ["Diff one.", "Diff two."],
      }),
    );

    expect(kit.landingPage.proofBullets.length).toBeLessThanOrEqual(5);
    expect(kit.prompts.nanoBananaVariants).toHaveLength(3);
    expect(kit.provenanceGuardrails).toEqual(
      expect.arrayContaining([
        expect.stringContaining("real Blueprint evidence"),
        expect.stringContaining("fake customer logos"),
      ]),
    );
  });

  it("threads buyer objections into the proof bullets and storyboard", () => {
    const kit = buildCreativeCampaignKit(
      baseBrief({
        buyerObjections: ["pricing and commercial clarity"],
      }),
    );

    expect(kit.landingPage.proofBullets.join(" ")).toContain(
      "Counter the common buyer objection: pricing and commercial clarity",
    );
    expect(kit.remotionStoryboard[1].copy).toContain("Buyer concern: pricing and commercial clarity");
  });
});
