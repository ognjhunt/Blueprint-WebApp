# Site-task measurements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This plan was executed inline by its author, who held the full design context; interfaces and test cases are exact, and implementations follow them.

**Goal:** Collect optional tape-measure readings when a site films its job, persist them with the job, export them as a `blueprint.site_task_measurement_samples.v1` source document, and author reviewed-before-use fidelity-profile templates for the two scored families.

**Architecture:** A shared measurement catalog (family → readings → checks) is defined once in the Pipeline templates, rendered to `docs/schemas/site_task_measurement_catalog.v1.json`, and mirrored byte-for-byte into WebApp `contracts/pipeline/`. WebApp stores readings in `siteTaskMeasurements/{requestId}` (outside the digest-bound brief), serves them to owner and film links, and exports the source document for a supplied qualification binding. Pipeline templates refuse to produce a profile until a named person marks their thresholds reviewed.

**Tech Stack:** WebApp: TypeScript, React, Express, zod, Firestore Admin, Vitest, Playwright. Pipeline: Python 3.12, pytest, RFC 8785 digests (`cross_runtime_canonical_digest`).

Design: `docs/superpowers/specs/2026-10-19-site-task-measurements-design.md`.

---

## File map

Pipeline (`~/.claude-worktrees/BlueprintCapturePipeline-site-task-measurements`, branch `claude/site-task-fidelity-profiles`):

| File | Responsibility |
| --- | --- |
| Create `src/blueprint_pipeline/site_task_fidelity_profile_templates.py` | Templates (source of truth), validation, catalog projection, `profile_from_template`, `measurement_coverage`, renderers, CLI |
| Create `docs/site_task_fidelity_profiles/rigid_pick_place.template.v1.json`, `articulated_open_close.template.v1.json` | Rendered templates for human review (byte-equal to the builder) |
| Create `docs/schemas/site_task_measurement_catalog.v1.json` | Rendered catalog, the WebApp mirror source |
| Create `tests/fixtures/site_task_measurements/*.webapp_export.synthetic.json` | WebApp export bytes (synthetic), copied from the WebApp fixture |
| Create `tests/test_site_task_fidelity_profile_templates.py` | Template, render, review-gate, coverage and end-to-end qualification tests |
| Modify `docs/beta-site-task-simulation-qualification.md` | Section on site measurements and templates |

WebApp (this worktree, branch `claude/site-task-measurements`):

| File | Responsibility |
| --- | --- |
| Create `client/src/data/siteMeasurements.ts` | Catalog in TS, units, conversion, labels and hints, presented types |
| Create `contracts/pipeline/site-task-measurement-catalog.v1.json` | Byte mirror of the Pipeline catalog |
| Create `scripts/pipeline/verify-site-task-measurement-catalog.ts`, script in `package.json` | Mirror parity check against a sibling Pipeline checkout |
| Create `server/utils/siteTaskMeasurements.ts` | Input normalization, persistence with provenance and revision, presenters, coverage, source-document export |
| Modify `server/routes/site-task-brief.ts` | `GET`/`PUT /:token/measurements` |
| Modify `server/routes/admin-job-console.ts` | `GET /:requestId/site-measurements`, `POST /:requestId/site-measurements/source-document` |
| Create `client/src/components/site/SiteMeasurementsPanel.tsx` | The job-page panel (owner and film links) |
| Modify `client/src/pages/SelfCaptureUpload.tsx` | Mount the panel lazily beside the item photos; one filming-hint sentence |
| Create `client/src/components/admin/SiteMeasurementsConsole.tsx`; modify `client/src/pages/AdminJobConsole.tsx` | Readings, coverage and export download in the job console |
| Create `server/tests/fixtures/site-task-measurements/*.webapp_export.synthetic.json` | Pinned export bytes shared with the Pipeline test |
| Create tests: `client/tests/data/siteMeasurements.test.ts`, `server/tests/site-task-measurements.test.ts`, `server/tests/site-task-measurement-routes.test.ts`, `server/tests/admin-site-measurements-route.test.ts`, `client/tests/components/SiteMeasurementsPanel.test.tsx`, `client/tests/components/admin/SiteMeasurementsConsole.test.tsx` | Unit, route and component coverage |
| Modify `docs/beta/SITE_OPERATOR_BETA_GUIDE.md`, `docs/runbooks/qualified-site-evaluation.md` | Site guide and operator runbook |

## Catalog (both repos)

Family `rigid_pick_place` readings: `pick_surface_height`, `place_surface_height`, `pick_to_place_distance`, `object_length`, `object_width`, `object_height`, `pick_front_clearance`, `pick_overhead_clearance` (length); `object_mass` (mass); `reference_sheet_long_edge` (length).

Family `articulated_open_close` readings: `handle_height`, `front_width`, `opening_travel` (sliding), `opening_chord` (hinged), `handle_offset_from_hinge` (hinged), `front_clearance_open` (length); `opening_force` (force); `reference_sheet_long_edge` (length).

Checks (id · dimension · unit · min · sample ids) exactly as the design's section 2 table. Catalog JSON shape (`sort_keys`, indent 2, trailing newline):

```json
{"families": [{"checks": [{"dimension": "scale", "id": "pick_place.scale.lengths", "minimum_sample_count": 1,
  "sample_ids": ["pick_to_place_distance", "reference_sheet_long_edge"], "unit": "m"}],
  "family": "rigid_pick_place",
  "readings": [{"articulation": null, "quantity": "length", "sample_id": "pick_surface_height", "unit": "m"}]}],
 "measurement_samples_schema": "blueprint.site_task_measurement_samples.v1",
 "schema_version": "blueprint.site_task_measurement_catalog.v1"}
```

Proposed thresholds (max abs / max RMS), all shipped with `threshold_review.status = "pending_review"`:
pick_place scale 0.025/0.020, registration 0.020/0.015, collision 0.050/0.050, task_state 0.010/0.008, observation 0.020/0.020, task_dynamics 0.100/0.100 kg;
open_close scale 0.025/0.020, registration 0.020/0.020, collision 0.050/0.050, task_state 0.030/0.025, observation 0.020/0.020, task_dynamics 10/10 N.

---

### Task 1: Pipeline templates module

**Files:** create `src/blueprint_pipeline/site_task_fidelity_profile_templates.py`, `tests/test_site_task_fidelity_profile_templates.py`.

Interface:

```python
TEMPLATE_SCHEMA = "blueprint.site_task_fidelity_profile_template.v1"
CATALOG_SCHEMA = "blueprint.site_task_measurement_catalog.v1"
FAMILIES = ("rigid_pick_place", "articulated_open_close")
class FidelityTemplateError(ValueError): ...
def template(family: str) -> dict            # deep copy of the source-of-truth template
def validate_template(value: Mapping) -> dict
def catalog() -> dict                         # projection of both templates, no thresholds
def render_json(value: Mapping) -> str        # json.dumps(indent=2, sort_keys=True, allow_nan=False) + "\n"
def profile_from_template(value: Mapping, *, task_id: str) -> dict
def measurement_coverage(value: Mapping, document: Mapping) -> dict
def main(argv: list[str] | None = None) -> int   # subcommands: render, profile, coverage
```

- [ ] Write failing tests:
  - both templates validate; each has exactly one check per dimension; thresholds are finite, > 0, rms ≤ max; every id, unit and sample id passes the qualifier's label pattern; sample ids are catalog readings of that family.
  - `validate_template` rejects: a missing dimension, a zero or null threshold, rms > max, an unknown sample id, a duplicate check id, an unknown key.
  - `profile_from_template` raises `FidelityTemplateError("template_thresholds_not_reviewed")` for the shipped templates; for a copy marked `{"status": "reviewed", "reviewed_by": "founder", "reviewed_at_iso": "2026-10-19T00:00:00Z"}` it returns schema `blueprint.site_task_fidelity_profile.v1`, the family, `task_id`, `template_digest == cross_runtime_canonical_digest(template)`, and checks with exactly the six profile keys.
  - `measurement_coverage` on a complete synthetic document → `complete is True`; dropping `object_mass` → the task_dynamics check reports `missing_required == 1` and `complete is False`; an extra sample id → listed under `unexpected`; a wrong unit → `unit_mismatch`.
- [ ] Run: `PYTHONPATH=src ~/workspace/BlueprintCapturePipeline/.venv/bin/python -m pytest tests/test_site_task_fidelity_profile_templates.py -q` → fails on import.
- [ ] Implement the module (templates as module-level literals with `site_reading`, `simulator_reading`, `threshold_basis` per check).
- [ ] Re-run → pass. `ruff check` the two files.
- [ ] Commit `feat(beta): fidelity-profile templates for the two scored site-task families`.

### Task 2: Rendered docs and catalog

**Files:** create the two template JSON files and `docs/schemas/site_task_measurement_catalog.v1.json` via `python -m blueprint_pipeline.site_task_fidelity_profile_templates render`.

- [ ] Failing tests: each docs file's text equals `render_json(...)` of the builder (byte equality, not parsed equality).
- [ ] Run the `render` subcommand, re-run tests → pass. Commit.

### Task 3: End-to-end qualification with a WebApp-shaped export

**Files:** `tests/fixtures/site_task_measurements/{rigid_pick_place,articulated_open_close}.webapp_export.synthetic.json` (copied from WebApp Task 6 output), tests in the same test file.

- [ ] Test helper `_qualify_with_export(tmp_path, family, simulator_delta)`: build `fixture(tmp_path)` from `tests/test_site_task_simulation_qualification.py`; load the export fixture; replace `binding` with the fixture request's binding and `producer_id` with `site_job:scene-request-fixture`; build a simulator copy with producer `blueprint-pipeline:simulator-measurements` and per-check deltas; write both files, update the request's `source_artifacts` sha256 and size, rewrite the request, write the profile from a reviewed template copy, re-authorize the review, extend allowed producers; run `qualify_from_profile`.
- [ ] Cases: inside thresholds → receipt validates and lists every family check; one task_state sample beyond the maximum → `fidelity_failed:<check id>`; a missing required reading → `samples_insufficient` or `samples_binding_mismatch`; the other family's profile → `samples_binding_mismatch`.
- [ ] Run, pass, commit.

### Task 4: Pipeline doc

- [ ] Add a "Site measurements and fidelity-profile templates" section to `docs/beta-site-task-simulation-qualification.md` (review gate, CLI, calibration exclusion, identities decision). Run `python scripts/lint_public_scientific_claims.py` if available. Commit.

### Task 5: WebApp catalog, conversion and mirror

**Files:** `client/src/data/siteMeasurements.ts`, `contracts/pipeline/site-task-measurement-catalog.v1.json` (copy of Pipeline bytes), `scripts/pipeline/verify-site-task-measurement-catalog.ts`, `package.json` script `pipeline:site-task-measurement-catalog:verify`, `client/tests/data/siteMeasurements.test.ts`.

```ts
export type MeasurementFamily = "rigid_pick_place" | "articulated_open_close";
export type Articulation = "hinged" | "sliding";
export type EntryUnit = "cm" | "in" | "kg" | "lb" | "kgf" | "lbf";
export const SITE_MEASUREMENT_FAMILIES: readonly MeasurementFamilySpec[];
export function familySpec(family: MeasurementFamily): MeasurementFamilySpec;
export function unitsFor(quantity: MeasurementQuantity): readonly EntryUnit[];
export function toSi(value: number, unit: EntryUnit): number;   // rounded to 1e-6
export function catalogProjection(): unknown;                    // equals the mirror JSON
```

- [ ] Failing tests: `catalogProjection()` deep-equals `JSON.parse(mirror)`; `toSi(30, "in") === 0.762`, `toSi(76.2, "cm") === 0.762`, `toSi(2, "lb") === 0.907185`, `toSi(1, "kgf") === 9.80665`; every check sample id is a reading of its family; reading ids are unique per family.
- [ ] Implement, run `npx vitest run client/tests/data/siteMeasurements.test.ts`, commit.

### Task 6: Server measurement module

**Files:** `server/utils/siteTaskMeasurements.ts`, `server/tests/site-task-measurements.test.ts`, fixtures `server/tests/fixtures/site-task-measurements/*.webapp_export.synthetic.json`.

```ts
export const SITE_TASK_MEASUREMENTS_COLLECTION = "siteTaskMeasurements";
export const measurementSaveSchema: z.ZodType<MeasurementSaveInput>;   // strict
export class MeasurementInputError extends Error { code: string }
export class MeasurementRevisionConflict extends Error { latest: SiteTaskMeasurementRecord | null }
export function normalizeMeasurementInput(input: MeasurementSaveInput): NormalizedMeasurements;
export async function getMeasurements(requestId: string): Promise<SiteTaskMeasurementRecord | null>;
export async function saveMeasurements(requestId: string, input: MeasurementSaveInput, actor: { scope: "owner" | "film" }, now?: Date): Promise<SiteTaskMeasurementRecord>;
export function presentMeasurements(record: SiteTaskMeasurementRecord | null): PresentedSiteMeasurements;
export function presentMeasurementsForAdmin(record: SiteTaskMeasurementRecord | null): AdminSiteMeasurements;
export function measurementCoverage(record: SiteTaskMeasurementRecord | null): MeasurementCoverage;
export function buildSourceMeasurementDocument(record: SiteTaskMeasurementRecord, options: { binding: unknown; producerId: string; excludeSampleIds?: string[] }): SourceMeasurementExport;
```

- [ ] Failing tests: unit/quantity mismatch, out-of-bounds value, a reading of the other family, a hinged-only reading on a sliding front, `referencePaper: "other"` without a long edge → `MeasurementInputError`; paper standard → `reference_sheet_long_edge` at 0.2794/0.297 with basis `paper_standard`; save on a fresh job requires revision 0; a stale revision → `MeasurementRevisionConflict`; an unchanged reading keeps its first `recordedAtIso` and scope while a changed one takes the new time and scope; export: wrong-shaped binding, a digest field that is not `sha256:<64 hex>`, an unknown policy interface, `scene_request_id` ≠ job, an unknown exclusion and an empty result each refuse; exclusions drop samples from every check; output bytes equal the pinned fixture and `sha256` equals the hash of those bytes; `observed_at_iso` is the latest included reading time at second precision.
- [ ] Implement, run, commit.

### Task 7: Signed-link routes

**Files:** modify `server/routes/site-task-brief.ts`; create `server/tests/site-task-measurement-routes.test.ts`.

- [ ] Failing tests (pattern: `site-task-brief-scope.test.ts`): `GET` with an empty job → `{ok:true, revision:0, family:null}`; `PUT` from an owner link stores and returns the reading; a film link can also save and the reading records `recordedByScope: "film"`; invalid body → 400 `measurements_invalid`; stale revision → 409 `measurements_changed` with the latest record; a bad token → 404; withdrawn consent → 409 `capture_processing_not_authorized` (existing middleware).
- [ ] Implement, run, commit.

### Task 8: Admin console routes

**Files:** modify `server/routes/admin-job-console.ts`; create `server/tests/admin-site-measurements-route.test.ts`.

- [ ] Failing tests: non-admin → 403; `GET` with no record → `{measurements:null, coverage:...}`; with a record → SI values, provenance and coverage; `POST source-document` returns `{json, sha256, fileName, sampleCount, dimensionsWithoutSamples}` and writes nothing; a mismatched `scene_request_id` → 400.
- [ ] Implement, run, commit.

### Task 9: Site panel and job page

**Files:** create `client/src/components/site/SiteMeasurementsPanel.tsx`, `client/tests/components/SiteMeasurementsPanel.test.tsx`; modify `client/src/pages/SelfCaptureUpload.tsx`.

- [ ] Failing tests: the panel asks what the job does before showing readings; choosing open/close asks how it opens and swaps "How far it pulls out" / "How far it opens"; switching cm/in changes the saved unit; save sends `PUT` with `revision`, family, readings `{value, unit}` and the paper choice; a 409 reloads and says so; a film link sees the same form. Job page: the disclosure "Add measurements (optional)" appears beside the item photos and fetches nothing until opened.
- [ ] Implement, run `npx vitest run client/tests/components/SiteMeasurementsPanel.test.tsx client/tests/pages/SelfCaptureUpload.test.tsx`, commit.

### Task 10: Admin console section

**Files:** create `client/src/components/admin/SiteMeasurementsConsole.tsx`, `client/tests/components/admin/SiteMeasurementsConsole.test.tsx`; modify `client/src/pages/AdminJobConsole.tsx`.

- [ ] Failing tests: readings table with SI values; coverage lists missing dimensions; export requires valid binding JSON; the producer defaults to `site_job:<requestId>`; a successful export shows the sha256 and offers a download.
- [ ] Implement, run, commit.

### Task 11: Guide, runbook, verification

- [ ] Update `docs/beta/SITE_OPERATOR_BETA_GUIDE.md` (Measurements section) and `docs/runbooks/qualified-site-evaluation.md` (export step and `site_job:` identity).
- [ ] Run `npm run check`, `npx vitest run client/tests`, the server tests touched, `npx playwright test e2e/site-private-link-reliability.spec.ts e2e/onboarding-p1.spec.ts e2e/invited-site-beta.spec.ts e2e/brand-polish.spec.ts` (with each spec's config), `npm run pipeline:site-task-measurement-catalog:verify -- --require-pipeline` against the Pipeline worktree, `npm run doctrine:verify`, `npm run claims:guard`.
- [ ] Refresh graphify per the repo guide. Commit, push both branches, open paired PRs.
