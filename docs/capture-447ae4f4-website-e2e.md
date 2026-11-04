# capture-447ae4f4: wooden tray, website scene end to end

Task: "Pick up the wooden tray from the dining table and place it at the other
end of the same table". Website request `capture-447ae4f4-c253-44ae-a897-c999245e0ef7`,
scene `site-capture-447ae4f4-c253-44ae-a897-c999245e0ef7`. After the
2026-11-02 grant renewal the Pipeline intent is
`scene-c0e6803928890efaa9cdacd6b65589e86a32df6499fd3987f3c1682b6ee81473`, with an
owner-approved $90 scene budget (preparation and configuration) and the website
job ceiling raised to $130 by the owner's job-authorization row.

Host paths below are relative to `/var/lib/blueprint/`. Times are UTC, with CST
(UTC−6) in brackets. A step is claimed only with its artifact. Steps not
re-read on 2026-11-03 say so.

## Current attempt

Attempt `source-16f5bee564198ad68014c3aa` on release `e86f4e5452b4` (ARTISAN on
`gpt-6.1-sol`, reasoning `max`, $12 authoring cap, $6 compute cap). Launch
`website-f06d4da8b9f81559cd23f5f7-e86f4e54-20261102t223121z-16f5bee56419-activation-auto-launch`
(below, `<launch>` is `pipeline-control-plane/task-evaluation-launch-runs/` plus that
name, and `<job>` is `<launch>/allocator/scene-configuration-job`).

The earlier attempt `source-1b3df51413d45b5045a05a22` ran ARTISAN on
`gpt-6-astra` and stopped in stage 3 when OpenAI refused requests for credit
(429 `credit_balance_exhausted`, 2026-11-02 21:16 UTC). It was retired by the
`e86f4e5452b4` release succession. Its settlement receipt keeps the full $31 as
the stored figure (`terminal_launch_unreconciled`); budget admission derives the
proven hold from its meter (Pipeline #3291). The successor attempt was sized at
its full $18, which does not fit if $31 is counted.

| Step | Evidence at 2026-11-04 09:20 UTC (3:20 AM CST) |
| --- | --- |
| 1–9. Intake, upload, capture review, plan, masks, background, views, Atlas, registration | **done for preparation; not re-read on 11-03.** The attempt's preparation result `pipeline-control-plane/task-evaluation-owned-scene-preparations/results/website-f06d4da8…-16f5bee56419-preparation-ae002f49….json` is `queued_for_production_scene_configuration` with no blockers and no paid execution requested. Earlier sessions' evidence for these steps is not repeated here. |
| 10. Task object (ARTISAN) and static qualification | **done.** CPU prestage on the control plane, no GPU: stages 1–2 23:47–23:49, stage 3 (ARTISAN) 23:49–00:49, stage 4 00:49–00:50 (5:47–6:50 PM CST). ARTISAN meter: 43 calls (42 `gpt-6.1-sol`, 1 image), all priced, $4.21 of the $12 cap. Receipt `<job>/immutable_execution/stages/stage-3/adapter/replacement_authoring_receipt.v1.json` (`task_object_artisan_candidate.v1`, backend `artisan_v1`, `rigid_body`, subject `website-subject-53e1ef5c8bf71f6d840a`). Static qualification `…/stage-4/adapter/static_qualification_receipt.v1.json`. Prestage result `<job>/cpu_prestage_provider_result.json`: `completed_prefix` to `stage-4`. |
| 11. Captured-room integration | **built and published.** Stage 6 assembled the configured scene bundle (`…/stage-6/adapter/scene_assembly_receipt.v1.json`); see step 14 for publication. |
| 12. Native import qualification | **done.** One Vast GPU (instance 58898824, $0.534/h) from 00:57:51; it restored the stage 1–4 capsule (`STAGE_PREFIX_RESTORED`, stages 1–4 `ADOPTED`, not rerun), ran stage 5 01:14–01:19 and stage 6 at 01:19; entrypoint exit 0. Receipt `…/stage-5/adapter/native_import_qualification_receipt.v1.json`. |
| 13. Screening (policy episodes) | **not launched; robot-free probe waiting on a Pipeline fix.** Owner contract confirmed at 03:50 (request `20261103T035039Z-confirm-owner-success-contract-6e323b9c`, revision `ae2703d0…`); controls-pause screening (Pipeline #3308, `6cec9f9b9`) and team evaluations (#3314) deployed. The team packet then failed in turn on a frame-check false positive (#3311), a room-mesh station check (#3316), and kernel OOM kills of the compile on the 8 GB host (the tray hull ray cast in the third-camera search, about 5.6 GB; #3318, #3326, #3329, #3330). Each new release re-drove it once (#3313, #3321). It **compiled at 16:27 (10:27 AM CST)** on release `26004d8b5`: `pipeline-control-plane/team-scene-packets/status/31e12dca983b8837295ac911c44dee68.json` (`completed`, outcome `compiled`, no blockers, no paid execution). The robot-team offer is skipped until the robot-free probe receipt exists. The probe was queued at 16:27; from 16:28 every pass deferred `rigid_robot_free_probe_website_grant_expired` with nothing staged or spent: the job's renewed 24 h window ended 2026-11-03 15:36 UTC, and the Pipeline still reads the capture's Oct 30 grant copy. At 16:52 the owner approved a time-only extension to 2026-11-10 15:36:37 UTC (door request `20261103T165248Z-extend-scene-execution-window-90fa9fbb`, extension `sha256:908d2552…`, caps unchanged, WebApp receipt `sponsorship_window_mirrored: true`), and approved letting it cover the probe's ≤$1 booking. |
| 14. Teardown and website result | **teardown done; scene published.** `<job>/vast_provider_run/vast_teardown_manifest.json` `completed`, no continuing spend; GPU spend guard provider zero at 01:23:39. GPU estimate $1.16 ($0.21 runtime, $0.95 transfer) in `vast_budget_ledger.json`; Vast's own charge not yet reconciled. Publication first refused `website_publication_evidence_invalid` (website publication accepted only the earlier authoring backend's receipt; fixed by Pipeline #3297, deployed as `ceddd0220` at 01:59). Publication recovery then republished the retained build without the provider (`<launch>/publication-recovery-ceddd0220…/configured_scene_publication/`, thumbnail = ARTISAN's tray render), and the website refused the sync with HTTP 400 because its offering schema did not accept three binding fields the Pipeline sends (fixed by WebApp #1201). The sync passed at 02:14 and the scene progression recorded `completed/scene_prepared` at 02:16 (8:16 PM CST). |
| 13b. Robot-free probe | **first GPU runs; scene check not yet valid.** Window extension and booking fixes (WebApp #1205, Pipeline #3332) deployed 17:35/17:48. The probe was then refused before spend by the arm-reach gate (17:54) and by the tray's start pose (14.7 mm off, 21:12); fixed by #3335 and #3345 (deployed `e241cf29e`, 21:07). Attempts in `pipeline-control-plane/rigid-robot-free-probes/jobs/003c7a1ef84d169a04878b894e412a3a-bdfe6a51ccf61583/`: 00 (21:36, Vast 59017963) and 01 crashed at simulation launch (`set_use_tiled_camera` missing in pinned Arena; $0.13 and $0.17); fixed by #3347 with an owner-approved re-drive (deployed `9f47f0466`, 22:30). Attempt 02 (Vast 59023542) ran clean and recorded a trace (`<launch>/rigid_robot_free_probe_trace.v1.json`, $0.23) but scored `probe_unavailable`: on the scanned table the tray settles 2.8 mm low and tilted 0.044 rad (reset readback 2 mm / 0.01 rad), and a placement at the goal settles 1.2 mm below the sealed success window. Fix in progress: a flat support at the registered table height in the evaluation half. The site received the named hold by email. |
| 13c. Robot-free probe on a flat support | **ran clean; scoring awaits deploy approval.** The scanned table was planarized to the success plane in the evaluation half (#3349, deployed `283b79805` 00:26 UTC); the half's `task_support_pad` is `consistent` (plane z 0.80389, start and goal rest at the window centre, tilt 0). New probe job `…-9319f26e660a4c7c`: attempt 00 hit a Vast no-start ($0.09); later attempts were refused as `website_grant_exhausted` because the four earlier $1 holds were never settled; WebApp #1210 + Pipeline #3351 (deployed `88497b47`, 02:13 UTC) settled them to $0.62. Attempt 02 (04:27 UTC, $0.20) ran clean: the tray rests at z 0.81426 with tilt under 0.002 rad and settles at the goal at 0.81406, inside the window. Ingest refused it as `trace_conflict` beside the superseded request's trace; #3353 (merged, `d6f10b375`) re-ingests it at no cost, and a local replay predicts receipt `passed` (untouched `never_moved`, carried `placed_and_settled`). Deploy of main `f3717f0e1` awaits the owner's approval. A read-only lookahead predicts screening of scripted industrial arms only (learned Franka policies are out of reach from any clear stance), giving a `reference_only` hold. |

Spend on this attempt so far: about $5.90 (ARTISAN $4.21 metered, GPU $1.16
estimated, robot-free probe about $1.11 estimated across six runs).

## Next

1. WebApp: the preparation spend booking honours the owner's verified window
   extension (the Oct 31 rule kept paid bookings at the grant's own 24 h). The
   Pipeline then reads the current grant from the WebApp, through the window,
   instead of the capture's stale copy. Both are owner-approved (2026-11-03) and
   go out as one WebApp merge plus one Pipeline deploy.
2. The robot-free probe (one GPU session, cap $1, two funded attempts) records
   its receipt: untouched tray scores not-success, tray scripted to the goal
   scores success.
3. Screening plans and launches, capped at the smaller of $15 and what the $130
   job ceiling leaves.

Separately (owner's timing): the job ceiling undercounts settled scene spend
(the Pipeline commits $39.63 on the current intent, the website counts $18);
fixes are WebApp #1204 then Pipeline #3315.
