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

## Defects found and fixed on the way (all merged; #2172 and #2173 not yet deployed)

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
| Pipeline #2166, WebApp #707 (another lane) | A person in frame (the hand opening the door) held every such capture at `clean_plate` | Owner decision; see "Person handling" |
| Pipeline #2167 | The SAM tracking re-encode (CRF 18) of the 30 s clip was 50 MB, over the 32 MiB upload bound: `meta_sam_inline_video_limits_exceeded` | Host journal 13:06 UTC; CRF ladder, 23.8 MB at CRF 23 |
| Pipeline #2170 | The clip's −90° display matrix adds a transpose filter, after which ffmpeg encoded on 1/(29.97 fps) and re-timed frames; 792 of 902 frames drifted >2 ms (max 16.7 ms): `meta_sam_encoded_frame_mapping_invalid` | Host journal 13:48 UTC; source-timebase encode, drift 0 |
| Pipeline #2172 | Image edits sent the SAM silhouette as an edit mask and pasted the fill back only inside it, leaving a door-shaped ghost patch and a floating rack bowl; the independent review rejected the set (`website_image_completion_review_failed`) | Edited frame 0 at 14:24 UTC; review failure 14:30 UTC. Now: plain frame, no mask, prompt names contents/shadows/reflections, whole edited frame kept |
| Pipeline #2173 | The uncapped first encode was discarded, doubling encode time (~5.5 min on the host) | One capped pass: 30.6 MB, 902 frames mapped |

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
| 3 | Video/privacy/task review | Retained review record | **done**: the privacy screen cleared at 05:24 (`eligibility: approved`, run `9eb213c5`, attempt 4). Frames (150), `qa_report.json`, `capture_descriptor.json` and `pipeline_handoff.json` were written at 05:24. Under #2166/#707 the Pipeline admits the capture (`privacy.status: website_capture_admitted`) |
| 4 | Task-relevant assembly selection and reconstruction plan | Plan names the dishwasher door/tub assembly | **done**: `clean_plate/removal_plan.json` (Gemini `gemini-3.8-flash`, static) names `dishwasher` as the manipulated task object, `articulated_part: "dishwasher door"`, `articulation_kind: "revolute"`, `rebuild_and_compose`, confidence 0.98, quoting the task. A second target, `person` ("a person's hand and arm … manipulating the dishwasher racks and door"), is marked `remove` for privacy |
| 5 | Hosted SAM tracking/masks | Track manifest | **done**: after #2167 and #2170 (release `4088b46`), Meta SAM 3.1 tracked `dishwasher` over all 902 frames in one call (~55 s, reserved $0.18). `clean_plate/task_masks/…/task_masks.json` written 14:23:23 UTC; tracks bound to the provider response digest |
| 6 | Task-specific image edits/background recovery | Edited views + review | **in progress**: the first edits (masked, pre-#2172) were rejected by the independent review at 14:30 UTC. #2172 (plain frames, no mask) is merged; its deploy is queued behind another lane's drawer attempt |
| 7 | Provider-capacity view selection | View manifest | unproven |
| 8 | Marble reconstruction/preview | Provider receipt, splat/collider digests | unproven |
| 9 | Task-space registration | Registration receipt | unproven |
| 10 | Articulated asset (door hinge) | Multi-link USD, joint data, static qualification | unproven |
| 11 | Room integration or development fixture | Integration or fixture receipt | unproven |
| 12 | Native articulated qualification | Native qualification receipt | unproven |
| 13 | Robot team selects saved setup; policies execute | Episode receipts | unproven |
| 14 | Results on the website task page; provider-zero | Browser readback + provider-zero receipt | unproven |

## Person handling decision and current evidence

The owner directed that task videos with people, including a hand operating the
dishwasher, follow the ordinary authorized upload and reconstruction path. The
previous proposal to erase people from frames was superseded. The code change
under review removes the website's separate people screen, its person-specific
reconstruction hold, and the Pipeline's `person_target_count` and
`people_absent` conditions. Person observations remain in analysis provenance,
but are excluded from task-object masks and image edits. The source video is
retained without person erasure. Updated Terms and Privacy disclose that people
may appear in footage and derived scenes and that approved processing providers
receive media to build them.

The table above records the last observed live state. A merged and deployed
change, a host retry from the saved handoff, and provider and website receipts
are still required before this run can be called complete.

## Timeline (UTC)

- 02:40: first request `capture-8d72dcfd…` and the owner's upload (sha256 verified).
- 02:42–04:19: five privacy attempts, each lost to a defect above.
- 04:48: second request `capture-e41a08cd…`. 04:49: same bytes uploaded through the browser file chooser.
- 04:54: brief confirmed, `qualified`. 05:06: site claimed by the site-operator account.
- 05:24: privacy cleared (#700 live); frames extracted; Pub/Sub handoff.
- 05:29: host consumed the handoff; sponsorship granted; controller started (`preflight`, `materialization` done; `capture_pipeline` running).
- 05:30: preparation limit amended to 32.
- 05:31: controller stopped at `clean_plate` (`fill_machinery_pending`): a person is in frame, and no person-removal step existed.
- 12:53–13:06: #2166/#707 live; the capture is admitted, then SAM preparation stops on the 32 MiB bound (#2167).
- 13:48: #2167 live; SAM preparation stops on frame-timing drift (#2170).
- 14:12–14:23: #2170 live (`4088b46`); SAM 3.1 tracks all 902 frames (step 5).
- 14:23–14:30: masked image edits; review rejects them. #2172 and #2173 merged; deploy queued.
