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
| 1 | Confirm task, work region, success criteria before reconstruction | Browser submission and immutable confirmed task consumed by Pipeline | Live website-origin verified (confirmed task digest `fdfae972b0c607fd7289150d761f62bdfb5077cc296c9752cfb36c1e8b775930`) |
| 2 | Browser original retained; MapAnything Apache estimates depth and cameras | Source digests unchanged; native depth output with provider identity and uncertainty | Live website-origin verified: actual MapAnything Apache GPU output for 14 views; source image and geometry digests validated |
| 3 | Continue with MapAnything estimated scale for this development test; retain measurement provenance | Native estimated geometry and registration, no promotion to measured scale | Live website-origin verified: estimated geometry registered to Marble; scale ratio to provider declaration 1.008, physical scale and registration remain unproven |
| 4 | Reusable Gemini 3.8 task/coverage/object analysis; static up to five minutes, agentic above five minutes | Retained actual processing mode, validated task-bound output, source digest; paired navigation trace for agentic mode | Live website-origin verified: Gemini 3.8 Flash, static 2 FPS, 13.525-second original, task-bound validated output; prior failed agentic receipt retained |
| 5 | SAM3.1 tracks selected objects and people | Actual tracker outputs for retained frames, masks and identity bindings | Live website-origin verified: blue track has 11 observations (frames 244–254); deferred kept white support resolved from a grounded source-image mask; full target manifest completed |
| 6 | Task-dependent keep/collider/replace decisions before reconstruction | Confirmed plan distinguishing fixed supports from movable assets | Live website-origin decision verified: remove the blue task object and keep unrelated/support objects; latest plan uses the white support as destination. Geometry/contact validation remains in steps 11–12 |
| 7 | Original views, cameras, depth and placement preserved | Read-only source evidence and reusable placement references; no mandatory second world | Live website-origin verified: 14 digest-checked original/model views, depth arrays, intrinsics, camera transforms, and task-mask geometry bindings retained |
| 8 | Direct task-object removal in original-resolution frames with GPT Image; no depth-based pixel recovery or VIP | Real edited views, original/edited comparison, cross-view checks and residual-person checks | Live website-origin verified: two original-resolution edits; complete eight-view background, cross-view, removal and privacy review passed |
| 9 | One owner submits prepared views to the admitted reconstruction provider and collects completion | Actual Marble request, operation receipt, terminal assets; capability/readiness errors visible; Atlas remains capability-gated | Live website-origin verified: eight-view Marble operation completed; collider and full-resolution splat downloaded with digests |
| 10 | Reuse CAD, then parameterized geometry, then bounded agent authoring | Real exports with source, dimensions, kernel/tool version and deterministic validators | Live website-origin controller authoring verified on `3141d2f3`: CPU stages 1–4 completed before GPU rental; exported replacement USDZ and static qualification published. Dimensions remain estimates. |
| 11 | Register base to original references and compose independent assets | Multi-view pose checks, contacts, no duplicate baked objects | Pending by explicit owner decision: Marble collider lacks support beneath the registered object. No contact tolerance was relaxed or support fabricated. Development-surface assembly is separate evidence. |
| 12 | Task-relevant physics with uncertainty and measurement escalation | Sensitivity checks and measured/estimated provenance | Partially verified: Isaac 6.0.1 imported the authored asset and passed three 180-step contact/settle/reset repeats on the development surface. Full grasp/physics sensitivity and captured-room integration remain open. |
| 13 | Real simulator loads, steps, controls, observes, resets and scores | Native preflight and positive/negative controls, media and receipts | Unproven for robot episodes: native asset import is verified, but the selected Franka/two-policy evaluation has not produced episode/scoring receipts yet. |
| 14 | Signed publication of task, thumbnail and supported robot evaluations | Website browser readback plus actual compatible robot-team run and result | Partially verified: signed task/thumbnail offering and one-page $25/no-charge development UI are live; a real browser-origin selected evaluation is admitted. Actual robot result delivery remains open. |

## Execution constraints

- Preserve dirty primary checkouts; implementation lives in sibling worktrees
  named `website-task-pipeline` on `codex/website-task-pipeline`.
- Reuse existing admission, allocator, immutable requests, callbacks and result
  delivery. Do not add a competing queue, datastore or reconstruction owner.
- Completion requires the deployed controller to run the website-origin stages
  hands off on merged main. Manual component launches, local asset handoffs and
  branch-only fixes do not satisfy this requirement. Encode any missing
  transition or recovery in the existing controller before retrying that stage.
- Keep originals distinct from generated repair, depth estimates and simulation.
- Owner explicitly authorized Marble on 2026-09-19 because Atlas access is not
  available. Final reconstruction proof uses Marble; do not claim Atlas tested.
- Paid runs use the existing bounded resource admission and teardown controls.
- App Clip, duplicate full reconstructions, DA3, premium exports and custom CAD
  are conditional, not mandatory dependencies when existing inputs suffice.
- VIP must be absent from the new website path. Legacy receipts remain readable.
- Blueprint funds capped scene preparation; a robot-team purchase is not its
  authorization gate. Capture consent remains separate from Blueprint spending.

### Website preparation sponsorship

`BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON` configures the Blueprint service
owner (`user_id`, `organization_id`), `max_total_spend_usd`, disjoint
`upstream_max_spend_usd` and `native_max_spend_usd` allowances,
`max_paid_attempts`, `ttl_seconds` (at most one day), and
`provider_terms_reference`. The two allowances cannot exceed the total.
This is server configuration, never an upload form field. Missing configuration
holds automatic preparation; it does not request payment from the site owner.

The signed `scene-sponsorship` endpoint retains one grant on the existing
inbound request, bound to the current confirmed task and recorded capture
consent. Replays preserve its budget and expiry. Pipeline keeps this private
control record separate from the task context sent to models. Once the prepared
source is registered, its `prepared-scene` callback records the exact request
in the existing scene-intake outbox. That worker rechecks sponsorship and
provider terms, then uses the existing authenticated Pipeline intake and
reservation machinery. No local registration pretends to authenticate a caller.
Withdrawal of site consent revokes future execution while retaining result
closeout for work already started.

The native allowance is passed to that existing reservation machinery. The upstream allowance is reserved within the total policy. Image editing,
Marble and MapAnything now have controller admission connections; each still
requires its existing paid-resource checks and deployment configuration.
The approved development run retains its existing scoped allocator authority.

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

### First visual scene and hosted SAM (September 19)

The owner can now claim the site as soon as the reconstruction is viewable,
with “Save your scene and follow progress.” Pipeline publishes the completed
World Labs viewer and thumbnail through a signed `visual-scene` callback before
asset downloads or native construction. WebApp rechecks the confirmed task and
current capture consent. This milestone does not set simulation or evaluation
readiness. Focused WebApp coverage: 15 tests, typecheck clean; graphify refreshed.

Website SAM now prefers the Meta Model API (`sam-3.1`). Credentials resolve from
`META_MODEL_API_KEY`, the canonical `META_MODEL_API_KEY_FILE` override, the
configured provider secrets directory, or `~/.blueprint-secrets/meta_model_api_key`.
The official CPU-only mask parser is pinned. Requests retain source-frame
identity, require bound spend/disclosure admission, and do not automatically
repeat a submission with an uncertain outcome. Explicit `BLUEPRINT_WEBSITE_SAM31_PROVIDER=local`
retains the prior GPU profile path; provider failures never silently switch lanes.

The supplied Meta key completed real video and image requests. They returned no
matches for the selected blue-container prompt, so usable task masks remain
unverified. Video responses reported 50 processed frames even for short retained
clips; the adapter conservatively reserves at least 50 frames per request and
checks reported usage. Pricing reference: https://dev.meta.ai/docs/pricing-rate-limits#sam-pricing.
No measured Meta latency or mask-quality claim is made.

The MapAnything GPU run reached inference and exposed an adapter bug: requesting
`apply_mask=False` omits the mask field that the geometry writer requires. It now
requests the upstream validity mask, with 22 focused geometry/worker tests passing.
The failed instance was terminated and the provider confirmed zero resources
before the corrected run. Runtime completion remains separately verified.


Hosted SAM now consumes the Blueprint upstream allowance through the signed
`preparation-spend` route and a transaction on the existing inbound request.
Only the first reservation can dispatch; another worker receives
`already_reserved`, so a missing local cache cannot cause a duplicate charge.
Completed local responses can be reused without another reservation. Unknown
submission outcomes stay held for reconciliation. Current capture consent,
task digest, expiry and configured Meta provider terms are rechecked. The
`meta` entry in `TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON` must match the
sponsorship policy's terms digest. No production configuration was changed.

The corrected MapAnything run is now **live verified** for the 13 retained
walkthrough frames. Run `mapanything-vast-attempt-7` completed in 367 seconds,
recorded $0.1066, retrieved output before teardown and verified provider zero.
The production geometry reader checked the saved input/output hashes, frame
mapping and depth/camera artifacts. Scale remains model-estimated, not measured.
Evidence: Pipeline `output/website-task-pipeline/mapanything-vast-attempt-7/geometry-readback.json`
and `adapter-result.json`. This closes the inference/transport check, not the
full website-to-evaluation loop.

The continuous-video Meta SAM test also completed: all 406 decoded frames were
processed, with the selected blue object tracked in 83 frames and matched to
two retained MapAnything views (5.4 and 8.1 seconds). The spatial selector kept
the separate blue bag out of the task mask. The anchor was an analyst's visual
observation, not a successful Gemini result. Source-to-geometry binding retains
estimated scale. At Meta's published rate, this request represents $0.0812 of
segmentation usage; that is a rate calculation, not an invoice readback.
The uploaded provider file was deleted successfully.

Pipeline `0d0a79636` sends the continuous upright video through Meta's Files API,
preserves frame timestamps, and selects geometry views only after tracking.
Earlier sparse clips missed this object; full-resolution still segmentation
worked but did not establish video tracking. The inline full-video attempt
returned HTTP 413 before the successful file-upload path. Focused tests: 44
passed. Evidence lives under Pipeline
`output/website-task-pipeline/meta-sam31-uploaded-video-live/`, including
`geometry-binding.json`, the provider response and `video-cleanup.json`.
Neither the remaining Gemini analysis nor Marble/native evaluation is claimed
complete, and these changes are still on the draft PRs.

Owner clarification: step 8 is direct removal of the task objects before Marble,
not a separate background-recovery algorithm. Pipeline `fef88c658` removes that
algorithm from the website path, retains full-resolution source masks and images,
and gives the image editor the actual target descriptions plus another view as
reference. Multiple selected object masks are combined; unrelated objects remain
outside the editable region. Same-category targets share one SAM concept request.
Focused coverage verifies multi-object selection, mask union, original-pixel
preservation, provider replay and review; 46 tests passed across those seams.
The earlier low-resolution repairs were rejected by visual review and are not
accepted reconstruction inputs.

Pipeline `53a636b34` fixes the hard edit boundary with a resolution-scaled object
margin and blending inside that mask. The two original-resolution walkthrough
views now pass Gemini's image review: object removed, consistent background,
surrounding objects preserved, and no people. The white container and framed
picture remain. Actual returned image usage totals $0.133374 for the successful
pair. Evidence: Pipeline `output/website-task-pipeline/direct-object-edit-feathered-live/`
(`completed-frames.json`, provider receipts, and the passed review). These are
development component inputs, not proof of an actual website-triggered run.

The canonical `paid_resource_allocator provider-reconstruction` command now
supports `--provider world_labs` with a prepared website descriptor and capture
root. It checks immutable source identity, the bound grant, image hashes,
task/privacy preparation, disclosure authority, and the full $2.48 maximum
Marble 1.1 Plus multi-image generation cost before submission. The existing
adapter retains one operation and refuses an uncertain duplicate purchase.
Focused World Labs and Teleport coverage passes (32 tests); the shared admission
tests also pass (11). No HQ mesh export is requested.

The real World Labs key authenticated successfully, but its API balance returned
`remaining_credits: 0.0`. The reviewed frames are staged under Pipeline
`output/website-task-pipeline/marble-prepared-views-live/`; no Marble generation
has been purchased. API credits are separate from Marble website credits.
Multi-object selection and removal are covered by focused tests; the live
walkthrough still verifies one selected object. Agentic Gemini, actual Marble
completion, native simulation and website result publication remained open at that check.

After the owner added API credits, the canonical allocator submitted the reviewed
pair once. Marble operation `efcc90c5-6f54-40fd-8615-45847ed81a02` completed with
world `028824aa-764c-4c2a-9baf-dab855efae6a`. Provider-settled cost: 1,600 credits
($1.28). The collider GLB (5,880,188 bytes) and full-resolution SPZ (30,039,497
bytes) were downloaded through the existing materializer, with no HQ mesh purchase.
Evidence: `marble-prepared-views-live/marble-terminal.json`, `asset-collection.json`
and the materializer's file hashes. This proves visual construction and retained
assets, not simulation, physical accuracy, or a website-triggered run.

Owner-directed harness rule: fill the selected provider/model's configured,
verified image allowance, including wider context even when the task is out of
view. This is not a global eight- or 100-frame cap: future Atlas capabilities may
be 100+. Pipeline reads `BLUEPRINT_WEBSITE_RECONSTRUCTION_PROFILE_JSON` with
`provider`, `model`, and `max_input_images`; its current Marble profile supplies
eight. Unknown selected models require an explicit matching profile. The current
Marble adapter still enforces its own supported API contract; this does not claim
Atlas access or an implemented unpublished Atlas API.

The selector retains task anchors, ranks additional frames by clarity
and temporal separation, skips byte-identical duplicates, and uses all available
distinct frames when there are fewer than the configured allowance. Only selected task regions are
edited. The rule is also in Pipeline's nested `AGENTS.md`. The walkthrough now
has an eight-view candidate set: the two accepted edits plus six unchanged context
frames, without another SAM or image-generation purchase. The first completed
Marble world still used two images; the eight-view set has not been submitted.
The complete eight-view candidate set passed the image review. Context decoding
is independent of the smaller MapAnything batch, and full-video source masks are
retained for those additional frames. Selection tests exercise 8- and 128-frame
profiles and fewer available frames. Focused preparation, mask, image completion,
and Marble coverage passes; no new world has been purchased for the expanded set.

The owner-requested eight-view reconstruction subsequently completed: operation
`ba93dd50-73b2-429c-baea-d74b866d34e3`, world
`b917976e-d2c1-4d4f-b690-3afc630af1df`, provider-settled cost 1,600 credits
($1.28). The existing materializer retained the collider and full-resolution
splat with zero download failures. Evidence is under Pipeline
`output/website-task-pipeline/marble-eight-view-live/` (`marble-terminal.json`,
`asset-collection.json`, and the referenced materialized asset manifest).

Real registration replay still refuses this world with
`website_registration_ambiguous`; no task placement or native evaluation is
claimed. The replay exposed two implementation issues: registration only tried
axis permutations, and the handoff assumed World Labs GLBs were Y-up. The
registration now includes principal-axis orientation seeds and bounded trimmed
similarity refinement while preserving the fit and ambiguity refusals. World
Labs documents OpenCV Y-down exports, so the website path now carries `-Y`
through support probes, object observations, collision normalization and splat
conversion. The actual eight-view collider was converted to Z-up USD with its
provider-estimated scale, preserving source bytes; this is a format/coordinate
check, not source-to-world registration or simulator proof. Its receipt is
`marble-eight-view-live/native-coordinate-check/mesh_normalization.v1.json`.
Pipeline commit `32eba106e` contains those fixes. Verification: 52 focused tests
passed across preparation, runtime inputs, appearance, handoff, support geometry
and mesh inspection; the additional noisy arbitrary-orientation regression and
its exact counterpart both passed; two shared mesh-normalization checks passed.
Changed-file lint and diff checks passed. These checks do not close the live
registration refusal.

The panorama/source feature check found limited correspondences (20 in the first
low-resolution geometry frame and 0–3 in each remaining frame), which does not
establish a reliable multi-view pose. The retained panorama remains a visual
result only. No further reconstruction purchase or GPU allocation was made.


### Controller ownership correction

Owner clarified that the end-to-end demonstration must be controller-driven,
with the fixes merged to main, rather than Codex manually filling stage gaps.
The existing two-view/eight-view Marble runs and standalone CAD attempt remain
component evidence only. They do not close any website-origin acceptance row.

Image preparation now obtains its exact OpenAI image-edit grant through the
same signed WebApp preparation-spend endpoint and Blueprint upstream cap used
by hosted SAM. Provider/resource pairs and current provider terms are checked.
Completed frame receipts can be reused on a controller restart without a new
key or grant; uncertain calls and already-reserved work on another worker do
not authorize another purchase. The existing clean-plate stage supplies the
confirmed task context, so no manually supplied image admission is necessary.
Focused checks: 43 Pipeline tests and 31 WebApp intake tests pass. These are
hermetic checks, not live controller proof. MapAnything/Marble admission,
controller recovery, deployment and the full website-origin run remain open.


The preview controller now sends website reconstruction through the canonical
paid allocator. Before a fresh Marble request it checks the admitted main release,
reserves the exact prepared-view request against the same sponsorship cap,
checks configured World Labs terms, and passes the issued grant to the existing
provider adapter. Restarting a retained operation performs no new purchase;
unknown submission outcomes remain held for reconciliation. Focused tests cover
this automatic entry and the refusal to allocate from unmerged code. This closes
the code connection for Marble admission, not the live website-origin run.

The standalone CAD attempt stopped at `cad_geometry_or_upstream_qa_failed`.
Its five model reservations are terminal, with no unknown in-flight calls;
the budget manifest reports $1.266402 reserved/settled accounting. No CAD
completion or hands-off controller proof is claimed, and no manual retry was
launched after the controller-ownership correction.


### MapAnything controller handoff and first merge

WebApp PR #622 merged to main as `059d26fbee9fa59934355995d04ba2280028db12`
with all five CI jobs passing. This establishes the code merge; Render release
identity and hands-off execution are separate checks.

The geometry stage now routes confirmed website tasks through the canonical
allocator rather than relying on a manually provided result path. A service
runtime profile binds the deployed release, container and four hashed runtime
files. The existing worker owns execution/retrieval/teardown; the controller
reserves the same Blueprint upstream allowance, arms the existing exact-name
watchdog, and preserves uncertain allocations rather than renting again.
Completed source-bound outputs replay without provider calls. The legacy local
component path remains available only without a website task context.

Focused Pipeline verification: 59 tests passed. WebApp: 33 intake tests and
TypeScript check passed. Runtime profile deployment and a controller-origin
MapAnything run remain open, as do CAD recovery and the full fourteen-step
website/evaluation demonstration.

## Fable lane offline replays and fixes for steps 10–14 (2026-09-19)

Worktree `claude/website-steps-10-14` in BlueprintCapturePipeline, branched
from main `5624bdd9`. Everything below is offline and deterministic: no
provider call, no GPU, no controller-origin proof. Retained outputs live under
that worktree's `output/website-task-pipeline/` and are not part of any
website run.

Step 11, registration. The unconstrained 24-rotation similarity fit of the
MapAnything estimate against the generative Marble collider was ambiguous on
the retained walkthrough. Marble's terminal response declares an estimated
metric factor (1.4772) and ground plane offset (1.6066 m) and generates the
world from the prepared views in submission order, so the first view's camera
anchors the pose. `website_scene_handoff` now carries those declarations into
`base_scene` (`scale_authority: provider_declared_estimate`), and
`register_source_to_runtime` refines that prior over four roll candidates,
reports rotation/translation/scale deviation from it, checks the declared
ground plane against the estimated floor, refuses a world whose unconstrained
fit is materially better elsewhere, and reports a task-region residual as
`placement_uncertainty_m`. Retained replay (`registration-anchor-replay/`):
0.31 m global trimmed RMSE, 18.8° from the prior, scale ratio 1.077, ground
residual 0.22 m, task-region residual 0.39 m, runner-up ratio 1.69. Still an
estimate; `physical_registration_proven` stays false.

Step 10, CAD. The retained attempt-2 program was replayed through the pinned
text-to-cad `step` CLI at `4fd71ea7`. It fails before any export for two
contract reasons: `gen_step` returns a dictionary, and its self-written
validation calls `Shell.is_closed`, which does not exist in build123d 0.11.1.
The current `_CAD_PROGRAM_CONTRACT` forbids both. A contract-conforming
program with the same nominal envelope returns a Shape only and passes the
CLI and the production readback exactly (282.379 × 126.343 × 64.178 mm, one
solid). Receipt: `cad-contract-replay/receipt.json`. The controller-origin
authoring run, Content Agents review and SimReady qualification remain
unproven.

Step 12, physics. The preparation's estimated mass/friction ranges,
grasp-hold sensitivity against the Robotiq 2F-85 reference, measurement
escalation, `feasibility_claim_allowed`, placement uncertainty and scale
authority now travel in the submitted task definition
(`configuration/task.json`) so a result can abstain where the estimate cannot
carry a claim.

Step 14, dispatch. `agent_run_executor` accepts `--capture-partition-root`
and resolves each admitted run's capture from its canonical request, refusing
roots outside the partition, roots that are not a real
`scenes/<scene>/captures/<id>` directory, or ids that differ from the admitted
binding. The systemd unit and env example expose
`BLUEPRINT_AGENT_RUN_CAPTURE_PARTITION_ROOT`; single-capture scope is
unchanged. This removes the per-capture reconfiguration the timer needed, but
the timer still has to be enabled and configured on the host.

Step 13 has no offline change. Native import, controls and the two frozen
policy candidates require the paid Vast run that Astra coordinates.


### Actual website-origin controller run — 2026-09-19 CDT

The account-free website upload and confirmed brief are now consumed by the
deployed controller for capture
`walkthrough-capture-ae539f2c-f6aa-4cbd-9f99-3ed72017791e` and scene
`site-capture-ae539f2c-f6aa-4cbd-9f99-3ed72017791e`. The original video digest is
unchanged, and 68 extracted frames were staged. The confirmed task is moving
the small blue rigid container to a clear nearby position on the same support;
unrelated objects stay. Step 1 is proven through this website-origin path.

This run reached step 4. Its Gemini agentic attempt returned
`gemini_clean_plate_analysis_incomplete_too_many_tool_calls`. It has not yet
produced SAM masks, edited frames, a reconstructed world, CAD, or native
simulation. Earlier component receipts above remain component evidence.

Merged Pipeline #1990 fixes the fresh sponsorship timing comparison and the
incorrect successful job receipt after required-lane failure. Recovery of that
specific old failed completion is encoded in the listener; normal completed
jobs remain idempotent. Merged #1991 implements the owner-approved static
single-pass mode at 2 FPS for clips up to five minutes, with unchanged evidence
validation and conservative bounded spend. Both fixes are being deployed
before resuming the same capture. Tests do not establish live stage completion.

Pipeline #1988's anchored registration and partition dispatch are already in
the active release `091933c49d88e99a5a29bdca20a3b249edd3be79`. The dispatcher
uses the website capture partition, its timer is enabled, and both required
Firestore queue indexes are READY. The empty queue read succeeds; this does
not establish a robot-team evaluation or result delivery.

## Website-origin Gemini and retry evidence (2026-09-19 local)

For capture `walkthrough-capture-ae539f2c-f6aa-4cbd-9f99-3ed72017791e`,
controller attempt 12 on deployed Pipeline `b74be93f3ba51e772b0c929bacae9a7b7b4e47fd`
completed static Gemini analysis. The retained result is
`pipeline/clean_plate/gemini_analysis/b6de2dd45be4bdc740eaab3f805cc144bf1ca1d827a14e02e9c4d9a0cd118696.json`.
It records 2 FPS, 13.525 seconds, 3,331 prompt tokens and 788 completion tokens.
The validated targets distinguish `small_blue_container` (task object, remove),
`white_support_container` (support, keep), and `dresser_support_surface`
(destination, keep, placement relation `on`). The original task and source
identities above are unchanged. This is development evidence, not measured
geometry or physical robot proof.

The next stage timed out during CPU video conversion before calling Meta SAM.
Pipeline #1993 fixes conversion and validated artifact reuse; its exact-source,
zero-provider host replay preserved all 406 frames and timestamps, completed in
73.62 seconds, and reused the result in 0.18 seconds. Attempt 13 then exposed a
separate handoff-redelivery bug: original cloud metadata replaced derived local
metadata while the materialization stage was skipped. Pipeline #1994 rebuilds
those cheap local records on retry while retaining completed provider stages.
Both fixes are merged; their combined deployment is in progress. No
website-origin SAM, edited-frame, Marble or native-evaluation completion is
claimed by this update.


## Website-origin tracking and exact-frame recovery (2026-09-20 UTC)

The same website capture reached Meta SAM3.1. Both latest concept requests
(`blue container`, `white container`) processed all 406 frames of the 13.525-second
video. These are whole-video API calls; local CPU work prepares video and decodes
returned masks, rather than running a second SAM model. The latest blue track
contains frames 244–254. The controller stopped with
`task_target_track_ambiguous:blue_container` because the coarse Gemini video
boxes do not match those moving-camera frames closely enough.

Pipeline PR #1997 (`6b8a4ed6d6583cd69377efd80964abd2c257382d`) is merged and deployed.
It adds one budgeted, retained exact-frame grounding step on ambiguous matching,
one evidence-derived concept refinement if necessary, decoded-mask reuse, and
task-visible reconstruction frames. PR #1998
(`584f624adeb952b2d7e70c8b8c4179dc42081a1f`) is merged and deploying. It preserves an
observed task frame in the bounded geometry batch when uniform sampling misses
the target. Its isolated retained-input replay added frame 254 to the 13-view
batch, yielding 14 views without provider calls or production output injection.

Three acceptance rows are website-origin verified: 1, 4, 6. Row 5 is not closed by
receiving API responses alone. The current execution order defers geometry and
scale (rows 2–3) until the first visual reconstruction, so row numbers are not a
linear completed-stage count. Website-origin edited views, Marble completion,
CAD, native evaluation, and robot-team result delivery remain unproven. The
controller owns the next attempts after deployment; all evidence remains
`development_only`.

## Website-origin frame edits and current request guard (2026-09-20 UTC)

On deployed Pipeline `f9afed3bbe0975865de397e798d81aaeb2f55b49` (PR #2001),
the controller selected `meta-sam31-blue_container-0`, retaining its 11 observed
frames (244–254), and produced `task_masks.object_removal.json` with status
`object_removal_ready`. The kept white support is explicitly deferred. It was
not silently assigned an unrelated mask: whole-video and source-image SAM
attempts did not identify the intended support. PRs #1999 and #2000 retain
those failures and the exact-frame observations.

Visual preparation can proceed because the kept support is not edited. After
Marble returns its assets, the controller must resolve the complete target set
before geometry and simulation. Both geometry binding and simulation preparation
reject a mask manifest with deferred targets. This changes execution order,
not the fourteen-item acceptance scope or the simulator-readiness boundary.

The controller then completed edits for source frames 244 and 254. Retained
receipts are `pipeline/clean_plate/image_completion/`
`90fbc02f8d703da4cc20e676bac42ed1fa6d8cf38450eb43fb8ff1a3335d5511/4.json`
and `5.json`, each with status `completed` and a digest-bound PNG. Original
frames remain in `object_removal_frames/000007.png` and `000008.png`. These
are website-origin controller outputs, not manually supplied component assets.

The subsequent background-review authorization was refused before Gemini was
called. Read-only inspection of the owning WebApp record confirms 16 of 16
requests reserved and $2.3097 reserved against the $5 preparation cap; the grant
has not expired. The $20 native allowance is separate. Owner authorization to
extend only this scene's preparation request limit to 32 has been requested;
no allowance has been raised and no new paid work is authorized by this note.

Rows 1, 4, and 6 remain the three completed website-origin acceptance rows.
Row 8 now has actual edited views but cannot close until its automated review
passes. Marble, full support geometry, CAD, native evaluation, and robot-team
result delivery remain unverified for this website-origin run.


## Website-origin visual world completed (2026-09-20 13:22 UTC)

On Pipeline main `885ff959171f6821e4e7d775462e083087e7d738`, the controller
completed World Labs operation `ae543721-6331-48b3-b400-97ca0f6b1cc5` and retained
world `48c4f4de-c9f6-426b-a81f-3a713fb24af7`. It submitted eight prepared views,
reusing the two completed edits, after the complete view set passed Gemini
review. The asset materialization receipt is complete with no blockers and
contains the collider GLB and full-resolution SPZ, each verified by digest.
The provider reported 1,600 credits ($1.28), below its $2.48 reservation.

The controller also resolved the deferred white support using grounded
source-image segmentation. The complete task mask manifest has 11 blue-object
observations and one white-support observation. This proves selected identity
and masks, not physical dimensions or contacts.

Six acceptance rows are now website-origin verified: 1, 4, 5, 6, 8, 9.
Rows 2, 3, 7, 10–14 remain open. The current handoff correctly stops at
`website_mapanything_runtime_profile_missing`; the capture worker was not
loading the deployed scene-runtime environment file. The next correction wires
that file into its service and reconciles terminal Marble billing through the
signed WebApp endpoint before geometry allocation. Neither the $5 preparation
cap nor the $20 simulation cap changes. The owner-approved request-only
amendment to 32 is already live. No simulation or robot-team result is claimed.

## Website-origin estimated geometry completed (2026-09-20 UTC)

Pipeline main `cf7d618d15cc0cd4ba771509ca75aab1c3b8d62f` ran the existing
website capture through controller-owned MapAnything dispatch. Vast instance
`51770652` completed on an A100 SXM4. The controller validated the 46,169,828-byte
output bundle, retained 14 frames of depth, confidence, validity masks, intrinsics
and camera poses, terminated the instance, and verified provider absence. The
execution receipt reports 279.29 seconds and an estimated $0.0775 runtime cost;
model execution itself reports 41.35 seconds. This is not an invoice claim.

All 14 source/model image and geometry-file digests were independently checked.
Every frame has finite camera matrices; the minimum valid-depth fraction is
0.9009. The original video binding remains
`037df5b58150ff4e00b90eaecd4cc0f883722432f5045a916c2a1a30be47295d`.
Output explicitly declares `estimated_meters`, `model_estimated`,
`metric_measurement_proven: false`, and `physical_evidence: false`.

The subsequent controller registration completed with 0.195 m global trimmed
residual, 0.305 m task-region residual, scale ratio 1.008 to Marble's declaration,
and 0.0105 m ground-plane residual. Placement uncertainty remains in the prepared
task. Source mask geometry was rebound to these retained outputs. These receipts
close rows 2, 3 and 7: nine of fourteen acceptance rows are now website-origin
verified.

Scene preparation then stopped at `support_surface_not_found_under_subject`.
The generated collider did not satisfy the existing support-contact query at
the registered blue object's bounds. No support was fabricated, no CAD or native
evaluation completion is claimed, and rows 10–14 remain open. The completed GPU
attempt must be replayed from retained output rather than rented again while
this CPU preparation boundary is corrected.

## Owner-authorized component continuation — 2026-09-20

Step 11 stays pending: no Marble contact tolerance or support repair is added.
The controller can explicitly admit this task to a separate authored-surface
component test for steps 10, 12, 13 and 14. It preserves source dimensions and
frames, uses the existing CAD/Blender, native qualification, controls and signed
result path, and leaves the original captured-scene refusal intact. The exact
context-digest allowlist must be configured on both services; failure alone
never selects this mode. It reuses the same native sponsorship/submission, so
it cannot silently create a second $20 allowance.

Development offerings/results are labeled as authored-surface tests and remain
private. The captured room cannot become evaluation-ready from this test.
Host replay of retained inputs passed without network/provider access and was
idempotent; this is CPU preparation evidence only. No new live completion row
is closed by the implementation or mocked controller tests.

## Controller-origin authoring and native import verified — 2026-09-21

The website source launch `website-9dda3f7d61e9494954da50c0-3141d2f3-20260921t084408z-activation-auto-launch` is completed on Pipeline `3141d2f38a4878fbde2e08d944c27ab51031dd01`. Its retained launch receipt is `sha256:d82058f33261d93004c4ac12f6c5efc006e1854703b4fc4026d9ceb314025990`; allocator terminal result is `sha256:afab3b1a63340d79bb236d40752a134162a14459caf6c6605a9b23e9752d11f1`. CPU prestage receipt `sha256:bbf4e7b4fa4c690c92e076a943a13b7b5772c81640eb7c9cf2278255baffa440` records stages 1–4 completed before GPU allocation.

The published replacement USDZ has digest `sha256:930fa4aaae2e5db6b8e79951badc7d55615fe9a278755e20b0a04d932ac84537`. Native import qualification bytes have digest `sha256:9d21a45699503ae3010e1912e363462d17481f8b3267b9b9582848e8f4117410`. Reinspection of those exact bytes confirms Isaac 6.0.1, three 180-step repeats, support contacts in every repeat, matching reset-state digests and maximum settling translation 0.0000275364 m. The receipt explicitly says `evaluation_episode_executed: false` and `physical_equivalence_claimed: false`.

Website publication succeeded and the source provider was removed, with authoritative post-teardown provider-zero digest `sha256:39760d66f3c99b3dcd850768ff7f255e68bfc0d7b67183cd87f0d48f2700f883`.

These receipts close asset authoring (row 10), not the remaining robot evaluation. Captured-room placement (row 11) stays pending by owner instruction; the authored development surface cannot promote the room to evaluation-ready.

The original browser-selected evaluation is `team-eval-5aea93d1-ab8a-4fe5-995a-48a0a22f90bb`, intake `scene-1c89ff7100e5a862611ea0b9191d1dbd52e0fedd7beb2b1b85d7d54e69b2cf85`. It reuses the published scene with separate team-selected robot/policies and existing bounded authority. No duplicate request is needed. At this audit it has CPU placement candidates but no policy episodes or final result. Pipeline #2073 repairs an explicit credential renewal binding and moves static checks before geometry; merged/deployed fixes alone do not close rows 13–14.

The simple setup registration from WebApp #650/#651 is live on `e9ee53b4b30b49c45ac3f2d724349e843bbf1804`. Physical URDF/USD/MJCF references are separate from policy references. Custom models remain unqualified: automatic model analysis, generic placement adapters and arbitrary private-policy execution are still required work and are not implied by the saved-setup UI.

These receipts prove the CAD/Blender path and the resulting USD asset; they do not establish that the separate NVIDIA USD Content Agents package executed. That named-agent integration remains a distinct unverified boundary.
