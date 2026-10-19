# Site-task measurements and fidelity-profile templates: design

Date: 2026-10-19. Status: approved by the founder on 2026-10-19 with three
decisions. Cohort 1 uses option A in section 6. The proposed thresholds ship
marked pending, and the founder reviews them in the Pipeline PR. Owner and
film-only links can both record readings.

Beta steps unblocked: L5 (a team's simulator-scored evaluation of one captured
site task) and L6 (an evidence-backed recommendation).

## Problem

The qualified path (WebApp #1058, Pipeline #2730) admits a team's evaluation
only with a receipt that compares independent source measurements of the real
site with paired simulator measurements, against a frozen task-specific
fidelity profile. Nothing collects the source measurements. The site guide and
the capture pages never ask for a measurement, and website scenes report
`physical_scale_measured: false` with scale in `estimated_meters`. World Labs
reconstructions return depth in world units. Every current capture therefore
fails closed at qualification, whichever reconstruction backend runs.

The 2026-10-18 audit names the smallest useful closure: "measure the few
quantities that could change the decision—scale, relative positions, reach,
collision surfaces, object dimensions and relevant contact assumptions—and
record tolerances and unknowns."

## Approaches considered

1. **An optional measurements panel on the job page (recommended).** It sits
   beside "Add photos of the job items", opens from the owner link and the
   film-only link, and is used by whoever stands at the work area with a tape
   measure. The start form and the brief stay as they are.
2. **Questions inside the brief.** The brief is the owner's attestation and is
   digest-bound: coverage review, footage proposals and clarifications compare
   `humanDecisionDigest(brief)`. Measurements there would mark that in-flight
   work stale and would add weight to the one step every site must finish.
3. **Questions on the start form.** This contradicts "keep entry light", and
   nobody has a tape measure at the desk where the form is filled in.

## 1. What a site measures

Six groups of readings per scored family, chosen because they decide whether a
simulated outcome carries over. Every reading is optional. "I could not measure
this" is recorded as absence plus an optional note, never as a guess.

The Pipeline's own screening already names two of them: an object's smallest
dimension against gripper stroke (`tape_measure`) and its mass against grip force
(`kitchen_scale`). Its articulated screen marks slide and hinge resistance as
"not observable in footage". Current website estimates assume 25% dimension
error.

**`rigid_pick_place`** (move an object from one place to another)

| Group | Reading (`sample_id`) | How |
| --- | --- | --- |
| Surface heights | `pick_surface_height`, `place_surface_height` | Floor to the top of each surface |
| Travel | `pick_to_place_distance` | Horizontal, middle of start spot to middle of end spot |
| Object size | `object_length`, `object_width`, `object_height` | One typical object, outside edges |
| Clear space | `pick_front_clearance`, `pick_overhead_clearance` | Front edge straight out to the nearest obstruction; surface up to anything above it |
| Weight | `object_mass` | Kitchen, postal or bathroom scale |
| Reference sheet | `reference_sheet_long_edge` | A sheet of printer paper lying flat on the work surface while filming |

**`articulated_open_close`** (open or close a door, drawer or lid; hinged or sliding)

| Group | Reading (`sample_id`) | How |
| --- | --- | --- |
| Handle height | `handle_height` | Floor to the middle of the handle |
| Front width | `front_width` | Edge to edge |
| Opening | `opening_travel` (sliding) or `opening_chord` (hinged), `handle_offset_from_hinge` (hinged) | Drawer: how far the front moves. Door or lid, fully open: straight across from its outer edge to the frame edge it closes against. Hinge edge to the handle middle |
| Clear space | `front_clearance_open` | From the fully open front straight out to the nearest obstruction |
| Force | `opening_force` | Luggage or spring scale on the handle: highest reading as it starts to move |
| Reference sheet | `reference_sheet_long_edge` | As above |

**Entry.** Lengths in cm or inches; weight in kg or lb; force as the kg or lb
a luggage scale shows. The record keeps what was typed plus the SI value. For
US Letter or A4 the sheet's long edge is the paper standard (0.2794 m or
0.297 m); another paper size is tape-measured. A plain sheet suits v1. A
printed high-contrast card is an option for later if automatic detection needs
one. Input bounds catch unit slips: heights up to 3 m, lengths up to 20 m,
object sides up to 3 m, mass up to 500 kg, force up to 2,000 N.

## 2. Mapping to `blueprint.site_task_measurement_samples.v1`

Check IDs carry the family, so a pick-and-place document can never satisfy an
open-and-close profile. Each check is one row: `{id, dimension, unit, samples:
[{sample_id, value}]}` with SI values.

| Check | Dimension (receipt) | Unit | Samples | Min |
| --- | --- | --- | --- | --- |
| `pick_place.scale.lengths` | scale (registration) | m | `pick_to_place_distance`, `reference_sheet_long_edge` | 1 |
| `pick_place.registration.surface_heights` | registration (registration) | m | `pick_surface_height`, `place_surface_height` | 1 |
| `pick_place.collision.clearances` | collision (registration) | m | `pick_front_clearance`, `pick_overhead_clearance` | 1 |
| `pick_place.task_state.object_size` | task_state (fidelity review) | m | `object_length`, `object_width`, `object_height` | 3 |
| `pick_place.observation.visible_lengths` | observation (fidelity review) | m | `reference_sheet_long_edge`, `object_length` | 1 |
| `pick_place.task_dynamics.object_mass` | task_dynamics (fidelity review) | kg | `object_mass` | 1 |
| `open_close.scale.lengths` | scale | m | `front_width`, `reference_sheet_long_edge` | 1 |
| `open_close.registration.handle_height` | registration | m | `handle_height` | 1 |
| `open_close.collision.open_clearance` | collision | m | `front_clearance_open` | 1 |
| `open_close.task_state.opening` | task_state | m | `opening_travel` or `opening_chord`, `handle_offset_from_hinge` | 1 |
| `open_close.observation.visible_lengths` | observation | m | `reference_sheet_long_edge`, `front_width` | 1 |
| `open_close.task_dynamics.opening_force` | task_dynamics | N | `opening_force` | 1 |

**Two paths, one truth.** Scale compares a tape length with the same length in
the scene geometry. Observation compares it with the length recovered from a
rendered camera view (RGB-D at a capture or robot camera pose): the appearance
the policy actually sees. A misaligned or wrongly scaled render fails
observation even when the collision geometry passes scale.

**Calibration exclusion.** A reading that sets the scene's metric scale (for
example a `measured_site_anchor` in `build_metric_scale_anchor`) cannot also
check it. The export takes the IDs of readings used for calibration and leaves
them out of every check. Nothing calibrates from site readings today.

**What a site reading cannot cover.** It cannot measure photometric fidelity,
friction, centre of mass or the robot's camera placement. The receipt states
only what its checks measured. A missing required reading fails closed, as it
does today.

**Simulator side** (for the separate simulator-producer work). Scene plans
already carry `support_plane_z_m`, start and destination poses, the subject
collision box, `hinge_point_world_m`, `handle_grasp_point_closed_world_m`,
`authored_limits_degrees`, camera intrinsics and the configured mass and joint
friction. Each template check states which of these its simulator reading uses.

## 3. Persistence and export (WebApp)

- `siteTaskMeasurements/{requestId}`: a server-only record beside the item
  inventory, outside the brief's digest. It holds the family, the articulation,
  the readings (as entered, SI value, basis `tape`/`scale`/`paper_standard`,
  recorded time, link scope and optional name), the sheet answer, a note and a
  revision. A save replaces the set. An unchanged reading keeps its original
  time and author. A stale revision is refused, so two people at the work area
  cannot silently overwrite each other.
- `GET`/`PUT /api/site-task-brief/:token/measurements`, through the existing
  signed-link middleware. Owner and film-only links can both record, because
  measuring is capture, like item photos. The record names which link saved
  each reading.
- Admin, behind the existing CSRF, Firebase and admin-role chain:
  `GET /api/admin/jobs/:requestId/site-measurements` shows the readings and
  dimension coverage. `POST .../site-measurements/source-document` takes the
  qualification request's `binding`, a `producer_id` and the calibration
  exclusions. It returns the measurement document's exact JSON bytes and their
  `sha256`. WebApp cannot compute the binding itself: scene revision, task-spec
  and success-contract digests do not exist before a run, and the robot model
  digest is per team. So the binding is an input, checked for shape and for
  `scene_request_id` equal to the job. `observed_at_iso` is the latest
  included reading's time. Nothing is written; the export is logged.
- The admin job console shows the readings and offers the export as a JSON
  download.
- Measurements are not added to the Pipeline task-context export. That would
  change `context_digest` and refuse sponsorship (`website_task_context_changed`).

**Evidence wording.** A site reading stays `operator_stated` in WebApp, in
line with the site-assessment rule that `measured` needs an admitted
measurement record. It becomes qualification evidence only as a source document
pinned by an authorized producer and accepted by an authorized reviewer.

## 4. Fidelity-profile templates (Pipeline)

`src/blueprint_pipeline/site_task_fidelity_profile_templates.py` defines one
template per family (`blueprint.site_task_fidelity_profile_template.v1`). Each
check has its six profile fields plus `sample_ids`, `site_reading`,
`simulator_reading` and `threshold_basis`. Each template has a
`threshold_review` block. Rendered copies are checked in under
`docs/site_task_fidelity_profiles/`, and the shared catalog (no thresholds)
under `docs/schemas/site_task_measurement_catalog.v1.json`. WebApp mirrors the
catalog byte for byte in `contracts/pipeline/`, with a verify script like the
capture-intake mirror.

- `profile_from_template(template, task_id=...)` emits a
  `blueprint.site_task_fidelity_profile.v1` with the family, task ID and
  template digest. It refuses while `threshold_review.status` is not
  `reviewed` by a named person. A template therefore never acts as a
  production default.
- `measurement_coverage(template, document)` reports per check what is present,
  what is missing and any sample ID the template does not allow, before anyone
  runs the simulator side.
- The qualifier is unchanged. Its six-key criteria, sample pairing, three
  distinct identities, review ordering and all other gates stay as they are.

**Proposed thresholds** (maximum absolute error / maximum RMS error):

| Check | Proposed | Basis |
| --- | --- | --- |
| scale lengths | 0.025 / 0.020 m | Careful tape reading ±5 mm on 0.3–2 m; 2.5 cm is 1.3–2.5% on 1–2 m, inside reach tolerance |
| surface heights | 0.020 / 0.015 m | Surface height sets approach and contact height; about the margin between a clean top grasp and a fingertip strike |
| handle height | 0.020 / 0.020 m | Same reasoning for the grasp point |
| clearances | 0.050 / 0.050 m | Long spans with soft end points; 5 cm against typical approach clearances of 0.3 m or more |
| object size | 0.010 / 0.008 m | Grasp width against stroke; 1 cm is 10–15% of a typical parallel-gripper stroke |
| opening extent | 0.030 / 0.025 m | 3 cm on a 0.4–1 m chord or travel, about 2–4° or 5% of range |
| visible lengths | 0.020 / 0.020 m | About 7% on a sheet edge; catches a render out of scale or misaligned with geometry |
| object mass | 0.100 / 0.100 kg | Kitchen-scale error; small against typical payload margin. Heavy objects may need a relative limit |
| opening force | 10 / 10 N | Untrained luggage-scale peaks ±3–5 N; separates a light cabinet (5–15 N) from a stiff door (30 N+) |

These are engineering proposals. They are not reviewed values.

## 5. Site guide and copy

The guide gains a short "Measurements (optional)" section, and the filming hint
gains one sentence about the paper sheet. Copy avoids "match", asks no robot,
budget or simulation question, and says plainly that measurements are evidence
Blueprint reviews, never a pass. The panel says: an evaluation can count toward
a recommendation only after Blueprint has checked the scene against
measurements of the real site.

## 6. Identities for cohort 1 (founder decision)

The qualifier needs three distinct authorized identities: measurement producer,
simulator producer and reviewer. The operator registry pins them.

| Option | Measurement producer | Simulator producer | Reviewer | Trade-off |
| --- | --- | --- | --- | --- |
| A | The site (`site_job:<requestId>`); its readings, exported unchanged | Pipeline simulator-measurement service identity | Founder | Real independence and no hire; readings are unverified non-expert measurements, which the reviewer checks against footage and the sheet |
| B | A named Blueprint person who checks the site's readings against footage, or measures on a visit | Same | Founder | Accountable, verified readings; needs a second person |
| C | Founder, by video check or visit | Same | An outside reviewer | Hands-on quality; needs a willing outside reviewer |

The design works with any of these: `producer_id` is an export input and the
registry holds the allowed lists. The threshold values also need a named human
reviewer before `profile_from_template` will run.

**Decision (2026-10-19): option A.** For cohort 1 the site is the measurement
producer, identified as `site_job:<requestId>`. A Pipeline service identity is
the simulator producer, and the founder is the reviewer. Each site's
`site_job:` identity is added to the operator registry's
`allowed_measurement_producers` when that site is admitted. The thresholds stay
`pending_review` until the founder marks them reviewed in the Pipeline PR.

## Testing

- WebApp: catalog and mirror equality; unit conversion and bounds; save,
  replace, revision conflict and per-reading provenance; owner and film scopes;
  the withdrawn-consent refusal from the existing middleware; export binding
  checks, exclusions, determinism and `sha256`; the panel's render, unit toggle
  and save payload; the job page, brief and footage e2e specs plus
  `e2e/brand-polish.spec.ts`.
- Pipeline: template validity (six dimensions, explicit positive thresholds,
  RMS ≤ maximum, valid labels, no duplicate IDs); rendered docs and catalog
  equal to the builder; the review gate; coverage; an end-to-end qualification
  on the existing synthetic fixture using a WebApp-shaped export. It passes
  inside the thresholds and fails with `fidelity_failed:<check>` outside them,
  with `samples_insufficient` for a missing reading and with a mismatch for the
  other family.

## Note after merging main (#1069)

The site guide now says the current website route evaluates one rigid object
placed elsewhere on the same support surface. Moving between surfaces, placing
into containers, and doors or other articulated objects need a separately
supported route. The panel still collects open-and-close readings, because the
Pipeline scores that family and its template exists. When a site chooses a
door, drawer or lid, the panel says Blueprint confirms that job before any
evaluation. The place-surface reading asks for the same height when the object
stays on one surface.

## Out of scope

- The simulator-side measurement producer: reading each quantity from the
  prepared scene and rendered views.
- Metric-scale calibration from site readings.
- A printable scale card with automatic corner detection.
- Wiring readings into the site assessment or into scene preparation.
