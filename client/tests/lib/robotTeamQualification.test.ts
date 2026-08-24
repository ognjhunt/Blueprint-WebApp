import { describe, expect, it } from "vitest";

import { specFields, gateFields } from "@/data/siteTaskQualification";
import {
  robotGateFields,
  robotProseFields,
  robotSpecFields,
} from "@/data/robotTeamQualification";
import { triageGateAnswers } from "@/lib/gateTriage";

function allClear(fields: typeof robotGateFields): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const field of fields) {
    const clear = field.options.find((option) => option.verdict === "clear");
    if (clear) answers[field.id] = clear.value;
  }
  return answers;
}

describe("robot-team gates", () => {
  it("screens deployment readiness, never robot quality", () => {
    // A site can genuinely fail to suit a robot. A robot team cannot fail in
    // that sense — it either matches a task or it does not. What it can fail is
    // "would you actually deploy", which is what costs a real capture visit.
    const questions = robotGateFields.map((field) => field.question.toLowerCase()).join(" ");
    expect(questions).not.toMatch(/how good|how capable|accuracy|state of the art|best/i);
    expect(questions).toMatch(/hardware today/);
    expect(questions).toMatch(/austin metro/);
    expect(questions).toMatch(/deployment engineering/);
    expect(questions).toMatch(/running on a site/);
  });

  it("gives every blocking answer a way out", () => {
    for (const field of robotGateFields) {
      for (const option of field.options) {
        if (option.verdict === "blocking") {
          expect(option.unblocks, `${field.id}/${option.value}`).toBeTruthy();
        }
        if (option.verdict === "marginal") {
          expect(option.ambiguity, `${field.id}/${option.value}`).toBeTruthy();
        }
      }
    }
  });

  it("runs through the same triage engine as the site side", () => {
    const clear = triageGateAnswers(allClear(robotGateFields), robotGateFields);
    expect(clear.disposition).toBe("qualified");

    // No hardware is a deferral with a reason, not a rejection.
    const noHardware = triageGateAnswers(
      { ...allClear(robotGateFields), hardwareMaturity: "development" },
      robotGateFields,
    );
    expect(noHardware.disposition).toBe("not_now");
    expect(noHardware.blockers[0].detail).toMatch(/runs a task end to end/i);

    // A partial submission never qualifies, same guarantee as the site side.
    const partial = triageGateAnswers({ hardwareMaturity: "deployed" }, robotGateFields);
    expect(partial.disposition).not.toBe("qualified");
    expect(partial.incomplete).toBe(true);
  });

  it("does not ask a robot team the site's screening questions", () => {
    // Timeline is legitimately asked of both sides — deployment intent is a
    // real question for each — and shares an id on purpose. What must never
    // cross over is the four qualifying conditions, which describe a room.
    const siteConditionGateIds = new Set(
      gateFields.filter((field) => field.condition).map((field) => field.id),
    );
    expect(siteConditionGateIds.size).toBe(4);
    for (const field of robotGateFields) {
      expect(
        siteConditionGateIds.has(field.id),
        `"${field.id}" screens a room, not a robot team`,
      ).toBe(false);
      expect(field.condition, `"${field.id}" claims a site condition`).toBeUndefined();
    }
    // Service area is asked of both, but from opposite directions.
    expect(robotGateFields.some((field) => field.id === "serviceArea")).toBe(false);
  });

  it("asks robot teams to specify the evidence a data package must carry", () => {
    // The most valuable question on either form: it is a robot team telling us
    // what to build, before we build the wrong thing.
    const evidence = robotProseFields.find((field) => field.id === "evidenceBar");
    expect(evidence?.question).toMatch(/before committing an engineer-week/i);
  });
});

/**
 * The pairing that makes matching mechanical.
 *
 * Every paired spec field must use the *same enum* on both sides, so a match is
 * a comparison of values rather than of prose. If these drift, matching quietly
 * degrades into "a human reads two paragraphs and guesses" — which is the thing
 * Blueprint exists to remove.
 */
describe("spec taxonomies stay aligned across the two intakes", () => {
  const paired = robotSpecFields.filter((field) => field.siteSpecCounterpart);

  it("pairs most of the robot envelope to a site question", () => {
    expect(paired.length).toBeGreaterThanOrEqual(6);
  });

  it("names a real site field for every declared counterpart", () => {
    const siteIds = new Set(specFields.map((field) => field.id));
    for (const field of paired) {
      expect(
        siteIds.has(field.siteSpecCounterpart!),
        `robot "${field.id}" points at missing site field "${field.siteSpecCounterpart}"`,
      ).toBe(true);
    }
  });

  it("uses identical option values on both sides of every pair", () => {
    for (const robotField of paired) {
      const siteField = specFields.find((field) => field.id === robotField.siteSpecCounterpart)!;
      const robotValues = robotField.options.map((option) => option.value);
      const siteValues = siteField.options.map((option) => option.value);
      expect(
        robotValues,
        `"${robotField.id}" and site "${siteField.id}" have drifted apart`,
      ).toEqual(siteValues);
    }
  });

  it("covers every site spec question that a robot envelope could answer", () => {
    // The only site spec field with no robot counterpart should be one that
    // genuinely has none. Today every one of them is paired.
    const covered = new Set(paired.map((field) => field.siteSpecCounterpart));
    const unpaired = specFields.filter((field) => !covered.has(field.id));
    expect(unpaired.map((field) => field.id)).toEqual([]);
  });

  it("explains why every robot spec question is asked", () => {
    for (const field of robotSpecFields) {
      expect(field.whyAsked, `robot spec "${field.id}" does not say why`).toBeTruthy();
    }
  });
});
