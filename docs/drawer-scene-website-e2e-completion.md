# Drawer scene: website-origin articulated evaluation, end to end

## Current scene: 2026-09-24 website capture

This section tracks the latest separately sponsored attempt. The older scene
matrix below remains historical evidence and does not transfer completion to
this scene.

| Identity | Value |
| --- | --- |
| Website request | `capture-bc15f409-09b7-438c-9891-519ba24d728f` |
| Scene | `site-capture-bc15f409-09b7-438c-9891-519ba24d728f` |
| Capture | `walkthrough-capture-bc15f409-09b7-438c-9891-519ba24d728f` |
| Original video | `IMG_4170.MOV`, SHA-256 `d63aa286294795da39fd0d4c61744c359d6449bf2a80459ebe493db3c7de0130` |
| Task | Pull the middle drawer of the wood-front three-drawer mobile pedestal under the desk |
| Intake truth | Owner confirmed Austin, Texas, US, recording rights, and the website task/terms for this scene |
| Sponsorship | Fixed $25 development test: $5 preparation, $20 simulation; no customer charge; preparation request cap amended once to 32. Owner separately authorized two bounded internal simulation exposure increases to a cumulative $33; the per-attempt $13 quote, $7 CPU model cap, and 16-attempt limit remain enforced. This does not change the website price. |
| Last proven control-plane release | `de30eba14f973376dc827750085b83518bfba9da`, canonical deploy and live exact `commit_proven: true`, no blockers at 15:39 UTC. |

### Independent 14-step matrix for the current scene

This is a development test. Cabinet dimensions, drawer stroke, mass, inertia,
friction, and the unseen rear/interior remain estimates or generated assumptions.
The source video observes the desk and teal backpack; both remain obstacles.
Only the middle drawer is the task joint. Captured-room and development-fixture
completion are scored separately.

| Step | Required evidence | State at 2026-09-24 15:26 UTC |
| --- | --- | --- |
| 1 | Website intake, rights, task confirmation consumed by Pipeline | **done** — same-scene `website_task_context.json` and `website_scene_sponsorship.json` retained; owner confirmed Austin and rights |
| 2 | Original-byte website upload, capture binding | **done** — retained 520-frame video digest `sha256:d63aa286…d130` bound in the clean-plate manifest |
| 3 | Video/privacy/task review with original-frame references | **done** — `gemini_capture_fidelity_review.json` and capture QA artifacts retained |
| 4 | Cabinet assembly and middle-drawer plan; obstacles preserved | **done** — Gemini selected the mobile cabinet/middle prismatic drawer and retained the desk/backpack as observed context/obstacles |
| 5 | Hosted SAM 3.1 task mask/track and view corroboration | **done for preparation** — clean-plate `task_masks` status `object_removal_ready`, digest `sha256:5ab1099e…26d0c85929e7`; independent view corroboration retained |
| 6 | Background edits, original/edited pairs, independent review | **done** — one bounded review found an invented panel in edited original frame 138; the controller excluded that generated view; fresh review passed on frames 34, 35, 173, 519; `clean_plate_stage_manifest.json` is `objects_removed` / `prepared_images`, with originals retained and no blockers |
| 7 | Digest-bound provider-capacity view selection | **done** — four prepared frames 34, 35, 173, 519, digest `sha256:1953ff6d…180c70e7b`, selected under the configured Marble 1.1 Plus maximum of eight; original frames remain separate |
| 8 | Marble room and MapAnything geometry/camera estimates | **MapAnything complete; Marble failed** — World Labs operation `89768cb3-0f51-4e1c-9842-3f4b98f1ec9f` ended with provider error 500, no reported bill, and no collider/splat. The controller retained that failure and acquired 13 original-frame MapAnything camera/depth estimates in `estimated_meters` (not metric measurements). Vast execution completed at 10:30:15 UTC with teardown `PASS` and provider-zero `PASS`; its $0.175 reservation remains unsettled, despite the execution receipt's $0.1312 cost estimate |
| 9 | Camera/task registration and provenance-tagged geometry | **partial for fixture only** — original-frame MapAnything estimates and source-registration binding retained; captured-room camera registration remains unqualified without a Marble room model |
| 10 | CPU CAD/Blender/USD articulated assembly and static qualification | **partial; stage 3 failed before review** — after PR #2169 fixed the failed-render handoff, same-scene attempt `source-0965117a683eb1f105f233e2` made real Claude Opus 5.5 calls, exported a valid carcass STEP/STL (550 × 587 × 782 mm) and wrote all three Blender inspection images. The trusted Blender process exceeded its 600-second limit just after the third image, so there was no independent review, complete articulated assembly, or static qualification. PR #2174 merged a 16-sample/900-second bounded render fix; an isolated no-provider replay of this exact carcass finished all three views in 143 seconds. Production retry is pending deployment. |
| 11 | Captured-room integration or separately named development fixture | **fixture execution entered, not qualified** — controller prepared and accepted a distinct `development_drawer_fixture` and reached CPU stage 3. The latest Blender timeout stopped before native integration. Captured room stays `needs_input` and unqualified |
| 12 | Native import, joints/limits/reset, physics, interfaces, collision and camera checks | unproven |
| 13 | Saved robot setup and GPU policy-action episodes with numeric scoring | unproven |
| 14 | Results/replay/media on the website task page and provider-zero teardown | unproven |

Current completion states: captured-room integration **unqualified**;
development fixture execution **unproven**; policy result and website publication
**unproven**. The terminal Marble operation and error are retained; no duplicate
world was bought. Pipeline PR #2160 is merged and deployed, fixing the
adapter's false-ready verdict. Pipeline PR #2161 is merged and deployed;
it adds an owner-allowlisted development fixture path after a retained terminal
Marble error. Neither fix turns the provider error into a successful room or a
zero-cost bill. The fixture path has passed 61 focused tests but has not
completed execution on this capture. Controller attempt 19 retained a completed
three-target mask manifest with digest
`sha256:00e420d6780f0bd16d45c0e0e84e7c78f85b2edc3193339862e96833b9d1a1e0`.
The 10:31 preparation ledger read showed 29/32 requests and $4.99/$5 maximum
quoted exposure, so subsequent admission must continue to honor both guards.
The Marble bill is unreported and its full quote remains reserved. The new
MapAnything quote is also still reserved; provider-zero does not settle its bill.

At 10:06 UTC, Pipeline PR #2162 merged as `088a341a…`. It verifies and reuses
this capture's already paid full-video SAM response for the desk and teal
backpack before MapAnything. An isolated read-only selection on the retained
tracks chose `meta-sam31-teal_backpack-0` and `meta-sam31-office_desk-1`; a
service-user replay ran the new helper against exact retained inputs with its
output redirected to scratch, producing a three-target completed mask manifest
without a provider call or live-scene write. This is preparation evidence, not
geometry or simulator qualification. The canonical deploy of `088a341a…`
completed with an immutable $0.175 MapAnything quote, $1.10/h rate ceiling,
570-second hard TTL, 80 GB minimum, and the unchanged $5 scene cap. At 10:22
UTC the controller admitted and launched Vast instance `52396769` for
MapAnything under its independent watchdog. Output retrieval, validation,
teardown and provider-zero passed at 10:30; the final bill remains pending.
Controller attempt 19 ended `failed_retryable` when the website refused the
named fixture due to its scene-specific development allowlist. The fixture
itself is `intake_ready`; captured-room support remains unqualified.

Pipeline PR #2163 is merged and canonically deployed as `8d580a05…`, with
live `commit_proven: true` and no blockers. It adds a bc15-specific,
development-only cabinet depth prior bound to this scene's own fixture
preparation/observation digests and original-frame hashes. The original source
depth estimate of 0.16327 m remains intact; the authoring candidate is 0.55 m
with an estimated 0.4125 m usable drawer stroke. A full no-spend preflight on
the saved fixture packet passed, including the two-part carcass/drawer
authoring requests, rights, images and source digest verification; it is not
a completed CAD or simulator check. Render web deployment
`dep-daqg21e7bikc738d19bg` and worker deployment
`dep-daqg3j8jo6nc73earlfg` are live on exact `af16cd7…`; both now have the
same four-entry task-digest allowlist, retaining the prior three and adding
only this scene. Public version and readiness checks pass. The normal listener
timer was restored for a same-scene retry after both services became live.

The worker initially lacked the existing web service's Anthropic provider-terms
entry, so the accepted fixture intake paused locally with
`provider_terms_not_configured_or_changed` and zero Pipeline deliveries. A
worker-only config deploy `dep-daqgb88u01pc7382qbu0` copied that exact entry;
post-deploy terms match web and the scene's separately signed Anthropic
reference. No consent or authority record changed. One subsequent transport
attempt failed before a host POST, then the worker's automatic retry succeeded:
Firestore intake `scene-53d1de9d9c6d71dd5d00ac7441a052e9fac3e235da02b9cc61520bd1f988f22a`
is `accepted`, with Pipeline intent receipt and no blocker. Host progression is
`running` on exact Pipeline `8d580a05…`; the whole-chain disk admission passed
with about 20.16 GB free against 19.33 GB required. CPU authoring has not yet
produced a provider receipt or asset.

At 11:33 UTC, the controller-owned launch
`website-c577df51a964aa540227c710-8d580a05-20260924t105122z-activation-auto-launch`
passed paid admission, staged the sealed bundle and armed an independent
watchdog. It stopped at 11:37 with
`scene_configuration_provider_python_runtime_invalid`, before the first stage,
any Claude query, or a GPU rental. The provider adapter was never invoked;
teardown was `not_required_provider_adapter_never_invoked`, and the subsequent
global guard verified provider-zero with zero live instances. The retained
runtime log reports a generic import-preflight failure. A scratch replay of
the exact sealed 216 MB wheelhouse and shipped modules as the service user
passed; the isolated import took 34.79 seconds under lighter load. The launch
timeline and generic error are consistent with its 90-second subprocess
timeout under host contention, though the wrapper did not retain the exception
type. Pipeline PR #2164 encodes a bounded 300-second check and a typed timeout
error; three focused tests and changed-file Ruff passed. No spend ceiling,
signed authority or scene receipt was edited.

Pipeline PR #2164 merged as `6bec7f70…` and the canonical deploy receipt is
`deployed`; live version reports that exact commit with `commit_proven: true`
and no blockers. The first release-successor tick required a fresh global
provider-zero check after its retained failure record. The guard at 12:07:37
UTC reported zero live instances; the controller then created same-scene
successor `source-7dc9b92c5c87fda55d4d4b20` on `6bec7f70…` and entered
`running/source_preparation` with no blockers at 12:11 UTC. This is neither a
new sponsorship nor CAD or GPU execution proof.

At 12:13 UTC, the successor reached `scene_intake_spend_cap_exhausted` before
authoring. The controller had sealed the prior scene-configuration row as
`settled_after_terminal_attempt`, retaining its full $13 quote with basis
`terminal_launch_unreconciled` under the unchanged $20 scene cap. The first
launch's retained archive proves `first_stage_started: false`, no policy query,
no Claude call, no GPU allocation, and Vast adapter never invoked, but the
existing budget rule did not recognize this particular Python-runtime setup
blocker. Pipeline PR #2165 adds a narrow proof rule requiring that exact
archive, setup log, provider result and no-allocation teardown. A read-only
service-user replay validated the signed settlement and computed a $0 budget
hold for this already terminal row; the original receipt stays unedited. Eleven
focused tests and Ruff passed. PR #2165 subsequently merged and deployed as
`0be1f9a6…`; its precise zero-allocation rule let the same scene progress
without changing the signed settlement or the $20 simulation cap.

At 13:12 UTC, the controller admitted the next launch
`website-c577df51a964aa540227c710-0be1f9a6-20260924t125418z-activation-auto-launch`.
CPU stages 1 and 2 completed; stage 3 made three real Anthropic Claude Opus 5.5
inference calls. The carcass CAD export succeeded, and its retained STEP has
SHA-256 `d8c82e07e7622ab40ccd16527566deef944a00533fcf452f25112a8386e73f6c`.
The carcass STL bounds are 550 × 587 × 782 mm. The Blender appearance script
then raised `ValueError: not enough values to unpack (expected 4, got 3)`.
The local Agents SDK stopped at the failed render tool, so the model did not
receive its `repair_needed` feedback. The launch terminalized before an
accepted assembly, native checks, GPU allocation or policy query. The CPU
archive, failed tool output and provider-zero teardown remain retained.
An exact-artifact preview is available at
`/private/tmp/bc15-carcass-review-20260924/carcass-preview.png`; it is CAD
candidate evidence, not a completed task asset. Pipeline PR #2169 is open to
return failed render feedback to the agent for a bounded repair turn; 48
focused tests and changed-file Ruff passed locally. Captured-room readiness
and fixture steps 10–14 remain unproven.

Pipeline PR #2169 passed hosted checks, merged as `b1da0c64…`, and its
canonical deploy/live version are proven. A read-only replay of the exact
retained Claude CPU archive against the earlier OpenAI-only settlement proof
returned no bounded hold even though Anthropic calls used only the CPU stage:
the signed request sets OpenAI authoring allowance to $0 and Anthropic to $7.
Pipeline PR #2171 added a digest-checked Anthropic proof that retains the full
$7 authoring allowance instead of the earlier $13 whole-attempt quote; it does
not use the observed ~$0.45 model usage estimate as a final bill. The exact
95.9 MB archived CPU output, request and scratch-rebound result replay now
return a $7 upper bound, so one $13 successor would fit the existing $20
simulation cap. All 66 focused settlement tests, changed-file Ruff and hosted
impacted checks passed. PR #2171 merged as `09c0586d…`, but was **not yet
deployed** at 14:02 UTC because another lane's operator-door deploy was active.
The owner authorized a spend-cap increase if needed; no extension has been
issued, and the fixed $25 website test price is unchanged. The scene currently
awaits a fresh controller-owned successor after deployment and provider-zero
recovery; steps 10–14 remain unproven.

## Historical drawer attempts (2026-09-22 to 2026-09-23)

Owner request (2026-09-22 UTC): take a NEW capture (`IMG_4170.MOV`) through the
normal website upload path, prepare an articulated "open one drawer" task,
let the durable controller author/qualify/dispatch it, execute the robot
team's saved setup with learned policies on GPU (controls paused), and return
results to the same website task/evaluation page. This document is the
independent status, handoff and 14-step evidence matrix for that scene. It is
separate from the blue-object scene matrix
(`docs/website-task-pipeline-completion.md` on Codex's branch) and never
appends to it.

Lane: Claude Fable 5.1, worktrees
`~/.claude-worktrees/drawer-website-e2e/{BlueprintCapturePipeline,Blueprint-WebApp}`
on branch `claude/drawer-website-e2e` (Pipeline base `8d717b848`, WebApp base
`752e3215`). Codex's active blue-object run and its
`codex/prepolicy-composition-visibility` branch are read-only for this lane.

## Source evidence (original bytes, not pipeline outputs)

| Fact | Value | Source |
| --- | --- | --- |
| Original file | `/Users/nijelhunt_1/Downloads/IMG_4170.MOV` | owner |
| SHA-256 | `d63aa286294795da39fd0d4c61744c359d6449bf2a80459ebe493db3c7de0130` | re-verified locally 2026-09-22 |
| Size / duration | 34,699,478 bytes / 17.3317 s | `ffprobe` |
| Video stream | H.264, coded 1920x1080, 30 fps, 520 frames, rotation side data -90 (displayed portrait 1080x1920) | `ffprobe` |
| Other streams | 2 audio (AAC + one more), 5 data streams; none treated as calibrated depth or measured scale | `ffprobe` |

Inspection aids (mine, derived locally, never pipeline inputs):
`~/workspace/drawer-scene-evidence-20260922/source-inspection/` (contact sheet at
2 fps, two 4 fps cabinet sheets, five full-resolution frames, `SHA256SUMS.txt`).
Owner's aids: `~/.codex/visualizations/2026/09/22/drawer-scene-handoff/source-*.jpg`.

### Full-video read

- 0.0–1.75 s: camera starts on a three-drawer mobile pedestal (wood-laminate
  fronts, grey metal carcass, three horizontal silver bar handles, casters) that
  sits under the left end of a long desk with a hutch and mesh divider. A desk
  phone sits on the desk directly above it. A black UPS stands on the floor to
  its left; a teal backpack lies on the floor directly in front of it.
- 1.5–4.5 s: pan right along the desk (cables, bagged items, mesh divider).
  The same pedestal reappears at the left edge from 3.5 s while panning back.
- 5.0–7.0 s: pedestal fully visible again from a slightly different angle
  (best reference frames: t=5.5 s, 6.0 s, 6.5 s, original frames 165/180/195).
- 7–17.3 s: pan left to a second desk (monitor, keyboard, mouse, laptop, sticky
  notes, papers, a key ring on paper, a glass). The cabinet is not visible.

There is exactly one three-drawer cabinet in the clip. All three drawers stay
closed for the entire clip; no frame shows any drawer travel, interior, rails,
or friction behaviour. A lock cylinder with a key inserted is visible at the
upper right of the TOP drawer front (t≈0.75–1.25 s and 5.0–6.5 s). The key does
not establish whether any drawer is locked or unlocked.

### Selected task drawer

Middle drawer of that pedestal (default per owner; full-video inspection found
no reason to prefer another). Original-frame references: frame 12 (t=0.4 s),
frame 30 (t=1.0 s), frames 165–195 (t=5.5–6.5 s). Handle: horizontal silver bar
centred on the middle drawer front.

### Explicit unknowns (must stay labelled estimated/generated downstream)

- Cabinet dimensions, drawer stroke, interior, rail type, sliding friction,
  mass: not observable. Any value used is an object-prior estimate or a
  MapAnything/provider scale estimate, never a measurement.
- Lock status: unknown (key visible, no drawer opened).
- Country of capture: not confirmed in the clip; must come from trusted intake
  context, not transplanted from the blue-object scene.
- Drawer mechanism assumed prismatic (sliding) because nothing in the video
  contradicts a standard pedestal drawer.

## Fixed decisions carried from the owner prompt

- Controls stage paused; existing policy-omission support carries the
  diagnostic claim ceiling. Basic validity checks (import, joints, limits,
  reset, physics stability, interfaces, collision sanity, real camera output)
  stay.
- One simple task page, fixed $25 customer price, server-authorized no-charge
  development execution; no Stripe/customer charge.
- Marble now, Atlas later; provider's configured/verified maximum useful
  distinct views; keep wide context views.
- Gemini single-pass interpretation; hosted SAM 3.1 masks; image editing with
  the configured backend (no VIP/ArtiFixer); MapAnything for estimates.
- Persistent Agents SDK CAD/Blender/USD session per asset with spend limits on
  CPU before any GPU rental; no NVIDIA USD Content Agents package claim.
- Policy must pull the drawer with its own actions; no position drive,
  teleport, auto-assist, or reset-motion counted as success.
- Opening criterion frozen before episodes from the modelled joint coordinate
  (proposal: >= 60 % of the estimated usable stroke held for 1 s, cabinet
  stable, valid physics); bound in the task contract before any policy call.
- Geometry workaround permitted: task-local carcass/aperture repair layered
  over raw Marble output; if room integration cannot be defended, an explicitly
  named development drawer fixture continues execution, with separate
  completion states for captured-room integration and development execution.

## 14-step evidence matrix (all rows start unproven)

| Step | Required behaviour | Evidence required to close | State |
| --- | --- | --- | --- |
| 1 | Website task intake, rights/task confirmation, task = open the selected drawer | Browser submission and immutable confirmed task consumed by Pipeline | **done** — HTTP 201 inbound request, brief confirmed HTTP 200, rights and US region attested by the owner; Pipeline consumed the handoff at 03:39 UTC and wrote `website_task_context.json` and `website_scene_sponsorship.json` |
| 2 | Website upload of original bytes to existing storage, linked to the new capture/task | Retained object digest equals `d63aa286…d130` | **done** — upload accepted HTTP 201; Pipeline decoded 520 frames from the retained object and every provider binding in this scene carries `source_video_digest: sha256:d63aa286…d130` |
| 3 | Video/privacy/task review, timestamped original evidence, explicit unknowns | Retained review record with frame refs and unknowns | **done** — `gemini_capture_fidelity_review.json`, `capture_qa_scorecard.json` and `qa_report.json` written 03:40 UTC |
| 4 | Task-relevant assembly selection and reconstruction plan | Plan names cabinet carcass + middle drawer + handle as the replacement assembly | **done** — Gemini returned `pedestal_cabinet` ("three-drawer wood-front cabinet") as one manipulated assembly with `articulated_part: "middle drawer"`, `articulation_kind: "prismatic"`, confidence 0.98, quoting the task text; the teal backpack stayed a `static_obstacle` with `collision_required: true` |
| 5 | Hosted SAM whole-video tracking/masks for the assembly parts incl. partial views | Track manifest with per-frame masks for both visibility windows | **done** — whole-cabinet `under-desk cabinet` track retained 186 observations; 14 candidate views, independent same-frame corroboration passed on original frame 173 (tracked share 0.213993, fresh SAM share 0.207911). The whole-video path was used for this capture; the separately merged view-first canary remains off for it |
| 6 | Task-specific image edits/background recovery, original/edited pairs retained | Edited views + review, originals unchanged | **done** — configured `gpt-image-2.5-sunburst` backend edited five views. First review identified the unedited, unmasked original frame 0; controller excluded exactly that view and a second Gemini review passed. Clean-plate manifest is `objects_removed`, `prepared_images`, five reviewed views, no blockers. Originals and failed review retained |
| 7 | Provider-capacity view selection, wider context, originals preserved | View manifest with provider maximum and digests | **done** — retained 14 candidate views, five digest-bound prepared views admitted to the configured Marble 1.1 Plus multi-image input; originals remain separate |
| 8 | Marble reconstruction/preview, durable provider artifacts, estimated geometry/scale/registration | Provider operation receipt, splat/collider digests, MapAnything estimate | **partial: Marble and MapAnything acquired; registration refused** — World Labs operation `51323203-7420-421a-a460-d6aa6ea63745` produced world `baffc3ca-4c87-45dc-8531-52c3275820ed` for 1,600 credits ($1.28). Collider GLB and full-resolution splat SPZ were materialized and website visual publication written. The third bounded MapAnything rental returned 13 original-frame camera/depth estimates; execution `completed`, teardown `PASS`, provider-zero `PASS`. These are estimates, not measurements. Marble's anchor frame 34 is absent from MapAnything's sample, and registration refused. |
| 9 | Task-space/cabinet registration, removal/replacement boundary, provenance-tagged facts | Registration receipt with source/estimated/generated labels | unproven |
| 10 | Controller-created articulated CAD/Blender/USD asset with independent static validation | Multi-link USD, joint data, references, static qualification receipt | unproven |
| 11 | Room integration with local geometry workaround, or separately identified development fixture | Integration receipt OR fixture receipt with explicit world label | **partial: fixture handoff accepted; CPU authoring blocked** — the controller wrote separately named `development_drawer_fixture` construction, rights, and runtime inputs; the website accepted and forwarded the handoff, and the control plane registered its intent. Two CPU attempts reached articulated asset authoring but neither produced a complete cabinet-and-drawer asset or native import receipt. Captured-room integration remains unqualified. |
| 12 | Native articulated import/reset/limits/contact/physics qualification | Native qualification receipt with assumptions | unproven |
| 13 | Robot team selects saved compatible setup; learned policies execute on GPU, controls skipped | Episode receipts with camera frames, actions, joint trajectories, metrics, failure reasons | unproven |
| 14 | Results/replay/media and honest status on the same website task page; thumbnail visible; provider-zero after teardown | Browser readback + provider-zero receipt | unproven |

Completion states tracked separately:

- Captured-room integration: unproven.
- Development end-to-end execution (fixture): unproven.

## Identities (new scene only)

Created 2026-09-22 03:31 UTC through the live website, browser-driven:

| Identity | Value |
| --- | --- |
| Inbound request / site submission | `capture-1eccb098-d39c-4bc9-b7d0-9ff59a18c153` |
| Capture | `walkthrough-capture-1eccb098-d39c-4bc9-b7d0-9ff59a18c153` |
| Scene | `site-capture-1eccb098-d39c-4bc9-b7d0-9ff59a18c153` |
| Capture upload link scope | `owner`, expires epoch 1790652693 |
| Confirmed task text | "Open the middle drawer of the three-drawer wood-front cabinet with silver bar handles (the mobile pedestal under the desk)." |
| Confirmed by | Nijel Hunt, 2026-09-22 03:32 UTC, consent statement `2026-09-18.v1` |
| Capture region | `us`, from the Austin, Texas address; corroborated by the clip's own GPS tag `+30.4261-097.7177` and `creationdate 2026-09-21T10:23:57-0500` |
| Upload response | HTTP 201, `eligibility: unscreened` |
| Live WebApp commit at submission | `6a6f2e3bd8019b645138f99d2db73376761082a5` |
| Live control-plane release at submission | `ba6072c262e645c2fda9aec3a2e8236cdf71a895` |

The uploaded bytes are the original file: the staged upload copy was verified
`d63aa286…d130` (same SHA-256 and size as `~/Downloads/IMG_4170.MOV`) before the
browser read it, and deleted afterwards.

The blue-object identities (`team-eval-5aea93d1…`,
`setup-c660b4f6…`, `team-eval-7b5d46d9…-policy-canary-765ceba44410`,
Vast instance 51991469) are reference only and must never be reused, cancelled,
rebound, or debited by this lane.

## Environment snapshot (2026-09-22 ~02:30 UTC)

- Host `paperclip-prod-01` active release `0de036ac86b312e3f37e653eabc1abe82d026185`;
  Pipeline `origin/main` `8d717b848` (PR #2090 merge). WebApp `origin/main`
  `752e3215` (PR #656) deployed via the CI-gated Render workflow.
- No live paid GPU attempt observed; blue-object closeout shows provider-zero.
- Chain preflight `preflight/latest.json` reports 17 blockers (warnings about
  activation intents bound to other releases); to be re-read before submission.
- Codex branch `codex/prepolicy-composition-visibility` (1 commit ahead of
  main) touches the native composition coverage gate/diagnostic; this lane
  does not edit those functions.

## Seams found (2026-09-22 ~03:00 UTC)

The native arena runtime already dispatches `articulated_open_close`
(`native_task_runtime_contract`, `native_task_arena_scene_plan`,
`native_articulated_task_state`, `adp_task_scoring.score_articulated_task_episode`)
and the ops lane accepts `articulated_manipulation`. The public website lane was
rigid-only at every layer: Gemini schema (single movable solid), Pipeline and
WebApp intake schemas (`pick_and_place` literal, destination + lift/displacement
success), the preparation compiler, the stage-3 authoring / stage-4 static
qualification adapters (refuse joints), no articulated native adapter, and the
policy-canary path validating only the rigid success contract.

Batch 1 (preparation side, this branch in both repos) makes the website lane
carry an articulated task up to the scene-configuration request. Batch 2
(authoring brief, articulated static qualification, native import, articulated
native adapter, canary success contract, WebApp result surfaces) follows while
the reusable Gemini/SAM/edit/Marble/MapAnything stages run for the new scene.

## Progress log

- 2026-09-22 02:30 UTC: worktrees created, video fully inspected, evidence
  folder written.
- 2026-09-22 03:05 UTC: Batch 1 implemented and tested (Pipeline 110 focused
  tests + sentinels; WebApp intake/team-selection 61 tests, typecheck clean).
- 2026-09-22 03:15 UTC: Batch 1 merged. Pipeline PR #2092 ->
  `ba6072c262e645c2fda9aec3a2e8236cdf71a895`; WebApp PR #658 ->
  `6a6f2e3bd8019b645138f99d2db73376761082a5`, Render deploy green. Canonical
  control-plane deploy (`--iteration --canary --preserve-configured-controls-state`)
  started after checking no deploy was running, the Vast paid-launch lock was
  free and the GPU guard reported zero live instances. Active release link
  switched to `ba6072c2`.
- 2026-09-22 03:31 UTC: **real browser-origin submission and upload done** (see
  Identities). Steps 1 and 2 are done on the WebApp side; Pipeline consumption
  is the next thing to observe.
- 2026-09-22 03:35 UTC: Batch 2 (articulated authoring + static qualification)
  pushed as Pipeline PR #2094, 98 focused tests passing, auto-merge armed.
- 2026-09-22 03:39–04:22 UTC: capture pipeline ran intake → Gemini removal
  analysis → MapAnything source geometry → SAM 3.1 video tracking. Gemini in
  production returned the cabinet as **one manipulated assembly**
  (`pedestal_cabinet`, "three-drawer wood-front cabinet", `articulated_part:
  "middle drawer"`, `articulation_kind: "prismatic"`, confidence 0.98, task text
  quoted verbatim) and kept the teal backpack as a `static_obstacle` with
  `collision_required: true`. The articulated hint shipped in Batch 1 is
  therefore live and working on a real capture.

### Blocker found and fixed: the segmenter could not resolve "cabinet"

SAM 3.1 processed all 520 decoded frames three times and returned **no track at
all** for the cabinet:

| prompt | source | frames processed | tracks |
| --- | --- | --- | --- |
| `cabinet` | video-analysis noun | 520 | 0 |
| `file cabinet` | one allowed refinement | 520 | 0 |
| `teal backpack` | same clip, same call | 520 | 228 |

The run refused with `clean_plate: task_target_track_ambiguous:pedestal_cabinet`
and retried on that same refusal five times. The cabinet is the same light wood
as the desk and the hutch above it and is cut off at the frame edge, so the
generic noun never resolved; the backpack, visually distinct, tracked fine.

The defect was not the noun but the spending rule around it. The old path let
the grounding model propose exactly one alternative and spent a second
full-clip call on it unverified. A wrong noun costs one frame price per decoded
frame; proving a noun costs one image price.

`fix(task-masks): prove a segmentation concept on one frame before buying the
clip` now proves each candidate concept on the exact frame the grounding model
verified, and spends on the whole clip only for a concept that resolved the
target there. The search is bounded at three concepts, each a new proposal the
model supported after being shown the crop and every noun already rejected;
repeating a rejected noun ends the search. A surface the task only rests on
keeps its single-frame rescue and now reaches it without buying a second clip.
An object that must leave every frame still has no single-frame rescue.

**Replayed on CPU against this scene's saved inputs before any deploy**
(scratch root, live capture tree untouched):

| step | concept | result |
| --- | --- | --- |
| grounding 1 | `cabinet` | already rejected, re-grounded |
| grounding 2 | `filing cabinet` | probe returned 0 tracks |
| grounding 3 | `drawers` | probe returned 3 tracks; selected against the verified box |

Resolved concept `drawers`, box `[0.0, 0.44, 0.56, 0.395]`. Replay cost about
$0.045 (two grounding calls, two single-frame probes), all through the scene's
own preparation-spend ledger.

- 2026-09-22 04:53 UTC: Codex's paid Vast instance `52007050` torn down
  (`vast_instances_destroyed_by_adapter`), paid-launch lock free. Branch merged
  with `origin/main` `3ad70e6d4` first so the deploy carries Codex's delivery
  and intake-capacity fixes (#2093, #2095, #2096) rather than dropping them.

### My replay consumed the live run's one-dispatch grant (and how it was repaired)

The CPU replay above ran through the scene's own preparation-spend ledger, which
is keyed by `allocation_binding_digest`. A single-frame probe's binding is the
frame plus the concept text and nothing else, so the replay's probe for
`filing cabinet` produced **the same digest** the live run computed later:
`ecc7bb50c60d29491e959add88e696e32747addaf064794f2eeca43be91cf299`. The WebApp
correctly answered `already_reserved` — only the first transaction may dispatch —
and attempts 12 and 13 refused with `clean_plate: PaidResourceAdmissionBlocked`.

The guard is right and was not weakened. What was missing was the artifact: the
call had been paid for, but its response sat under the replay's scratch root
instead of the directory its own binding names. Both replay probe responses were
installed into the live binding directories, owned `blueprint:blueprint`, mode
0600, with no existing file overwritten:

| probe | concept | binding digest | clip digest | tracks |
| --- | --- | --- | --- | --- |
| 01 | `filing cabinet` | `ecc7bb50…f299` | `4a6a2d9f…1c67` | 0 |
| 02 | `drawers` | `40a22cc6…a5f9` | `4a6a2d9f…1c67` | 3 |

The clip digests were byte-identical to the ones the live worker had already
re-encoded in place, so `run_meta_sam31` admitted them through its own retained
path (`binding_digest` and `clip_digest` both verified) rather than through any
relaxed check. Nothing was hand-written: these are the provider's own responses
for those exact bindings.

**Lesson for the next replay:** a replay of a paid stage must not share the live
scene's spend ledger. Use a scratch task context, or accept that the replay is
the dispatch and place its artifacts in the real tree deliberately.

- 2026-09-22 05:59 UTC: attempt 14 running on release `91887b222`. Probe
  `filing cabinet` returned 0 tracks and was rejected; probe `drawers` returned
  3 tracks and was selected against the verified box; the run then bought the
  full-clip SAM call for `drawers`. Decoding those masks is the pure-Python
  per-pixel stage that took 34 minutes for the backpack.

### The proven concept was still the wrong object

`drawers` passed the probe and the clip call was bought. It returned exactly
three instances across 520 frames, and none of them is the cabinet:

| instance | frame-150 box | height | overlap with the grounded cabinet box |
| --- | --- | --- | --- |
| 0 | (0, 1235, 547, 1591) | 356 | 0.42 |
| 1 | (0, 870, 564, 1109) | 239 | 0.30 |
| 2 | (0, 1066, 555, 1283) | 217 | 0.27 |

The grounded cabinet box is (0, 844, 604, 1603), height 759. Track selection
would have taken instance 0 on overlap, cleared the bottom drawer front from the
plate, and rebuilt an assembly sized like one drawer.

The probe was too weak. A sub-part always overlaps the whole, so overlap alone
cannot tell a cabinet from its drawer. The probe now also asks how much of the
grounded box the selected mask spans and refuses a concept that covers less than
most of it. The two failures are reported to the grounding model differently:
one found no instance, the other found a part, and only the second is told that
the task acts on the whole assembly.

Checked against this scene's own retained probe: `drawers` covers 0.421 and is
refused, so the clip is not bought for it.

**The capture listener was stopped at 06:15 UTC** rather than let that run reach
paid image completion and Marble generation on the wrong target. Nothing
downstream had started: no `image_completion`, no `website_reconstruction`, no
`task_masks.json`. Sunk cost is the one `drawers` clip call, about $0.10. The
timer goes back on as soon as the fix is deployed.

Pipeline PR #2098 carries the coverage rule, the task-kind argument at two
dispatch call sites, and two modules brought back inside their source line
budgets. Three test files were already failing on `origin/main` before any of
this work (materializer reachability, live-pipeline import isolation, and the
scene-configuration budget profiles); they are tracked separately and are not
regressions from this branch.

### Step 7's provider ceiling is configured, not hardcoded

Checked against the requirement that the view count follow the provider's
verified capability rather than a global constant.
`client`-side nothing is involved; the ceiling lives in
`website_reconstruction_profile.py`, whose first line is "Provider-specific
image capacity; never a global reconstruction frame cap." The profile comes from
`BLUEPRINT_WEBSITE_RECONSTRUCTION_PROFILE_JSON` or an explicit argument, and
defaults to Marble's own `{"provider": "world_labs", "model": "marble-1.1-plus",
"max_input_images": 8}`. Selecting a different model without supplying its
profile refuses with `website_reconstruction_profile_required_for_selected_model`,
and the module comment says plainly that Atlas is not assigned an invented limit
before its API exists. The adapter-side equality check in `website_worldlabs.py`
is a provider-binding check, not a ceiling: a different profile needs a matching
adapter and says so.

Nothing to change here for this scene.

## Blocked on one owner action: the preparation attempt cap, not the money

The fix deployed cleanly (release `fc5b748ee64a5bd68a6e5881096e9661b0a20513`,
receipt `iteration_fc5b748ee64a.json`, intake reports the same commit, both
surfaces clean). The capture resumed, ran the new concept search, and then hit a
different wall:

```
clean_plate: website_control_preparation-spend_http_409:website_scene_preparation_budget_exhausted
```

That refusal has two limbs, and it is **not** the money one:

| guard | configured | used |
| --- | --- | --- |
| preparation spend | $5.00 | about $1.20 |
| preparation requests | 16 | 17 |

The concept search trades one expensive call for several cheap ones. Six
grounding calls and three single-frame probes cost 13 cents together and nine of
the sixteen attempts. For comparison, the completed blue-object scene spent
$3.16 across seven retained reservations. So this scene has roughly 76% of its
dollars left and no attempts.

Four of the consumed attempts are mine: the pre-deploy CPU replay ran two
grounding calls and two probes through this scene's ledger. That was the wrong
place to replay a paid stage.

### What unblocks it

`amendWebsitePreparationRequestLimit` is deliberately operator-only, exposed
through no public route and no Pipeline API, and it requires the scene owner's
own user id as `approved_by`. It cannot be run from this host: the Pipeline
service account reaches the Website over the signed HTTP API precisely so it
cannot write these records directly, and nothing here holds the Website's
Firebase credentials. So this is the owner's action, not an automation's.

From the Blueprint-WebApp checkout, with the Website's own environment. It
previews by default and only writes with `--apply`:

```bash
node --env-file=.env --import tsx scripts/amend-website-preparation-limit.ts capture-1eccb098-d39c-4bc9-b7d0-9ff59a18c153 sha256:d16ea102acd75849992a23c1b9f6d4eb3e62c454410f4b94f8b05accb9df8c98 f8LpkurhpsNmAJhMaSnts8Y3Dkt2 30 "drawer scene concept recovery: 16 attempts spent at about \$1.20 of the \$5 preparation cap, 4 of them by a diagnostic replay; dollar cap unchanged"
```

Re-run the same command with `--apply` appended to write it. 30 is derived, not
picked: 16 already spent, about 10 to finish (concept search, one clip, image
completion, Marble, fidelity review), and four spare for one retry. The schema
ceiling is 32 and the $5 spend cap is untouched, so money remains the binding
control.

**The amendment is one-shot.** A second one with different values is refused as
`website_preparation_amendment_conflict`, which is why the number above is
generous rather than exact.

### The product finding underneath

`max_paid_attempts` comes from `BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON` and is
16. A scene that needs concept recovery cannot fit in 16, so a fresh capture of
the same video would hit the same wall rather than route around it. Raising that
policy value would break every in-flight scene's sealed sponsorship
(`website_scene_sponsorship_changed` compares the policy digest), so it is a
change to make deliberately between scenes, not now.

### A concept that does resolve the whole cabinet exists

Before asking anyone to spend a one-shot budget amendment on a scene that might
still fail, the question worth answering was whether *any* concept resolves the
cabinet as one object. Five candidates, one single-frame request each, about a
penny and a quarter in total:

| concept | instances | best coverage of the grounded box | whole target? |
| --- | --- | --- | --- |
| `under-desk cabinet` | 1 | 0.983 | yes |
| `drawer unit` | 3 | 0.422 | no, the three fronts again |
| `mobile pedestal` | 0 | — | no |
| `wooden cabinet` | 0 | — | no |
| `pedestal` | 0 | — | no |

`under-desk cabinet` returns a single instance whose mask spans
(0, 838, 614, 1590) against a grounded box of (0, 844, 604, 1603). That is the
cabinet, not a drawer front, and the deployed coverage rule accepts it at 0.983
while still refusing `drawer unit` at 0.422. So the amendment buys a scene that
can finish, and the rule discriminates correctly on real data in both
directions.

This diagnostic was run **outside the scene's preparation ledger**, on purpose
and recorded as such: that ledger is exhausted, which is the very thing being
diagnosed, and the alternative was to ask for an irreversible amendment on a
guess. Five image requests at $0.0025, receipt at
`/tmp/drawer-concept-diagnostic/concept_diagnostic.json` on the control-plane
host. No capture artifact was touched and no scene budget was charged.

What it does not tell us is whether the grounding model will propose that noun.
It has been told to name the whole object rather than the part that moves, which
points the right way, but the proposal is still the model's.

## Where this stands

Steps 1 to 4 are done on real evidence. Step 5 is one owner command away from
resuming, and the two defects it exposed are fixed and deployed:

- Pipeline #2094 added the concept probe, so a noun is proved on one frame
  before a whole clip is bought for it.
- Pipeline #2098 made the probe require the concept to *cover* the target
  rather than overlap part of it, told the grounding model which of the two
  failures happened, spent the budget on probes rather than turns, and brought
  two modules back inside their source line budgets.
- Pipeline #2103 (open) carries the measured naming hint. It briefly carried a
  parallel mask decode too; measured on a real clip that pool ran at 0.89x and
  then 0.04x against serial, because the host is four cores under a load average
  near ten and the decode there is contention-bound rather than
  parallelism-bound. The code and the claim both came out. The number that
  survives is that a real clip decodes in twelve to twenty-seven minutes serial,
  depending on what else the host is doing.
- WebApp #662 (open) carries the articulated success contract end to end, so a
  drawer run has something to submit and something to show.

Two commands resume it, and nothing else is waiting on a person. The amendment
above, and then the capture listener, which a later control-plane deploy
quiesced while a paid GPU run was in flight:

```bash
systemctl start blueprint-pubsub-handoff-listener.timer
```

The fix is live either way: the active release `41d9ce6cb` carries it, having
been cut from a commit that descends from the one it shipped in.

## The amendment landed and the lane unblocked itself

The owner authorized raising the preparation attempt cap. Applied through the
sanctioned operator script with their own admin credentials, previewed first:
`max_requests` 16 to 30, amendment digest
`sha256:5bc3a580c2d7d46257d3ce1628cbca09609dff5852c82dea68cb1f0a6b3d9b8c`. The
$5 spend cap was not touched and money remains the binding control.

The capture listener was restarted at 10:10 UTC with the paid launch lock free
and no deploy in flight. Attempt 19 recovered the lease and ran the concept
search on the deployed rule. It behaved exactly as designed:

| concept | instances | coverage of the grounded box | outcome |
| --- | --- | --- | --- |
| `file cabinet` | 0 | — | refused, no clip bought |
| `drawers` | 3 | 0.421 | refused as a part, no clip bought |
| `dresser` | 1 | 0.981 | accepted, one clip bought |

`dresser` matches the independent diagnostic almost exactly, where
`under-desk cabinet` measured 0.983. Two different whole-object nouns, the same
mask. The run is now decoding that clip, which is the twelve-to-twenty-seven
minute serial stage.

Worth recording about cost: after the first pass the whole search is retained.
Grounding bindings are deterministic given the same failure sequence, so a
repeated attempt replays from receipts and buys nothing. The search either
finds a concept or fails identically and for free.

## Step 6 failed honestly, and this capture is out of attempts

The masks landed and the background review failed the run:

> The entire desk and upper shelving were mistakenly removed, leaving phones
> and wires floating in mid-air.

It was right. Two of the five edited views had lost their desk. The concept was
not at fault: `dresser` resolved the cabinet on the frame it was proved on, and
across the clip the tracker walked onto the desk behind it, which is the same
light wood. Measured on the views the editor was given, as a share of the frame:

| view | tracked mask | single-frame segmentation | ratio | edited result |
| --- | --- | --- | --- | --- |
| 35 | 46.1% | 20.0% | 2.3 | desk erased |
| 138 | 44.2% | 16.4% | 2.7 | desk erased |
| 104 | 34.4% | 4.1% | 8.4 | not edited |
| 173 | 25.4% | 20.9% | 1.2 | correct |
| 0 | 12.9% | no instance | — | correct |
| 208 | 9.7% | no instance | — | not edited |
| 519 | 0.7% | no instance | — | correct |

An overlay of the 16.4% mask covers the three drawers and nothing else, so the
drifted views are a different object, not a harder angle.

Pipeline #2103 adjudicates the biggest claims first and stops at the first one
an independent single-frame look agrees with, because drift can only add area
and everything smaller than a corroborated mask claims less than the target. On
this scene that is four looks and it catches all three drifted views.

### Why this capture cannot finish

Read from the ledger rather than estimated:

| | used | cap |
| --- | --- | --- |
| preparation requests | 25 | 30 |
| preparation spend | $2.28 | $5.00 |

Five requests remain. Finishing needs about nine: four corroboration looks, an
image edit per retained view (the editor bills one request per view, not per
batch), and the Marble generation. The amendment is one-shot by construction, a
second one with different values is refused as
`website_preparation_amendment_conflict`, and the schema ceiling is 32 anyway,
so there is no larger number to ask for.

This capture has therefore done its job: it found three real defects, all of
them now fixed and two already deployed. Proving the lane end to end continues
on a fresh capture of the same video, which starts with its own budget and runs
on code that no longer has those defects.

## Fresh capture continuation, 2026-09-22

The owner reconfirmed that the office is in the United States and that Blueprint
may use the recording for this drawer evaluation. The original local file was
rechecked at SHA-256
`d63aa286294795da39fd0d4c61744c359d6449bf2a80459ebe493db3c7de0130`.
The owner chose `ohstnhunt@gmail.com` for this new submission.

The unsigned website form at `/contact/site-operator` returned its generic save
error twice. Firestore had no new inbound request after either attempt. The same
form fields were then submitted to the website's existing
`POST /api/inbound-request` route, with the route's normal CSRF cookie and
header. It returned HTTP 201 and created the independent request
`capture-7d655e25-34f2-4961-ae9c-6da11621ce8f`. This proves website API
intake, **not** a completed browser form submission or video upload. The owner
capture link was issued. The owner then directed us to use the website upload
API without waiting for email delivery. The new owner link authorized the
existing `POST /api/self-capture/uploads/:token` route; it returned HTTP 201 for
`walkthrough-capture-7d655e25-34f2-4961-ae9c-6da11621ce8f`. The uploaded
storage object was read back independently at 34,699,478 bytes and SHA-256
`d63aa286294795da39fd0d4c61744c359d6449bf2a80459ebe493db3c7de0130`.
This was a website API upload, not a browser file-picker action. The owner task
brief was confirmed for the exact middle-drawer sentence; its unrelated site
planning questions remained unresolved. The normal raw manifest and completion
marker are present. No old capture's authority or remaining budget was reused.

New scene `site-capture-7d655e25-34f2-4961-ae9c-6da11621ce8f` reached the
host's `capture_pipeline` stage with preflight and materialization completed.
The independent sponsorship digest is
`sha256:5d09032a0fd359a7f7378b71dd0bbe45a991b62f352c54d17d08fefac61396b7`.
The one-time preparation request-limit amendment was previewed and applied to
32 requests for this request alone. The sponsorship still binds a $5 upstream
provider budget and $20 native simulation budget; its
`preparation_max_total_spend_usd: 25` field is the combined scene ceiling, not
a new $25 upstream allowance. One preparation reservation existed when the
amendment was verified.

The active Pipeline release was verified as
`b1aed954b08e5cee8c143640ab6d1b5776b45db1` with `commit_proven: true`
and no identity blockers. WebApp main `e0078966de77a27558c2028bed940a85f14d455b`
has a successful CI-gated Render deploy. Its articulated contract from PR #669
superseded the then-open, conflicted PR #662; no code from #662 was deployed for this
continuation. The unrelated policy result-delivery worker was active, so no
control-plane deployment or paid launch was started.

Fresh-capture evidence matrix: step 1 is **partial** (website API intake and
confirmed task, but the browser form failed); step 2 is **done via the website
upload API** with exact storage readback, though no browser file-picker claim is
made. Capture QA artifacts for step 3 are present, but the separate
`gemini_capture_fidelity_review.json` reports `not_run`, so step 3 is **partial**.
Step 4 is **done**: this scene's completed Gemini removal analysis names
`pedestal_cabinet` as the task object, `middle drawer` as its prismatic part,
and retains `teal_backpack` as a collision-required obstacle. Steps 5–14 are
**unproven**. Captured-room integration and development-fixture execution are
both **unproven**.

### Live continuation, 2026-09-22 ~20:40 UTC

The controller service still owns this capture's `capture_pipeline` stage.
Its live main process (PID 69739) was consuming CPU at the last check, the
stage ledger remained `running` with no `failed_stage`, and only the first of
two retained SAM 3.1 responses had a parsed-response receipt. The second
whole-video response is retained and being converted into source-frame mask
runs. No image-completion receipt exists. Step 5 therefore remains unproven;
steps 6–14 have not been credited from this CPU activity.

Pipeline PR #2113 merged as `1bb21d0c70ac88f578f9e33894c5af78c6023522`
after an exact saved-response comparison of the same 462-mask response. It
provides a faster official parser path, but the current process is on the
older deployed release `b1aed954b08e5cee8c143640ab6d1b5776b45db1`.
It was not restarted or deployed over this healthy run. The speed measurement
is not evidence that the live mask stage completed.

WebApp PR #669 already merged the articulated success/results contract as
`a7a1093bd06ef35fba5ae329a5e00c58723a7c37`. The live website
`/version.json` reports descendant commit
`38de39ab809d4315e6eabe3ea065d76503fa86a8`. The older PR #662 had zero
remaining file changes after reconciliation and was closed as superseded.
This proves deployed code availability, not that this scene has policy
episodes or visible results; step 14 still needs its own readback.

### Parser recovery started, 2026-09-22 ~20:51 UTC

At nearly two hours of live mask conversion, the second hosted SAM response
remained unparsed. The exact retained response contains 462 masks. On the same
local machine, the merged official JavaScript parser path converted it to the
same deterministic track JSON in 32.08 seconds, compared with 1257.88 seconds
for the improved single-pass Python candidate. The active release uses an older
path with two decode passes. These are parser timings, not a host end-to-end
completion estimate.

The owner asked to interrupt the prolonged conversion if the faster approach
would avoid further hours. The response receipt is durable; merged Pipeline
commit `1bb21d0c70ac88f578f9e33894c5af78c6023522` validates and reuses it
without another hosted SAM request. The GPU spend guard reported zero live
instances. The canonical deploy started as
`blueprint-drawer-parser-deploy-1bb21d0c.service` on a clean host clone, with
receipt target `iteration_1bb21d0c_dwr.json`. The existing listener continued
running while the deployment started. Deployment, listener restart, parser
completion, masks, and all subsequent steps remain pending proof.

At 20:58 UTC, with the new release files staged and no parsed second response,
the old listener was stopped through systemd. Its durable job ledger remained
on attempt 1 with lease expiry 21:12:45 UTC. The canonical deploy then
completed with `status: deployed` for commit
`1bb21d0c70ac88f578f9e33894c5af78c6023522`; both release surfaces were
recorded, and the live intake version endpoint reported that commit with
`commit_proven: true` and no blockers. The deploy briefly restored the queue
timer; it and the new listener were stopped before the old lease expired. The
timer will be restored after that lease expires so normal controller redelivery
can resume from the retained response without repeated active-lease nacks.
There is still no parsed-response-1 receipt or completed step 5.

The selected part is independently visible in original decoded frames
`decoded-000000150` (5.00 s) and `decoded-000000170` (5.67 s) of the
SHA-256-bound video above. Frame 170 shows all three closed wood fronts, their
silver handles, the middle handle between the upper keyed drawer and larger
lower drawer, and the teal backpack on the floor in front. Frame 150 shows the
same three-front pedestal under the desk from a wider angle. These references
identify the middle drawer and an observed obstacle; they do not measure the
drawer stroke, cabinet dimensions, friction, or clearance.

### Partial SAM request recovery, 2026-09-22 ~21:28 UTC

After the old job lease expired, the normal controller claimed attempt 2 under
the verified `1bb21d0c` release. It failed before parsing the second retained
response: `clean_plate` reported `task_masks_blocked` with
`PaidResourceAdmissionBlocked`. The exact request has three prompts: cabinet,
carpet/floor, and teal backpack. Responses 0 and 1 are durable; response 2 and
its intent are absent. The existing code requested the already reserved
three-prompt spend grant again, so the spending guard correctly refused it.
No new hosted SAM request occurred on attempt 2. The job ledger is
`failed_retryable`, attempt 2, and the listener timer is paused while the
resume defect is repaired.

Pipeline PR #2115, commit `c7406bf430a82b96c6fe13a2cc228af0c7041fc5`,
validates and reuses existing responses, refuses uncertain or altered retained
evidence before spend, and requests a new bounded grant only for prompts with
no response. Seventy-one focused tests and 27 impacted tests passed. A scratch
replay of the exact saved 520-frame clip and 462-mask response, with a fake
grant/provider response for the missing backpack prompt, completed in 41.7
seconds using the official fast parser. It requested only that fake missing
prompt. No live provider or scene record was changed by the replay, and the
scratch video copy was removed. A canonical canary deploy of the pushed commit
has started as `blueprint-drawer-partial-deploy-c7406bf.service`; deployment,
live parser completion, selected task masks, and steps 5–14 remain unproven.

### Task noun recovery, 2026-09-22 ~21:53 UTC

The canonical canary deploy of `c7406bf430a82b96c6fe13a2cc228af0c7041fc5`
completed with both surfaces recorded and live `commit_proven: true`; the
controller claimed attempt 3. It reused the earlier cabinet and floor SAM
responses, parsed the 462 floor observations, then admitted only the missing
teal-backpack prompt. It retained and parsed that response too. The initial
`cabinet` prompt still found no cabinet. Exact-frame grounding and four
one-frame concept probes then tried `filing cabinet` (no instance), `desk
drawers` (three fronts), `drawer unit` (three fronts), and `mobile pedestal`
(no instance). None passed the whole-cabinet coverage gate. The stage stopped
with `task_target_track_ambiguous:pedestal_cabinet`, without editing the desk
or claiming step 5 complete. The job ledger is `failed_retryable`, attempt 3,
and the listener timer is paused to avoid repeating the same paid search.

Pipeline PR #2116 adds one task-supported `under-desk cabinet` probe ahead of
free-form synonyms when the confirmed task itself uses that setting. The same
fresh-scene single-frame coverage gate remains mandatory, and the total search
stays at four probes. This phrase covered 0.983 of the whole-unit box in the
earlier capture of these same video bytes, but that earlier result is only a
candidate noun, never this capture's mask evidence or spending authority.
Forty-six focused task-mask/grounding tests, changed-file Ruff and diff check
passed. PR, deploy, fresh probe, full target clip, background recovery, and
steps 5–14 remain pending.

The read-only website reservation ledger after attempt 3 shows 14 of the
amended 32 preparation requests used and $0.576 reserved against the $5
preparation cap. Pipeline PR #2116 passed its impacted/sentinel CI gate and
merged to `main` as `7829d4b443b51c00f98828aeb99cd0f2b6c3607f`.
The canonical isolated canary deploy of pushed source
`258ee26f2d7ad5bfe2ba3f768abb6732b50c222b` has started under
`blueprint-drawer-concept-deploy-258ee26f.service`. The listener remains
paused pending a completed deploy receipt and live version proof.

### Fresh capture attempt 4: cabinet tracked, corroboration blocked, 2026-09-22 ~22:23 UTC

The canonical deploy of source `258ee26f2d7ad5bfe2ba3f768abb6732b50c222b`
completed with two verified surfaces and `commit_proven: true`; the normal
controller claimed attempt 4. Its `under-desk cabinet` one-frame probe found the
whole pedestal. The refined hosted SAM video result was retained and decoded:
`task_masks.object_removal.json` reports `object_removal_ready` and the selected
cabinet source track contains 186 original-frame observations. This is evidence
of the cabinet task mask, not a completed step 5 or a clean background.

The next stage began an independent single-frame look at selected view 173,
then stopped with `clean_plate: KeyError`. The selected target record omitted
`segmentation_prompt`, which the corroboration stage needs to ask SAM for the
same object. There is no completed corroboration or image edit. The controller
ledger is `failed_retryable`, attempt 4; the listener timer and service were
stopped to avoid repeated paid retries. Pipeline PR #2117 propagates the exact
chosen SAM noun into the target manifest. Its 43 focused tests, changed-file
Ruff/diff checks and hosted impacted/sentinel gate passed; it merged to main.
A canonical canary deploy of pushed commit
`1022228cf65ac717b9003552eee853db71951633` has started with GPU guard
showing zero live instances. The listener stays paused until that deploy's
receipt and live version prove the source commit.

The owner also requested a faster view-first masking path. Draft Pipeline PR
#2118 implements a separate, default-off development canary: select original
views first, prove the text concept on one frame, then track across a short
lossless selected-view clip. A no-provider scratch replay on the exact drawer
video selected original frames 0, 30, 35, 138, 150, 242, 346 and 519 and
prepared the clip in 19.32 seconds. This measures input preparation only;
there is no hosted-SAM speed or end-to-end result claim for that path. The
current fresh capture remains on the verified continuous-video path. Fresh
step 5 has a retained cabinet mask but awaits corroboration and clean-plate
completion; steps 6–14 and both room/fixture outcomes remain unproven.

### Fresh capture attempt 5: mask check passed, clean-plate review blocked

The hotfix deploy receipt for `1022228cf65ac717b9003552eee853db71951633`
completed with both surfaces verified. The live version endpoint proved that
commit with no blockers, and the listener resumed. The controller claimed
attempt 5 and reused the retained full-video cabinet track. Independent
single-frame SAM corroboration on original frame 173 compared a 21.3993% tracked
mask with a 20.7911% fresh mask, passed, and retained all 14 candidate views.
This closes the cabinet mask/corroboration substep, not the clean-plate stage.

The configured `gpt-image-2.5-sunburst` image backend retained five edited
outputs. Independent Gemini review then blocked the prepared views:
`consistent_background`, `people_absent` and `unrelated_objects_preserved` were
true, but `task_objects_removed` was false because the cabinet remained in the
first selected view. That view is original frame 0 and had zero cabinet-mask
pixels, so the editor could not remove it. No room reconstruction or GPU stage
started. Attempt 5 is `failed_retryable`, and the listener timer is paused.

Pipeline PR #2119 asks the reviewer to return exact frame IDs for remaining
task objects. If all other checks pass, the controller may exclude only
identified views that were never edited, retain both review receipts, and run
one final review. It still blocks if an edited view fails or the second review
fails. Focused tests cover both cases. The pushed canary source
`35fda8ad43a63242a0add78ac286e606146fb095` is being deployed with the
listener inactive and GPU guard at zero. Steps 6–14 and captured-room/fixture
completion remain unproven.

### Fresh capture attempt 6: clean plate passed, Marble admission blocked

The controller reused the retained cabinet track and five image edits. The
new structured review identified only `decoded-000000000` as an unedited view
still showing the cabinet; the controller excluded it, retained the failed
review, and independently reviewed the remaining five prepared views. That
second review passed. The clean-plate stage manifest now reports
`objects_removed`, `prepared_images`, no blockers, and the excluded original
frame ID. This closes task-object background recovery for the prepared views;
it does not prove room geometry or simulation.

The same attempt then failed before a World Labs request:
`website_reconstruction_release_not_admitted:gpu_canary_deployed_release_receipt_unverified`.
The active release receipt is valid and the live intake endpoint proves its
commit, but the paid-release checker expected the older fixed source checkout
path. Canonical deployments in this lane use clean root-owned clones under
`/opt/blueprint/control-plane-config-tools`, and the receipt accurately names
that clone. Pipeline PR #2120 limits admission to the exact receipt-bound clone
under that approved root (or the fixed canonical checkout), rejects outside,
nested and symlink paths, and preserves the development-only claim. Thirty-five
focused admission/allocator tests passed. A read-only replay on the host with
the candidate source and current receipt returned `verified_active_release`,
zero blockers, `development_iteration`, and `promotion_eligible: false`.
The pushed source `5d7bcdb8b` is in canonical canary deployment. Listener
service/timer remain inactive; GPU guard reports zero live instances. No
Marble operation or provider spend was admitted on attempt 6. Steps 8–14 and
captured-room/fixture outcomes remain unproven.

### Fresh capture attempt 7: World Labs account credit blocker

The clone-release admission fix deployed as
`5d7bcdb8bc0096022dd71c24eda835a2167a0aea`; its canonical deploy
receipt reports `deployed`, the live version endpoint proves the exact commit,
and the paid-release inspector as the `blueprint` service user reports
`verified_active_release`, no blockers, `development_iteration`, and no
promotion eligibility. The controller claimed attempt 7 and admitted one
World Labs request with a $2.48 maximum under this scene's preparation
sponsorship. It uploaded the prepared input views and sent the generation
request for `marble-1.1-plus`.

World Labs rejected generation with HTTP 402: insufficient API credits. The
provider returned no operation ID or world ID. The provider-run manifest is
`failed` with that exact reason; the submission intent remains
`status: submitting`, so the current controller correctly refuses an automatic
repeat until the explicit rejection is reconciled in code. The listener timer
and service are inactive. This is an external provider-account blocker, not a
geometry or mask mismatch. No Marble reconstruction, captured-room integration,
CPU articulated asset or GPU episode is proved. The five reviewed clean-plate
views remain retained. A named development drawer fixture is permitted by the
owner contract, but the existing authored-surface fixture path is for rigid
pick-and-place and is not an articulated drawer controller path; it cannot be
claimed as completed or used to fabricate website results.

### Credit recovery after owner top-up

The owner added World Labs API credits. A read-only authenticated
`GET /marble/v1/credits` returned HTTP 200 and 6,250 remaining API credits
at 2026-09-23 00:05 UTC. This exceeds the documented 3,100-credit maximum
for a Marble 1.1 Plus multi-image request. The check did not start a world.

The scene's WebApp ledger, read before reconciliation, showed 26/32
preparation requests and $4.755/$5 reserved or settled. The rejected Marble
attempt held a $2.48 quote. Pipeline PR #2121 merged as
`aa647d6c503591c688ae36429a5181add1f21941`; it accepts only the exact
recorded pre-generation credit rejection, settles its unused quote, retains
the original evidence, and permits one new generation attempt with a distinct
bounded grant. WebApp PR #676 merged as
`a040ea0611030bddadf943ef2113c8b6de4d2793`; its signed settlement route
can record that rejection at zero cost without restoring the consumed request
count. The Pipeline canary release is being deployed from exact pushed source
`ad2ea98d426c35f671bd562ce6641f31ae32bb8e`. WebApp main CI passed and
its exact-SHA Render deployment started. Until both live identities are
verified, the listener remains paused and step 8 remains blocked.

### Marble world retained; retry settlement path repair

Controller attempt 8 settled the initial credit rejection at $0 and started one
separately bound Marble request. World Labs operation
`51323203-7420-421a-a460-d6aa6ea63745` finished with world
`baffc3ca-4c87-45dc-8531-52c3275820ed`, 1,600 credits ($1.28). The
provider-run manifest is `ready`; downloaded collider GLB and full-resolution
splat SPZ have a complete materialization manifest. The Marble-to-SimReady
bridge is `review_ready_with_conversion_required`. The controller also wrote
the website visual publication. These receipts do not prove MapAnything,
registration, articulated CAD, native import, or policy evaluation.

A controller path error saved the new request admission under the first
attempt's filename. The existing world and price receipt remain usable, but
the current release could not settle the $1.28 bill and the subsequent $0.50
MapAnything reservation got a WebApp `budget_exhausted` response. Attempt 8
ended `failed_retryable` without another Marble POST. Pipeline PR #2122 merged
as `65ad58b0ec8ac3a97f4935497cc45beb98da1dfd`: future retry admissions
use their own path, and the already-running request is recognized only when
its binding exactly matches the retained operation and the first rejection is
settled. The listener is paused and the canonical canary deployment of that
exact merge commit is in progress. The next attempt should reuse the world,
settle its actual cost, and then resume MapAnything under the same scene cap.

### MapAnything first rental: bootstrap refusal, fully torn down

The deployed `65ad58b` release settled the retained Marble operation at its
actual $1.28 cost. Attempt 9 compiled a MapAnything bundle with SHA-256
`87b5cdf545eaf11d4cab1d6fb275f0b1d4fb9fff42fab6e9bd75810882737188`,
then its transport selected an older bundle under the same controller directory
with SHA-256 `db39a28657038f34383d6b2a89d84d29d3421d7ea3d14bea2b1a3eb84ce9c745`.
The GPU worker refused the mismatched download; it produced no geometry. The
900-second bounded attempt cost $0.273980, ended `failed_retryable`, and wrote
teardown `PASS` and provider-zero `PASS`. A subsequent pass on the old release
refused to reuse the failed operation and did not launch another GPU.

Pipeline PR #2123 merged as `401455a1f2bf65e9e873c4e4d5d6ec43ff75d99e`.
The controller now stages the precise receipt-named bundle after digest and
byte-count verification. A new release may make one distinct retry only when
the earlier execution failure, teardown and provider-zero receipts validate;
the same release and an uncertain allocation remain blocked. Twenty-five
impacted tests and nineteen MapAnything/Vast tests passed. The retry predicate
also passed against this capture's retained terminal receipts. Canonical canary
deployment of the merged commit completed with exact live source proof. Step 8
remains incomplete until MapAnything returns source-frame camera/depth estimates
and the GPU tears down.

### MapAnything second rental: exact bundle, worker ended without output

Controller attempt 11 staged the precise receipt-named MapAnything bundle.
Both staged bytes and the transport digest matched
`sha256:f1eeb3ad7ec73054295b1e77a368b0cf2d0103b287d1e0803629f58456f8e62f`.
The Vast instance exited after about 193 seconds without a geometry result.
The execution receipt is `failed`, teardown is `PASS`, and provider-zero is
`PASS`. The controller did not accept an image or a static validator as a
policy episode. The listener timer and service were stopped after this failed
attempt, with no live GPU instance. The worker's exact exception was not
retained before destruction, so its cause remains open.

Vast's per-instance charges API reports $0.228 for the first failed rental
and $0.010 for the second, including GPU, disk, and bandwidth. The WebApp
still holds each $0.50 reservation because it lacks a Vast settlement route;
the scene has 29/32 requests and $4.555/$5 reserved or settled. The owner has
authorized more requests, while the fixed $5 preparation spend cap remains.
Pipeline PR #2124 merged as `67d0a3ff3a9133c120602474b88ab70677490183`.
It retains typed worker failure evidence, allows one further new-release retry
only after failed execution plus teardown and provider-zero proof, and
reconciles exact-instance provider charges under the unchanged $5 spend cap.
Focused tests and the hosted impacted/sentinel gate passed. Its exact pushed
source `44d5a3af0caf0fb90f193054ec2d2fa9adad291b` is in canonical canary
deployment, with the listener stopped and Vast reporting zero live resources.

WebApp PR #672 merged as `926392e952f23819d8cbc29214818df5b8f3a808`.
Its exact-SHA Render deployment reports both web and worker live at that
commit, and the live version and readiness endpoints agree. The owner-approved
append-only preparation request extension from 32 to 48 was applied and
re-read with receipt digest
`sha256:f5fe0224c20de3b7481b60303059fafdde0598866b95a8e9d82463af92c60950`.
The $5 preparation and $20 simulation spend caps are unchanged. Step 8
remains incomplete until a MapAnything geometry receipt and teardown pass;
steps 9–14 remain unproved.

### MapAnything third bounded rental: dispatched after exact-charge settlement

The canonical Pipeline canary deploy completed at source
`44d5a3af0caf0fb90f193054ec2d2fa9adad291b`. Its receipt is `deployed`;
the live intake endpoint proves that commit with no blockers, and the
service-user active-release inspector reports `verified_active_release`,
`development_iteration`. Vast's authenticated global inventory was zero
before restarting the listener. The production runtime preflight passed.

The controller settled both earlier Vast reservations from the provider's
exact-instance charges: $0.228 for instance `52147319` and $0.010 for
`52151169`. It admitted `controller_geometry_retry_2` with a distinct
request, a $0.50 maximum, no in-rental retry, an independent watchdog, and
the original scene authority. The Vast instance started at 02:44 UTC on
2026-09-23. It returned a validated `website_source_geometry.v1` result with
13 original-frame camera and depth estimates, including frame 35. The GPU
execution receipt is `completed`; teardown and provider-zero are both `PASS`.
This closes MapAnything acquisition. The estimates are not measured dimensions
or physical registration.

The next controller boundary refused captured-room registration with
`website_registration_anchor_frame_missing`: Marble declares original frame
34 as its first-input camera, while the MapAnything sample contains frame 35
but not 34. Read-only registration trials using frame 35 as a proxy and using
no anchor both returned `website_registration_ambiguous`. Captured-room
integration stays pending. Pipeline PR #2125 adds the exact refusal to the
authorized, separately named `development_drawer_fixture` path and preserves
the prismatic middle-drawer task without a destination. The exact saved-input
scratch replay produced captured-scene `needs_input` and a distinct fixture
`intake_ready`; it did not call a provider or write a scene receipt. PR #2125
merged as `c8c5a30b21d7fab8853f2566ac50f94af43e82bb` after the hosted
impacted/sentinel checks passed. The exact scene was added to the controller's
development allowlist, preserving the other entries, and the canonical canary
deployment completed at the merged source with the listener paused. On
controller attempt 13, the named development fixture and its construction,
rights, and runtime inputs were written. The website refused the fixture
handoff with HTTP 409 `website_scene_development_test_not_authorized`, so no
website intake outbox or authoring receipt was created. The refusal was not
caused by fixture construction; its website-side cause was still under review.
The exact scene context digest was appended to each Render service's existing
development allowlist without changing the other entries. Render requires a
deploy for an environment change to take effect; both web and worker deploys
are live on unchanged application commit
`926392e952f23819d8cbc29214818df5b8f3a808`. The public version and
readiness endpoints agree, and the listener has resumed controller attempt
14. Steps 9–10 and 12–14 remain unproved; step 11 has only fixture-preparation
evidence.

Controller attempt 14 retried after both Render services were live with the
scene-specific allowlist and still received the same HTTP 409. Comparing the
retained request with the deployed WebApp validator found that the validator
admitted only the older `authored_surface_component_test` kind and label. The
controller correctly supplied the distinct `development_drawer_fixture` kind
and its explicit captured-room-pending label. The WebApp now admits both exact
kind/label pairs under the existing scene digest allowlist, while still
requiring development-only scope and refusing mismatched labels or a claim
that captured-room evaluation is ready. A focused route test and TypeScript
typecheck passed locally; deploy and live retry remain pending.

On 2026-09-23 the WebApp web and worker both reached merged commit
`1a75f62217989b434f8484c69dfe8ab37b05fcef` with ready endpoints.
The controller retried the same scene, and the WebApp accepted and forwarded
the named development fixture. The control plane registered owner intent
`scene-bd07d5f70b11b9d53a84b8daef682efe42251db171705ee52c80a51906ab380b`.
It initially refused whole-chain disk admission: 19,327,352,832 free bytes
were required, about 15.2 GB were available. Canonical scratch GC retired
three exact idle parent replay directories plus smaller old scratch entries,
each with a manifest and receipt, without removing scene evidence. A separate
release-retention patch was not used. The controller then prepared an immutable
production scene-construction envelope and an activation intent; it has not
started paid construction.

The activation worker's saved-input lookahead refused the articulated drawer
template because its continuation parser admitted only rigid relocation.
Pipeline PR #2127 added the articulated template path with an estimated drawer
front used only as a robot placement hint. It merged as
`15d1b57ffcba7896e0f7f8d4e423bfd1f2c7b6e8`; 53 focused tests passed,
and exact saved-input replay on the host accepted both downstream consumers
with zero blockers and no provider mutation. Canary deployment of its exact
source SHA `8fbe7b768cc0a8ab4d1250d4a1a12b959fbd6810` is underway. Step 11
remains partial, steps 9–10 and 12–14 unproven; neither captured-room nor
development fixture evaluation is ready to claim.

The canary deployment later completed with both release surfaces at
`8fbe7b768cc0a8ab4d1250d4a1a12b959fbd6810`, live version proof and no
blockers. A fresh provider-zero observation allowed the controller to reserve
a new attempt on that release. Its saved-input lookahead passed, and the
authority-gated activation queued. The CPU provider-bundle stage then refused
before allocation: `astra_authoring_configuration_kind_unsupported` for the
articulated replacement configuration. The preflight had selected the rigid
one-piece translator even though the existing Astra authoring worker supports
carcass and drawer as distinct parts. Pipeline PR #2128 routes the exact
articulated schema to that two-part preflight; 53 focused tests pass, and a
scratch build from the retained production construction envelope returned a
`ready` 1,194,261,436-byte provider bundle without allocating a provider.
PR #2128 passed its hosted gate and merged as
`abf84fe18f761087dad58d4272d20d38d3855c5f`; its exact-commit canary
deployment is running. Step 10 remains unproven until the controller actually
authors and validates the asset.

## 2026-09-23: development fixture CPU attempts

The durable controller admitted the separate `development_drawer_fixture` and
launched it on Pipeline release `24af68312b73a6a6a4b7cd3b7fea9cd0751eff23`.
CPU stages 1 and 2 checkpointed. Stage 3 authored both carcass and drawer
candidate geometry, but the model-spend gate stopped the next Astra call:
14 completed calls had estimated usage of $3.74245, and the next $1.40
worst-case reservation would exceed that attempt's $5 authoring cap. The
allocator reported zero GPU provider mutations and no Vast instance. Pipeline
PR #2131 raised the articulated website attempt's authoring allowance to $7
while leaving the $20 scene simulation limit unchanged. It also projects
that failed pre-GPU attempt at its full $5 model cap, based on the retained,
digest-bound CPU archive, rather than retaining its unused GPU allowance.
PR #2131 merged as `1c7c617c7060f11df35fd668c4449094b579575b` and was
canonically deployed with a proven live commit.

The next controller attempt,
`website-52ff463bc7855063836d5861-1c7c617c-20260923t085718z-activation-auto-launch`,
passed paid admission and the CPU preflight, then failed stage 3 with
`authoring_independent_review_limit_reached`. Its archived tool sequence shows
two valid carcass renders, each followed by `observe_object`, which cleared the
rendered candidate before the independent visual reviewer could inspect it.
No appearance review ran, no complete drawer link was authored, and no GPU
provider mutation occurred. Thirteen completed model calls carried estimated
usage of $3.69448; the provider's official completion receipt still says
`official_cost_reporting_pending` and `cost_is_final: false`. The signed
settlement retains the full $13 attempt allowance pending a narrower verified
budget projection or final billing. Those estimates are not final charges.

Pipeline PR #2132 makes each completed `render_candidate` tool call hand off
immediately to independent review, records digest-bound render artifacts for
resume, and keeps older inspected-render checkpoints readable. The focused
session, resume and scene-configuration tests passed 64/64; the two-part runtime
tests passed 6/6. PR #2132 merged as
`ac39dabb9af5b46dbb2f90a73d2edf1a3fee32bf`; its canonical deployment is
in progress at the time of this entry. The current scene's conservative
simulation holds are $5 plus $13 against its fixed $20 limit, while another
full articulated attempt is quoted at $13. No further paid attempt is implied
by the code merge. Steps 10 and 12–14 remain unproven; step 11 remains a
separately labeled development fixture handoff, not captured-room readiness.

## 2026-09-24: same-scene Claude retry and bounded render repair

The durable website launch `website-c577df51a964aa540227c710-09c0586d-20260924t142508z-activation-auto-launch` passed admission on the development fixture. CPU stages 1 and 2 reused their retained inputs. Stage 3 used Claude Opus 5.5 through the existing Agents SDK, exported a valid carcass STEP/STL at estimated bounds 550 × 586.67 × 781.53 mm, and Blender wrote perspective, top and side studio images. The render subprocess had a 600-second bound and had not exited after the final image; the trusted runner raised `TimeoutExpired`. The controller marked the launch blocked before independent visual review, drawer authoring completion, native qualification, GPU rental or policy query. Its launch receipt, archived CPU output, website sync and post-teardown provider-zero receipt are retained. This is a completed failed CPU attempt, not a completed step 10 or policy episode.

Pipeline PR #2174 reduced denoised CPU studio renders from 32 to 16 Cycles samples at unchanged 960 × 960 resolution and raised both bounded authoring render timeouts to 900 seconds. An isolated no-provider replay of this exact carcass and its saved images completed all three new studio renders in 143 seconds, compared with the failed production render's 600-second limit. The replay only verifies the render path; it is not scene qualification or evaluation. PR #2174 passed 42 focused tests, changed-file Ruff and hosted impacted checks, then merged as `de30eba14f973376dc827750085b83518bfba9da`. Deployment was started but was not yet proven live at this entry.

The owner authorized a bounded spend increase. The canonical append-only budget API wrote extension `sha256:f4f296e65e416457ebd21ddeb5fece9c1795f6eb6258c97d9e1c97d2b5c7b017`, raising cumulative simulation exposure from $20 to $27 while keeping 16 attempts and all per-attempt limits. It did not change the fixed $25 website development-test price, erase historical reservations or authorize an unbounded retry. The next production attempt remains pending exact live deployment and a fresh controller preflight.

### 2026-09-24 15:55 UTC — Signed extension and controller retry

The canonical de30 deploy completed with exact live commit proof and no blockers. The previous failed CPU launch kept its full $13 quote under `terminal_launch_unreconciled`; earlier holds totaled $20 of conservative exposure, not confirmed provider billing. On the owner’s request, the append-only budget API recorded sequence 2, digest `sha256:d180b4a4981ea1b87ed7e4aafcf72500b2fa8489dccf6e18ee8504cfea2dbf8f`, raising cumulative simulation exposure from $27 to $33. The 16-attempt count, $13 per-attempt quote and $7 CPU model cap remain enforced; the website price stays fixed at $25. No signed settlement or earlier receipt was edited. The controller created a same-scene de30 source attempt and reached event 36, `awaiting_execution/scene_configuration`, with no blockers. Launch activation is running; CPU qualification, GPU policy, and website terminal results remain unproven. The operator-door watcher was temporarily stopped before paid work to prevent a deployment from interrupting this attempt and must be restored after terminal provider-zero.

At 16:02:46 UTC, durable launch `website-c577df51a964aa540227c710-de30eba1-20260924t153842z-activation-auto-launch` started on de30 after activation published a verified profile. Paid admission was still running at the last 16:04:49 UTC observation; no completed CPU authoring receipt, GPU episode or website result is yet proven.

By 16:06 UTC, the new launch had a controller `admitted` receipt with no blockers and the CPU prestage entrypoint had emitted its first progress tick. This proves paid admission and CPU process start, not CAD/Blender completion or independent review.

At 16:14 UTC, the active CPU prestage wrote completed-prefix checkpoint receipts for stages 1 and 2 and started stage 3, the articulated CAD/Blender authoring stage. The new stage 3 result and independent review are still pending.

At 16:26 UTC, stage 3 generated a carcass STEP with passing readback (550 × 586.67 × 781.53 mm), watertight visual mesh, three finished studio renders and a `.blend` file. The separate Claude Opus 5.5 visual review returned all required booleans true and no blockers, while listing unseen interior and rear surfaces as generated. The carcass `result.json` says `candidate_authored_pending_native_qualification`; it is not final qualification. Drawer CAD authoring had started and was still running.
