# Drawer scene: website-origin articulated evaluation, end to end

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
| 10 | Controller-created articulated CAD/Blender/USD asset with independent static validation | Multi-link USD, joint data, references, static qualification receipt | **partial: packaged candidate, no accepted assembly** — the latest `89c7bd02` attempt authored separate carcass and drawer parts, passed independent appearance review, and packaged an articulated USDZ with the middle drawer as the prismatic task link. The stage-3 adapter refused a real input mismatch: the task requested a 0.1222 m stroke, while the shallow 0.16287 m source box forced the plan to 0.07487 m. No stage-4 static qualification receipt exists. Merged Pipeline fixes add a scene-bound development depth estimate and pre-CAD gate, but have not been deployed or run live. |
| 11 | Room integration with local geometry workaround, or separately identified development fixture | Integration receipt OR fixture receipt with explicit world label | **partial: fixture handoff, assembly not accepted** — the controller wrote separately named `development_drawer_fixture` construction, rights, and runtime inputs; the website accepted and forwarded the handoff, and the control plane registered its intent. The latest CPU attempt stopped before static or native qualification. Captured-room integration remains unqualified. |
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

## 2026-09-23: owner grant and third fixture attempt

The scene's original simulation authority was $20 through 18:50:52 UTC on
2026-09-23. Signed terminal settlements stayed intact. The controller's
evidence-bound budget projection retained $5 for one prior CPU attempt and
$13 for the latest unreconciled attempt, or $18 in all; the next attempt
quoted $7 CPU authoring plus $6 native compute. The owner explicitly
authorized raising this scene's spend cap. The existing append-only owner
grant set the cumulative simulation cap to **$31**, the minimum that admits
one more $13 attempt, while keeping the 16-attempt limit and per-attempt
limits. Grant digest:
`sha256:2b657b24ebf6dc857714626fd31519a5676ef597d4debe0dab1c48e4be4b6851`.
This is additional internal development exposure; the website's fixed $25
task price and no-charge development handling were not changed.

On deployed Pipeline commit `ac39dabb9af5b46dbb2f90a73d2edf1a3fee32bf`,
the durable controller cleared `scene_intake_spend_cap_exhausted` on the
same intent and source attempt `source-6fce2c277e294a9b03ffd3cf`.
Activation materialized with no blockers. The WebApp accepted launch
`website-52ff463bc7855063836d5861-ac39dabb-20260923t104154z-activation-auto-launch`
with HTTP 202. Allocator admission was `admitted` with no blockers and the
controller wrote `launch_started.json` at 12:21:05 UTC. As of 12:26 UTC,
its live CPU prestage log had advanced to tick 4; no GPU instance, completed
articulated asset, policy episode, or website result was proved. The run
remains a development fixture and does not qualify the captured room.

## 2026-09-23: credit failure and bounded continuation

The third fixture launch stopped in CPU stage 3. The retained stage log records
OpenAI HTTP 429 `insufficient_quota` / `credit_balance_exhausted` during
articulated authoring. Stages 1 and 2 completed. The carcass and drawer CAD
candidates and first independent drawer visual review were retained, but the
review rejected a coarse texture; the later appearance pass did not finish.
The allocator reported `provider_mutations_performed: 0`, and no GPU rental,
policy action, native import qualification, or website result occurred.

The owner reported adding OpenAI credits. The new balance is not yet verified
by an authoring call. The ledger conservatively holds the failed launch's full
$13 quote, giving $31 total retained exposure. An append-only owner grant
raised this scene's cumulative *internal* simulation limit to **$44**, the
minimum for one more $13 attempt; the 16-attempt count and original per-attempt
guards stayed fixed. Grant digest:
`sha256:694a027ea58018af755827d5d9a17b768e4bb09306cec019ab9fc93f6a1f58c6`.
No signed settlement was edited, no new scene identity was created, and the
website's $25 task price/no-charge development handling did not change.
Progression remained at event 65 `scene_configuration_failed` when checked
immediately after the grant; the listener timer was active and its service was
activating. Steps 10 and 12–14 remain unproven.

## 2026-09-23: retained-record repair and live CPU retry

Pipeline PR #2133 merged the GPT-6 Sol model upgrade. Its first deployed
release reached drawer activation, then global spend validation rejected
historical signed GPT-5.6 Sol placement records from another scene. PR #2134
restored read compatibility for those exact retained records while keeping
GPT-6 Sol for new calls. The repair passed 55 focused tests and read-only
validation of all 542 actual host attempt cancellations. PR #2134 merged as
`3c177ad5cee75567f4dd7c128d63a5dfe06ea411`; the canonical deploy receipt
says `deployed`, and the live version reports the exact commit with
`commit_proven: true` and no blockers. No signed record was edited.

The durable controller then advanced this fixture through preparation and
website activation, published the profile and standing authorization, and
queued launch
`website-52ff463bc7855063836d5861-3c177ad5-20260923t141516z-activation-auto-launch`.
Allocator admission is `admitted` with no blockers. `launch_started.json`
records 14:34:10 UTC; the launch process and CPU provider child were alive at
approximately 14:38 UTC, with CPU prestage heartbeats through tick 2. The
GPU guard reported zero live instances. This is a live bounded development
fixture attempt, not a completed CAD/Blender asset, native qualification,
policy episode, website result, or captured-room evaluation. The new OpenAI
credit balance remains unverified until a successful bounded authoring call.

## 2026-09-23: drawer author context failure and bounded repair

The `3c177ad5` fixture launch completed CPU stages 1 and 2 and checkpointed
both. Stage 3 authored the separate cabinet carcass candidate and rendered a
first drawer candidate. Its independent visual review found that the drawer
front was too cool and uniformly striped compared with original frames 0 and 3,
and found black patches near the box corners and handle mounts. It requested a
warmer wood finish, more natural grain, and removal of those artifacts. Before
the author could make that correction, the per-request context gate refused the
next GPT-6 Sol call with `authoring_session_context_ceiling_exceeded`. The
archived CPU bundle retains the 22-row authoring conversation, original image
references, visual review, and typed `failure.json`. The allocator result is
`blocked` with `provider_mutations_performed: 0`; the process exited and the
15:16:58 UTC global GPU guard passed with zero live instances. This is not a
finished drawer, native import, policy episode, or website result.

The old compactor kept older generated inspection images in the next request.
Pipeline PR [#2136](https://github.com/ognjhunt/BlueprintCapturePipeline/pull/2136)
merged as `15c94f6ffd700830de6278aa43b4c565499cd96f`. It selects progressively
smaller, bounded inference views while keeping the original source and complete
current repair turn, retaining the latest editable program when it fits. The
80,000-unit ceiling, persistent history and spend gates are unchanged. All 34
focused authoring/resume tests, changed-file Ruff, and hosted impacted/sentinel
checks passed. A read-only replay of the saved drawer history as the `blueprint`
service user fit at 76,811 units with a deliberately generous 40,000-unit
non-history allowance, keeping the original source, current review, and latest
render program. No provider call was made in that replay.

Canonical canary deployment of that merge began as
`blueprint-drawer-context-deploy-15c94f.service` at approximately 15:32 UTC;
its receipt, live commit proof, controller recovery and next paid attempt remain
unverified. The 14-step matrix remains unchanged except for this status note:
step 10 and steps 12–14 are unproven, step 11 is partial, and captured-room
registration remains unqualified.

## 2026-09-23: verified deployment and unused GPU hold projection

The `15c94f6f` canonical deploy receipt reports `deployed`; the live pipeline
endpoint reported that exact commit with `commit_proven=true` and no blockers.
After a fresh global provider-zero check, the durable controller advanced this
same scene through event 84 `source_preparation/running`. Event 85 then stopped
before a new paid launch with `scene_intake_spend_cap_exhausted`. No new model
call, GPU rental, or policy episode occurred.

The signed $44 cumulative exposure was fully held. A read-only service-user
projection found three terminal CPU stage-3 attempts each holding the full $13
CPU-plus-GPU quote although their complete, digest-bound archives show only
stages 1–3, zero Vast provider mutations, completed no-GPU teardown, and a
$7 OpenAI authoring reservation. Another terminal authoring attempt held $5;
other settled rows held zero. This is conservative authorization accounting,
not a claim that $44 was billed. The original signed settlements remain intact.

Pipeline PR [#2137](https://github.com/ognjhunt/BlueprintCapturePipeline/pull/2137)
merged as `83f5277ab367bfe9a7c6b9763ca8ed7232842fc1`. It extends the existing
archive-bound projection to the observed rate-limit and asset-authoring failure
forms, retaining the full $7 CPU model ceiling for each and releasing only the
never-started GPU allowance. Unrecognized or tampered evidence retains the
original hold. The 93 focused tests, Ruff, diff check, and hosted impacted and
sentinel checks passed. A read-only service-user replay against the exact
retained scene records projects $26 held, so the next $13 quote fits within the
existing $44 owner grant. This is a cap projection, not final provider billing.

The canonical deploy unit `blueprint-drawer-hold-deploy-83f5277.service` started
after a fresh global guard passed with zero live instances and no active paid
allocator. Its receipt and live commit proof are pending. The controller owns
any retry after deployment. Steps 10 and 12–14 remain unproven; step 11 remains
partial, and the original captured-room registration remains unqualified.

## 2026-09-23: controller-owned authoring retry admitted

The canonical retry deploy receipt reports `deployed` for exact Pipeline commit
`83f5277ab367bfe9a7c6b9763ca8ed7232842fc1`; the live version endpoint
reports `commit_proven=true` with no blockers. A service-user read-only
projection using the deployed code retained $26, leaving room for the next $13
quote under the signed $44 cumulative limit. A fresh global GPU guard passed
with zero live instances. The temporary deploy credential files were removed.

The durable controller progressed the same intent through event 91
`scene_configuration/awaiting_execution`. Activation published the scene profile
and standing authority without a provider call. It then submitted launch
`website-52ff463bc7855063836d5861-83f5277a-20260923t161850z-activation-auto-launch`.
The launch admission receipt is `admitted` with no blockers, and CPU prestage
reported progress ticks while its provider runtime remained active. At that
point it was an active paid attempt, so no deployment or WebApp merge ran over
it. The later terminal result is recorded below. Matrix step 11 remained
partial, steps 10 and 12–14 unproven, and captured-room readiness unqualified.

## 2026-09-23: drawer appearance rejection and bounded Astra retry preparation

That launch ended at CPU stage 3 with `authoring_independent_review_limit_reached`.
The retained stage archive shows a cabinet carcass that passed independent
appearance review and a separate drawer CAD candidate. Three drawer renders
failed the independent appearance review: the front was cooler and more uniform
than original frames 0 and 3, and the handle looked darker and more squared
than the observed bright silver bar. The last author program mapped a
17-pixel-wide source-image strip across the broad drawer front. No GPU provider
mutation or policy episode followed this failure.

The owner requested GPT-6 Astra for CPU CAD/Blender authoring. Pipeline PR
[#2140](https://github.com/ognjhunt/BlueprintCapturePipeline/pull/2140) merged
as `f4c2b87e562beb86fe8f63060443765d2fe5384b`; it restores Astra on this
bounded stage, retains exact model provenance for Sol-authored prior records,
and improves instructions for photographed surface patches. One hundred
focused tests and changed-file lint passed. Its canonical deployment receipt
reports `deployed`, and the live endpoint reports that exact commit with
`commit_proven=true` and no blockers. A fresh global GPU guard passed with zero
live instances after deployment. The controller still owns the retry; no
accepted drawer or policy episode is claimed from this code yet.

The service-user ledger retained $39 in conservative exposure. Under the
owner's previous bounded cap-increase authorization, an append-only grant
raised this scene's cumulative internal simulation ceiling from $44 to $52,
covering exactly one more $13 guarded attempt. The attempt count stays 16 and
the $7 CPU/$6 GPU per-attempt limits and fixed $25 website development-test
price stay unchanged. This grant is not evidence of actual provider billing or
of a new launch. Steps 10 and 12–14 remain unproven; step 11 remains partial.

## 2026-09-23: Astra retry admitted on the same scene

After the deployed Astra release and fresh provider-zero check, the durable
controller completed source preparation and activation for the same fixture
intent. It submitted launch
`website-52ff463bc7855063836d5861-f4c2b87e-20260923t181453z-activation-auto-launch`
through the canonical dispatcher. The allocator admission is `admitted` with
no blockers; its result is pending. No CPU authoring acceptance, native
qualification, GPU episode, or website result is claimed yet. Keep the evidence
matrix at step 11 partial and steps 10 and 12–14 unproven while this guarded
attempt runs.

## 2026-09-23: Astra drawer review failed before articulation packaging

The admitted `f4c2b87e` launch ended `blocked` at CPU stage 3. Its retained
`cpu_prestage_output.zip` has SHA-256
`d1cc5f52b098bf3bca8a9353749c11b8dfa09022a5e6524f50e902ec2bcc956e`.
Stages 1 and 2 checkpointed. Astra authored the cabinet carcass and drawer
CAD and Blender meshes. The carcass review passed as a development-only
candidate. The drawer's first independent appearance review rejected broad,
blurred wood grain against original frames 0, 2, and 3; it accepted the shape
and handle presence. Astra rebuilt a finer-grained drawer and rendered its
perspective, top, and side views, but that revised mesh never reached visual
review. Physical-property review 3 returned an `object_id` with extra hash
digits. Deterministic review rejected it as `object_identity_changed`, and the
authoring loop ended `authoring_independent_review_limit_reached`.

The allocator result reports `provider_mutations_performed=0`,
`configuration_completed=false`, and `evaluation_episode_executed=false`.
No articulated assembly, native qualification, GPU policy action, teardown of
a GPU rental, or website policy result is claimed. Captured-room registration
remains unqualified. The existing scene's simulation authority expired at
18:50:52 UTC, and the $52 cumulative exposure grant covered only this last
$13 quote; no further paid retry is authorized by that grant.

Pipeline PR [#2142](https://github.com/ognjhunt/BlueprintCapturePipeline/pull/2142)
merged as `44fdc9b98a6f6bf5331b24a123ae57b876784be6`. It preserves the bad
physical-review proposal and deterministic rejection, allows one separately
receipted, spend-guarded exact-ID correction call within the same render slot,
validates both completions on resume, and stops with a typed error if the
identifier remains wrong. Sixty-four focused authoring, resume, physical
review, and articulated packaging tests passed; changed-file Ruff and diff
checks passed. Hosted impact-plan upload was blocked by GitHub Actions artifact
quota before its dependent checks ran. A canonical deployment has started but
is not yet claimed complete here. Matrix step 11 remains partial; steps 10 and
12–14 remain unproven.

## 2026-09-23: exact-ID repair deployed; execution authority still expired

The canonical iteration receipt
`/var/lib/blueprint/pipeline-control-plane/deploy-receipts/iteration_44fdc9b_drawer_id_retry.json`
reports `deployed` with both active-release and source-checkout heads at
`44fdc9b98a6f6bf5331b24a123ae57b876784be6`. The live pipeline version
endpoint reports that exact commit, `commit_proven=true`, and no blockers.
Listener, scene-progression, and launch-reconciler timers are active. The
20:05 UTC global GPU guard passed with zero live instances and verified
provider zero. This is code deployment evidence only. A service-user status
read still reports `scene_intake_authority_expired`; the effective cumulative
budget is $52, and the last $13 quote is retained. The owner has been asked
for a bounded same-scene time and spend extension. No extension, new paid
attempt, native qualification, or GPU policy episode is claimed here.

## 2026-09-23: owner-approved same-scene execution extension

The owner approved a 48-hour time extension and a $91 cumulative simulation
exposure ceiling for this existing intent, with the 16-attempt ceiling and
$7 CPU/$6 GPU per-attempt bounds unchanged. As the `blueprint` service user,
the canonical append-only window grant extended expiry to epoch
`1790367906.5103035` (2026-09-25 20:25:06 UTC), then the canonical budget
grant raised the effective cumulative ceiling from $52 to $91. The grant
digests are `sha256:5989eef82d1033af6fdb4dff6a4ef4eae14a64eb2518280b449f35d91f5d19f4`
and `sha256:f66c154239310cb4282145133309994aaf5f6f9601cd262deed8f46802b43c62`.
Service-user readback verified both; historical holds and the prior 10 attempt
records were retained. This does not alter the fixed $25 website
development-test price or the $5 preparation guard.

The 20:27 UTC global GPU guard passed with zero live instances and verified
provider zero. Controller progression initially held a stale recovery blocker,
then advanced on its next normal pass to event 105, `running` /
`source_preparation`, with no blockers. There was no new paid launch, CPU
authoring acceptance, native qualification, GPU policy episode, or website
result at this observation. Matrix step 11 remains partial; steps 10 and
12–14 remain unproven. Captured-room registration remains unqualified.

## 2026-09-23: next guarded Astra fixture attempt admitted

After normal source preparation and activation, the controller queued launch
`website-52ff463bc7855063836d5861-44fdc9b9-20260923t201625z-activation-auto-launch`
on deployed Pipeline `44fdc9b98a6f6bf5331b24a123ae57b876784be6`.
Activation returned `profile_authority_materialized_no_execution` with no
blockers. The canonical dispatcher started the launch, and allocator
`admission.json` reports `admitted` with no blockers. The paid allocator is
running the CPU prestage; its entrypoint log reached progress tick 1. The
allocator result is pending. Do not count admission or a progress tick as
accepted articulation, native qualification, a GPU policy episode, or a
website result. The independent watchdog is active; do not deploy over this
healthy paid attempt. Matrix step 11 remains partial and steps 10 and 12–14
remain unproven.

## 2026-09-23: reviewed drawer parts, mass-bound packaging refusal

That launch ended `blocked` at 21:30:55 UTC in CPU stage 3, before any GPU
allocation, policy query, or evaluation episode. Its retained output archive
contains successful separate carcass and drawer CAD/Blender candidates,
independent physical reviews, and an accepted third visual review of the
drawer. Packaging raised
`authoring_packaging_estimate_outside_admitted_bounds:mass_kg`: the reviewed
carcass value was 10.84 kg, within the signed [4, 12] kg simulated mass
range, while its estimated physical uncertainty was [4.93, 22.99] kg. The
review did not claim a measured mass or suppress that interval. The allocator
reported `provider_mutations_performed: 0`; the Vast watchdog reported
`cancelled_no_allocation`. This does not say the OpenAI model calls were free.

Pipeline [PR #2144](https://github.com/ognjhunt/BlueprintCapturePipeline/pull/2144)
merged as `89c7bd020e6c52d61774627d23dc654b22aecda8`. For articulated
development candidates, the packager now admits the *simulated nominal* mass
within the scene's unchanged signed range and retains the full estimated
uncertainty plus an explicit out-of-range flag in the digest-bound link
receipt. The drawer remains 4.47 kg per generated link with estimated
[2.89, 5.93] kg uncertainty. Measured mass and contact-property intervals
retain strict full-range admission. Forty-one focused local tests, 32 adapter
and packaging tests, Ruff, and diff checks passed; hosted PR checks stopped
before tests because GitHub Actions artifact storage was full.

The exact failed stage-3 archive was replayed through the candidate's
production articulated packager as the `blueprint` service user, inside a
private Linux mount and network namespace. It passed without a model call or
GPU rental and produced candidate asset digest
`sha256:84d3dafb1a0bab7ca631d53859a5117ca9a274e436acd3fb0a6eefc8b8dd6aa7`.
The canonical canary deploy of the merged commit started as
`blueprint-drawer-mass-deploy-89c7bd0.service`; deployment and a later
controller-owned retry were still pending at this observation. Replay is a
fix check, not an accepted scene artifact. Steps 10 and 11 remain partial;
steps 12–14 and captured-room readiness remain unproven.

## 2026-09-23: shallow cabinet diagnosis and cost-free pre-authoring repair

The controller-owned `89c7bd02` retry ended before GPU. The CPU producer
completed an articulated cabinet-and-drawer USDZ and the final independent
appearance review passed, but its stage-3 adapter rejected the candidate. A
read-only comparison of the retained stage input and graph found the exact
cause: a source box projected to only 0.16287 m cabinet depth; the task input
requested [0, 0.1222] m prismatic travel, while the assembly planner reduced
the graph to [0, 0.07487] m to retain a drawer box. The strict graph-versus-task
check was correct; its generic `content_agents_replacement_result_invalid`
message hid the mismatch. The launch reports `configuration_completed:false`
and `evaluation_episode_executed:false`. Its teardown receipt says
`provider_zero_confirmed`, `provider_zero_verified:true`, and
`continuing_spend_from_this_run:false`; a separate global GPU guard observed
zero live instances. No policy query or website terminal result occurred.
Official OpenAI completion recorded $3.91298 provider-observed usage with final
cost reporting still pending.

The depth was not measured from the video. Original frames show the cabinet
mostly from the front or obliquely, without a clear rear edge. Manufacturer
specifications for comparable mobile pedestals put depth around 0.50–0.61 m:
[Steelcase Edvi](https://shop.steelcase.com/products/edvi-storage-copy),
[Herman Miller Kumi](https://ukstore.hermanmiller.com/pages/product-details-kumi-pedestal),
[IKEA MICKE](https://www.ikea.com/us/en/p/micke-drawer-unit-drop-file-storage-white-50213080/),
and [Global wood veneer BBF](https://admin.globalfurnituregroup.com/storage/96152/Wood_Veneer_Price_List_01_23_26.pdf).
These are object priors for a development fixture, not this cabinet's measured
specifications. The source width (0.58636 m) and height (0.7815 m) also sit
outside the cited examples and remain explicitly flagged for review.

Pipeline PRs [#2146](https://github.com/ognjhunt/BlueprintCapturePipeline/pull/2146)
(`25ff1df8`) and [#2145](https://github.com/ognjhunt/BlueprintCapturePipeline/pull/2145)
(`eff6f8b2`) merged a before-Astra, scene-bound geometry hypothesis and stronger
native import readback. The hypothesis retains the signed source AABB, names
0.55 m estimated depth with [0.45, 0.65] m uncertainty, and derives 0.4125 m
estimated travel and a 0.2475 m opening threshold before authoring. It remains
`development_only`; the captured room is still unqualified. Pipeline PRs
[#2147](https://github.com/ognjhunt/BlueprintCapturePipeline/pull/2147)
(`178ae982`) and [#2148](https://github.com/ognjhunt/BlueprintCapturePipeline/pull/2148)
(`5c28383e`) merged specific stage-3 mismatch reporting and stage-4 static
USD/graph/receipt/physics checks. The exact retained preparation/runtime
inputs and original-frame observation manifest passed a cost-free stage-3
transition replay; focused local tests passed (63 for the prior, 26 for native
import, 121 for the combined CPU chain, and 52 for the final static receipt
change), plus Ruff. GitHub Actions jobs for these PRs failed before startup
with an account billing/spending-limit annotation, so hosted checks did not
run. The subsequent deployment and cost-free compiler result are recorded below.
Steps 10 and 11 remain partial; steps 12–14 remain unproven.

## 2026-09-24: depth-aware website preflight and opening criterion repair

The canonical control-plane iteration deployed Pipeline `5c28383e6f3c46e659c8c24966d2583f54b28531`.
Its receipt reports `deployed`, both source and active-release heads match, and
the live version endpoint reports `commit_proven:true` with no blockers. The
controller then retried the *same* scene. Before any new paid model call or GPU
rental, website submission stopped at
`website_articulated_depth_opening_criterion_mismatch`. The revised proposed
stroke was 0.4125 m; multiplying by the owner's unchanged 60% requirement
produced the floating-point number `0.24749999999999997`, while the sealed
development hypothesis stored `0.2475` m. Exact float equality rejected the
same opening criterion.

Pipeline [PR #2149](https://github.com/ognjhunt/BlueprintCapturePipeline/pull/2149)
merged as `a566f85cf848b65d2c08924e81390aed073d505f`. It permits only
1e-8 m absolute representation noise in that estimated threshold comparison,
keeps exact stroke equality, and still rejects changed thresholds. Three
focused website tests and Ruff passed locally. The merged candidate's
production website submission compiler passed a full cost-free replay as the
`blueprint` service user against this scene's exact saved source and release
binding, producing a validated pending-publication manifest in scratch space.
That replay is a preflight, not a published attempt or asset qualification.
GitHub Actions checks were queued or skipped at merge, not verified green.

A canonical deploy of `a566f85` started as
`blueprint-drawer-opening-deploy-a566f85.service`; its deployment receipt and
live version have not yet been verified. No new paid authoring, native import,
policy episode, or website result follows from the code merge or preflight.
The development fixture remains separate from unqualified captured-room
registration. Matrix steps 10 and 11 are partial; steps 12–14 are unproven.

### Deployed continuation and bounded CPU attempt

The `a566f85` iteration receipt subsequently reported `deployed`, both
release surfaces matched the merged commit, and the live version endpoint
reported `commit_proven:true` with no blockers. The durable controller reused
the same scene intent, compiled and published the website submission, and
confirmed full-byte readback. Activation produced a standing execution
profile without a paid call. The controller then queued launch
`website-52ff463bc7855063836d5861-a566f85c-20260924t002250z-activation-auto-launch`.
Its allocator admission is `admitted` with no blockers. As observed around
00:43 UTC, the CPU prestage runner was live and its entrypoint log reached
progress tick 3; the independent Vast watchdog was active. This is a running
authoring attempt, not an accepted articulated assembly. No native import,
GPU policy episode, or website terminal result was observed. The separate
development fixture and captured-room completion states remain unchanged.

### Drawer review and retained budget stop

The live CPU run authored the cabinet carcass as a development-only candidate.
Its independent visual review passed with no blockers, while physical review
kept the 0.55 m depth estimate and uncertainty explicit. The separate middle
drawer CAD readback and physical review also passed, retaining estimated
drawer mass uncertainty rather than presenting it as measured. The first
drawer visual review rejected coarse, rippled wood grain against the original
frame references. The author then produced a finer second render (perspective
SHA-256 `294500407481947636dcf985e6ba48b6bdb67a073486566c207cb1c4562e44d3`),
but that second candidate never received an independent review.

The attempt ended at CPU stage 3 with
`agents_sdk_inference_budget_ceiling_exceeded`. Its retained inference journal
records 19 completed Astra requests with $5.6741 reconciled actual usage
against the $7 stage limit. The next visual review reserved a $1.40 maximum,
exceeding the $1.3259 remaining allowance, so it was refused before a model
request. The canonical launch receipt is `blocked`; its post-teardown receipt
is `provider_zero_confirmed` with no blockers. There is no accepted drawer,
assembled articulated asset, native import, GPU rental, policy query, or
website policy result from this attempt. The owner said the shown wood
appearance was adequate; that preference does not rewrite the first
independent review or accept the unreviewed revision.

Pipeline [PR #2150](https://github.com/ognjhunt/BlueprintCapturePipeline/pull/2150)
merged as `1221980e5d8fcd7d2deec8304d0efce0d1780bcf`. It guides future
independent reviews to treat modest grain, hue, or brightness differences as
cosmetic while retaining blocking checks for wrong parts, shape, material,
color family, opacity, and conspicuous texture artifacts. Review capability
`observable_v3` prevents silent reuse of prior verdicts under this guidance.
Pipeline [PR #2151](https://github.com/ognjhunt/BlueprintCapturePipeline/pull/2151)
merged as `a9d67e5f35b3e8d72839fc9cb54f59b7ebd0e70d`. It reduces only the
structured appearance review maximum output from 12,000 to 8,192 tokens;
the new worst-case quote is $1.2096, within the retained allowance. It keeps
the $7 stage cap and the strict review predicate. Focused tests, changed-file
Ruff, and the hosted impacted-test gate passed. A canonical control-plane
deploy of `a9d67e5` has started; its receipt and any controller-owned retry
remain pending. Matrix steps 10 and 11 remain partial and 12–14 unproven.
