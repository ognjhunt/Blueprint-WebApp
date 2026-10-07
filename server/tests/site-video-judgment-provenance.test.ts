// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../agents/runtime", () => ({ runAgentTask: vi.fn(() => { throw new Error("offline_only"); }) }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, storageAdmin: null, default: {} }));

import { siteVideoEvidenceOutputSchema } from "../agents/tasks/site-video-evidence";
import { proposalsFromFootage } from "../utils/siteTaskBriefReading";
import { summariseVideoEvidence, toVideoEvidenceReview } from "../utils/siteVideoEvidence";
import { videoEvidenceCeiling } from "../../client/src/lib/gateTriage";

// Synthetic contract cases, never annotations of the user's dishwasher clip.
const observation = {
  field_id: "sceneStability", operator_answer: "Stable", stance: "contradicts",
  observation: "A fixture moves.", confidence: 0.99, implied_value: "stable",
  moments: [{ at_seconds: 0, note: "fixture position" }],
};
function evidence(overrides: Record<string, unknown> = {}) {
  return siteVideoEvidenceOutputSchema.parse({
    footage_status: "usable", footage_status_reason: null, summary: "Synthetic fixture scene.",
    observations: [observation],
    cycle_measurement: { cycles: [], median_cycle_seconds: null, implied_band: null, note: "No full cycle." },
    people_present: { max_visible_at_once: 0, relationship_to_work: "none_visible", note: "" },
    not_evidenced: ["Full task cycle"], privacy_flag: false, ...overrides,
  });
}

describe("video judgment needs inspectable evidence", () => {
  it("retains a timestamp at zero as evidence without changing the source", () => {
    const source = evidence(), original = structuredClone(source);
    expect(proposalsFromFootage(source, "self_capture")[0].reading).toContain("0:00");
    expect(videoEvidenceCeiling(toVideoEvidenceReview(summariseVideoEvidence(source, "offline")))).toBe("needs_conversation");
    expect(source).toEqual(original);
  });

  it("does not promote an observation without a timestamp into a brief or screening decision", () => {
    const source = evidence({ observations: [{ ...observation, moments: [] }] });
    expect(proposalsFromFootage(source, "self_capture")).toEqual([]);
    const summary = summariseVideoEvidence(source, "offline");
    expect(summary.contradictions).toEqual([]);
    expect(videoEvidenceCeiling(toVideoEvidenceReview(summary))).toBeNull();
    expect(source.observations).toHaveLength(1);
  });

  it("keeps supported siblings when one claimed observation has no timestamp", () => {
    const source = evidence({ observations: [observation, { ...observation, field_id: "taskShape", implied_value: "single", moments: [] }] });
    expect(proposalsFromFootage(source, "self_capture").map(item => item.fieldId)).toEqual(["sceneStability"]);
    expect(summariseVideoEvidence(source, "offline").contradictions.map(item => item.field_id)).toEqual(["sceneStability"]);
  });

  it("does not promote observations from explicitly unusable footage", () => {
    const source = evidence({ footage_status: "unusable", footage_status_reason: "Task not shown" });
    expect(proposalsFromFootage(source, "self_capture")).toEqual([]);
    expect(summariseVideoEvidence(source, "offline").contradictions).toEqual([]);
    expect(source.observations[0].moments).toHaveLength(1);
  });

  it("keeps partial footage useful while an unseen task stays unknown", () => {
    const source = evidence({ footage_status: "partially_usable", observations: [observation,
      { ...observation, field_id: "taskShape", implied_value: "single", stance: "not_visible" }] });
    expect(proposalsFromFootage(source, "self_capture").map(item => item.fieldId)).toEqual(["sceneStability"]);
    expect(summariseVideoEvidence(source, "offline").not_evidenced).toContain("Full task cycle");
  });
});
