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
| 2 | Browser original retained; MapAnything Apache estimates depth and cameras | Source digests unchanged; native depth output with provider identity and uncertainty | In progress |
| 3 | Continue with MapAnything estimated scale for this development test; retain measurement provenance | Native estimated geometry and registration, no promotion to measured scale | In progress |
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


2026-09-19 implementation continuation: owner selected MapAnything Apache.
Pipeline commits `3097c5868` and `b6e6a53c7` retain original-view geometry,
bind task-specific SAM3.1 masks, recover observed background, and submit only
prepared images to Marble while reusing its saved operation. `3e58f5114`
removes VIP from the website path and adds conditional Sunburst image fills
with exact preservation outside the hole mask, shared reference views, and a
required model visual review. 123 focused Pipeline tests passed. Native
MapAnything/SAM inference and image-edit/Marble provider execution are pending.
The local machine does not have the MapAnything package/checkpoint installed;
its free disk is about 8 GB and the upstream Apache checkpoint alone is 4.91 GB.
Do not substitute a synthetic geometry result for a worker inference run.

The stored website consent now travels in the raw manifest and the fresh signed
task snapshot; Pipeline replaces historical permissions with that current
snapshot before preparation. Missing, withdrawn, or unknown-version consent
cannot grant derivation, and scene-building consent does not grant data resale.
WebApp targeted rights/manifest tests: 22 pass, plus 24 existing capture-upload
tests. Final WebApp typecheck passed.
Graphify was attempted and remains unavailable because graphifyy is missing.

The first real Gemini 3.8 agentic call on the owner-provided walkthrough returned
an incomplete response. Its blocked plan is retained at
`output/website-task-pipeline/live-analysis/removal-plan.json` in the Pipeline
worktree. A bounded follow-up with low thinking and a larger output allowance also
returned incomplete. Provider readback identified TOO_MANY_TOOL_CALLS, including
a bounded-prompt attempt; a Files API attempt then exposed a local SDK argument
mismatch, which is fixed against the installed 2.24.0 signature. The live retry
is parked per the owner instruction to keep progressing on independent steps.
No reconstruction, simulator proof, or full website loop has completed yet.

Coordination: Fable committed the step 10-14 intake compiler in Pipeline
`efdf1733d` (`website_task_preparation.py`). Astra owns the clean-plate stage,
image completion, source geometry and task masks, task-context/rights handoff,
and `site_package_orchestrator.py`. Neither compiler tests nor a successful
provider preview alone close steps 10-14.


Owner steering: provider rate limits/failures are parked while independent code
and integration work continues. Do not retry a single provider in a serial loop.

Further integration: the website orchestrator now carries a finished Marble
world into `website_scene_handoff`, checking world identity and local asset
hashes before task preparation. Website downloads retain one splat and the
collider; repeat polls reuse verified files. Partial exports cannot claim
complete scene assets. The real compiler produces placement, authoring inputs,
and a thumbnail on hermetic source/collider fixtures. Coordinates now use the
same Y-up-to-Z-up and unit conversion as the simulator; absent physical scale
uses the MapAnything registration estimate. Input digests must still match.
Capture consent no longer fabricates execution consent, owner identity, provider
terms, or spending permission. Geometry compilation continues with execution
held until the existing authority is supplied.

Verification for this continuation: 16 handoff/compiler tests, 12 orchestrator
edge tests, 9 provider/download tests, and 15 Gemini request-contract tests pass;
changed-file Ruff and diff checks pass. These 52 checks are hermetic, not native
provider or simulator proof. The production scene-source resolver still needs
the website-specific path for a subject already removed before reconstruction;
the older completed-mesh path requires a source object prim to excise and cannot
be reused unmodified. No execution intent has been queued by this handoff.

Owner clarification: preparation decisions must depend on the task and observed
scene, not a universal object-removal, destination, CAD, or physics recipe.
Pipeline `59372c734` preserves quoted `on` versus `inside` placement intent
through analysis and masks. Existing surface placement now reuses the native
surface-target contract and scoring without creating a destination asset.
Container placement holds for interior geometry instead of changing the task to
placing on its top. WebApp preparation and offering schemas now share that
surface-target contract, including digest validation. 48 focused Pipeline tests
and 62 WebApp contract/route tests pass; WebApp typecheck passes. Graphify remains
unavailable (missing graphifyy); no install/debugging detour.

A later single Gemini Files API rerun, after the SDK call-shape fix, still
returned TOO_MANY_TOOL_CALLS. Result: Pipeline ignored output
`output/website-task-pipeline/live-analysis/removal-plan-file-fixed.json`.
It is parked again. No provider job from that attempt remains running.
The website-specific already-removed-subject construction adapter/source
resolver remains open; the existing completed-mesh path still expects a subject
prim. MapAnything also needs its actual worker run: this Mac has 16 GiB RAM and
7.8 GiB free disk, so downloading the 4.91 GB model here is not the deployment
path. These are incomplete requirements, not successful native tests.

Task-dependent placement now checks reconstructed triangles under the subject
and destination footprint instead of inventing a support area from the object's
dimensions. It retains the connected surface faces, uses the collider contact
height, and refuses unsupported edges, disconnected contact islands, remote
floors, and currently unbound distinct destination surfaces. The check is an
estimated nine-point footprint contact check, not physical proof or a substitute
for native controls. Verification: 26 focused support/compiler/handoff tests
pass; changed-file Ruff and diff checks pass. The source resolver and native
execution remain open; the 14-step end-to-end completion count is unchanged.

Pipeline `242d1973c` now feeds the collected website background into the existing
OpenUSD mesh normalizer during the handoff. It retains the real background prim
mapping, estimates metres in Z-up using the same transform as subject placement,
and keeps the original object image references separate. It does not invent a
subject prim to excise or reconstruct the scene again. A revised scale has a
separate conversion cache; mismatched task transforms and changed source bytes
are refused. Missing execution authority does not stop this CPU conversion, but
missing capture-processing rights does. Twenty-six focused tests pass, including
actual OpenUSD opening, static collision attributes, coordinate readback, and
handoff integration. This is native file-format verification, not Isaac proof.

The visual splat remains `awaiting_splat_frame_binding`. The local converter is
2.7.0 while the repository pins 3.2.0; a bounded install into task-owned scratch
failed with npm registry DNS `ENOTFOUND` and is parked. No live provider job is
running. Scene-source dispatch, object authoring, simulator controls, and the
robot-team website loop remain unfinished; no additional numbered requirement
is declared end-to-end complete.

Owner expansion: task objects may be newly created, including multiple package
variants. Pipeline `6f0c62d4e` adds generated-object specifications and batch
authoring through the existing Astra/CAD/Blender executor. Each object has its
own identity, dimensions, task purpose, geometry and appearance requirements;
variants name their reference object. Context images are not represented as
observations of a newly generated object. Physics measurements are not inherited
from the reference object, generated provenance reaches packaging, and new
objects still require native qualification. The batch shares one bounded
invoker and retains per-object success/failure so one failed object does not
discard siblings. This does not yet implement evaluation asset switching.

The website compiler now also supplies the confirmed task, operator answers,
destination, original-frame provenance and estimated dimension authority to the
existing Astra authoring request. Verification: 68 focused tests pass across
generation, Astra, packaging, and website preparation; Ruff and diff checks pass.
Both `codex/website-task-pipeline` work branches are now pushed. No merge,
deployment, generated-object live execution, or walkthrough end-to-end result
is claimed.


MapAnything worker handoff continuation: CPU frame preparation is now separate
from inference. The `website_scene_geometry prepare` command processed the
owner-selected walkthrough into 13 candidate views (294 by 518 model pixels),
retaining original pixels and excluding the three held-out frames from the
portable worker input directory. Input digest:
`sha256:ff03dc806695bcd33abb7d59151ec58b7554be7925a5ecad63e74577037b6ee5`.
The `infer` command consumes that directory on a model-equipped worker.
Returned geometry can move hosts and be consumed with
`BLUEPRINT_WEBSITE_GEOMETRY_RESULT`, without local model weights, after checking
the original video, input manifest, frame identities and all artifact hashes.
47 focused geometry, clean-plate and mask tests passed, including relocated
worker inputs/results and rejection of a different capture or measured-scale
claim. The real walkthrough has prepared frames, not inferred depth yet.
Worker installation/allocation and live inference remain open; the end-to-end
completion count stays 0/14. WebApp PR #622 checks are all green at this point;
neither draft PR has been merged or deployed.


## MapAnything Vast attempt and resumable objects (2026-09-19)

The owner explicitly authorized Vast. The first bounded MapAnything attempt
used the existing reconstruction GPU allocator, the pushed Pipeline commit
`f3df2ec9a39287a4deeaa3454c061c021f4469b9`, and the actual 13 walkthrough frames.
The sealed 41,086,688-byte input bundle included three exact worker wheels and
hashed dependencies, with pinned Apache model/configuration and DINOv2 source.
The limit was $2, a 3,300-second allocator TTL, a one-hour independent watchdog,
and zero automatic retries. The allocator dry run and execute admission passed.

Vast allocated instance `51631006`, but the provider subsequently reported
`stopped_before_start` (created container with current/intended state stopped).
The image loaded; no worker output or model inference was observed. The owning
allocator was interrupted so its `finally` block destroyed the instance. Both
teardown and provider-zero receipts passed; a fresh API read confirmed zero
active instances. Input/receipt transport objects were deleted with verified
cleanup. Local receipts remain under Pipeline
`output/website-task-pipeline/mapanything-vast-attempt-1/`.
This attempt does not close step 2 or step 3, and the fourteen-step walkthrough
still has **0/14 end-to-end verified**. The startup failure is retained rather
than silently retried.

The reconstruction executor now checks exact provider state when output is
missing and tears down after two consecutive confirmed terminal observations.
Failed status reads do not count as terminal. It also hands the allocated id to
the independent watchdog. Focused lifecycle and generation tests: 16 passed.

Generated-object batches now retain successful object results, verify their
request and artifact hashes on resume, and attempt only unfinished objects in
new immutable attempt directories. A rate-limited sibling cannot force an
already-finished object to be purchased again. Corrupt retained outputs hold
that object instead of silently regenerating it. This is hermetic verification;
no generated object or simulator qualification is claimed from these tests.

## Prepared background and separate object handoff (2026-09-19)

Pipeline commits `aff327e04` and `f5fed6871` connect the website preparation to
the installed native background adapters. The selected subject's masked depth
becomes a separate partial surface candidate, retaining the original source
images and estimated geometry provenance. The candidate contains only triangles
between adjacent valid masked pixels; it does not invent unseen back faces or
claim complete or qualified geometry. The existing Astra authoring reader now
accepts these website observations.

The background collision adapter preserves the normalized collider bytes. The
appearance adapter uses the existing ParticleField writer and places the splat
in the same estimated coordinate frame with a USD transform. Neither adapter
performs a second object removal. Portable observation references let a worker
consume the candidate and original images without paths on the control-plane
machine. A test copies the inputs to a different directory, deletes the source
directory, executes both installed background adapters, and passes their outputs
to the actual authoring-input reader.

Verification: the initial object handoff passed 51 focused tests plus 27 existing
runtime/configuration tests. The subsequent appearance and combined handoff
passed 59 focused tests; changed-file Ruff and diff checks passed. These checks
use local fixtures and real OpenUSD authoring, not live walkthrough inference or
Isaac rendering. Missing or unreadable splats remain pending while completed
collision/object preparation is retained.

Still open: full recipe/source dispatch and provider preflight integration,
successful real MapAnything and Gemini/SAM outputs, image completion and Marble
execution, native rendering and controls, and signed website publication and
robot evaluation readback. The 14-item walkthrough count remains **0/14
end-to-end verified**. Both Pipeline changes are pushed to the draft PR;
neither a merge nor a production deployment is claimed.

## Native worker transport and consent (2026-09-19)

Pipeline `27f8deac8` compiles all six existing construction stages from website
preparation and carries the captured object derivatives through source preflight,
bundle creation, relocation, provider preflight and worker hydration. The archive
test deletes the original control directory, executes the first two installed
adapters and reads their outputs with the actual authoring reader. The third
through sixth stages were not executed. Verification: 68 focused tests and three
existing bundle compatibility checks passed.

Pipeline `766d717d2` creates the disclosure admission from the bound website task
context and recorded owner consent, validates current execution authority and
rejects expired, altered or incomplete authority. The worker binds that admission
back to the same preparation. A later handoff error preserves finished CPU
outputs. Verification: 19 focused tests passed. Automatic source resolution,
submission and queue dispatch still need to be connected; these commits do not
establish a live automatic path.

The configured Gemini environment variables and local secret match. A read-only
request with that key successfully retrieved `models/gemini-3.8-flash`; this does
not verify the billing account balance. The retained failed video request reports
`TOO_MANY_TOOL_CALLS`, not an authentication or credit failure. Pipeline `21b7a2509`
uses Google's documented Interactions agentic-video interface with response storage
disabled and requires paired processing-call/result evidence. Its 41 focused
provider and clean-plate tests passed. Live walkthrough completion remains unproven.

The real Interactions attempt also hit tool-call exhaustion: Google returned
HTTP 400, `Model generated too many tool calls`. Further retries are parked.
Pipeline `b54c2e7d5` preserves that specific blocker rather than classifying it as
a generic provider error; 18 provider-contract tests passed. No usable video
analysis or billing-balance readback is claimed.

The WebApp preparation validator now accepts the same immutable website runtime,
appearance, observation, candidate and frame references as Pipeline. Six focused
contract tests and `npm run check` passed; the required graphify refresh completed.
This closes request-shape compatibility, not the remaining automatic producer and
dispatch connection. The real walkthrough count remains **0/14 end-to-end verified**.

## Website construction queue handoff (2026-09-19)

Pipeline `e80c0eaa5` connects registered website preparation to the existing
scene-intent progression worker, derivative publication, preparation queue and
construction queue. It reopens the authenticated owner intent, retains estimated
geometry, uses the existing six stages and does not remove the subject twice.
Replays produce one queue entry and no paid preparation reservation. Generated
colliders no longer claim an owner-declared common coordinate frame.

The integration test runs the real publisher and queue consumer with an in-memory
object store and real local OpenUSD fixtures. It exposed and fixed two actual
worker mismatches: missing immutable stage references and the request's nested
run identifier. All 90 affected tests passed; changed-file Ruff and diff checks
passed. The website execution-authority producer and live provider runs remain
open. This is code-path verification; the walkthrough remains **0/14 end-to-end
verified**.
