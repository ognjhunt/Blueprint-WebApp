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

| Step | Evidence at 2026-11-03 02:30 UTC (8:30 PM CST, 11-02) |
| --- | --- |
| 1–9. Intake, upload, capture review, plan, masks, background, views, Atlas, registration | **done for preparation; not re-read on 11-03.** The attempt's preparation result `pipeline-control-plane/task-evaluation-owned-scene-preparations/results/website-f06d4da8…-16f5bee56419-preparation-ae002f49….json` is `queued_for_production_scene_configuration` with no blockers and no paid execution requested. Earlier sessions' evidence for these steps is not repeated here. |
| 10. Task object (ARTISAN) and static qualification | **done.** CPU prestage on the control plane, no GPU: stages 1–2 23:47–23:49, stage 3 (ARTISAN) 23:49–00:49, stage 4 00:49–00:50 (5:47–6:50 PM CST). ARTISAN meter: 43 calls (42 `gpt-6.1-sol`, 1 image), all priced, $4.21 of the $12 cap. Receipt `<job>/immutable_execution/stages/stage-3/adapter/replacement_authoring_receipt.v1.json` (`task_object_artisan_candidate.v1`, backend `artisan_v1`, `rigid_body`, subject `website-subject-53e1ef5c8bf71f6d840a`). Static qualification `…/stage-4/adapter/static_qualification_receipt.v1.json`. Prestage result `<job>/cpu_prestage_provider_result.json`: `completed_prefix` to `stage-4`. |
| 11. Captured-room integration | **built and published.** Stage 6 assembled the configured scene bundle (`…/stage-6/adapter/scene_assembly_receipt.v1.json`); see step 14 for publication. |
| 12. Native import qualification | **done.** One Vast GPU (instance 58898824, $0.534/h) from 00:57:51; it restored the stage 1–4 capsule (`STAGE_PREFIX_RESTORED`, stages 1–4 `ADOPTED`, not rerun), ran stage 5 01:14–01:19 and stage 6 at 01:19; entrypoint exit 0. Receipt `…/stage-5/adapter/native_import_qualification_receipt.v1.json`. |
| 13. Screening (policy episodes) | **held on owner confirmation.** The robot-team packet refused at 02:16 (8:16 PM CST) with `team_scene_owner_contract_invalid:configured_owner_success_contract_authority_missing`: website jobs seal Blueprint's default thresholds as `proposal_only` (the brief's own targets are `not_supplied`), and both the team packet and screening require a confirmed contract. No website or Pipeline path confirmed one. At 02:27 (8:27 PM CST) the owner chose to confirm this job's exact thresholds through a new operator-door request (`confirm-owner-success-contract`), being built in the Pipeline. Screening then plans within the smaller of the $15 site allowance and what the $130 job ceiling leaves. |
| 14. Teardown and website result | **teardown done; scene published.** `<job>/vast_provider_run/vast_teardown_manifest.json` `completed`, no continuing spend; GPU spend guard provider zero at 01:23:39. GPU estimate $1.16 ($0.21 runtime, $0.95 transfer) in `vast_budget_ledger.json`; Vast's own charge not yet reconciled. Publication first refused `website_publication_evidence_invalid` (website publication accepted only the earlier authoring backend's receipt; fixed by Pipeline #3297, deployed as `ceddd0220` at 01:59). Publication recovery then republished the retained build without the provider (`<launch>/publication-recovery-ceddd0220…/configured_scene_publication/`, thumbnail = ARTISAN's tray render), and the website refused the sync with HTTP 400 because its offering schema did not accept three binding fields the Pipeline sends (fixed by WebApp #1201). The sync passed at 02:14 and the scene progression recorded `completed/scene_prepared` at 02:16 (8:16 PM CST). |

Spend on this attempt so far: about $5.37 (ARTISAN $4.21 metered, GPU $1.16
estimated).

## Next

1. Merge and deploy the owner-confirmation request, then the owner confirms this
   job's exact thresholds through the door (preview, then apply).
2. The robot-team packet compiles, then the robot-free probe and screening of
   the three candidates, then the robot team's saved-setup step.
