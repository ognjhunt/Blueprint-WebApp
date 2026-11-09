# Library-aisle navigation job, end to end (2026-11-06 to 11-07)

A brand-new site, run through production from the public website by a cloud
session: new video, new scene, new task. It is the forcing case for the
owner's direction of 2026-11-06, that Blueprint should be able to take on any
job. Every claim below names the artifact it was read from. Host files were
read as JSON or text through the operator door. Nothing was copied off the
host except JSON.

Times are UTC. The owner reads them in CST (UTC−6).

## Identities

| | |
|---|---|
| Request | `capture-5b067498-c8b3-4549-9da9-ded4c391db1f` |
| Scene | `site-capture-5b067498-c8b3-4549-9da9-ded4c391db1f` |
| Capture | `walkthrough-capture-5b067498-c8b3-4549-9da9-ded4c391db1f` |
| Status link | tokenized; retained in the session only (a capability URL, so never in a repo) |
| Task | "Navigate from the near end of the visible aisle to a stopping point before the end bookshelf, avoiding contact with the shelves on either side." |
| Site country entered | United States. The clip's real filming location is unknown; the form requires a country |

## Source video and rights

- **Page:** https://www.pexels.com/video/video-inside-a-library-854533/. The uploader is Pixabay and the page is dated 2016-10-30. The page's description reads "Browsing a quiet library aisle filled with books on white shelves."
- **Rendition:** `https://videos.pexels.com/video-files/854533/854533-uhd_3840_2160_25fps.mp4`, fetched with `scripts/cloud/fetch-media.ts`.
  - 49,023,833 bytes, sha256 `3f1c177f586ca2b7b29a4c7e1e7bfca52afe159e4aac270408dd5c405c76e1c0`.
  - 17.493 s, 3840×2160, 25 fps, 437 frames, H.264 with AAC audio.
- **License evidence**, read 2026-11-06:
  - The page's license line reads "License: Free", linked to `/creative-commons-images/`. The word "CC0" does not appear on the page.
  - Pexels' Creative Commons page: "All photos that are covered by the Creative Commons Zero license are marked with "CC0" on the photo page."
  - Pexels terms (last updated 2026-10-20):
    - §4: CC0 content is marked "CC0" on its page.
    - §5: other content is marked "Pexels License". This page shows neither marker.
    - §8 forbids data mining or extraction "for all unauthorised purposes, including without limitation for machine learning purposes".
  - CC0 legal code: https://creativecommons.org/publicdomain/zero/1.0/legalcode.en.
- **Owner decision:** approved with that evidence ("yes i approve everything", before 14:44Z).
- **Owner ruling, 16:05Z:** "yes standard - rights are okay". Clips under the standard Pexels License are cleared for this work. That covers capture-447's clip and clips #2 (Pexels 4294436, warehouse) and #3 (Pexels 3773483, kitchen).

## Money approved

The owner approved the following before 14:44Z. The hard ceiling is $115 and the expected spend is $15–35.

| Line | Approved | Applied on this job (artifact) |
|---|---|---|
| Vast top-up | $30, the owner's own action | not a blocker (owner, 11-07: "these shouldnt be blockers at all"). The $7.07 credit covers one $4 G1 run and the $1 reserve |
| Atlas allowance | $40 | automatic grant of $25 / 32 requests (`pipeline/atlas/configuration.json`) |
| Upstream ledger | $5 | $5 (`pipeline/website_scene_sponsorship.json`) |
| Scene budget | $40 | $20 at intake, with 16 paid attempts (`website_scene_sponsorship.json`) |
| Preparation attempts | 16 → 32, one-shot | applied 14:53Z, amendment `sha256:99ab7973…` (`scripts/amend-website-preparation-limit.ts --apply`) |
| Site screening | $30, the existing limit | `SITE_LIMIT` in the Pipeline coordinator |
| Cloud Run | $0 | not enabled |

**Spent at 14:04Z on 11-07 (unchanged since 06:10Z),** from the door's status read:
- Atlas: $7.38 of the $25 grant, including the $5 refined splat and the $0.50 mesh;
- clean plate: $0.69 held;
- intake capture inference: $1.06 known.

That is about $9.13 against the $115 ceiling.

## Owner decisions, 16:05Z (10:05 CST)

| Decision | Words | Applied |
|---|---|---|
| Bandit triage | "Bandit OK as recommended" | Pipeline #3423 `6429be8`, applied on top of #3420's renewal: 18 entries expire 12-06, 77 expire 2027-02-04, every entry is owned by `@ognjhunt`. [51] is fixed in code (DeepInfra download: https to DeepInfra hosts only, 2 GiB cap) and has a fresh entry. The gate passes locally: high 0, medium 96 |
| G3 success rule | "switch G3" | The arm rule changes from "the whole object inside the disc" to "the object's centre within a tolerance", so the disc can be small and clear of the start. Done: WebApp #1228 (live) accepts the new target schema, and Pipeline #3427 emits it, live with `8dc96be` at 22:32Z. Earlier results still score the old way. The 5 cm tolerance is the harness default, not an owner choice |
| Parked deliveries | "yes retire the 7" | No door operation could end a parked delivery, and host files are never edited by hand. Pipeline #3425 added a general owner-approved door operation, `retire-parked-delivery`, and #3427 fixed its first plans. **Done 22:40–22:45Z** on the `8dc96be` door: each of the 7 was planned, then retired. 3 delivery records parked since 11-02 were retired, and 4 orphaned hints whose captures are absent were archived under `retired/`. Nothing was deleted |
| Rights | "yes standard - rights are okay" | Recorded above |

## Owner decisions, 11-07 (overnight)

| Decision | Words | Applied |
|---|---|---|
| Appearance | "we need to remove 'depth-fused draft' from an option (maybe can be fallback) - atlas only here (as long as we have money/credits)" (about 00:55Z) | Pipeline #3435: a scene kept as filmed takes Atlas's refined splat as its appearance, mesh source and export. The draft is only a named fallback. This job bought the $5 refined splat |
| Brief and Vast | "these shouldnt be blockers at all" | An unconfirmed brief is disclosed in the G1 navigation authority, never a stop there (#3439). The Vast top-up is not needed for the first $4 run |
| Brief and consent | "yes a confirmed brief counts as consent" (to the G1 session, about 05:50Z) | Consent rechecks stay as they are. Nothing in the Pipeline sets or assumes the confirmation: the site confirms the brief on the website |
| Overnight | "DONT STOP FOR ANYTHING - keep making progress. i pre-approve everything needed" (05:20Z) | Covers deploys and fixes, within the approved money. Privacy, rights and money stay hard stops |

## Owner decisions, 11-07 (day)

| Decision | Words | Applied |
|---|---|---|
| Levelling | "build the flagged fallback floor and keep going" (about 13:00Z) | Pipeline #3448: when nothing observed levels the scene and both up estimates lie within 3° of the provider's up, the collider gets a flat floor at the uneven band's median. Walls, shelf sides and the splat are kept. It is flagged `development_only_estimate` |
| Money | Per-job budget confirmations are "not how prod services work"; chose meter + monthly cap; then "set the monthly cap to $200" (13:20–13:55Z) | Pipeline #3451: every paid admission is metered per job, with one account-wide limit of USD 200 a month and alerts at $100, $160 and $200. Stops are never blocked by the limit, and a failed reading never lowers the count. It is additive: every existing cap stays. Stage 2, removing per-job budgets, is planned in the Pipeline's `docs/architecture/metered-spend.md` |
| Brief | Chose "confirm at upload": the form takes the task description and one consent box, and submitting is the confirmation; an existing job needs one click | The upload change is being built. An existing job's one click: WebApp #1232 (live 14:27Z) keeps it on the job page during a Blueprint-side stop, where it had been hidden |
| Rights stand-in | "yes - make sure this is the case for all future runs/scenes" | Pipeline #3449: each G1 navigation checkpoint's own development rights review stands in for `reviewed_checkpoint_terms`, on every site, development-only |
| Funded rows | "two" | No code change: both `_vision_navi` rows fund at $4 each within the $30 site limit |
| Navigation intake | "yes" | WebApp #1233 (merged 14:59Z): a `goal_region_navigation` intake reserving $0, accepted only for a confirmed brief. The Pipeline half follows |
| Confirmation | The owner confirmed the library job's brief on its job page | `confirmedAtIso` 2026-11-07T14:30:45Z, a person named. Read through the job's own link |
| Deploys | "merge #3449", "deploy 637248b", then "deploy both together when ready" (14:19–14:45Z) | 637248b's main CI failed only at the attestation step, with a 500 from the public transparency log (Rekor was down; it answered 200 again at 14:49Z). It deploys together with #3451 |
| Away | "keep working - non stop - i pre-approve everything so dont ask" (about 15:00Z) | Covers deploys and fixes. Privacy, rights and money stay hard stops |

## 11-07 afternoon: confirmation, intake and restarts

Owner words in this stretch: "deploy 9d77525", "deploy main" (twice), the
"View your scene" request ("we need to fix this/add this feature"), and "i'll
be gone for about an hour - i pre-approve all deploys and stuff necessary -
keep working without stopping" (about 21:10Z).

| What | Where | Result |
|---|---|---|
| Confirm at upload | WebApp #1235 | Submitting the form with the task description and its one consent box is the confirmation; an existing job needs one click |
| Navigation intake, Pipeline half | Pipeline #3453 | The Pipeline sends the job's `goal_region_navigation` intake ($0, no construction allowance) once the navigation record exists, and binds the website's receipt beside the record |
| Late confirmation keeps paid work | Pipeline #3454, #3455; WebApp #1236 | A brief confirmed after preparation is the sealed context's confirmed successor, so every retained, paid artifact stays bound. A held job replays once when the fact it waited on arrives |
| Completed held ledger | Pipeline #3456 | The operator's `--resume-preparation` replays a held, completed ledger once per arrived fact |
| Confirmation that accepts proposals | Pipeline #3457, #3458; WebApp #1237 | Accepting Blueprint's proposed answers keeps the successor's parent; the door's contract mirrors it |
| Deploys | Pipeline | `4289556` live 15:46Z; then `9d77525`; then `ad2776f`; then `9a64834` live 21:08Z. WebApp `bf91ecc` (#1237) live 21:22Z |
| Restarts | door `--resume-preparation` | The 19:18Z and 20:03Z restarts were refused. Each refusal led to one of the fixes above (`task_context_changed`, `native_resume_not_eligible`, `website_assessment_resume_binding_invalid`). The 21:22:51Z restart completed at 21:24Z (`native_preparation` revision 101, `completed`) |
| The 21:24Z restart changed nothing | host `run_summary.json`, `handoff.json` | `capture_pipeline` took 0.08 s, and `handoff.json` and `provider_run_manifest.json` stayed at 14:04Z, so the intake was never sent. Cause: the qualification lane's resume marker keyed only on the delivered descriptor and raw manifest, which no replay changes. It had skipped the 20:04Z replay the same way. Pipeline #3460 adds the stage's rerun binding to that key, which also fixes target corrections and robot-fit rechecks |
| View your scene | Pipeline #3459; WebApp #1238 (merged 21:36Z) | The job page opens a private, web-sized preview of the job's own scene (at most 32 MiB, a 15-minute view ticket; deleted on withdrawal). It is live once the Pipeline half deploys |

## 11-07 evening to 11-08: handoff, G1 runs and the scene preview

Owner words in this stretch, all 11-07 unless noted:

- "lets do option 2" (about 23:05Z): add a door operation that restores and verifies π0.5's language files.
- "Gemma terms OK" (about 23:10Z). The restore source is a verified copy already on the host only (B).
- "yes" (about 23:55Z): the door-profile addition and an off-window door upgrade. "deploy now" was said to the G1 session.
- "deploy 9089cf2" (11-08 about 02:00Z).
- "keep working for the next few hrs … i pre-approve all deploys/approvals needed" (11-08 about 02:05Z).

| What | Where | Result |
|---|---|---|
| Restart refused | door, 22:04Z, on `13dbd27` | `held_handoff_resume_not_eligible`: the 21:22Z run had retained the confirmed successor context, but the 14:04Z hold was still bound to its parent. Pipeline #3462 lets the replay and status readers accept the verified lineage parent (`008142c`, live 22:41Z) |
| Restart completed | door, 22:41:27Z | Preparation really re-ran: the handoff was rewritten at 22:46Z, the navigation intake went `forward_pending`, and its receipt was bound at 22:47Z (reserved $0) |
| **Step 13 cleared** | host `handoff.json`, 22:55Z | `intake_ready`, no blockers, `accepted`; lane `g1_navigation_screening`; both `_vision_navi` rows are candidates |
| G1 plan | G1 session, 22:55:48Z | DP selected (4 episodes, $4 cap, flags `g1_scene_floor_estimated` and `g1_spawn_foot_unsupported`). π0.5 unavailable: `g1_beta_selected_pi_tokenizer_invalid` |
| DP attempt 1 | Vast, 23:01–23:18Z | Crashed at import (`jsonschema` absent on the rented image), before any observation. About $0.40. Pipeline #3463 (deployed as `18bb85a` with the door upgrade, 00:31Z) |
| π0.5 language files | door restore plan, 00:32Z | Refused, correctly: the files are intact under `pi-tokenizer-f1eaa13/assets/`, and the reader looked one folder up. Pipeline #3465 |
| DP attempt 2 | Vast, 00:44–00:59Z | The same module, reached through a function-level import. About $0.52. Pipeline #3466 adds a reachability guard. The owner asked for lookahead: the G1 session audited all 75 functions and 107 modules on the runtime path, and `jsonschema` is the only missing third-party import |
| Scene preview v1 | Pipeline #3459, WebApp #1238 (live 22:01Z) | Showed 599,168 of 2,000,000 Gaussians, the largest first, so it smeared. The owner flagged it |
| Scene preview v2 | Pipeline #3464, WebApp #1240 | PlayCanvas compressed PLY with every Gaussian. Rebuilt 00:32:18Z: 2,000,000 of 2,000,000, 32.6 MB |
| Remaining softness | Atlas inputs | 41 frames at Atlas's default 1280×720 from a forward-only 4K clip. Gap fill added no generated view. Under investigation as a general change (more frames, resolution) |

## 11-08: the first episodes, a fall through the floor, and the splat's cause

Owner words, all 11-08: "deploy anything waiting" (15:59Z); "option 1" (17:52Z, delete an old internal folder themselves; the command ran on their own computer, so the server was unchanged); "yes, add it" (18:44Z, a reviewed folder-delete door operation); "yes prune" (18:46Z); "can we investigate why our atlas refined splat turned out so badly??" (20:29Z); "fix the input first, then do the rebuild" (21:02Z); "go ahead" (21:52Z), approving the order in the second-to-last row.

| What | Where | Result |
|---|---|---|
| DP attempts 3–5 | Pipeline #3468, #3470, #3471, #3473 | Each stopped before an episode on one fixable cause: a mismatched triton wheel ($0.67), no ffmpeg on the Isaac image ($0.62), then no Vast offer under the $4 cap and an untyped refusal ($0). Deploys `44d78b7`, `6a181b1` (15:18Z), `a13381d` (16:30Z) |
| Disk | Pipeline #3475; #3474 (open, paused) | π0.5's first run was refused 0.35 GB short of collection room on the work volume. Unspent attempts' bundles are now pruned, with receipts kept, and the collection reservation is 2 × the 4 GiB output bound plus the bundle, not 4 ×. Headroom went from 16.80 to 20.98 GB with `985c482` (19:43Z). The approved folder for #3474 is on the root disk, not the work volume, so it is paused |
| **First episodes** | DP attempt 6, 19:59Z, about $1.14 | The learned policy was queried. Cells 0 and 1 were scored failures, cell 2 ran out of output budget (Pipeline #3476 drops a cell's PNG frames once its videos exist), and cell 3 did not run |
| Correction: the robot fell through | Pipeline #3478 (merged 22:02Z) | Both scored cells drifted about 16 km and 15 km in root height: free fall, so they measured the scene, not the policy. Such an episode is now void (`g1_robot_fell_through_scene`) and the G1 harness revision rises to 2 |
| Floor root cause | G1 session, open | The collision copy is Z-up metres and its box covers the spawn at (1.04, 0.16) on the camera's path, yet the spawn check found no collision near the robot. The suspect is how the packet loads or places that copy. A JSON-only host diagnostic and a `g1_spawn_floor_absent` refusal before spend are being built |
| Why the splat is soft | splat investigation, 20:29–21:30Z | World Labs did not accept pose refinement, and the opening frames' poses and depth disagree with their neighbours. Other causes: pan frames with no parallax, soft opening frames, a large scene, blurred faces. Frame count mattered least. Atlas's gap fill only fills unseen regions; it does not re-render a soft captured one |
| Input fix and one rebuild | Pipeline #3477 (merged 22:02Z) | Drops frames under 0.6 × the clip's median sharpness and sends the splat only views that agree with their neighbours (19 dolly views here). A ready job's splat bought from disagreeing views can be rebuilt once, beside the original: about $6.56 expected, at most $10.88, inside the Atlas grant, which ends 11-13 14:44Z. It stops after the pose (about $1.06) if refinement isn't accepted |
| Order approved ("go ahead") | both sessions | 1. merge #3477 and #3478 (done 22:02Z); 2. the floor's root cause and its pre-spend refusal; 3. a general step that re-derives the levelled scene, colliders, navigation packet and registration whenever a job's Atlas result changes; 4. one deploy after π0.5 settles; 5. the rebuild |
| π0.5 | Vast, from 21:35:33Z | Running on `985c482`, which has neither the frame drop nor the fall-through void. The same fall is expected and would be void |

Spend: G1 $3.35 of the $30 site limit, before π0.5; Atlas $7.38 of $25; total about $12.48 of the $115 ceiling.

## 11-08 22:00Z to 11-09 16:00Z: the walked floor, the splat's real cause, and π0.5 reaches its policy

Owner words, all 11-09 (CST in brackets):
- "yes" (04:32Z, 10:32 PM): re-admit a run refused only for a missing provider billing reading.
- "yes, deploy" (12:15Z, 6:15 AM).
- "yes, deploy latest main" (12:26Z and 14:12Z).
- "you can deploy latest main when green - for next 48 hrs" (14:26Z, 8:26 AM; until 14:26Z on 11-11).
- "yes" (15:01Z, 9:01 AM): one windowed splat retry, at most about $6.55 from the Atlas grant.
- "remember we need general solutions for all types of scenes/inputs" (about 15:08Z).
- "yes" (15:27Z, 9:27 AM): new jobs get the same windowed re-pose, which raises a new job's maximum Atlas cost by one pose.

| What | Where | Result |
|---|---|---|
| Floor under the spawn | Pipeline #3484, #3485 | A camera never films the floor under its own feet, so there was no collider where the robot starts. A flat floor is now filled within 0.5 m of every camera footprint, at the levelled floor height, disclosed as `walked_floor` and flagged `g1_scene_floor_estimated`. After the re-derive the spawn check reads clear at the start and all four offsets |
| Re-derive and re-issued intake | Pipeline #3481, #3486, #3487; WebApp #1243 | A changed Atlas result or levelling revision re-derives the levelled scene, colliders, navigation packet and registration. The navigation intake is re-issued under its own submission for the same capture. `intake_ready` 02:47Z, $0 |
| First splat rebuild | Pipeline #3477, #3487, #3488 | The 105-view pose came back with `poseRefinementAccepted: false` (about $1.05). The rebuild stopped there (02:26Z), and the job kept its original splat. Draft fusion now holds one view at a time (peak 2.7 GB to 1.3 GB) |
| Why the pose was refused | the 105-view pose, read 11-09 | 0–7.96 s: the camera stands still, turning under 1° a step. Between frames 199 and 202 the pose jumps 3.29 units in 0.12 s. 8.08–17.44 s: a steady dolly. The clip is most likely two shots joined. The rebuild had re-sent the whole clip |
| Windowed retry, and new jobs | Pipeline #3502 (live 15:52Z), #3504 (merged, not yet deployed) | A rebuild whose pose wasn't refined retries once with only the moving footage its earlier pose found consistent. Required frames outside that footage are named and flagged; there's never a third pose. New jobs do the same once, before buying the splat, only when the remaining dollars and requests both cover the re-pose plus the splat and mesh. Clean shots are unchanged. There is no customer-facing Atlas quote in the WebApp, so no WebApp change |
| DP runs 6 and the ffmpeg run | Pipeline #3489, #3490, #3494, #3495, #3497 | 02:51Z, about $0.49: no ffmpeg from the Ubuntu archive (retries and a mirror added). 05:51–06:24Z, about $0.64: silent after the entrypoint, ended at the 1,800 s no-progress window. The runtime now prints stage and growth lines. DP is at 6 of 7 harness failures, with 2 runs left |
| π0.5 refusals and run 3 | Pipeline #3491, #3492, #3503 (open) | Two refusals before rental ($0): a stale lock, then a missing billing reading. Run 3, 14:36–15:20Z, about $0.89, **reached the policy for the first time**: the runtime built, SONIC and the checkpoint loaded, and episode 000 started. The first inference failed (HTTP 500) because torch.compile found no C compiler in the Isaac image. #3503 installs one and test-compiles before any episode. Harness failures: 2 |
| Goal marker in view | Pipeline #3498 (live 15:52Z) | Both walking checkpoints were trained on "Avoid obstacles and move to the yellow marked area", and the episode sends exactly that with one yellow disc. A $0 planning-time projection through the head camera now flags `g1_goal_marker_not_in_initial_view`. Here the disc starts in view, 1.78 m ahead |
| Deploys | the door | `d337b41` 02:10Z, `f1d69a9` 03:53Z, `b85ac9e` 05:25Z, `9b9bd6e` 12:43Z, `74d0af8` 14:26:57Z, `661c780` 15:52:14Z. Each on a quiet door, with the G1 session told |
| Disk | the door, 14:28Z | Control-plane headroom is `low` (12.9 GB available against a 15.8 GB floor). New embodiment preparation and checkpoint downloads are refused; cached checkpoints are unaffected |

Spend at 16:00Z:
- G1: about $5.37 of the $30 site limit.
- Atlas: about $8.43 of $25.
- Clean plate $0.69 and intake inference $1.06, unchanged.
- Total: about $15.55 of the $115 ceiling.

## 14-step evidence matrix

| # | Step | Status | Artifact | Cost | Time | Gap found |
|---|---|---|---|---|---|---|
| 1 | Website intake, rights, task | **done** | `POST /api/inbound-request` 201. Host `pipeline/website_task_context.json` (`task_family: general_task`, `confirmed: false`) and `website_scene_sponsorship.json` (consent `spend_authorized: true`, `task_confirmed: false`) | $0 | 14:44Z | The brief screen recorded the job as "mobile", which is a hint. On today's code it also refuses an execution grant for such a job: the task-kind gate at `websiteSceneSponsorship.ts:240`, removed on this branch |
| 2 | Original-byte upload, capture binding | **done** | `POST /api/self-capture/uploads/…` 201 at 14:51:48Z, `processing_ready`. Host `raw/walkthrough.mp4` is 49,023,833 bytes, and `clean_plate_stage_manifest.json` records `input_video_sha256: 3f1c177f…76e1c0`, equal to the source | $0 | 14:44–14:51Z | — |
| 3 | Video/privacy/task review | **done, then failed** | Atlas planner review 1, receipt `scene_planner/9ad5eb5e….json`: `no_manipulated_subject`, one `navigation` step, `covers_entire_job: false` (start pose, stop tolerance and robot footprint unspecified; "no registered navigation profile"). Reviews 2 and 3 followed. Clean plate: Gemini `removal_plan.json` found 4 targets (left, right and end shelves, and the floor), with 0 to remove and 0 people | $0.079, $0.141 and $0.120 (OpenAI, settled); SAM target 0 about $0.087 reserved | 14:45–15:50Z | (a) Review 3 cited a frame it had not selected, and the Atlas job failed with `atlas_automation_frames_not_selected` (fixed in Pipeline #3423). (b) The 4K source made the extended survey slow: 153 frames as about 11 MB PNGs, roughly 30 s each. (c) Clean plate stopped with `meta_sam_submission_requires_reconciliation`: a parser timeout at a fixed 300 s, then a 404 on a stale video upload (fixed in #3423) |
| 4 | Task-relevant selection and reconstruction plan | **done on the second try** | First try: Atlas `preview_job.json` `failed`, `atlas_automation_frames_not_selected`, revision 2 (15:50Z). After the `a14db1c` deploy (#3423, about 17:18Z) the job was requeued at 17:27Z (revision 4). Two more planner reviews passed, and the World Labs source pose ran | $0.120 and $0.056 (OpenAI); $0.41 (World Labs pose); all settled | 17:27–18:29Z | — |
| 5 | Preserved-scene gap review | **failed, fixed, requeued** | `preview_job.json` revision 4: `failed`, stage `source_pose`, `atlas_source_gap_capture_identity_invalid` (18:29Z). The pose had also been given the clean plate's 41 task-source frames (`object_geometry_only`), 6 of them in no Atlas survey, and `source_gallery` requires every conditioned frame to be surveyed. Pipeline #3428 adds the missing frames from the manifest the pose verified. Live with `8dc96be` (22:32Z); requeued at 22:34Z (revision 5). By 22:36Z the job had written `capture_source_survey_with_task_views.json` | $0 (it stopped before any gap purchase) | 18:29Z; 22:34Z | The task-source frames reached the pose but not the gap review's survey |
| 6 | Gap fill | **done, nothing admitted** | The planner ($0.28), the generation ($0.42), the review and the joint registration (41 frames, 33 agree) passed. The recovered view's 4,510 gap pixels yielded 0 exportable samples, and the job ended `atlas_preserved_completion_no_exportable_geometry` (23:08Z). Pipeline #3435 flags an empty recovery and keeps the captured scene; live with `682d098` (02:01Z), requeued 02:02Z | $0.70 (Atlas grant) | 23:08Z; 02:02Z | An empty recovery stopped the job instead of being flagged |
| 7 | Splat | **done** | Atlas refined splat (`posedImages2Splats`, minimal form): 41 captured frames, no generated view, 2 M Gaussians (02:08Z) | $5 (Atlas grant) | 02:08Z | — |
| 8 | Mesh and registration | **failed, fixed, done** | `splats2Mesh` (02:29Z) gave 613,408 faces, and registration refused it, `atlas_mesh_not_registered_to_splat` (02:30Z): the limit was 3 draft voxels (0.0198) and this mesh is coarser than capture-447's 1.89 M faces. Pipeline #3437: the limit is max(3 voxels, 1.5 median mesh edges), and a refusal writes its numbers. Live with `69e48f8` (03:12:57Z); the job was `ready` at 03:18Z. It registered with residual 0.0310 against 0.0504, keeping 398,036 faces | $0.50 (Atlas grant) | 02:29Z; 03:18Z | The registration limit ignored the provider mesh's resolution |
| 9 | Clean plate (native preparation) | **failed, fixed, done** | Resumed 03:19Z. At 03:26Z the kernel killed it out of memory (4.0 GB of 8.3 GB, no swap) while decoding SAM masks for the 4K, 437-frame video. Pipeline #3438 keeps SAM tracks compact, resends an unanswered SAM request once (the first is counted as spent) and recovers an attempt whose process died. Live with `01ca433` (05:42:50Z). A resume at 05:43Z was refused before any work because the Google Cloud budget report was older than 5 minutes (the month: $9.77 of $100). The 05:46Z resume finished the clean plate at 05:52Z, with at least 5.5 GB free throughout | $0.69 held (SAM $0.35, Gemini $0.34) | 03:19–05:52Z | (a) SAM decoding held whole-video masks in memory. (b) No operator path recovered a preparation whose process died |
| 10 | Scene handoff (levelling) | **done on the fallback floor** | Six refusals of `website_atlas_scene_level_unobserved` (05:52–09:56Z), each followed by a general fix and a recorded answer:<br>(1) no single plane held 4% (fix: parallel level surfaces, Pipeline #3441);<br>(2) that search missed the floor as the lowest layer and failed against dense bookshelves (#3442);<br>(3) its profile was taken along a sloped 44.5° plane (#3444 keeps one along +Y and each candidate);<br>(4) the floor sat a couple of degrees off the shelves, so the floor is now fitted as its own plane (#3445);<br>(5) that fit showed the floor is **uneven**: its best 2 cm plane holds 1.5%, while a 20 cm band holds about 6% (#3446 levels when two up estimates agree within 0.5°);<br>(6) they are **3.1° apart**. The up direction is known only to about 3°, and the reconstructed floor rises and falls about 10 cm.<br>**Then the flagged fallback floor** (owner, about 13:00Z; Pipeline #3448, live with `853f309` at 13:56Z). Resumed 13:57Z; at 14:04Z the base scene recorded `up_basis: fallback_fitted_floor`, tilt 0. 3,167 faces (0.83% of the area) were replaced by a 3.42 × 2.75 m flat floor, flagged `development_only_estimate` | $0 | 05:52–14:04Z | The reconstruction's floor is not flat enough to declare as observed. The flat stand-in is flagged, and every G1 result on it carries `g1_scene_floor_estimated` (Pipeline #3449) |
| 11–12 | Navigation spec, Isaac scene files, native qualification | **done** | 14:04Z handoff: `navigation_task_spec.json` and `navigation_scene_assets.json` written; the navigation scene inputs record `status: written` with `robot_free_probe_status: passed`; the registry's derived row written | $0 | 14:04Z | — |
| 13 | Robot team picks its saved setup; screening | **done** | 22:55Z handoff `intake_ready`, `accepted`, lane `g1_navigation_screening`; the receipt was bound 22:47Z | $0 | 22:55Z | Held-job restarts were skipped by the lane resume marker (Pipeline #3460) and refused when the hold was parent-bound (#3462) |
| 14 | Results on the task page; provider-zero | **in progress** | DP attempts 1–5 stopped before an episode, each on a fixed cause. DP attempt 6 scored the first episodes, but the robot fell through the scene, so they are void (Pipeline #3478). On the walked floor (11-09), DP's next two runs stopped before an episode (ffmpeg fetch; a silent runtime). π0.5's third run reached its policy and failed its first inference on a missing C compiler (Pipeline #3503). DP's 7th run follows `661c780`. Each settled with no continuing spend | about $5.37 (Vast) | 11-07 23:01Z onward | Tests did not exercise the remote runtime path; the spawn's floor (now checked before spend) and the policy's compile toolchain (checked before the first episode once #3503 deploys) were found only on rented machines |

## Gaps from capture-447 (G1–G11)

For each gap: the cause with its evidence, the general fix, and what proves it fixed in production.

| Gap | Cause and evidence | General fix | Proof in production |
|---|---|---|---|
| G1 placement vs wrist view | The robot base sat at table height with the tray centre 0.92 m ahead; the wrist camera saw 0–94 tray pixels at 9 of 10 starts (tracker, 11-06 study). Cause in code: the website station (`team_scene_packet._carrying_station`) ranks stances by reach and the scripted carry only. The existing framing machinery (`native_task_camera_start_configuration.camera_framing_report`, `materialize_camera_start_from_plan`) is not applied on the beta team-packet path | Rank in-reach stances by every policy camera's framing report at the reset joints, requiring the wrist view to sit above the gripper's own pixels; then bind a camera start configuration. Proposed, not built: the grasp, not the view, is what failed on 447 | not started |
| G2 garbled prompt | `concrete_droid_task_instruction` joined a location-laden subject label with the same surface as target | `task_spec_compiler.placement_instruction`: the subject without its location, plus the marked destination (Pipeline #3419) | a new arm job's `task_spec.prompt` |
| G3 marker covers object | `task_evaluation_surface_target` sized the marker from the object's half-diagonal (0.39 m) | `task_spec_compiler`: markers sized to the goal tolerance, and a goal never covers its subject's start (Pipeline #3419). The owner switched the website arm rule to "object centre within a tolerance" on 11-06, so the website target is sized the same way (in progress) | a new plan's marker radius equals the tolerance |
| G4 base above support | root at the registered support top, 0.8166 m; object on the collider top, 0.8039 m | `team_scene_packet` seats the station on `support_alignment.start_support.collider_top_z_m` when it exists (Pipeline #3423) | a new arm plan's station height |
| G5 misread score field | `gripper_closed` is evaluated only over the settle window | `behaviour` block on every rigid and predicate report: closes, width, closest approach, and for a mobile robot its path, goal approach and clearance (Pipeline #3419) | a new run's `score_receipt.behaviour` |
| G6 flat-object grasp | The authored contact point was the object's centre with a top-down approach, whatever its size: the pads open 0.104 m and the tray's narrowest side is 0.313 m | Derive the affordance from geometry. When the narrowest horizontal extent exceeds the tool's opening, put the contact on the rim or edge facing the robot; otherwise keep the centre. Proposed | not started |
| G7 money cutoff | Nothing re-read the job's money authority after planning. capture-447's last run launched at 10:23Z, 7 minutes after the owner's $130 row expired. The WebApp ceiling also ignored that row's `expires_at_epoch` | WebApp #1226 (merged): an expired owner row raises no ceiling. Pipeline #3423: `launch_candidate` re-reads the ceiling in force before spawn (`require_current_job_ceiling`). Widening the door's hold profile stays the owner's call | after deploy, a launch past an expired row refuses with `beta_screening_job_ceiling_exceeded` or `website_job_ceiling_unavailable` |
| G8 ingestion fragility | one B2 failure sealed a paid run (molmoact2, 11-06) | Pipeline #3411, merged | waits on a deploy (Bandit signed off 11-06) |
| G9 cosmos3 `policy_load` | dependency precedence (`cosmos_droid_client_dependencies.py:57`) | Pipeline #3416, merged | waits on a deploy (Bandit signed off 11-06) |
| G10 metric scale | The clip has no known dimensions. The Atlas review took a scale prior from a cited 80 cm bookcase product page and recorded "a broad category prior; no product match is established… do not establish measured metric scale". The scene's `scale_authority` is `atlas_reference_estimate` | The compiled spec carries `metric_scale` as status plus evidence, and widens a locomotion goal's tolerance by 10% of its distance when scale is not validated, capped at 0.5 m and flagged (Pipeline #3419 and #3423) | the job's `compiled_task_spec.json` |
| G11 host hygiene | `door status` 14:11Z: `/var/lib/blueprint` 86.7% used; 4 storage classes over budget; 7 parked deliveries (owner test jobs from 10-11 to 10-27, whose brief digest changed with WebApp #1113); Vast $7.07 | parked deliveries: the owner approved retiring them (11-06). On the host they are 7 test captures parked since 10-28/29, and a general door operation is being built to retire them. Vast: the owner's top-up | `door status` `preparation_delivery.parked_count` 0 |

## Task-kind gate inventory

Every place in either repo where a task kind, a task-profile enum, a regex over
the task text or a robot type changes what runs. Read at Pipeline `3d1cd4dd`
and WebApp `8a4caa7`.

For each entry, the "Navigation job" column says what happens to this job
there, and "Replacement" gives the general mechanism and its status.

Roots: **W** = `Blueprint-WebApp/`, **P** = `BlueprintCapturePipeline/src/blueprint_pipeline/`.

### WebApp intake and spend

| Where | Decides | Navigation job | Replacement |
|---|---|---|---|
| W `server/utils/siteTaskScope.ts:66-77, 314-318` `screenTaskScope` | supported/kind/disposition hint | `mobile`, `accepted_for_analysis` | display and demand hint only; documented so on this branch |
| W `siteTaskScope.ts:79-85, 116-118` `POSITIVE`, `RELOCATION` | "from … to" or "move" reads as `rigid_pick_and_place` | not reached ("mobile" fires first) | **risk:** reworded without "navigate", the job is routed to the rigid path and fails untyped (`website_single_manipulated_subject_required`). Fix: the Pipeline always reads the task semantics |
| W `server/utils/websiteSceneSponsorship.ts:240` `taskScopeNotSupported` | refuses an execution grant (`website_scene_site_not_qualified`) | would refuse the scene-configuration grant | **removed on this branch**; the site screen and the budgets still apply |
| W `server/utils/teamJobAccess.ts:125, 195` | `task_not_yet_supported` holds team evaluation | would hold step 13 | **removed on this branch**; the job's own runnable-scene proof decides (`scene_not_runnable`) |
| W `server/utils/siteRobotFit.ts:473-481` `notRated` | robot forms rated only for scorable pick-and-place | not rated | rate from task predicates (route length, clearance) |
| W `server/utils/taskFamilySceneIntake.ts:9-13`, `taskEvaluationSceneIntake.ts:249-271`, `taskEvaluationLaunchPreparationContract.ts:251-286`, `sceneObjectDiscoveryContract.ts:32, 73-75` | strategy enums in intake and launch contracts | would refuse a navigation strategy | strategy registry from the Pipeline catalog |
| W `server/utils/internalPolicyCanaryContract.ts:66, 463-494`; `nativeG1TeamCampaignForwarding.ts:14, 41, 66` | G1 objective enum | `g1_navigation_goal` pairs refused (`POLICY_OBJECTIVE_CONTRACT_NOT_PUBLISHED`) | objective from the task's success contract |
| W `server/utils/evaluationReadyRunContract.ts:11, 147`, `taskEvaluationRunContract.ts:534` | run contract fixed to the DROID Franka | no non-Franka run | embodiment by requirement |
| W `server/utils/websitePreparationStatus.ts:100-106`, `client/src/components/site/RobotFitHold.tsx:9, 28` | `task_kind` enum on the status receipt | a new kind fails to parse | open string, display only |

### Pipeline preparation (where this job holds first)

| Where | Decides | Navigation job | Replacement |
|---|---|---|---|
| P `task_profile_contracts.py:27-62` `TASK_PROFILES`, `task_profile_for` | profile → adapter and scorer | no profile | profiles as data with requirements; navigation added with the per-job route |
| P `atlas_preparation_context.py:26-28` `requires_task_semantic_analysis` | reads semantics only for `general_task` | semantics are read | always read semantics |
| P `website_operation_coverage.py:212-239` `operation_coverage_gap` | typed hold | **`website_task_operation_coverage_unresolved`** (first hold) | resolves once the profile exists |
| P `website_task_preparation.py:95-150` `native_task_preparation_gap` (`legacy` at :124) | hold or route | coverage gap, or `website_native_task_profile_preparation_required` without semantics | from the compiled spec |
| P `website_early_task_hold.py:45-165` | hold right after the Atlas review | **held here** | keep as the typed hold for a truly missing piece |
| P `website_task_context_contracts.py:126` | subject holds only for two profiles | n/a | drop the allowlist |
| P `website_atlas_pipeline.py:48-67` `ROUTE_ENV` | geometry-only route by a host env switch | full route | route per job from the spec: no manipulated subject means the scene as filmed |
| P `website_task_preparation.py:1066-1073` | raises `website_single_manipulated_subject_required` | n/a | a typed no-subject spec |

### Pipeline scene configuration, screening and scoring

| Where | Decides | Navigation job | Replacement |
|---|---|---|---|
| P `team_scene_packet.py:85-86, 914-917` `RIGID_STRATEGIES` | refuses other strategies; the robot is always the DROID Franka | refused | strategy and robot by requirement |
| P `external_scene_robot_placement.py:566-567` | `external_placement_robot_must_be_default_franka` | n/a | embodiment by requirement (G1 placement objective) |
| P `task_evaluation_embodiment_registry.py:42, 97, 138-147` `FIXED_ARM_TASK_PROFILES` | robot × profile matrix; G1 lists only `rigid_pick_place` and `reviewed_checkpoint_terms` as missing | no body lists navigation | capabilities as requirements. The G1 terms are reviewed in the catalog for internal development; customer-site scope is an owner decision (#3418) |
| P `website_robot_fit_precheck.py:64-68, 284-374` `TASK_KINDS` | fit per strategy; others `unknown` | unknown, not held | fit per predicate × embodiment |
| `config/beta_policy_candidates.v1.json` `supported_task_kinds` | 45 rows `[rigid_pick_place]`, including the G1 navigation policies | no candidate supports navigation | declare requirements per policy |
| P `beta_policy_screening_plan.py:395, 435-460` `TASK_KIND_BLOCKERS` | `task_kind_not_supported_by_candidate` | would refuse every candidate | match on requirements |
| P `beta_policy_screening_capabilities.py:290-293` | `g1_beta_native_rigid_task_required`, `g1_beta_scene_packet_missing` | G1 cannot be used | owned by the G1 session (#3418): registration and runtime source |
| P `beta_policy_screening_g1.py:25, 72, 191-214` | 48 GB floor; `supported_task_kinds: [rigid_pick_place]`; `task_kind == rigid_pick_place` | refused | navigation as its own spec. The 48 GB floor rents A6000s at $0.40–0.51/h (#3418), so it is not a money blocker |
| P `native_g1_scene_packet_request.py:111, 180-200` | `g1_scene_request_source_task_mismatch` unless rigid | refused | packet from the compiled spec (coordinated with #3418) |
| P `native_g1_navigation_goal.py:22, 40-54` | `task_kind == rigid_pick_place`, a fixed sentence, a yellow disc, obstacles unscored | the site's "avoid contact" is not representable | `task_predicates`: the same criterion plus `no_contact` (Pipeline #3419) |
| P `adp_task_scoring.py:1313-1339` `score_task_episode_from_spec` | scorer by `task_kind`, else `task_kind_unsupported` | no scorer | **compiled predicates dispatch first** (Pipeline #3419) |
| P `robot_free_probe_gate.py:40-67`, `beta_policy_screening_launch.py:165-168` | probe checks per kind | refused | probe checks per predicate family |
| P `droid_policy_canary_embodiment.py:55-90` | prompt from kind/strategy | would mis-instruct | instruction from the compiled spec (Pipeline #3419, G2) |

Display only, with no gating: `siteReadiness.ts:150-163`,
`taskStatusProjection.ts:424-425, 831-833`, `siteTaskScope.ts:380-459`,
`jobConsoleFacts.ts:249`, `client/src/data/siteMeasurements.ts:34`,
`siteTaskMeasurements.ts:150`.
