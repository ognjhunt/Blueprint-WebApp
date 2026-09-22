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
| 1 | Website task intake, rights/task confirmation, task = open the selected drawer | Browser submission and immutable confirmed task consumed by Pipeline | unproven |
| 2 | Website upload of original bytes to existing storage, linked to the new capture/task | Retained object digest equals `d63aa286…d130` | unproven |
| 3 | Video/privacy/task review, timestamped original evidence, explicit unknowns | Retained review record with frame refs and unknowns | unproven |
| 4 | Task-relevant assembly selection and reconstruction plan | Plan names cabinet carcass + middle drawer + handle as the replacement assembly | unproven |
| 5 | Hosted SAM whole-video tracking/masks for the assembly parts incl. partial views | Track manifest with per-frame masks for both visibility windows | unproven |
| 6 | Task-specific image edits/background recovery, original/edited pairs retained | Edited views + review, originals unchanged | unproven |
| 7 | Provider-capacity view selection, wider context, originals preserved | View manifest with provider maximum and digests | unproven |
| 8 | Marble reconstruction/preview, durable provider artifacts, estimated geometry/scale/registration | Provider operation receipt, splat/collider digests, MapAnything estimate | unproven |
| 9 | Task-space/cabinet registration, removal/replacement boundary, provenance-tagged facts | Registration receipt with source/estimated/generated labels | unproven |
| 10 | Controller-created articulated CAD/Blender/USD asset with independent static validation | Multi-link USD, joint data, references, static qualification receipt | unproven |
| 11 | Room integration with local geometry workaround, or separately identified development fixture | Integration receipt OR fixture receipt with explicit world label | unproven |
| 12 | Native articulated import/reset/limits/contact/physics qualification | Native qualification receipt with assumptions | unproven |
| 13 | Robot team selects saved compatible setup; learned policies execute on GPU, controls skipped | Episode receipts with camera frames, actions, joint trajectories, metrics, failure reasons | unproven |
| 14 | Results/replay/media and honest status on the same website task page; thumbnail visible; provider-zero after teardown | Browser readback + provider-zero receipt | unproven |

Completion states tracked separately:

- Captured-room integration: unproven.
- Development end-to-end execution (fixture): unproven.

## Identities (new scene only)

None created yet. The blue-object identities (`team-eval-5aea93d1…`,
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
- 2026-09-22 03:05 UTC: Batch 1 implemented and tested locally (Pipeline 110
  focused tests + sentinels; WebApp intake/team-selection 61 tests, typecheck
  clean). Not yet merged or deployed; no upload has been made.
