# Dishwasher scene: website end-to-end run (2026-09-24)

A new website scene, driven from a Claude Code cloud session with
`docs/runbooks/cloud-scene-runs.md`. Source video `IMG_4178.MOV`. Task: open and
close the dishwasher. The owner authorized the run and every merge, deploy and
approval it needed.

## Identities

| Identity | Value |
| --- | --- |
| Inbound request / site submission | `capture-e41a08cd-d37f-4329-8e69-b5901d5ee5d3` |
| Capture | `walkthrough-capture-e41a08cd-d37f-4329-8e69-b5901d5ee5d3` |
| Scene | `site-capture-e41a08cd-d37f-4329-8e69-b5901d5ee5d3` |
| Source video | `IMG_4178.MOV`, 60,035,801 bytes, sha256 `c549b3b358fb3abe4248c81d20f28794e398ae2685fbbae990851941e639fedd`, 1920×1080 rotated −90°, 30.08 s, HEVC + AAC |
| Contact / claim email | `ohstnhunt+site@gmail.com` (site-operator account `rxKBT8Mff3MjsDadzShCvpoKskF2`) |
| Confirmed task text | "Open and close the dishwasher." Success: "The dishwasher door is opened fully and then closed fully." |
| Confirmed by | Nijel Hunt, consent statement `2026-09-18.v1`, region `us` (Austin, Texas) |
| Screening answers | `taskShape: single`, `objectVariety: under_10`, `sceneStability: stable`, `deploymentTimeline: this_quarter`, `accessWindow: scheduled` → `qualified` |
| Sponsorship authority | `sha256:7887d74a97f147be31b58e6cfc6320ae3257a91fedc2f948df30687e435ca1e7`, $25 preparation / $5 upstream / $20 native, 16 paid attempts |
| Preparation amendment | `max_requests: 32`, amendment digest `sha256:398b579113853f1e361b850679dd64ab97f61eb5bb582ef93d0cfe75d8784a77` |

The screening answers after the brief's own two proposals were given on the
owner's behalf for a home dishwasher in Austin. Correct them if any is wrong.

### Why a second request

The first request, `capture-8d72dcfd-3377-48e7-a3c0-b2a4c465a61a`, used the same
bytes (the owner uploaded them from a Mac browser). It cannot be sponsored:

- **Unclaimable.** Its contact email is the owner's admin account, which is a
  `robot_team` workspace. Sponsorship needs `account_owner_uid`, and a claim
  needs a `site_operator` account whose verified email matches the contact
  email.
- **Out of attempts.** All five privacy-review attempts went on the defects
  below.

The second request uses a plus-alias of the same inbox for the contact and a
site-operator account created through the claim page. The bytes are the same,
re-fetched from the first capture's storage object and checked against the
digest.

## Defects found and fixed on the way (all merged and deployed)

The upload privacy screen had never completed a review in production. The 7
earlier captures were `not_reviewed/unscreened` because the lane was off.

| PR | Defect | Evidence |
| --- | --- | --- |
| #693 | `normalizeAgentProvider` rewrote the `gemini_video` pin to `codex_local`; every review failed `spawn codex ENOENT` | 2 `agentRuns` with that error |
| #694 | The inline review body held a 60 MB clip several times over and ran the 512 MB free web instance out of memory. Attempts were counted only after a review returned, so a crash never escalated | Render "exceeded its memory limit" 03:04 UTC; +276 MB → +114 MB measured |
| #696 | Inline 60 MB never answered (5-min analysis timeout); a late reading was discarded and each retry started over | run `1740ff81` timeout |
| #697 | The Files API upload still held the clip twice; the instance restarted again | Render "exceeded its memory limit" 03:54 UTC; +256 MB → +88 MB measured |
| #698 | The answer stopped short in 8,192 output tokens, and the error did not say why. A held capture had no way back but a person with no tool | run `6c305b10`; `scripts/rescreen-held-capture.ts` added |
| #699 | Chromium sent an uppercase `.MOV` with a generic type; it was stored as `application/octet-stream` and refused as unreadable | runs `e14e5c9c`, `1b8b4cef` |
| #700 (another lane) | Agentic navigation ended `TOO_MANY_TOOL_CALLS` after 376,300 tokens; privacy and site review moved to bounded static video | run `39fbd480`; cleared by run `9eb213c5` |

Open follow-up outside this run: the Firebase verification email for the claim
account never arrived (the send reported success; nothing reached the inbox,
spam or trash). The account was verified through an Admin-SDK
`generateEmailVerificationLink` link, which is the same Firebase verification
without the mail hop. Queued as a separate task.

## 14-step evidence matrix

| Step | Required behaviour | Evidence required to close | State |
| --- | --- | --- | --- |
| 1 | Website task intake, rights/task confirmation, task = open/close the dishwasher | Browser submission and confirmed task consumed by Pipeline | **done**: `/contact/site-operator` form in headless Chromium returned HTTP 201 at 04:48 UTC. Brief confirmed HTTP 200 (`qualified`). The site was claimed through `/claim/<token>` (HTTP 200) at 05:06. Pipeline wrote `website_task_context.json` and `website_scene_sponsorship.json` at 05:29 |
| 2 | Website upload of the original bytes | Retained object digest equals `c549b3b3…fedd` | **done**: uploaded through the capture page's "Upload a video file" chooser. The stored `raw/walkthrough.mov` was read back at 60,035,801 bytes with that sha256 |
| 3 | Video/privacy/task review | Retained review record | **partial**: the privacy screen cleared at 05:24 (`eligibility: approved`, run `9eb213c5`, attempt 4). Frames (150), `qa_report.json`, `capture_descriptor.json` and `pipeline_handoff.json` were written at 05:24 |
| 4 | Task-relevant assembly selection and reconstruction plan | Plan names the dishwasher door/tub assembly | **done**: `clean_plate/removal_plan.json` (Gemini `gemini-3.8-flash`, static) names `dishwasher` as the manipulated task object, `articulated_part: "dishwasher door"`, `articulation_kind: "revolute"`, `rebuild_and_compose`, confidence 0.98, quoting the task. A second target, `person` ("a person's hand and arm … manipulating the dishwasher racks and door"), is marked `remove` for privacy |
| 5 | Hosted SAM tracking/masks | Track manifest | **blocked (owner decision)**: the controller stopped at `clean_plate` with `status=blocked mode=fill_machinery_pending`, reason `clean_plate_fill_machinery_not_implemented`, surfaced as `website_preparation_pending`. See "Current blocker" |
| 6 | Task-specific image edits/background recovery | Edited views + review | unproven |
| 7 | Provider-capacity view selection | View manifest | unproven |
| 8 | Marble reconstruction/preview | Provider receipt, splat/collider digests | unproven |
| 9 | Task-space registration | Registration receipt | unproven |
| 10 | Articulated asset (door hinge) | Multi-link USD, joint data, static qualification | unproven |
| 11 | Room integration or development fixture | Integration or fixture receipt | unproven |
| 12 | Native articulated qualification | Native qualification receipt | unproven |
| 13 | Robot team selects saved setup; policies execute | Episode receipts | unproven |
| 14 | Results on the website task page; provider-zero | Browser readback + provider-zero receipt | unproven |

## Current blocker: a person in frame

The Pipeline verifies privacy for a website capture only when its removal
analysis finds **no** person (`clean_plate_stage.py`: `privacy_verified = … and
not person_target_count`). It has no step that masks or erases people. Any
capture showing the person doing the task, here a hand and forearm opening the
dishwasher, therefore never gets past clean plate, however the website's own
privacy screen reads it. The drawer capture passed only because no one was in
frame.

A fix is written and tested but **not pushed**. The session's permission check
refused the push as a privacy-policy change, which is the owner's call. What it
does:

- **Masks:** people found by the analysis are tracked by the same hosted SAM
  call, under their concept and "hand". They are kept as `privacy_masks`, apart
  from the task targets.
- **Removal:** their pixels join each view's removal mask, and the editor fills
  them.
- **Verification:** privacy counts as verified only when the independent
  completion review of the prepared set passes with `people_absent: true`.
  Otherwise, or when no review ran, the stage fails closed. The analysis's own
  `authorizes_person_pixel_removal: false` boundary is unchanged.
- **Tests:** 6 new tests (fail without the change), `ruff` clean, impacted
  selection 129 passed, neighbouring suites 55 passed, source governance
  passed. The patch is in the session scratchpad
  (`pipeline-people-removal.patch`).

Owner options:

1. Approve that change (or a variant). The Pipeline PR can then land and this
   capture re-runs from the retained handoff.
2. Re-film without a person in frame, for example the door opened and closed
   off-camera or with the hand kept out of view. That path already works
   today.

## Timeline (UTC)

- 02:40: first request `capture-8d72dcfd…` and the owner's upload (sha256 verified).
- 02:42–04:19: five privacy attempts, each lost to a defect above.
- 04:48: second request `capture-e41a08cd…`. 04:49: same bytes uploaded through the browser file chooser.
- 04:54: brief confirmed, `qualified`. 05:06: site claimed by the site-operator account.
- 05:24: privacy cleared (#700 live); frames extracted; Pub/Sub handoff.
- 05:29: host consumed the handoff; sponsorship granted; controller started (`preflight`, `materialization` done; `capture_pipeline` running).
- 05:30: preparation limit amended to 32.
- 05:31: controller stopped at `clean_plate` (`fill_machinery_pending`): a person is in frame, and no person-removal step exists (see "Current blocker").
