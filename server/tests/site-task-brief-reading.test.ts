// @vitest-environment node
/**
 * Turning a model's reading, and the footage reader's observations, into
 * proposals the brief can carry.
 *
 * The rule from the review: nothing invented. A description proposal has to
 * quote the operator's own words or it is a guess; a footage proposal has to
 * clear the same confidence floor a contradiction has to clear; a value that is
 * not one of the gate's options is nobody's answer; and a gate that does not
 * bind under the capture mode is not asked at all.
 */
import { describe, expect, it } from "vitest";

import { proposalsFromFootage, proposalsFromReading } from "../utils/siteTaskBriefReading";
import { siteVideoEvidenceOutputSchema } from "../agents/tasks/site-video-evidence";

describe("proposalsFromReading", () => {
  const sources = {
    taskStatement: "We move about six carton sizes from the conveyor onto a pallet.",
    whatGoesWrong: "The pallet is sometimes moved between shifts.",
  };
  const reading = {
    summary: "Move sealed cartons from the conveyor onto a pallet",
    proposals: [
      {
        field_id: "objectVariety",
        value: "under_10",
        basis: "description" as const,
        quote: "about six carton sizes",
        reading: "Six sizes is fewer than ten.",
        confidence: 0.9,
      },
      {
        field_id: "sceneStability",
        value: "stable",
        basis: "description" as const,
        quote: null,
        reading: "Conveyors do not move.",
        confidence: 0.9,
      },
      {
        field_id: "deploymentTimeline",
        value: "this_quarter",
        basis: "assumption" as const,
        quote: null,
        reading: "Sounds urgent, but no date is given.",
        confidence: 0.4,
      },
      {
        field_id: "accessWindow",
        value: "not_an_option",
        basis: "description" as const,
        quote: "after the night shift",
        reading: "Invalid value.",
        confidence: 0.9,
      },
      {
        field_id: "serviceArea",
        value: "austin_metro",
        basis: "description" as const,
        quote: "Austin",
        reading: "Not a self-capture gate.",
        confidence: 0.9,
      },
    ],
    not_stated: ["accessWindow"],
  };

  it("keeps a quoted description proposal, with the quote in the reading", () => {
    const proposals = proposalsFromReading(reading, "self_capture", sources);
    const variety = proposals.find((answer) => answer.fieldId === "objectVariety");
    expect(variety?.basis).toBe("description");
    expect(variety?.value).toBe("under_10");
    expect(variety?.reading).toContain("about six carton sizes");
  });

  it("downgrades an unquoted description to an assumption", () => {
    const proposals = proposalsFromReading(reading, "self_capture", sources);
    expect(proposals.find((answer) => answer.fieldId === "sceneStability")?.basis).toBe("assumption");
  });

  it("keeps an assumption as an assumption", () => {
    const proposals = proposalsFromReading(reading, "self_capture", sources);
    expect(proposals.find((answer) => answer.fieldId === "deploymentTimeline")?.basis).toBe("assumption");
  });

  it("drops a value that is not one of the gate's options", () => {
    const proposals = proposalsFromReading(reading, "self_capture", sources);
    expect(proposals.find((answer) => answer.fieldId === "accessWindow")).toBeUndefined();
  });

  it("drops a gate that does not bind under the capture mode", () => {
    const proposals = proposalsFromReading(reading, "self_capture", sources);
    expect(proposals.find((answer) => answer.fieldId === "serviceArea")).toBeUndefined();
  });

  it("downgrades a quote the operator never wrote", () => {
    const fabricated = {
      ...reading,
      proposals: [{
        ...reading.proposals[0],
        quote: "exactly six identical cartons",
      }],
    };
    expect(proposalsFromReading(fabricated, "self_capture", sources)[0]?.basis).toBe("assumption");
  });
});

function evidence(observations: unknown[]) {
  return siteVideoEvidenceOutputSchema.parse({
    footage_status: "usable",
    footage_status_reason: null,
    summary: "A carton line.",
    observations,
    cycle_measurement: { cycles: [], median_cycle_seconds: null, implied_band: null, note: "" },
    people_present: { max_visible_at_once: 0, relationship_to_work: "none_visible", note: "" },
    not_evidenced: [],
    privacy_flag: false,
  });
}

describe("proposalsFromFootage", () => {
  const seen = evidence([
    {
      field_id: "sceneStability",
      operator_answer: null,
      stance: "corroborates",
      observation: "Fixtures and the pallet position stay put across the clip.",
      confidence: 0.8,
      moments: [{ at_seconds: 12, note: "same layout" }],
      implied_value: "stable",
    },
    {
      field_id: "taskShape",
      operator_answer: null,
      stance: "not_visible",
      observation: "Looks like one job, but only part of a cycle is shown.",
      confidence: 0.4,
      moments: [],
      implied_value: "single",
    },
    {
      field_id: "objectVariety",
      operator_answer: null,
      stance: "not_visible",
      observation: "Cartons only, count unclear.",
      confidence: 0.9,
      moments: [],
      implied_value: null,
    },
    {
      field_id: "lighting",
      operator_answer: null,
      stance: "corroborates",
      observation: "Consistent overhead light.",
      confidence: 0.9,
      moments: [{ at_seconds: 3, note: "overhead light" }],
      implied_value: "consistent",
    },
  ]);

  it("accepts an implied value on an observation", () => {
    expect(seen.observations[0].implied_value).toBe("stable");
  });

  it("proposes a confident observation with a value, citing the moment", () => {
    const proposals = proposalsFromFootage(seen, "self_capture");
    const stability = proposals.find((answer) => answer.fieldId === "sceneStability");
    expect(stability?.basis).toBe("observation");
    expect(stability?.value).toBe("stable");
    expect(stability?.reading).toContain("0:12");
  });

  it("drops an observation below the confidence floor", () => {
    const proposals = proposalsFromFootage(seen, "self_capture");
    expect(proposals.find((answer) => answer.fieldId === "taskShape")).toBeUndefined();
  });

  it("drops a high-confidence value when the footage did not show the field", () => {
    const unseen = evidence([{
      field_id: "taskShape",
      operator_answer: null,
      stance: "not_visible",
      observation: "Only part of one cycle is visible.",
      confidence: 0.99,
      moments: [],
      implied_value: "single",
    }]);
    expect(proposalsFromFootage(unseen, "self_capture")).toEqual([]);
  });

  it("drops an observation that implies no value", () => {
    const proposals = proposalsFromFootage(seen, "self_capture");
    expect(proposals.find((answer) => answer.fieldId === "objectVariety")).toBeUndefined();
  });

  it("ignores fields that are not gates", () => {
    const proposals = proposalsFromFootage(seen, "self_capture");
    expect(proposals.find((answer) => answer.fieldId === "lighting")).toBeUndefined();
    expect(proposals).toHaveLength(1);
  });
});
