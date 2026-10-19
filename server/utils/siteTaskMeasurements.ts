/**
 * Tape-measure readings a site records about its job, and the source
 * measurement document the Pipeline's qualifier consumes.
 *
 * ## Where they live, and why not on the brief
 *
 * `siteTaskMeasurements/{requestId}`, beside the item inventory. The brief is
 * digest-bound: coverage review, footage proposals and clarifications compare
 * `humanDecisionDigest(brief)`, so a reading saved there would mark that work
 * stale. Readings are not added to the Pipeline task-context export either;
 * that would change its `context_digest` and refuse sponsorship.
 *
 * ## Who may record
 *
 * Owner and film-only links alike (founder decision, 2026-10-19). Measuring is
 * capture, like photographing an item, and the person at the work area with the
 * tape is often the colleague who films. Every reading keeps the link scope,
 * the name typed with it and the time it was recorded; a later save that leaves
 * it unchanged keeps that first record. A save names the revision it read, so
 * two people at the work area cannot silently overwrite each other, and every
 * save is also kept as an append-only revision (`revisions/{n}`), so a
 * reviewer can see what changed before an export.
 *
 * ## What a reading is
 *
 * Something the site states (`operator_stated`). It is never `measured` in the
 * site-assessment sense and never passes anything. It becomes qualification
 * evidence only when the export below is pinned by an authorized measurement
 * producer and accepted by an authorized reviewer, with the simulator's own
 * readings and the frozen fidelity profile.
 *
 * ## The export
 *
 * `buildSourceMeasurementDocument` emits a
 * `blueprint.site_task_measurement_samples.v1` document. WebApp cannot compute
 * its binding: the scene revision, task-spec and success-contract digests exist
 * only once a scene is prepared, and the robot model digest is per team. So
 * the binding is an input, checked for shape and for naming this job. A reading
 * that set the scene's metric scale is named in `calibrationSampleIds` and left
 * out of every check, because it cannot also check that scale.
 */
import { createHash } from "node:crypto";
import { z } from "zod";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  ARTICULATIONS,
  ENTRY_UNITS,
  MEASUREMENT_FAMILIES,
  REFERENCE_PAPERS,
  REFERENCE_PAPER_LONG_EDGE_M,
  REFERENCE_SHEET_BOUNDS_M,
  REFERENCE_SHEET_SAMPLE_ID,
  SITE_MEASUREMENT_SAMPLES_SCHEMA,
  UNIT_LABELS,
  coverageOf,
  familySpec,
  isMeasurementFamily,
  readingsFor,
  siUnitFor,
  toSi,
  unitsFor,
  type AdminSiteMeasurements,
  type Articulation,
  type EntryUnit,
  type MeasurementFamily,
  type MeasurementSaveInput,
  type PresentedSiteMeasurements,
  type ReadingBasis,
  type ReferencePaper,
  type SourceMeasurementExportResponse,
} from "../../client/src/data/siteMeasurements";

export const SITE_TASK_MEASUREMENTS_COLLECTION = "siteTaskMeasurements";

type LinkScope = "owner" | "film";

/** What a saved reading keeps. `value` and `unit` are null only for a paper standard. */
export interface StoredReading {
  value: number | null;
  unit: EntryUnit | null;
  si: number;
  basis: ReadingBasis;
  recordedAtIso: string;
  recordedByScope: LinkScope;
  recordedByName: string | null;
}

export interface SiteTaskMeasurementRecord {
  requestId: string;
  family: MeasurementFamily;
  articulation: Articulation | null;
  referencePaper: ReferencePaper | null;
  readings: Record<string, StoredReading>;
  measuredBy: string | null;
  note: string | null;
  revision: number;
  updatedAtIso: string;
}

type NormalizedReading = Pick<StoredReading, "value" | "unit" | "si" | "basis">;

export interface NormalizedMeasurements {
  family: MeasurementFamily;
  articulation: Articulation | null;
  referencePaper: ReferencePaper | null;
  readings: Record<string, NormalizedReading>;
  measuredBy: string | null;
  note: string | null;
}

/** A save the catalog refuses. The message is written for the site. */
export class MeasurementInputError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "MeasurementInputError";
  }
}

/** Someone saved after this page loaded. `latest` is what they saved. */
export class MeasurementRevisionConflict extends Error {
  constructor(readonly latest: SiteTaskMeasurementRecord | null) {
    super("measurements_changed");
    this.name = "MeasurementRevisionConflict";
  }
}

/** An export the binding, producer or readings do not support. The message is for an operator. */
export class SourceMeasurementExportError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "SourceMeasurementExportError";
  }
}

const entrySchema = z.object({ value: z.number().finite().positive(), unit: z.enum(ENTRY_UNITS) }).strict();

export const measurementSaveSchema = z.object({
  revision: z.number().int().min(0),
  family: z.enum(MEASUREMENT_FAMILIES),
  articulation: z.enum(ARTICULATIONS).nullable(),
  readings: z.record(z.string().max(64), entrySchema)
    .refine((readings) => Object.keys(readings).length <= 24, "Too many readings."),
  referencePaper: z.enum(REFERENCE_PAPERS).nullable(),
  referenceSheetLongEdge: entrySchema.nullable(),
  measuredBy: z.string().trim().max(120).nullable(),
  note: z.string().trim().max(1000).nullable(),
}).strict();

function formatEntry(value: number, unit: EntryUnit) {
  return `${value} ${UNIT_LABELS[unit]}`;
}

/** Check one save against the catalog and convert it to SI. */
export function normalizeMeasurementInput(input: MeasurementSaveInput): NormalizedMeasurements {
  const front = input.family === "articulated_open_close";
  if (front ? !input.articulation : input.articulation !== null) {
    throw new MeasurementInputError("articulation_invalid", "Say whether it opens on hinges or slides out.");
  }
  const applicable = new Map(readingsFor(input.family, input.articulation)
    .filter((reading) => reading.sampleId !== REFERENCE_SHEET_SAMPLE_ID)
    .map((reading) => [reading.sampleId, reading]));
  const readings: Record<string, NormalizedReading> = {};
  for (const [sampleId, entry] of Object.entries(input.readings)) {
    const spec = applicable.get(sampleId);
    if (!spec) {
      throw new MeasurementInputError("reading_unknown",
        "One of these readings does not belong to this kind of job. Reload the page and try again.");
    }
    if (!unitsFor(spec.quantity).includes(entry.unit)) {
      throw new MeasurementInputError("unit_invalid", `${spec.label}: choose a unit that fits this reading.`);
    }
    const si = toSi(entry.value, entry.unit);
    if (!(si > 0) || si > spec.maxSi) {
      throw new MeasurementInputError("value_out_of_range",
        `${spec.label}: ${formatEntry(entry.value, entry.unit)} is more than this reading can be. Check the units.`);
    }
    readings[sampleId] = { value: entry.value, unit: entry.unit, si, basis: spec.quantity === "length" ? "tape" : "scale" };
  }

  const paper = input.referencePaper;
  const edge = input.referenceSheetLongEdge;
  if (paper === "other") {
    const si = edge && unitsFor("length").includes(edge.unit) ? toSi(edge.value, edge.unit) : NaN;
    if (!edge || !(si >= REFERENCE_SHEET_BOUNDS_M.min && si <= REFERENCE_SHEET_BOUNDS_M.max)) {
      throw new MeasurementInputError("reference_sheet_invalid",
        "Enter the length of the sheet's long edge, between 10 and 100 cm (4 and 39 inches).");
    }
    readings[REFERENCE_SHEET_SAMPLE_ID] = { value: edge.value, unit: edge.unit, si, basis: "tape" };
  } else {
    if (edge) {
      throw new MeasurementInputError("reference_sheet_invalid",
        "A sheet's long edge is needed only when it is not US Letter or A4.");
    }
    if (paper === "letter" || paper === "a4") {
      readings[REFERENCE_SHEET_SAMPLE_ID] = { value: null, unit: null, si: REFERENCE_PAPER_LONG_EDGE_M[paper],
        basis: "paper_standard" };
    }
  }

  return {
    family: input.family,
    articulation: front ? input.articulation : null,
    referencePaper: paper,
    readings,
    measuredBy: input.measuredBy?.trim() || null,
    note: input.note?.trim() || null,
  };
}

function store() {
  if (!db) throw new Error("measurement_store_unavailable");
  return db.collection(SITE_TASK_MEASUREMENTS_COLLECTION);
}

function recordFrom(value: unknown): SiteTaskMeasurementRecord | null {
  const data = value as Partial<SiteTaskMeasurementRecord> | undefined;
  if (!data || !isMeasurementFamily(data.family) || typeof data.revision !== "number") return null;
  return {
    requestId: String(data.requestId ?? ""),
    family: data.family,
    articulation: data.articulation ?? null,
    referencePaper: data.referencePaper ?? null,
    readings: (data.readings && typeof data.readings === "object" ? data.readings : {}) as Record<string, StoredReading>,
    measuredBy: data.measuredBy ?? null,
    note: data.note ?? null,
    revision: data.revision,
    updatedAtIso: String(data.updatedAtIso ?? ""),
  };
}

export async function getMeasurements(requestId: string): Promise<SiteTaskMeasurementRecord | null> {
  const snapshot = await store().doc(requestId).get();
  return snapshot.exists ? recordFrom(snapshot.data()) : null;
}

function sameReading(previous: StoredReading | undefined, next: NormalizedReading): previous is StoredReading {
  return Boolean(previous) && previous!.value === next.value && previous!.unit === next.unit
    && previous!.si === next.si && previous!.basis === next.basis;
}

/** Replace the job's readings, keeping the first record of every reading that did not change. */
export async function saveMeasurements(
  requestId: string,
  input: MeasurementSaveInput,
  actor: { scope: LinkScope },
  now: Date = new Date(),
): Promise<SiteTaskMeasurementRecord> {
  const normalized = normalizeMeasurementInput(input);
  const ref = store().doc(requestId);
  return db!.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const existing = snapshot.exists ? recordFrom(snapshot.data()) : null;
    const revision = existing?.revision ?? 0;
    if (input.revision !== revision) throw new MeasurementRevisionConflict(existing);
    const nowIso = now.toISOString();
    const readings: Record<string, StoredReading> = {};
    for (const [sampleId, reading] of Object.entries(normalized.readings)) {
      const previous = existing?.readings[sampleId];
      readings[sampleId] = sameReading(previous, reading) ? previous : {
        ...reading, recordedAtIso: nowIso, recordedByScope: actor.scope, recordedByName: normalized.measuredBy,
      };
    }
    const record: SiteTaskMeasurementRecord = {
      requestId,
      family: normalized.family,
      articulation: normalized.articulation,
      referencePaper: normalized.referencePaper,
      readings,
      measuredBy: normalized.measuredBy,
      note: normalized.note,
      revision: revision + 1,
      updatedAtIso: nowIso,
    };
    tx.set(ref, { ...record, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    // Append-only: a reading replaced or cleared later stays visible to a reviewer.
    tx.set(ref.collection("revisions").doc(String(record.revision)),
      { ...record, savedAtIso: nowIso, savedByScope: actor.scope });
    return record;
  });
}

/**
 * What the job page loads: the values as typed, without their SI conversion or
 * anyone's name. A name is never pre-filled for the next person, so each
 * reading keeps the name of whoever actually saved it.
 */
export function presentMeasurements(record: SiteTaskMeasurementRecord | null): PresentedSiteMeasurements {
  if (!record) {
    return { revision: 0, family: null, articulation: null, referencePaper: null, referenceSheetLongEdge: null,
      readings: {}, note: null, updatedAtIso: null };
  }
  const readings: PresentedSiteMeasurements["readings"] = {};
  for (const [sampleId, reading] of Object.entries(record.readings)) {
    if (sampleId === REFERENCE_SHEET_SAMPLE_ID || reading.value === null || reading.unit === null) continue;
    readings[sampleId] = { value: reading.value, unit: reading.unit, recordedAtIso: reading.recordedAtIso,
      recordedByScope: reading.recordedByScope };
  }
  const sheet = record.readings[REFERENCE_SHEET_SAMPLE_ID];
  return {
    revision: record.revision,
    family: record.family,
    articulation: record.articulation,
    referencePaper: record.referencePaper,
    referenceSheetLongEdge: record.referencePaper === "other" && sheet?.value != null && sheet.unit
      ? { value: sheet.value, unit: sheet.unit } : null,
    readings,
    note: record.note,
    updatedAtIso: record.updatedAtIso,
  };
}

/** What the admin job console shows: SI values, basis, full provenance and coverage. */
export function presentMeasurementsForAdmin(record: SiteTaskMeasurementRecord | null): AdminSiteMeasurements | null {
  if (!record) return null;
  const spec = familySpec(record.family);
  return {
    requestId: record.requestId,
    family: record.family,
    articulation: record.articulation,
    referencePaper: record.referencePaper,
    revision: record.revision,
    updatedAtIso: record.updatedAtIso,
    note: record.note,
    readings: spec.readings.filter((reading) => record.readings[reading.sampleId]).map((reading) => {
      const stored = record.readings[reading.sampleId];
      return {
        sampleId: reading.sampleId,
        label: reading.label,
        value: stored.value,
        unit: stored.unit,
        si: stored.si,
        siUnit: siUnitFor(reading.quantity),
        basis: stored.basis,
        recordedAtIso: stored.recordedAtIso,
        recordedByScope: stored.recordedByScope,
        recordedByName: stored.recordedByName,
      };
    }),
    coverage: coverageOf(record.family, Object.keys(record.readings)),
  };
}

const SAMPLE_LABEL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
/** The qualification request's binding, in the Pipeline's order. */
const BINDING_FIELDS = [
  "scene_request_id", "site_id", "task_id", "capture_id", "source_capture_digest", "testbed_digest_sha256",
  "scene_revision_digest", "task_spec_digest", "success_contract_digest", "robot_model_digest", "policy_interface_id",
] as const;
type Binding = Record<(typeof BINDING_FIELDS)[number], string>;
const POLICY_INTERFACES = new Set(["openpi_droid_https.v1", "blueprint_policy_https.v1"]);

function exactBinding(value: unknown, requestId: string): Binding {
  const row = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  const keys = row ? Object.keys(row) : [];
  const valid = row !== null && keys.length === BINDING_FIELDS.length
    && BINDING_FIELDS.every((field) => typeof row[field] === "string" && (row[field] as string).length > 0
      && (row[field] as string).length <= 512 && (!field.includes("digest") || DIGEST.test(row[field] as string)))
    && POLICY_INTERFACES.has(row.policy_interface_id as string);
  if (!valid) {
    throw new SourceMeasurementExportError("binding_invalid",
      "Paste the qualification request's exact binding: its eleven fields, with sha256 digests and a supported policy interface.");
  }
  if (row!.scene_request_id !== requestId) {
    throw new SourceMeasurementExportError("binding_job_mismatch",
      "That binding names a different site job. Export from the job its scene_request_id names.");
  }
  // Rebuilt in the Pipeline's field order, so equal bindings export equal bytes.
  return Object.fromEntries(BINDING_FIELDS.map((field) => [field, row![field] as string])) as Binding;
}

/** Rounded up: a reading saved within a second after a review must never read as before it. */
function ceilToSecondIso(iso: string) {
  return new Date(Math.ceil(Date.parse(iso) / 1000) * 1000).toISOString().replace(/\.000Z$/, "Z");
}

/** The `blueprint.site_task_measurement_samples.v1` document, as exact bytes and their sha256. */
export function buildSourceMeasurementDocument(
  record: SiteTaskMeasurementRecord,
  options: { binding: unknown; producerId: string; calibrationSampleIds?: string[] },
): SourceMeasurementExportResponse {
  const binding = exactBinding(options.binding, record.requestId);
  if (typeof options.producerId !== "string" || !SAMPLE_LABEL.test(options.producerId)) {
    throw new SourceMeasurementExportError("producer_invalid",
      "Name the measurement producer the operator registry allows, for example site_job:<job id>.");
  }
  if (options.producerId.startsWith("site_job:") && options.producerId !== `site_job:${record.requestId}`) {
    throw new SourceMeasurementExportError("producer_job_mismatch",
      `A site producer names its own job. This job's site is site_job:${record.requestId}.`);
  }
  const spec = familySpec(record.family);
  const familyIds = new Set(spec.readings.map((reading) => reading.sampleId));
  const excluded = new Set(options.calibrationSampleIds ?? []);
  for (const sampleId of excluded) {
    if (!familyIds.has(sampleId)) {
      throw new SourceMeasurementExportError("calibration_invalid",
        `${sampleId} is not a reading of this job's family, so it cannot have set the scene's scale.`);
    }
  }
  const included = (sampleId: string) => Boolean(record.readings[sampleId]) && !excluded.has(sampleId);
  const checks = spec.checks
    .map((check) => ({
      id: check.id,
      dimension: check.dimension,
      unit: check.unit,
      samples: check.sampleIds.filter(included).map((sampleId) => ({ sample_id: sampleId, value: record.readings[sampleId].si })),
    }))
    .filter((check) => check.samples.length > 0);
  if (!checks.length) {
    throw new SourceMeasurementExportError("no_readings", "No recorded reading remains to export for this job.");
  }
  const includedIds = Object.keys(record.readings).filter(included);
  const observed = includedIds.map((sampleId) => record.readings[sampleId].recordedAtIso).sort().at(-1)!;
  const document = {
    schema_version: SITE_MEASUREMENT_SAMPLES_SCHEMA,
    binding,
    producer_id: options.producerId,
    observed_at_iso: ceilToSecondIso(observed),
    checks,
  };
  const json = `${JSON.stringify(document, null, 2)}\n`;
  return {
    json,
    sha256: `sha256:${createHash("sha256").update(json, "utf8").digest("hex")}`,
    sizeBytes: Buffer.byteLength(json, "utf8"),
    fileName: `site-task-measurements-${record.requestId}-r${record.revision}.json`,
    sampleCount: checks.reduce((total, check) => total + check.samples.length, 0),
    // Check by check, so a check exported with too few readings is named here, not first at qualification.
    coverage: coverageOf(record.family, includedIds),
  };
}
