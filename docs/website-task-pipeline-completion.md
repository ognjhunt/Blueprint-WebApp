# Website capture to robot evaluation: completion evidence

Owner request: implement the corrected fourteen-step design in full across
WebApp and Pipeline, and demonstrate completeness before closing the goal.
Scope is website capture. Existing iOS capture is not the default entry path.
All rows start unproven; contracts and mocked tests alone do not prove live execution.

Program mapping: ADP-009B (public day 14 removal/replacement rehearsal), ADP-021
and ADP-022 (partner day 21 capture and registration), ADP-030/040/050
(partner day 28 task, replica and robot integration). This owner-directed work
adds the website precursor without upgrading synthetic evidence to physical proof.

## Acceptance matrix

| Step | Required behavior | Evidence required to close | State |
| --- | --- | --- | --- |
| 1 | Confirm task, work region, success criteria before reconstruction | Browser submission and immutable confirmed task consumed by Pipeline | Unproven |
| 2 | Browser original retained; optional inferred depth | Source digests unchanged; native depth output with provider identity and uncertainty | Unproven |
| 3 | Metric scale from confirmed SKU/dimension or measurement; optional ARKit escalation | Independent scale/registration checks, no guessed metric promotion | Unproven |
| 4 | Reusable Gemini 3.8 agentic task/coverage/object analysis | API trace of media navigation, validated outputs, one source-bound analysis | In progress |
| 5 | SAM3.1 tracks selected objects and people | Actual tracker outputs for retained frames, masks and identity bindings | Unproven |
| 6 | Task-dependent keep/collider/replace decisions before reconstruction | Confirmed plan distinguishing fixed supports from movable assets | In progress |
| 7 | Original views, cameras, depth and placement preserved | Read-only source evidence and reusable placement references; no mandatory second world | Unproven |
| 8 | Consistent observed-background recovery plus conditional image editing; no VIP | Real edited views, original/edited comparison, cross-view checks and residual-person checks | Unproven |
| 9 | One owner submits prepared views to the admitted reconstruction provider and collects completion | Actual Marble request, operation receipt, terminal assets; capability/readiness errors visible; Atlas remains capability-gated | Unproven |
| 10 | Reuse CAD, then parameterized geometry, then bounded agent authoring | Real exports with source, dimensions, kernel/tool version and deterministic validators | In progress (existing `rigid_replacement_authoring` stage; website inputs compiled, GPU run pending) |
| 11 | Register base to original references and compose independent assets | Multi-view pose checks, contacts, no duplicate baked objects | In progress (source-to-collider registration and support placement hermetic; `native_task_scene_assembly` pending) |
| 12 | Task-relevant physics with uncertainty and measurement escalation | Sensitivity checks and measured/estimated provenance | In progress (estimated bounds plus grasp-hold screen and escalation; `bounded_physics` cells run on GPU) |
| 13 | Real simulator loads, steps, controls, observes, resets and scores | Native preflight and positive/negative controls, media and receipts | Unproven (existing native Isaac import and ADP-009D hold/scripted-positive controls; needs a paid Vast run) |
| 14 | Signed publication of task, thumbnail and supported robot evaluations | Website browser readback plus actual compatible robot-team run and result | In progress (existing configured-scene offering readback; thumbnail proposal compiled; no run yet) |

## Execution constraints

- Preserve dirty primary checkouts; implementation lives in sibling worktrees
  named `website-task-pipeline` on `codex/website-task-pipeline`.
- Reuse existing admission, allocator, immutable requests, callbacks and result
  delivery. Do not add a competing queue, datastore or reconstruction owner.
- Keep originals distinct from generated repair, depth estimates and simulation.
- Owner explicitly authorized Marble on 2026-09-19 because Atlas access is not
  available. Final reconstruction proof uses Marble; do not claim Atlas tested.
- Paid runs use the existing bounded resource admission and teardown controls.
- App Clip, duplicate full reconstructions, DA3, premium exports and custom CAD
  are conditional, not mandatory dependencies when existing inputs suffice.
- VIP must be absent from the new website path. Legacy receipts remain readable.

## Evidence log

2026-09-19: clean starting points WebApp `2e646087` and Pipeline `56cc0a913`.
Observed website adapter requested ordinary inline video; Pipeline removal
scaffold defaulted to 3.7 with a static fallback. No full-path completion claim.

Owner-selected test input: `/Users/nijelhunt_1/Downloads/walkthrough (2).mov`.
SHA-256: `037df5b58150ff4e00b90eaecd4cc0f883722432f5045a916c2a1a30be47295d`.
Original stays in place; derivatives live in ignored run output.
Probe: 13.525 seconds, 13,424,329 bytes, encoded 1920x1080 at 30 fps with
rotation metadata. Owner selected small rigid-object pick-and-place as the
development test. Object and scale still need source evidence.

WebApp agentic adapter focused tests: 21 passed (5 provider-contract tests and
16 existing video-evidence tests). Provider calls mocked; live proof pending.
WebApp `npm run check`: passed. Pipeline focused tests: 17 passed. Google GenAI
2.24.0 actual types accept the agentic request fields and parse MEDIA_PROCESSING
responses (local SDK serialization check, no provider call).
Graphify refresh attempted: runner lacks graphifyy; staged corpus exists but
canonical graph regeneration is pending.

Task-removal refinement: movability alone never requests removal. The analysis
records task effect, reason and source observations, and binds manipulated
objects to a verbatim task-text reference. Unrelated movable objects stay;
static supports and obstacles request collision geometry without deleting their
appearance. Ambiguous task objects retain a clarification question and block
editing. Existing Agents SDK capture supervisor instructions use the same rule.
Its full website-stage orchestration is not yet connected or live-verified.

Reconstruction admission now rejects blocked/invalid preparation instead of
falling back to the unedited source. Website uploads carry task context through
materialization. A signed, read-only WebApp endpoint now returns the current
brief without owner identity; Pipeline checks its capture binding and digest
before any preparation, retaining the snapshot beside (not over) the original
manifest. Unconfirmed tasks hold preparation. The legacy direct WebApp
reconstruction endpoint rejects website captures, since extraction already
hands them to Pipeline; there is no second unprepared World Labs purchase.
Focused verification: Pipeline 80 tests passed (analysis, clean-plate admission,
materialization and supervisor manager); WebApp 52 passed (manifest, agentic
adapter, footage evidence and privacy). Changed-file Python lint passed.
The two new current-task endpoint tests and WebApp typecheck also passed.
These are hermetic tests, not live reconstruction or simulator proof.

## Parallel work split (2026-09-19, Claude Fable lane)

Claude works in these same worktrees on steps 10–14; Astra keeps steps 1–9.
Commits carry a `[claude]` prefix; pull before editing shared files.

Correction after owner review: the platform target is Isaac Sim, and SimReady
authority already lives in the USD Content Agents, the static qualification
stage, the native import qualification stage and the native task execution
admission. Steps 10–14 therefore map onto the existing Task Evaluation
scene-configuration run rather than new simulator code:

| Step | Existing production stage |
| --- | --- |
| 10 | `rigid_replacement_authoring` (`content_agents_rigid_replacement` or Astra CAD/Blender) then `replacement_static_qualification` |
| 11 | `replacement_native_import_qualification` and `native_task_scene_assembly` with frame registration |
| 12 | stage-3 physics bounds, physical property review, and the `bounded_physics` policy-run cells |
| 13 | native import driver, native task execution admission, ADP-009D hold (negative) and scripted differential-IK (positive) controls |
| 14 | `publish_configured_scene_revision` → WebApp configured-scene offering, thumbnail, `/app/packs/:launchId/evaluate` |

No MuJoCo harness is introduced. Local CPU smoke remains non-proof by doctrine.

Claude-owned bridge: Pipeline `website_task_preparation.py` (commit
`efdf1733d`, 6 hermetic tests). It consumes the Astra lane's confirmed task
context, `website_task_masks.v1`, `website_source_geometry.v1`, the clean-plate
removal manifest and a Marble `base_scene` (splat + collider mesh with declared
up axis and metres per unit, provider operation id, intake binding ids), then:

- registers the MapAnything estimate to the Marble collider (24 axis
  conventions, trimmed RMSE, ambiguity and poor-fit refusal; scale stays
  `estimated_registration`, `physical_scale_measured: false`);
- places the removed subject on the collider support beneath its footprint and
  fills the removal manifest's `compose_back` slots in a sibling file;
- emits estimated physics bounds and a grasp-hold sensitivity screen against
  the Robotiq 2F-85 reference (85 mm stroke, 20–235 N) that names the smallest
  missing measurement (`mass_kg` or `smallest_dimension_m`);
- proposes a task-region thumbnail from the source frame and subject mask
  (operator listing approval still required before display);
- assembles and validates a `task_evaluation_scene_intake_request.v1` with the
  two canonical policy candidates, or returns typed blockers
  (`task_destination_pose_required`, stale consent, missing support).

Still open before rows 10–14 can close:

1. Astra lane step 9 must collect the Marble splat and collider exports and
   register them as owned intake bindings (`base_scene` input above).
2. A website source resolution in `task_evaluation_scene_source_resolver` that
   binds subject/support from this preparation instead of mesh object names,
   plus no-spend stage 1–2 producers for the website route (removal already
   happened before reconstruction; no collider prim to excise).
3. One paid Vast run of the six-stage recipe (Content Agents, static and native
   Isaac qualification, assembly) and the controls gate. Owner authorization is
   required; the allocator and `vast_api_key` are configured on this machine.
4. Browser readback of the configured-scene offering and one evaluation run.
   Supported evaluations today are the Franka DROID embodiment with
   `pi05_droid` and `groot_n17_droid`; a robot team's own checkpoint is not yet
   an Isaac candidate, so the library must not imply otherwise.
