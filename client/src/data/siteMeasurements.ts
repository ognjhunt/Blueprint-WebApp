/**
 * What a site can measure with a tape measure while it films its job, and how
 * each reading feeds the qualification receipt.
 *
 * ## Why these readings
 *
 * An evaluation is a simulation of the site, and a simulation of the wrong
 * size answers the wrong question. Website scenes carry estimated metres
 * (`physical_scale_measured: false`), and World Labs reconstructions return
 * depth in world units, so the few quantities that decide a pick or an opening
 * are asked of the people standing at the work: surface heights, how far the
 * object travels, its size and weight, the clear space around it, and for a
 * door or drawer the handle, the front, the opening and the force to start it.
 *
 * ## One catalog, two repositories
 *
 * The readings and checks mirror the Pipeline's fidelity-profile templates
 * through `contracts/pipeline/site-task-measurement-catalog.v1.json`, which a
 * test pins to `catalogProjection()`. Thresholds are not here: they live in the
 * Pipeline templates, and a named person reviews them before any profile uses
 * them.
 *
 * ## What a reading is not
 *
 * A reading is something the site states. It becomes qualification evidence
 * only after an authorized measurement producer pins the exported source
 * document and an authorized reviewer accepts it. It never passes anything by
 * itself.
 */

export const SITE_MEASUREMENT_CATALOG_SCHEMA = "blueprint.site_task_measurement_catalog.v1";
export const SITE_MEASUREMENT_SAMPLES_SCHEMA = "blueprint.site_task_measurement_samples.v1";

export const MEASUREMENT_FAMILIES = ["rigid_pick_place", "articulated_open_close"] as const;
export type MeasurementFamily = (typeof MEASUREMENT_FAMILIES)[number];
export const ARTICULATIONS = ["hinged", "sliding"] as const;
export type Articulation = (typeof ARTICULATIONS)[number];
export type MeasurementQuantity = "length" | "mass" | "force";
export type MeasurementDimension =
  | "scale" | "registration" | "collision" | "task_state" | "observation" | "task_dynamics";
export type SiUnit = "m" | "kg" | "N";
export const ENTRY_UNITS = ["cm", "in", "kg", "lb", "kgf", "lbf"] as const;
export type EntryUnit = (typeof ENTRY_UNITS)[number];

/** Read off a sheet of printer paper lying flat in view while filming. */
export const REFERENCE_SHEET_SAMPLE_ID = "reference_sheet_long_edge";
export const REFERENCE_PAPERS = ["letter", "a4", "other", "none"] as const;
export type ReferencePaper = (typeof REFERENCE_PAPERS)[number];
/** Long edge of a standard sheet: US Letter is 11 in, A4 is 297 mm. */
export const REFERENCE_PAPER_LONG_EDGE_M = { letter: 0.2794, a4: 0.297 } as const;
/** Any sheet's long edge lies inside this; a value outside it is a unit slip. */
export const REFERENCE_SHEET_BOUNDS_M = { min: 0.1, max: 1 } as const;

const SI_UNIT: Record<MeasurementQuantity, SiUnit> = { length: "m", mass: "kg", force: "N" };
const UNITS: Record<MeasurementQuantity, readonly EntryUnit[]> = {
  length: ["cm", "in"],
  mass: ["kg", "lb"],
  // A luggage scale shows kilograms or pounds; it is measuring force.
  force: ["kgf", "lbf"],
};
const TO_SI: Record<EntryUnit, number> = {
  cm: 0.01, in: 0.0254, kg: 1, lb: 0.45359237, kgf: 9.80665, lbf: 4.4482216152605,
};
/** How each unit reads to a site. */
export const UNIT_LABELS: Record<EntryUnit, string> = { cm: "cm", in: "inches", kg: "kg", lb: "lb", kgf: "kg", lbf: "lb" };

export interface MeasurementReading {
  sampleId: string;
  quantity: MeasurementQuantity;
  /** Null: any front. Otherwise only a hinged, or only a sliding, front has it. */
  articulation: Articulation | null;
  label: string;
  hint: string;
  /** Upper bound in SI units. A larger value is a unit slip, not a site. */
  maxSi: number;
}

export interface MeasurementCheck {
  id: string;
  dimension: MeasurementDimension;
  unit: SiUnit;
  minimumSampleCount: number;
  sampleIds: readonly string[];
}

export interface MeasurementFamilySpec {
  family: MeasurementFamily;
  /** What the job does, in the site's words. */
  label: string;
  readings: readonly MeasurementReading[];
  checks: readonly MeasurementCheck[];
}

const SHEET: MeasurementReading = {
  sampleId: REFERENCE_SHEET_SAMPLE_ID,
  quantity: "length",
  articulation: null,
  label: "Long edge of the sheet",
  hint: "Measure it only if it is not US Letter or A4.",
  maxSi: REFERENCE_SHEET_BOUNDS_M.max,
};

export const SITE_MEASUREMENT_FAMILIES: readonly MeasurementFamilySpec[] = [
  {
    family: "rigid_pick_place",
    label: "Moves an object from one place to another",
    readings: [
      { sampleId: "pick_surface_height", quantity: "length", articulation: null, maxSi: 3,
        label: "Height of the surface where the object starts",
        hint: "From the floor to the top of the surface." },
      { sampleId: "place_surface_height", quantity: "length", articulation: null, maxSi: 3,
        label: "Height of the surface where it ends up",
        hint: "From the floor to the top. If it stays on the same surface, enter the same height." },
      { sampleId: "pick_to_place_distance", quantity: "length", articulation: null, maxSi: 20,
        label: "How far the object moves",
        hint: "Across the floor, from the middle of where it starts to the middle of where it ends." },
      { sampleId: "object_length", quantity: "length", articulation: null, maxSi: 3,
        label: "Object length (its longest side)",
        hint: "One typical object, outside edge to outside edge." },
      { sampleId: "object_width", quantity: "length", articulation: null, maxSi: 3,
        label: "Object width", hint: "Outside edge to outside edge." },
      { sampleId: "object_height", quantity: "length", articulation: null, maxSi: 3,
        label: "Object height", hint: "Outside edge to outside edge." },
      { sampleId: "pick_front_clearance", quantity: "length", articulation: null, maxSi: 20,
        label: "Open floor in front of the starting surface",
        hint: "From its front edge straight out to the nearest thing in the way, such as a wall, rack or machine." },
      { sampleId: "pick_overhead_clearance", quantity: "length", articulation: null, maxSi: 5,
        label: "Open height above the starting surface",
        hint: "From the top of the surface up to the shelf or fixture above it. Leave it blank if nothing is above." },
      { sampleId: "object_mass", quantity: "mass", articulation: null, maxSi: 500,
        label: "Object weight",
        hint: "If you have a kitchen, postal or bathroom scale." },
      SHEET,
    ],
    checks: [
      { id: "pick_place.scale.lengths", dimension: "scale", unit: "m", minimumSampleCount: 1,
        sampleIds: ["pick_to_place_distance", REFERENCE_SHEET_SAMPLE_ID] },
      { id: "pick_place.registration.surface_heights", dimension: "registration", unit: "m", minimumSampleCount: 1,
        sampleIds: ["pick_surface_height", "place_surface_height"] },
      { id: "pick_place.collision.clearances", dimension: "collision", unit: "m", minimumSampleCount: 1,
        sampleIds: ["pick_front_clearance", "pick_overhead_clearance"] },
      { id: "pick_place.task_state.object_size", dimension: "task_state", unit: "m", minimumSampleCount: 3,
        sampleIds: ["object_length", "object_width", "object_height"] },
      { id: "pick_place.observation.visible_lengths", dimension: "observation", unit: "m", minimumSampleCount: 1,
        sampleIds: [REFERENCE_SHEET_SAMPLE_ID, "object_length"] },
      { id: "pick_place.task_dynamics.object_mass", dimension: "task_dynamics", unit: "kg", minimumSampleCount: 1,
        sampleIds: ["object_mass"] },
    ],
  },
  {
    family: "articulated_open_close",
    label: "Opens or closes a door, drawer or lid",
    readings: [
      { sampleId: "handle_height", quantity: "length", articulation: null, maxSi: 3,
        label: "Height of the handle",
        hint: "From the floor to the middle of the handle, with it closed." },
      { sampleId: "front_width", quantity: "length", articulation: null, maxSi: 5,
        label: "Width of the door, drawer or lid front", hint: "Edge to edge." },
      { sampleId: "opening_travel", quantity: "length", articulation: "sliding", maxSi: 3,
        label: "How far it pulls out",
        hint: "With it pulled out fully, how far the front has moved." },
      { sampleId: "opening_chord", quantity: "length", articulation: "hinged", maxSi: 5,
        label: "How far it opens",
        hint: "With it open as far as it goes, straight across from its outer edge to the frame edge it closes against." },
      { sampleId: "handle_offset_from_hinge", quantity: "length", articulation: "hinged", maxSi: 5,
        label: "Handle distance from the hinge side",
        hint: "From the hinge edge to the middle of the handle." },
      { sampleId: "front_clearance_open", quantity: "length", articulation: null, maxSi: 20,
        label: "Open floor in front when it is fully open",
        hint: "From the open front straight out to the nearest thing in the way." },
      { sampleId: "opening_force", quantity: "force", articulation: null, maxSi: 2000,
        label: "Pull needed to start opening it",
        hint: "If you have a luggage scale: hook it on the handle, pull slowly, and note the highest reading as it starts to move." },
      SHEET,
    ],
    checks: [
      { id: "open_close.scale.lengths", dimension: "scale", unit: "m", minimumSampleCount: 1,
        sampleIds: ["front_width", REFERENCE_SHEET_SAMPLE_ID] },
      { id: "open_close.registration.handle_height", dimension: "registration", unit: "m", minimumSampleCount: 1,
        sampleIds: ["handle_height"] },
      { id: "open_close.collision.open_clearance", dimension: "collision", unit: "m", minimumSampleCount: 1,
        sampleIds: ["front_clearance_open"] },
      { id: "open_close.task_state.opening", dimension: "task_state", unit: "m", minimumSampleCount: 1,
        sampleIds: ["opening_travel", "opening_chord", "handle_offset_from_hinge"] },
      { id: "open_close.observation.visible_lengths", dimension: "observation", unit: "m", minimumSampleCount: 1,
        sampleIds: [REFERENCE_SHEET_SAMPLE_ID, "front_width"] },
      { id: "open_close.task_dynamics.opening_force", dimension: "task_dynamics", unit: "N", minimumSampleCount: 1,
        sampleIds: ["opening_force"] },
    ],
  },
];

export function isMeasurementFamily(value: unknown): value is MeasurementFamily {
  return (MEASUREMENT_FAMILIES as readonly unknown[]).includes(value);
}

export function familySpec(family: MeasurementFamily): MeasurementFamilySpec {
  const spec = SITE_MEASUREMENT_FAMILIES.find((candidate) => candidate.family === family);
  if (!spec) throw new Error(`Unknown measurement family: ${family}`);
  return spec;
}

/** The readings that apply to this front; pick and place has no articulation. */
export function readingsFor(family: MeasurementFamily, articulation: Articulation | null): readonly MeasurementReading[] {
  const spec = familySpec(family);
  if (family !== "articulated_open_close") return spec.readings;
  return spec.readings.filter((reading) => reading.articulation === null || reading.articulation === articulation);
}

export function unitsFor(quantity: MeasurementQuantity): readonly EntryUnit[] {
  return UNITS[quantity];
}

export function siUnitFor(quantity: MeasurementQuantity): SiUnit {
  return SI_UNIT[quantity];
}

/**
 * A number from what a site typed: a decimal with a point or a comma, or
 * inches as a tape shows them ("30 1/4", "30-1/4", "3/4"). Blank is
 * `undefined` (not measured); anything else is `null`, never a guess.
 */
export function parseReading(text: string): number | null | undefined {
  const value = text.trim();
  if (!value) return undefined;
  if (/^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value)) return Number(value.replace(",", "."));
  const fraction = /^(?:(\d+)(?:\s+|-))?(\d+)\/(\d+)$/.exec(value);
  if (fraction && Number(fraction[3]) > 0) {
    return Number(fraction[1] ?? 0) + Number(fraction[2]) / Number(fraction[3]);
  }
  return null;
}

/** The SI value of what a site typed, rounded to a micrometre (or milligram, or micronewton). */
export function toSi(value: number, unit: EntryUnit): number {
  return Math.round(value * TO_SI[unit] * 1e6) / 1e6;
}

export interface MeasurementCheckCoverage {
  id: string;
  dimension: MeasurementDimension;
  present: string[];
  minimumSampleCount: number;
  satisfied: boolean;
}

export interface MeasurementCoverage {
  complete: boolean;
  missingDimensions: MeasurementDimension[];
  checks: MeasurementCheckCoverage[];
}

/** Which checks the recorded readings could fill. The Pipeline's coverage report remains the authority. */
export function coverageOf(family: MeasurementFamily, sampleIds: Iterable<string>): MeasurementCoverage {
  const present = new Set(sampleIds);
  const checks = familySpec(family).checks.map((check) => {
    const ids = check.sampleIds.filter((id) => present.has(id));
    return { id: check.id, dimension: check.dimension, present: ids, minimumSampleCount: check.minimumSampleCount,
      satisfied: ids.length >= check.minimumSampleCount };
  });
  const missingDimensions = [...new Set(checks.filter((check) => !check.satisfied).map((check) => check.dimension))].sort();
  return { complete: missingDimensions.length === 0, missingDimensions, checks };
}

/** The Pipeline's catalog shape, for the mirror test. */
export function catalogProjection() {
  return {
    schema_version: SITE_MEASUREMENT_CATALOG_SCHEMA,
    measurement_samples_schema: SITE_MEASUREMENT_SAMPLES_SCHEMA,
    families: SITE_MEASUREMENT_FAMILIES.map((spec) => ({
      family: spec.family,
      readings: spec.readings.map((reading) => ({
        sample_id: reading.sampleId, quantity: reading.quantity, unit: SI_UNIT[reading.quantity],
        articulation: reading.articulation,
      })),
      checks: spec.checks.map((check) => ({
        id: check.id, dimension: check.dimension, unit: check.unit,
        minimum_sample_count: check.minimumSampleCount, sample_ids: [...check.sampleIds],
      })),
    })),
  };
}

/** One recorded reading as the site's page shows it. */
export interface PresentedReading {
  value: number;
  unit: EntryUnit;
  recordedAtIso: string;
  recordedByScope: "owner" | "film";
}

/** The measurements a job page loads and saves (`/api/site-task-brief/:token/measurements`). */
export interface PresentedSiteMeasurements {
  revision: number;
  family: MeasurementFamily | null;
  articulation: Articulation | null;
  referencePaper: ReferencePaper | null;
  /** Only for a sheet that is not US Letter or A4. */
  referenceSheetLongEdge: { value: number; unit: EntryUnit } | null;
  readings: Record<string, PresentedReading>;
  note: string | null;
  updatedAtIso: string | null;
}

export interface MeasurementEntry {
  value: number;
  unit: EntryUnit;
}

/** The body of a save. A save replaces the whole set; a reading left out is cleared. */
export interface MeasurementSaveInput {
  revision: number;
  family: MeasurementFamily;
  articulation: Articulation | null;
  readings: Record<string, MeasurementEntry>;
  referencePaper: ReferencePaper | null;
  referenceSheetLongEdge: MeasurementEntry | null;
  measuredBy: string | null;
  note: string | null;
}

/** Where a value came from: a tape, a weighing or force scale, or a standard paper size. */
export type ReadingBasis = "tape" | "scale" | "paper_standard";

/** One reading as the admin job console shows it. */
export interface AdminMeasurementReading {
  sampleId: string;
  label: string;
  value: number | null;
  unit: EntryUnit | null;
  si: number;
  siUnit: SiUnit;
  basis: ReadingBasis;
  recordedAtIso: string;
  recordedByScope: "owner" | "film";
  recordedByName: string | null;
}

export interface AdminSiteMeasurements {
  requestId: string;
  family: MeasurementFamily;
  articulation: Articulation | null;
  referencePaper: ReferencePaper | null;
  revision: number;
  updatedAtIso: string;
  note: string | null;
  readings: AdminMeasurementReading[];
  coverage: MeasurementCoverage;
}

export interface SourceMeasurementExportResponse {
  /** The exact bytes to retain as the request's `measurement` artifact. */
  json: string;
  sha256: string;
  /** For the request's `source_artifacts[].size_bytes`. */
  sizeBytes: number;
  fileName: string;
  sampleCount: number;
  /** What the exported readings can fill, check by check, after calibration readings are left out. */
  coverage: MeasurementCoverage;
}

/** Where an export is kept: immutable, keyed by its sha256, so a lost download can be recovered. */
export interface RetainedExportReference {
  path: string;
  retainedAtIso: string;
  /** The same bytes were exported before; the first record stands. */
  alreadyRetained: boolean;
}

/** The admin export response: the document and the reference to its retained copy. */
export interface RetainedSourceMeasurementExportResponse extends SourceMeasurementExportResponse {
  retained: RetainedExportReference;
}

/** One retained export as the job console lists it. */
export interface RetainedExportSummary {
  path: string;
  sha256: string;
  sizeBytes: number;
  fileName: string;
  revision: number;
  producerId: string;
  calibrationSampleIds: string[];
  exportedAtIso: string;
}

/** A retained export in full: the exact bytes and the inputs that produced them. */
export interface RetainedExport extends RetainedExportSummary {
  requestId: string;
  json: string;
  binding: Record<string, string>;
  exportedBy: string | null;
}

/** `GET /api/admin/jobs/:requestId/site-measurements`. */
export interface SiteMeasurementsConsoleResponse {
  measurements: AdminSiteMeasurements | null;
  /** Recording consent was withdrawn: exports are refused. */
  consentRevoked: boolean;
  exports: RetainedExportSummary[];
}
