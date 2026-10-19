// @vitest-environment node
/**
 * Site measurements: what a site types, what is kept, and the source document
 * the Pipeline's qualifier consumes.
 *
 * Three things are pinned here. Input is checked against the catalog, so a
 * reading in the wrong unit or for the wrong kind of job never reaches the
 * record. Each reading keeps who recorded it and when, through later saves
 * that leave it unchanged. And the export is exactly the bytes the Pipeline
 * test also consumes, bound to the request it is exported for.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";
import type { MeasurementSaveInput } from "../../client/src/data/siteMeasurements";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP", delete: () => FAKE_FIELD_DELETE } } },
    dbAdmin: sharedFakeFirestore,
    storageAdmin: null,
  };
});

const {
  MeasurementInputError,
  MeasurementRevisionConflict,
  SourceMeasurementExportError,
  buildSourceMeasurementDocument,
  getMeasurements,
  normalizeMeasurementInput,
  presentMeasurements,
  presentMeasurementsForAdmin,
  saveMeasurements,
} = await import("../utils/siteTaskMeasurements");

const FIXTURES = path.resolve(process.cwd(), "server/tests/fixtures/site-task-measurements");
const SHA = (digit: string) => `sha256:${digit.repeat(64)}`;

const PICK_PLACE_INPUT: MeasurementSaveInput = {
  revision: 0,
  family: "rigid_pick_place",
  articulation: null,
  readings: {
    pick_surface_height: { value: 30, unit: "in" },
    place_surface_height: { value: 36, unit: "in" },
    pick_to_place_distance: { value: 150, unit: "cm" },
    object_length: { value: 40, unit: "cm" },
    object_width: { value: 30, unit: "cm" },
    object_height: { value: 25, unit: "cm" },
    pick_front_clearance: { value: 120, unit: "cm" },
    object_mass: { value: 3.5, unit: "lb" },
  },
  referencePaper: "letter",
  referenceSheetLongEdge: null,
  measuredBy: "Dana Okafor",
  note: null,
};

const OPEN_CLOSE_INPUT: MeasurementSaveInput = {
  revision: 0,
  family: "articulated_open_close",
  articulation: "hinged",
  readings: {
    handle_height: { value: 92, unit: "cm" },
    front_width: { value: 60, unit: "cm" },
    opening_chord: { value: 80, unit: "cm" },
    handle_offset_from_hinge: { value: 55, unit: "cm" },
    front_clearance_open: { value: 150, unit: "cm" },
    opening_force: { value: 2.5, unit: "kgf" },
  },
  referencePaper: "a4",
  referenceSheetLongEdge: null,
  measuredBy: null,
  note: "The door sticks a little in humid weather.",
};

function binding(requestId: string, overrides: Record<string, unknown> = {}) {
  return {
    scene_request_id: requestId,
    site_id: `site-${requestId}`,
    task_id: "task-fixture",
    capture_id: `walkthrough-${requestId}`,
    source_capture_digest: SHA("1"),
    testbed_digest_sha256: SHA("2"),
    scene_revision_digest: SHA("3"),
    task_spec_digest: SHA("4"),
    success_contract_digest: SHA("5"),
    robot_model_digest: SHA("6"),
    policy_interface_id: "blueprint_policy_https.v1",
    ...overrides,
  };
}

const FIRST = new Date("2026-10-17T09:00:00.000Z");
const LATER = new Date("2026-10-17T09:42:17.250Z");

function expectInputError(run: () => unknown, code: string) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(MeasurementInputError);
    expect((error as InstanceType<typeof MeasurementInputError>).code).toBe(code);
    return;
  }
  throw new Error(`expected ${code}`);
}

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
});

describe("input is checked against the catalog", () => {
  it("refuses a unit that does not fit the reading", () => {
    expectInputError(() => normalizeMeasurementInput({ ...PICK_PLACE_INPUT,
      readings: { object_mass: { value: 2, unit: "cm" } } }), "unit_invalid");
  });

  it("refuses a value no site could have, which is a unit slip", () => {
    expectInputError(() => normalizeMeasurementInput({ ...PICK_PLACE_INPUT,
      readings: { pick_surface_height: { value: 400, unit: "cm" } } }), "value_out_of_range");
  });

  it("refuses a reading from the other kind of job", () => {
    expectInputError(() => normalizeMeasurementInput({ ...PICK_PLACE_INPUT,
      readings: { handle_height: { value: 90, unit: "cm" } } }), "reading_unknown");
  });

  it("refuses a hinged front's swing on a drawer", () => {
    expectInputError(() => normalizeMeasurementInput({ ...OPEN_CLOSE_INPUT, articulation: "sliding" }), "reading_unknown");
  });

  it("needs to know how a front opens, and only for a front", () => {
    expectInputError(() => normalizeMeasurementInput({ ...OPEN_CLOSE_INPUT, articulation: null }), "articulation_invalid");
    expectInputError(() => normalizeMeasurementInput({ ...PICK_PLACE_INPUT, articulation: "hinged" }), "articulation_invalid");
  });

  it("takes the sheet only through the paper question", () => {
    expectInputError(() => normalizeMeasurementInput({ ...PICK_PLACE_INPUT,
      readings: { reference_sheet_long_edge: { value: 28, unit: "cm" } } }), "reading_unknown");
    expectInputError(() => normalizeMeasurementInput({ ...PICK_PLACE_INPUT, referencePaper: "other" }),
      "reference_sheet_invalid");
    expectInputError(() => normalizeMeasurementInput({ ...PICK_PLACE_INPUT, referencePaper: "other",
      referenceSheetLongEdge: { value: 3, unit: "cm" } }), "reference_sheet_invalid");
    expectInputError(() => normalizeMeasurementInput({ ...PICK_PLACE_INPUT,
      referenceSheetLongEdge: { value: 28, unit: "cm" } }), "reference_sheet_invalid");
  });

  it("uses the paper standard for US Letter and A4, and the tape for anything else", () => {
    expect(normalizeMeasurementInput(PICK_PLACE_INPUT).readings.reference_sheet_long_edge)
      .toEqual({ value: null, unit: null, si: 0.2794, basis: "paper_standard" });
    expect(normalizeMeasurementInput(OPEN_CLOSE_INPUT).readings.reference_sheet_long_edge)
      .toEqual({ value: null, unit: null, si: 0.297, basis: "paper_standard" });
    expect(normalizeMeasurementInput({ ...PICK_PLACE_INPUT, referencePaper: "other",
      referenceSheetLongEdge: { value: 14, unit: "in" } }).readings.reference_sheet_long_edge)
      .toEqual({ value: 14, unit: "in", si: 0.3556, basis: "tape" });
    expect(normalizeMeasurementInput({ ...PICK_PLACE_INPUT, referencePaper: "none" }).readings.reference_sheet_long_edge)
      .toBeUndefined();
  });
});

describe("saving keeps who measured what, and when", () => {
  it("starts a job at revision 1 with each reading's provenance", async () => {
    const record = await saveMeasurements("req-1", PICK_PLACE_INPUT, { scope: "owner" }, FIRST);
    expect(record.revision).toBe(1);
    expect(record.readings.pick_surface_height).toEqual({ value: 30, unit: "in", si: 0.762, basis: "tape",
      recordedAtIso: FIRST.toISOString(), recordedByScope: "owner", recordedByName: "Dana Okafor" });
    expect(record.readings.object_mass).toMatchObject({ si: 1.587573, basis: "scale" });
    expect(await getMeasurements("req-1")).toMatchObject({ revision: 1, family: "rigid_pick_place" });
  });

  it("refuses a save from a page that did not see the latest revision", async () => {
    await expect(saveMeasurements("req-1", { ...PICK_PLACE_INPUT, revision: 1 }, { scope: "owner" }, FIRST))
      .rejects.toBeInstanceOf(MeasurementRevisionConflict);
    await saveMeasurements("req-1", PICK_PLACE_INPUT, { scope: "owner" }, FIRST);
    const conflict = await saveMeasurements("req-1", PICK_PLACE_INPUT, { scope: "film" }, LATER).catch((error) => error);
    expect(conflict).toBeInstanceOf(MeasurementRevisionConflict);
    expect(conflict.latest).toMatchObject({ revision: 1 });
  });

  it("keeps an unchanged reading's first record, renews a changed one, and clears one left out", async () => {
    await saveMeasurements("req-1", PICK_PLACE_INPUT, { scope: "owner" }, FIRST);
    const { pick_front_clearance: _cleared, ...rest } = PICK_PLACE_INPUT.readings;
    const record = await saveMeasurements("req-1", { ...PICK_PLACE_INPUT, revision: 1, measuredBy: "Sam",
      readings: { ...rest, object_mass: { value: 1.6, unit: "kg" } } }, { scope: "film" }, LATER);
    expect(record.revision).toBe(2);
    expect(record.readings.pick_surface_height).toMatchObject({ recordedAtIso: FIRST.toISOString(),
      recordedByScope: "owner", recordedByName: "Dana Okafor" });
    expect(record.readings.object_mass).toMatchObject({ value: 1.6, unit: "kg", si: 1.6,
      recordedAtIso: LATER.toISOString(), recordedByScope: "film", recordedByName: "Sam" });
    expect(record.readings.pick_front_clearance).toBeUndefined();
    expect(record.readings.reference_sheet_long_edge).toMatchObject({ recordedAtIso: FIRST.toISOString() });
  });
});

describe("what each page sees", () => {
  it("gives a job without measurements an empty form at revision 0", () => {
    expect(presentMeasurements(null)).toEqual({ revision: 0, family: null, articulation: null, referencePaper: null,
      referenceSheetLongEdge: null, readings: {}, measuredBy: null, note: null, updatedAtIso: null });
  });

  it("shows the site what it typed, and the sheet through the paper question", async () => {
    const record = await saveMeasurements("req-1", { ...PICK_PLACE_INPUT, referencePaper: "other",
      referenceSheetLongEdge: { value: 14, unit: "in" } }, { scope: "film" }, FIRST);
    const presented = presentMeasurements(record);
    expect(presented.readings.pick_surface_height).toEqual({ value: 30, unit: "in",
      recordedAtIso: FIRST.toISOString(), recordedByScope: "film" });
    expect(presented.readings.reference_sheet_long_edge).toBeUndefined();
    expect(presented.referenceSheetLongEdge).toEqual({ value: 14, unit: "in" });
    expect(presented.measuredBy).toBe("Dana Okafor");
  });

  it("shows an admin SI values, basis, provenance and coverage", async () => {
    const record = await saveMeasurements("req-1", PICK_PLACE_INPUT, { scope: "owner" }, FIRST);
    const admin = presentMeasurementsForAdmin(record)!;
    expect(admin.readings.map((reading) => reading.sampleId)).toEqual([
      "pick_surface_height", "place_surface_height", "pick_to_place_distance", "object_length", "object_width",
      "object_height", "pick_front_clearance", "object_mass", "reference_sheet_long_edge"]);
    expect(admin.readings.find((reading) => reading.sampleId === "reference_sheet_long_edge"))
      .toMatchObject({ si: 0.2794, siUnit: "m", basis: "paper_standard", value: null });
    expect(admin.coverage).toMatchObject({ complete: true, missingDimensions: [] });
  });
});

describe("the source measurement document", () => {
  async function saved(input: MeasurementSaveInput, requestId: string) {
    return saveMeasurements(requestId, input, { scope: "owner" }, FIRST);
  }

  function expectExportError(run: () => unknown, code: string) {
    try {
      run();
    } catch (error) {
      expect(error).toBeInstanceOf(SourceMeasurementExportError);
      expect((error as InstanceType<typeof SourceMeasurementExportError>).code).toBe(code);
      return;
    }
    throw new Error(`expected ${code}`);
  }

  it.each([
    ["rigid_pick_place", PICK_PLACE_INPUT, "req-measure-1"],
    ["articulated_open_close", OPEN_CLOSE_INPUT, "req-measure-2"],
  ] as const)("exports exactly the pinned %s bytes", async (family, input, requestId) => {
    const record = await saved(input, requestId);
    const exported = buildSourceMeasurementDocument(record, { binding: binding(requestId),
      producerId: `site_job:${requestId}` });
    const pinned = fs.readFileSync(path.join(FIXTURES, `${family}.webapp_export.synthetic.json`), "utf8");
    expect(exported.json).toBe(pinned);
    expect(exported.sha256).toBe(`sha256:${createHash("sha256").update(pinned).digest("hex")}`);
    expect(exported.fileName).toBe(`site-task-measurements-${requestId}-r1.json`);
    expect(JSON.parse(exported.json).observed_at_iso).toBe("2026-10-17T09:00:00Z");
    expect(exported.dimensionsWithoutSamples).toEqual([]);
  });

  it("dates the document by its latest included reading, to the second", async () => {
    await saved(PICK_PLACE_INPUT, "req-1");
    const record = await saveMeasurements("req-1", { ...PICK_PLACE_INPUT, revision: 1,
      readings: { ...PICK_PLACE_INPUT.readings, object_mass: { value: 1.6, unit: "kg" } } }, { scope: "film" }, LATER);
    const document = JSON.parse(buildSourceMeasurementDocument(record, { binding: binding("req-1"),
      producerId: "site_job:req-1" }).json);
    expect(document.observed_at_iso).toBe("2026-10-17T09:42:17Z");
    const withoutMass = JSON.parse(buildSourceMeasurementDocument(record, { binding: binding("req-1"),
      producerId: "site_job:req-1", calibrationSampleIds: ["object_mass"] }).json);
    expect(withoutMass.observed_at_iso).toBe("2026-10-17T09:00:00Z");
  });

  it("leaves a calibration reading out of every check", async () => {
    const record = await saved(PICK_PLACE_INPUT, "req-1");
    const exported = buildSourceMeasurementDocument(record, { binding: binding("req-1"), producerId: "site_job:req-1",
      calibrationSampleIds: ["reference_sheet_long_edge"] });
    const document = JSON.parse(exported.json);
    const ids = document.checks.flatMap((check: { samples: Array<{ sample_id: string }> }) =>
      check.samples.map((sample) => sample.sample_id));
    expect(ids).not.toContain("reference_sheet_long_edge");
    expect(document.checks.map((check: { id: string }) => check.id)).toContain("pick_place.observation.visible_lengths");
    expect(exported.sampleCount).toBe(ids.length);
  });

  it("omits a check with nothing recorded and names its dimension", async () => {
    const { object_mass: _mass, ...rest } = PICK_PLACE_INPUT.readings;
    const record = await saved({ ...PICK_PLACE_INPUT, readings: rest }, "req-1");
    const exported = buildSourceMeasurementDocument(record, { binding: binding("req-1"), producerId: "site_job:req-1" });
    expect(JSON.parse(exported.json).checks.map((check: { id: string }) => check.id))
      .not.toContain("pick_place.task_dynamics.object_mass");
    expect(exported.dimensionsWithoutSamples).toEqual(["task_dynamics"]);
  });

  it("refuses a binding that is not the request's exact binding for this job", async () => {
    const record = await saved(PICK_PLACE_INPUT, "req-1");
    const run = (value: unknown) => () => buildSourceMeasurementDocument(record, { binding: value, producerId: "site_job:req-1" });
    const { task_id: _task, ...missing } = binding("req-1");
    expectExportError(run(missing), "binding_invalid");
    expectExportError(run({ ...binding("req-1"), extra: "x" }), "binding_invalid");
    expectExportError(run(binding("req-1", { testbed_digest_sha256: "sha256:abc" })), "binding_invalid");
    expectExportError(run(binding("req-1", { policy_interface_id: "unknown.v1" })), "binding_invalid");
    expectExportError(run(binding("req-1", { site_id: "" })), "binding_invalid");
    expectExportError(run(binding("req-2")), "binding_job_mismatch");
  });

  it("refuses an unknown producer, an unknown exclusion and an empty result", async () => {
    const record = await saved(PICK_PLACE_INPUT, "req-1");
    expectExportError(() => buildSourceMeasurementDocument(record, { binding: binding("req-1"), producerId: "" }),
      "producer_invalid");
    expectExportError(() => buildSourceMeasurementDocument(record, { binding: binding("req-1"),
      producerId: "site_job:req-1", calibrationSampleIds: ["handle_height"] }), "calibration_invalid");
    const all = Object.keys(record.readings);
    expectExportError(() => buildSourceMeasurementDocument(record, { binding: binding("req-1"),
      producerId: "site_job:req-1", calibrationSampleIds: all }), "no_readings");
  });
});
