# Library-aisle navigation job, end to end (2026-11-06)

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
| Vast top-up | $30, the owner's own action | pending. `door status` 14:11Z: credit $7.07 against the $11 page line |
| Atlas allowance | $40 | automatic grant of $25 / 32 requests (`pipeline/atlas/configuration.json`) |
| Upstream ledger | $5 | $5 (`pipeline/website_scene_sponsorship.json`) |
| Scene budget | $40 | $20 at intake, with 16 paid attempts (`website_scene_sponsorship.json`) |
| Preparation attempts | 16 → 32, one-shot | applied 14:53Z, amendment `sha256:99ab7973…` (`scripts/amend-website-preparation-limit.ts --apply`) |
| Site screening | $30, the existing limit | `SITE_LIMIT` in the Pipeline coordinator |
| Cloud Run | $0 | not enabled |

## Owner decisions, 16:05Z (10:05 CST)

| Decision | Words | Applied |
|---|---|---|
| Bandit triage | "Bandit OK as recommended" | Pipeline #3423 `6429be8`, applied on top of #3420's renewal: 18 entries expire 12-06, 77 expire 2027-02-04, every entry is owned by `@ognjhunt`. [51] is fixed in code (DeepInfra download: https to DeepInfra hosts only, 2 GiB cap) and has a fresh entry. The gate passes locally: high 0, medium 96 |
| G3 success rule | "switch G3" | The arm rule changes from "the whole object inside the disc" to "the object's centre within a tolerance", so the disc can be small and clear of the start. Done: WebApp #1228 (live) accepts the new target schema, and Pipeline #3427 emits it, live with `8dc96be` at 22:32Z. Earlier results still score the old way. The 5 cm tolerance is the harness default, not an owner choice |
| Parked deliveries | "yes retire the 7" | No door operation could end a parked delivery, and host files are never edited by hand. Pipeline #3425 added a general owner-approved door operation, `retire-parked-delivery`, and #3427 fixed its first plans. It runs once the door is upgraded past `4e8e946` (the G1 session's `upgrade-door`, after the 22:32Z deploy) |
| Rights | "yes standard - rights are okay" | Recorded above |

## 14-step evidence matrix

| # | Step | Status | Artifact | Cost | Time | Gap found |
|---|---|---|---|---|---|---|
| 1 | Website intake, rights, task | **done** | `POST /api/inbound-request` 201. Host `pipeline/website_task_context.json` (`task_family: general_task`, `confirmed: false`) and `website_scene_sponsorship.json` (consent `spend_authorized: true`, `task_confirmed: false`) | $0 | 14:44Z | The brief screen recorded the job as "mobile", which is a hint. On today's code it also refuses an execution grant for such a job: the task-kind gate at `websiteSceneSponsorship.ts:240`, removed on this branch |
| 2 | Original-byte upload, capture binding | **done** | `POST /api/self-capture/uploads/…` 201 at 14:51:48Z, `processing_ready`. Host `raw/walkthrough.mp4` is 49,023,833 bytes, and `clean_plate_stage_manifest.json` records `input_video_sha256: 3f1c177f…76e1c0`, equal to the source | $0 | 14:44–14:51Z | — |
| 3 | Video/privacy/task review | **done, then failed** | Atlas planner review 1, receipt `scene_planner/9ad5eb5e….json`: `no_manipulated_subject`, one `navigation` step, `covers_entire_job: false` (start pose, stop tolerance and robot footprint unspecified; "no registered navigation profile"). Reviews 2 and 3 followed. Clean plate: Gemini `removal_plan.json` found 4 targets (left, right and end shelves, and the floor), with 0 to remove and 0 people | $0.079, $0.141 and $0.120 (OpenAI, settled); SAM target 0 about $0.087 reserved | 14:45–15:50Z | (a) Review 3 cited a frame it had not selected, and the Atlas job failed with `atlas_automation_frames_not_selected` (fixed in Pipeline #3423). (b) The 4K source made the extended survey slow: 153 frames as about 11 MB PNGs, roughly 30 s each. (c) Clean plate stopped with `meta_sam_submission_requires_reconciliation`: a parser timeout at a fixed 300 s, then a 404 on a stale video upload (fixed in #3423) |
| 4 | Task-relevant selection and reconstruction plan | **done on the second try** | First try: Atlas `preview_job.json` `failed`, `atlas_automation_frames_not_selected`, revision 2 (15:50Z). After the `a14db1c` deploy (#3423, about 17:18Z) the job was requeued at 17:27Z (revision 4). Two more planner reviews passed, and the World Labs source pose ran | $0.120 and $0.056 (OpenAI); $0.41 (World Labs pose); all settled | 17:27–18:29Z | — |
| 5 | Preserved-scene gap review | **failed, fixed, requeued** | `preview_job.json` revision 4: `failed`, stage `source_pose`, `atlas_source_gap_capture_identity_invalid` (18:29Z). The pose had also been given the clean plate's 41 task-source frames (`object_geometry_only`), 6 of them in no Atlas survey, and `source_gallery` requires every conditioned frame to be surveyed. Pipeline #3428 adds the missing frames from the manifest the pose verified. Live with `8dc96be` (22:32Z); requeued at 22:34Z (revision 5). By 22:36Z the job had written `capture_source_survey_with_task_views.json` | $0 (it stopped before any gap purchase) | 18:29Z; 22:34Z | The task-source frames reached the pose but not the gap review's survey |
| 6–12 | Gap fill, splat, registration, assets, integration, native qualification | waiting | | | | The scene is kept as filmed, so there are no masks or edits. The handoff then compiles the navigation spec (`navigation_task_spec.json`) and authors the scene's Isaac files (`navigation_scene_assets.json`), both from #3428 |
| 13 | Robot team picks its saved setup; screening | waiting | | | | The job is expected to hold at the handoff with `website_task_runnable_policy_missing`, naming the navigation pieces not yet live: the arena runtime with no task object (Pipeline #3431, in review) and the G1 lane (part C, not started). Also needed: the site confirms the brief (`confirmed: false` today), and the owner's Vast top-up. Plan: Pipeline `docs/G1_NAVIGATION_FROM_COMPILED_SPEC.md` |
| 14 | Results on the task page; provider-zero | waiting | | | | |

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
