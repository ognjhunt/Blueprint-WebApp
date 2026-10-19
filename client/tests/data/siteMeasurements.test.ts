/**
 * The measurement catalog is a cross-repo contract: the Pipeline's fidelity
 * templates define it and WebApp collects and exports readings against it.
 * These tests pin the TypeScript catalog to the byte mirror of the Pipeline's
 * rendered catalog, and pin the unit conversions the export depends on.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  REFERENCE_SHEET_SAMPLE_ID,
  SITE_MEASUREMENT_FAMILIES,
  catalogProjection,
  coverageOf,
  familySpec,
  readingsFor,
  toSi,
  unitsFor,
} from "@/data/siteMeasurements";

const mirror = JSON.parse(fs.readFileSync(
  path.resolve(process.cwd(), "contracts/pipeline/site-task-measurement-catalog.v1.json"), "utf8"));

describe("the catalog is the Pipeline's", () => {
  it("projects to exactly the mirrored Pipeline catalog", () => {
    expect(catalogProjection()).toEqual(mirror);
  });

  it("only names readings of its own family in each check", () => {
    for (const spec of SITE_MEASUREMENT_FAMILIES) {
      const ids = spec.readings.map((reading) => reading.sampleId);
      expect(new Set(ids).size).toBe(ids.length);
      for (const check of spec.checks) {
        for (const sampleId of check.sampleIds) expect(ids).toContain(sampleId);
      }
    }
  });

  it("offers every family a reference sheet reading", () => {
    for (const spec of SITE_MEASUREMENT_FAMILIES) {
      expect(spec.readings.map((reading) => reading.sampleId)).toContain(REFERENCE_SHEET_SAMPLE_ID);
    }
  });
});

describe("readings follow the kind of front", () => {
  it("asks a hinged front for its swing and a sliding one for its travel", () => {
    const hinged = readingsFor("articulated_open_close", "hinged").map((reading) => reading.sampleId);
    const sliding = readingsFor("articulated_open_close", "sliding").map((reading) => reading.sampleId);
    expect(hinged).toEqual(expect.arrayContaining(["opening_chord", "handle_offset_from_hinge"]));
    expect(hinged).not.toContain("opening_travel");
    expect(sliding).toContain("opening_travel");
    expect(sliding).not.toContain("opening_chord");
  });

  it("does not depend on articulation for pick and place", () => {
    expect(readingsFor("rigid_pick_place", null)).toEqual(familySpec("rigid_pick_place").readings);
  });
});

describe("unit conversion", () => {
  it("converts what a site types into SI values without float noise", () => {
    expect(toSi(30, "in")).toBe(0.762);
    expect(toSi(76.2, "cm")).toBe(0.762);
    expect(toSi(11, "in")).toBe(0.2794);
    expect(toSi(2, "lb")).toBe(0.907185);
    expect(toSi(1, "kgf")).toBe(9.80665);
    expect(toSi(5, "lbf")).toBe(22.241108);
  });

  it("offers only the units that fit each quantity", () => {
    expect(unitsFor("length")).toEqual(["cm", "in"]);
    expect(unitsFor("mass")).toEqual(["kg", "lb"]);
    expect(unitsFor("force")).toEqual(["kgf", "lbf"]);
  });
});

describe("coverage", () => {
  it("is complete only when every check has its minimum", () => {
    const all = familySpec("rigid_pick_place").readings.map((reading) => reading.sampleId);
    expect(coverageOf("rigid_pick_place", all)).toMatchObject({ complete: true, missingDimensions: [] });
    const withoutWeightOrWidth = all.filter((id) => id !== "object_mass" && id !== "object_width");
    expect(coverageOf("rigid_pick_place", withoutWeightOrWidth)).toMatchObject({
      complete: false,
      missingDimensions: ["task_dynamics", "task_state"],
    });
  });
});
