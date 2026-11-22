# Pipeline inventory (agent `inventory-pipeline`)

Audit date 2026-11-22. Repository `BlueprintCapturePipeline` at HEAD `7d8b532` (2026-11-20).
The control plane runs release `cbff06b` (door `status.active_release`, saved 15:01Z).
HEAD is 6 commits and 22 files ahead of it (`git log --oneline cbff06b..HEAD | wc -l` -> 6).

This is the map the later phases hunt over. It is built from code and deploy files first,
then checked against the door (read subcommands only: `status` saved copy, `units`, `usage`,
`journal`, `cat` of one unit-failure record) and the docs.

Nothing here read a site's video, frames, name, address, contact details or job sentence.
Host data below is counts, states, times, sizes and money only.

Scratch scripts and raw outputs (not part of the deliverable):
`/tmp/claude-0/-home-user/e3989091-e008-5b78-a9cb-b7c31a5efdb8/scratchpad/agents/inventory-pipeline/`
(`graph.py`, `reach.py`, `fam.py`, `boundary.py`, `testonly.py`, `tests_area.py`, `units_md.py`,
`door-units.json`, `door-usage.txt`).

## 0. The short version

- The website job path is real and small at the top: 11 units move a job. But its import closure
  is huge. Starting from the units that move a website job, Python imports reach **1,317 of 1,621
  modules and 581,873 of 715,431 lines (81%)**. Retired systems ride along inside that closure.
- Trial code (the early trial of robot software, dropped 2026-11-14) is still imported by live
  code along **59 import edges from 41 live modules into 22 trial modules**. G1, Astra, episode
  compilation, the rigid probe and RunPod have the same pattern. Exact edges are in section 8.
- The host carries **207 failed units**. 206 are one-off experiment units from 2026-09-26 to
  2026-10-27 that were never cleared. The one real failure is the **GPU spend guard: 4,844
  failures since 2026-11-13**, because the retired RunPod is still queried while its key exists.
- **No company simulation package exists for any capture on the host.** The Atlas preview pass
  at 15:17Z counted `company_simulation_no_source: 4, company_simulation_not_permitted: 2`
  and zero current packages.
- Retired lanes still hold at least **67 GiB** of host disk (door `usage`), and three armed
  timers fire for lanes no website job feeds.
- The nightly full test lane has been **red four nights running** (2026-11-18 to 11-21),
  each night on a different single test.
- Several docs that agents are told to trust name files that were deleted on 2026-11-15, and
  `docs/SYSTEM_MAP.md` still says faces are blurred in every frame sent to World Labs, which the
  code no longer does for jobs under the current Privacy Policy.

## 1. The website job path, stage by stage

Sources: `docs/SYSTEM_MAP.md` (2026-11-19) for the skeleton, then each claim checked in code.
"Retry" says whether the stage uses `job_retry_policy` (the one rule AGENTS.md requires) or its own.
Modules that import `job_retry_policy` (grep): `atlas_refined_splat_retry, atlas_scene_automation,
clean_plate_removal_analysis_gemini, control_plane_stall_alarm, deterministic_refusal, hard_stops,
pubsub_handoff_listener, rigid_robot_free_probe_runner, scene_packet, scene_packet_queue,
scene_run_restore, task_evaluation_scene_launch_recovery, team_scene_packet_worker,
website_atlas_preview, website_build_choice, website_destination_choice, website_gemini_receipts,
website_preparation_retry, website_preparation_status, website_preparation_terminal,
website_rules_reopen, website_scene_handoff`.

| # | Stage | Entry module (lines, test files importing it, last change) | Unit that drives it | Needs | Produces | Provider, paid? | Retry | Deadline | Who consumes the output |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Upload hand-off | WebApp upload -> Cloud Function `functions/storage_trigger.py` (`on_storage_finalize`) -> Pub/Sub `capture_bridge_handoff` | (Cloud Function; GCP) | `raw/capture_upload_complete.json` | Pub/Sub message | GCP Pub/Sub, Storage (metered by GCP, $100/month ceiling) | Pub/Sub redelivery, then host retry (row 2) | none here | listener (row 2) |
| 2 | Frames, privacy screen, preparation | `pubsub_handoff_listener` (2,139 lines, 44 tests, 2026-11-15) -> `run_e2e` -> `site_package_orchestrator` -> `website_capture_preparation` (183, 13, 2026-11-18); privacy gate `site_package_orchestrator._privacy_postprocess_gate`; retry `website_preparation_retry` (610, 9, 2026-11-17) | `blueprint-pubsub-handoff-listener.timer` (every 1 min after inactive; service `TimeoutStartSec=6h`, batch slice) | Pub/Sub message, raw capture, signed WebApp context, a job sentence (`require_task_named`, `website_capture_preparation.py:15`) | `pubsub-handoffs/<bucket>/scenes/<scene>/captures/<capture>/pipeline/*` | Gemini (clean-plate analysis, removal visibility, whole-view review, via `website_gemini_receipts.retained_gemini_call`), Meta hosted SAM 3.1 (`meta_sam31`), OpenAI; all paid, admitted per `scripts/paid_api_call_sites.json` | `job_retry_policy` via `website_preparation_retry` | the grant's expiry (`website_preparation_terminal.retained_window_end`) | Atlas step (row 3), scene handoff (row 4) |
| 3 | Reconstruction (room) | `website_atlas_preview` (1,172, 26, 2026-11-19) -> `website_atlas_pipeline` (1,782, 35) -> `website_worldlabs` (208, 1); face blur `atlas_privacy_screen.face_blur_required` (314, 7, 2026-11-20) | `blueprint-website-atlas-preview.timer` (60 s after inactive, `TimeoutStartSec=2h`); `blueprint-website-atlas-provider-poll.{timer,path}` (read-only poll) | `pipeline/atlas/preview_job.json`, Atlas grant | Atlas bundle; served by intake `GET /api/live-pipeline/website-atlas-previews/<capture>/bundle` | World Labs Atlas, paid (November: 9 attempts, $11.85, door `capacity.provider_spend.world_labs`) | `job_retry_policy` (section 2 of `docs/architecture/job-retry-and-deadlines.md`) | 7 days (`MAXIMUM_JOB_SECONDS`, ends `atlas_preview_expired`) | site's job page (scene preview), scene handoff |
| 4 | Object isolation and scene preparation | `website_scene_handoff` (1,299, 36, 2026-11-19) -> `website_task_preparation` (1,995, 43) -> `website_task_masks` (1,205, 24) with `meta_sam31` | inside rows 2 and 3 (listener and Atlas pass) | Atlas result, prepared capture | prepared scene, room package (ships flagged when a non-wall blocker hits, `website_scene_handoff.goes_on`) | Meta SAM 3.1, Gemini, OpenAI (paid) | `job_retry_policy`; "ship the room package" rule (section 8 of the retry doc) | job window | WebApp (scene intent, row 5) |
| 5 | Scene intent intake | `live_pipeline_intake_service` (1,861, 25, 2026-11-16) + `task_evaluation_scene_intake_http` (210, 1) + `task_evaluation_scene_intake` (585, 75, 2026-11-19) | `blueprint-pipeline-intake.service` (always on, 127.0.0.1:8765 behind Caddy) | signed intent from WebApp | `task-evaluation-scene-intents/<intent>/intent.json` | none | n/a (WebApp retries the POST until the window ends) | job window | scene progression |
| 6 | Simulation build: preparation | `task_evaluation_scene_progression` (1,163, 23, 2026-11-16) -> `task_evaluation_scene_preparation_service`; `task_evaluation_launch_preparation_worker` (1,844, 29, 2026-11-10) | `...-scene-progression.timer` (1 min), `...-launch-preparation.{path,timer}` (2 min) | intent, prepared capture | preparation queues, `completed-scene-preparation/` (19.4 GiB on host) | B2 artifact store (paid storage, not metered per job) | progression: `task_evaluation_scene_launch_recovery` uses `job_retry_policy`; preparation worker: own rule (no `job_retry_policy` import) | intent `authority_expired` / execution window | activation (row 7) |
| 7 | Simulation build: paid object and scene configuration | `task_evaluation_launch_activation_worker` (1,858, 14) -> `task_evaluation_launch_dispatcher` (2,001, 33) -> `paid_resource_allocator gpu-canary` (942, 47) -> `vast_provider_adapter` (10,327, 46); on the GPU `scripts/task_evaluation_scene_configuration_provider_runner.py` -> `task_evaluation_scene_configuration_artisan_driver` -> `task_object_artisan_process` | `...-launch-activation.{path,timer}` (1 h), `...-launch-dispatcher.path` (`TimeoutStartSec=9h`) | activation intent, prepared references | configured scene in B2 | Vast GPU, OpenAI ARTISAN ($12/object cap) or Anthropic (only if the host prefers it and the Privacy version allows it, `artisan_provider_choice.py:39`); paid | own rules: intent's signed `max_retries` and `max_paid_attempts`; no `job_retry_policy` import in activation or dispatcher | `TimeoutStartSec` 255 min / 9 h; intent window | reconciler, completion |
| 8 | Teardown proof | `task_evaluation_launch_reconciler` (1,309, 12) | `...-launch-reconciler.timer` (2 min) | launch state, spend-guard inventory | provider-zero receipt | Vast read (free) | own (exit 2 while proving) | none | money ledgers |
| 9 | Team scene half (source of the company simulation) | `team_scene_packet_worker` (1,838, 27, 2026-11-16) -> `team_scene_packet` (1,495, 20) | `blueprint-team-scene-packet.path` | completed preparation | `team-scene-packets/status/<key>.json`, `task-evaluation-inputs/team-scene-halves` | none (CPU) | `job_retry_policy` | none found | company simulation package (row 11); robot fit table |
| 10 | First look on paper | WebApp (Gemini site assessment; door spend row `overhead:webapp.site_assessment` $6.01 in November) | WebApp | video, job sentence | first look | Gemini/OpenAI from the WebApp, paid | WebApp | WebApp window sweep | the site |
| 11 | Packet publication and company simulation package | `website_company_clip` (930, 5, 2026-11-15), `website_company_simulation` (1,992, 17, 2026-11-20), `website_company_look` (135, 1); served by `website_atlas_preview_http` (204, 7) | inside the Atlas preview pass (`website_atlas_preview.company_clip_tick`, `company_simulation_tick`, `website_atlas_preview.py:1106,1121`) | team scene half (row 9), rights statement | silent clip; deterministic zip `scene.usda` + `success_rule.json`; WebApp told via signed `company-simulation` operation | none (local CPU, `pxr`) | own: every 60 s pass, forever, no backoff | none | approved deployment companies on the website |
| 12 | Held-job sentences | `scene_stage_maintenance` (437, 5), `scene_stage_holds` | `blueprint-scene-stage-maintenance.timer` (1 min) | job window, scene state | WebApp `POST /api/internal/pipeline/beta-policy-screening-holds` (old name) | none | n/a | job window | the site (a held job's sentence) |

Measured state of row 11 at 2026-11-22T15:17Z (door `journal blueprint-website-atlas-preview.service`, aggregate line):
`{"company_clip_current": 2, "company_clip_no_source": 1, "company_clip_not_permitted": 2, "company_clip_refused": 1, "company_simulation_no_source": 4, "company_simulation_not_permitted": 2, "needs_input": 1, "ready": 4, "scene_preview_current": 4, ...}`.
So zero company simulation packages are current. The team-scene packet queue is empty
(`capacity.stall.checks.team_scene_packets.dispositions: {}`). Scene progression holds 52 intents:
`execution_window 9, rights 30, terminal 13` (`capacity.stall.checks.scene_progression`).

Website-path stages that use their own retry rule, not `job_retry_policy`: launch preparation,
launch activation, launch dispatcher (intent `max_retries`), reconciler, company clip and company
simulation (every pass, forever). AGENTS.md says a new stage controller must use `job_retry_policy`;
these predate that rule or are free passes.

## 2. Every systemd unit and timer

68 unit files in `deploy/systemd` (33 services, 23 timers, 11 path watchers, 1 slice).
63 are in `DEFAULT_DEPLOYED_SYSTEMD_UNITS` (`scripts/deploy_control_plane_commit.py:429`); the 5
operator-door units are installed by `deploy/operator-door/install.sh`. 16 services have
`OnFailure=` (grep). Host state is from `door units` at about 15:10Z.

Class: **W** moves a website job. **G** guard or housekeeping (money, disk, paging).
**P** privacy (withdrawal). **D** operator door. **H** installed and armed (or off on purpose)
but no website job feeds it. **R** paused lane, disarmed every release. **M** manual. **S** slice.
Cadence for timers is `OnBootSec;repeat` from the unit file.

| Unit | Class | Cadence | OnFailure | Host (active/sub) | Last change | Purpose |
|---|---|---|---|---|---|---|
| `blueprint-completed-replay-cache-gc.service` | G |  |  | inactive/dead | 2026-11-03 | reclaim replay working copies |
| `blueprint-completed-replay-cache-gc.timer` | G | 2min;5min |  | active/waiting | 2026-09-08 | reclaim replay working copies |
| `blueprint-control-plane-capacity.service` | G |  | yes | inactive/dead | 2026-11-10 | capacity, stall alarm, spend alerts, paging |
| `blueprint-control-plane-capacity.timer` | G | 5min;10min |  | active/waiting | 2026-09-05 | (timer) |
| `blueprint-control-plane-preflight.service` | G |  |  | inactive/dead | 2026-11-03 | chain preflight; "not a health signal yet" (SYSTEM_MAP, tracker D-04) |
| `blueprint-control-plane-preflight.timer` | G | 10min;30min |  | active/waiting | 2026-11-02 | (timer) |
| `blueprint-control-plane-release-lifecycle.service` | G |  |  | inactive/dead | 2026-11-04 | retire superseded release trees |
| `blueprint-control-plane-release-lifecycle.timer` | G | 20min;1h |  | active/waiting | 2026-11-04 | (timer) |
| `blueprint-control-plane-state-backup.service` | G |  | yes | inactive/dead | 2026-11-11 | back up job state and money records (stall check says `state_backup: not_configured`) |
| `blueprint-control-plane-state-backup.timer` | G | 10min;15min |  | active/waiting | 2026-11-11 | (timer) |
| `blueprint-control-plane-storage-gc.service` | G |  |  | inactive/dead | 2026-11-20 | storage GC, evidence offload |
| `blueprint-control-plane-storage-gc.timer` | G | 15min;1h |  | active/waiting | 2026-09-05 | (timer) |
| `blueprint-gpu-spend-guard.service` | G |  | yes | failing every run (see 2.2) | 2026-11-10 | money guard and orphan reaper (Vast, RunPod, DigitalOcean, GCP) |
| `blueprint-gpu-spend-guard.timer` | G | 1min;15s;1min |  | active/running | 2026-10-30 | (timer) |
| `blueprint-off-host-reaper-heartbeat.service` | G |  | yes | inactive/dead | 2026-11-11 | heartbeat for the off-host Vast reaper |
| `blueprint-off-host-reaper-heartbeat.timer` | G | 1min;2min |  | active/waiting | 2026-11-11 | (timer) |
| `blueprint-operator-door-hold-sweep.service` | D |  |  | inactive/dead | 2026-11-03 | door hold sweep |
| `blueprint-operator-door-hold-sweep.timer` | D | 1min;1min |  | active/waiting | 2026-09-27 | (timer) |
| `blueprint-operator-door-runner.path` | D | watch |  | active/waiting | 2026-09-23 | door spool runner trigger |
| `blueprint-operator-door-runner.service` | D |  |  | inactive/dead | 2026-11-03 | door spool runner |
| `blueprint-operator-door.service` | D |  |  | active/running | 2026-11-03 | operator door (127.0.0.1:8767) |
| `blueprint-owner-approved-deletion-plan.service` | M |  |  | not loaded | 2026-11-12 | plan owner-approved deletions (by hand) |
| `blueprint-owner-approved-deletion.service` | M |  |  | not loaded | 2026-11-12 | apply owner-approved deletions (by hand) |
| `blueprint-pipeline-intake.service` | W |  | yes | active/running | 2026-11-16 | signed intake :8765 |
| `blueprint-provider-billing-reconciler.service` | G |  |  | inactive/dead | 2026-11-03 | billing evidence (pulled by the guard) |
| `blueprint-provider-billing-reconciler.timer` | G | 2m;10m |  | inactive/dead (off on purpose, runbook §7) | 2026-09-27 | (timer) |
| `blueprint-pubsub-handoff-listener.service` | W |  | yes | activating | 2026-11-10 | frames, privacy screen, preparation, retries |
| `blueprint-pubsub-handoff-listener.timer` | W | 30s;1min |  | active/running | 2026-09-27 | (timer) |
| `blueprint-rigid-robot-free-probe-runner.path` | H | watch |  | active/waiting | 2026-10-27 | $1 robot-free GPU probe; a website half queues none (SYSTEM_MAP step 11) |
| `blueprint-rigid-robot-free-probe-runner.service` | H |  | yes | inactive/dead | 2026-11-10 | (service) |
| `blueprint-rigid-robot-free-probe-runner.timer` | H | 2min;5min |  | active/waiting | 2026-10-27 | (timer; queue `pending: 0`) |
| `blueprint-scene-project-spend-refresh.service` | G |  |  | inactive/dead | 2026-11-03 | scene spend exposure |
| `blueprint-scene-stage-maintenance.service` | W |  | yes | inactive/dead | 2026-11-14 | held-job sentences; can enqueue a rigid probe |
| `blueprint-scene-stage-maintenance.timer` | W | 2min;1min |  | active/waiting | 2026-11-14 | (timer) |
| `blueprint-task-evaluation-episode-compilation-remote.path` | H | watch |  | active/waiting | 2026-09-29 | robot-team episode compile on Cloud Run, "armed only to drain" (runbook §7) |
| `blueprint-task-evaluation-episode-compilation-remote.service` | H |  |  | inactive/dead | 2026-11-10 | (service) |
| `blueprint-task-evaluation-episode-compilation-remote.timer` | H | 1min;60s |  | active/waiting | 2026-09-29 | (timer) |
| `blueprint-task-evaluation-episode-compilation.path` | R | watch |  | not loaded | 2026-09-29 | host episode compile; disarmed each release |
| `blueprint-task-evaluation-episode-compilation.service` | R |  |  | not loaded | 2026-11-10 | (service) |
| `blueprint-task-evaluation-episode-compilation.timer` | R | 5min;5min |  | not loaded | 2026-09-29 | (timer) |
| `blueprint-task-evaluation-launch-activation.path` | W | watch |  | active/waiting | 2026-09-27 | activate paid scene configuration |
| `blueprint-task-evaluation-launch-activation.service` | W |  | yes | inactive/dead | 2026-11-10 | (service) |
| `blueprint-task-evaluation-launch-activation.timer` | W | 10min;1h |  | active/waiting | 2026-11-02 | (timer) |
| `blueprint-task-evaluation-launch-dispatcher.path` | W | watch |  | active/waiting | 2026-09-27 | paid GPU launch via allocator |
| `blueprint-task-evaluation-launch-dispatcher.service` | W |  | yes | inactive/dead | 2026-11-10 | (service) |
| `blueprint-task-evaluation-launch-preparation.path` | W | watch |  | active/waiting | 2026-09-27 | materialise prepared inputs |
| `blueprint-task-evaluation-launch-preparation.service` | W |  | yes | inactive/dead | 2026-11-10 | (service) |
| `blueprint-task-evaluation-launch-preparation.timer` | W | 2min;2min |  | active/waiting | 2026-09-27 | (timer) |
| `blueprint-task-evaluation-launch-reconciler.service` | W |  |  | inactive/dead | 2026-11-10 | teardown proof |
| `blueprint-task-evaluation-launch-reconciler.timer` | W | 2min;2min |  | active/waiting | 2026-09-27 | (timer) |
| `blueprint-task-evaluation-scene-progression.service` | W |  | yes | inactive/dead | 2026-11-10 | scene intent to preparation |
| `blueprint-task-evaluation-scene-progression.timer` | W | 2min;1min |  | active/waiting | 2026-09-27 | (timer) |
| `blueprint-task-evaluation-terminal-resource-release.path` | H | watch |  | inactive/dead (off on purpose) | 2026-08-11 | release one terminal Vast record; queue empty since 2026-08-12 |
| `blueprint-task-evaluation-terminal-resource-release.service` | H |  |  | inactive/dead | 2026-11-10 | (service) |
| `blueprint-team-scene-packet-remote.path` | H | watch |  | active/waiting | 2026-11-05 | Cloud Run team-scene lane; SYSTEM_MAP lists it as "switched off on purpose", yet it is armed |
| `blueprint-team-scene-packet-remote.service` | H |  |  | inactive/dead | 2026-11-10 | (service) |
| `blueprint-team-scene-packet-remote.timer` | H | 1min;60s |  | active/waiting | 2026-11-05 | (timer) |
| `blueprint-team-scene-packet.path` | W | watch |  | active/waiting | 2026-11-05 | team scene half |
| `blueprint-team-scene-packet.service` | W |  | yes | inactive/dead | 2026-11-10 | (service) |
| `blueprint-unit-failure@.service` | G |  |  | template (16 instances loaded) | 2026-11-10 | OnFailure notifier |
| `blueprint-website-atlas-preview.service` | W |  | yes | activating | 2026-11-10 | room, scene preview, company clip, company simulation package |
| `blueprint-website-atlas-preview.timer` | W | 3min;60s |  | active/running | 2026-10-22 | (timer) |
| `blueprint-website-atlas-provider-poll.path` | W | watch |  | active/waiting | 2026-10-30 | World Labs poll trigger |
| `blueprint-website-atlas-provider-poll.service` | W |  | yes | inactive/dead | 2026-11-10 | read World Labs operations, never spend |
| `blueprint-website-atlas-provider-poll.timer` | W | 2min;60s |  | active/waiting | 2026-10-30 | (timer) |
| `blueprint-website-withdrawal-deletion.service` | P |  | yes | inactive/dead | 2026-11-10 | withdrawal deletion pass |
| `blueprint-website-withdrawal-deletion.timer` | P | 30min;1h |  | active/waiting | 2026-11-10 | (timer) |
| `system-blueprintbatch.slice` | S |  |  | (slice) | 2026-11-10 | `MemoryHigh=5G`, `MemoryMax=5.5G` for 23 batch units |

How a unit starts its module: 14 units go through `task_evaluation_scene_retirement_supervisor --worker <module>`;
its allowlist (`task_evaluation_scene_retirement_supervisor.py:1117`) still names
`task_evaluation_episode_compilation_worker` (paused lane), `task_evaluation_sam31_preparation_execution`
(retired trigger) and `task_evaluation_terminal_resource_release` (off on purpose).

Owner of each class: W = AGENTS.md mission (owner direction 2026-11-12); G = AGENTS.md "Spend limits"
(money) and runbook §1-3; P = privacy hard stop; D = D-08 deploy policy (2026-11-02);
H/R = runbook §7 "Triggers that are off on purpose (D-06)" and "Lanes paused by the 2026-11-12 frame".

### 2.1 Host units not in the repo

`door units` lists units the repo does not ship: 11 `blueprint-operator-door-hold-expiry-*.timer`
(all `active/waiting`), 11 matching `.service`, `blueprint-existing-policy-canary-watchdog.service`,
and the transient experiment units below. The only door hold is an **expired** hold from 2026-10-02
on `blueprint-agent-run-dispatcher.timer` (`require_explicit_release: true`), a timer whose code
left the repository on 2026-11-15 (#3598). The door still reports `hold_target:
blueprint-agent-run-dispatcher.timer` (`deploy/operator-door/operator_door/status.py:367`).

### 2.2 Failed units, by cause (door `status.failed_units`, 207 entries)

| Cause | Count | Evidence |
|---|---|---|
| One-off `systemd-run` experiment units, never `reset-failed` | 206 | none of them is a repo unit file; names carry dates 2026-09-26 to 2026-10-27 (112 in October, 25 in September, 70 undated) |
| of which G1 controller / dry / paid runs (`blueprint-g1-841757-*`) | 35 | |
| of which Atlas experiments (`blueprint-atlas-*`, dishwasher, canaries, preflights) | 33 | |
| of which native / G1-adjacent bundle and harness runs | 31 | |
| of which scene-configuration diagnostics (`blueprint-diagnostic-*`, `internal-team-diagnostic-*`) | 29 | |
| of which scene experiments (`scene839873-*`, `scene-release-*`, combined scene) | 23 | |
| of which policy / trial runs (`paired-policy-*`, `approved55-*`, `policy-*`) | 15 | |
| of which ad-hoc deploys, preflight probes, retained deliveries, other | 40 | |
| Installed repo unit failing every run: `blueprint-gpu-spend-guard.service` | 1 | `unit-failures/blueprint-gpu-spend-guard.service.json`: `failure_count 4844`, first `2026-11-13T04:39Z`, last `2026-11-22T15:16:17Z`, `exit_status 2`; journal: `warning: runpod pod query failed (http=0)`, `Main process exited, code=exited, status=2`; spend guard `status: blocked`, `blockers: ["runpod_inventory_query_failed"]`, `provider_zero_verified: false` |

Cause of the guard failure, in code: `scripts/gpu_spend_guard.py:2322-2337`. While a RunPod key file
exists, RunPod is "still read and required"; with no key it is recorded retired and not required.
The owner step in AGENTS.md ("close the RunPod account, then delete the RunPod key file") is still open.
Each guard run consumed about 36 s of CPU (journal `Consumed 36.472s CPU time`) and the timer
restarts it about a minute after it ends, on a 4-CPU host.

### 2.3 Capacity alerts (door `capacity.alerts`, 18)

4 money alerts (`account_spend_month_50pct`, `account_spend_forecast_reaches_limit_this_month`,
`account_spend_reconciliation_outside_tolerance` for digitalocean, gcp, openai, vast,
`account_spend_unverifiable`), 3 `storage_class_over_budget` (unclassified 112.5 GB of 32.2 GB budget,
work 34.2 of 26.8, release 33.0 of 16.1), `orphan_scratch_large` (61 folders, 63.8 GB),
and 10 `usage_unclassified_root` rows (largest `/opt/blueprint/artisan` 11.1 GB). Capacity level: `warning`.

## 3. External providers

Paid call sites are inventoried by `scripts/paid_api_call_sites.json` (71 sites, 2026-11-18),
checked by `scripts/verify_paid_resource_allocator.py`.

| Provider | For | Paid? | Admitted / metered where | Call sites (class) | November spend seen |
|---|---|---|---|---|---|
| World Labs Atlas | room reconstruction | yes | Atlas grant from WebApp; `paid_spend_meter`; alert lines $60/24 h, $450/month (`provider_spend_alerts`) | 2 admitted, 8 not paid | $11.85, 9 attempts |
| Google Gemini | clean-plate analysis, removal visibility, whole-view review | yes | `website_gemini_receipts.retained_gemini_call` reserves on the WebApp job ledger | 10 admitted, 2 not automatic, 1 not paid | in WebApp ledger (no Google settlement route) |
| Meta hosted SAM 3.1 | object masks | yes | upstream ledger under the website sponsorship | 3 admitted, 5 not paid | not split out |
| OpenAI | ARTISAN object authoring (gpt-6.1-sol), agents SDK, research | yes | `paid_resource_admission`, ARTISAN cap $12/object | 27 admitted, 6 not paid, 1 not automatic | $85.25 month to date |
| Anthropic | ARTISAN on Claude when host prefers and Privacy version allows | yes | admitted | 2 admitted, 1 not paid | not seen |
| NVIDIA NIM | model preflight | yes | admitted | 1 admitted, 1 not automatic | not seen |
| RunPod serverless / pods | retired 2026-11-05 | was | refused by `RUNPOD_PROVIDER_RETIRED` (`paid_resource_admission.py`) | 1 admitted (watchdog) | none; guard still queries inventory |
| Vast.ai | GPU scene configuration, rigid probe | yes | `paid_resource_allocator` only; credit check `provider_credit_admission`; fleet caps in the guard unit | (compute, not API) | $34.52 metered to retired screening on two captures; billing export total `vast: 479.076` (scope `blueprint_beta_100_user_cohort`) |
| DigitalOcean | control-plane host | yes (fixed) | billing reconciler | n/a | billing export `385.8` |
| Google Cloud (Pub/Sub, Storage, Cloud Run) | hand-off, storage, remote CPU lanes | yes | `gcp_monthly_budget_guard`, $100/month | n/a | $61.03 |
| Backblaze B2 | artifact store (`blueprint-task-evaluation-artifacts-prod`) | yes | not metered per job (unverified) | n/a | unknown |
| Parallel FindAll | web research (`parallel_findall.py`) | yes | runbook `parallel-findall-api.md` | not in the call-site file | unknown |
| Lambda Labs | adapter only | n/a | `lambda_provider_adapter` (1,724 lines) is a console script; nothing live imports it | 0 | none |
| Resend | email (WebApp) | yes | WebApp | n/a | n/a |

Account month (door `spend_guard.account_monthly_spend`): $296.54 counted of the $400 November limit
(74%); `complete: false`; forecast reaches the limit on 2026-11-30 (`daily_rate_usd 13.71`, lower bound).
Metered by source: retired screening $34.52, Atlas $11.85, OpenAI settlement $7.23, WebApp overhead
$6.05, paid admission $0.10. Two `itest-*` jobs account for $10.72.

## 4. Config files, feature flags and environment switches

| File | Last change | Read by (production code) | On in production |
|---|---|---|---|
| `config/account_monthly_spend_limit.v1.json` | 2026-11-19 | `account_monthly_spend.py` | yes (status `cap_status: set`, limit 400) |
| `config/website_job_spend_cap.v1.json` | 2026-11-19 | `website_job_spend_cap.py` | yes (installed by deploy) |
| `config/artisan_openai_tool_schemas.v1.json` | 2026-11-15 | `artisan_strict_tool_schemas.py`, a build script | yes (GPU bundle) |
| `config/image_editor_backends.v1.json` | 2026-11-14 | `website_image_completion.py`, artifixer driver (5 readers) | yes |
| `config/blueprint_owned_captures.v1.json` | 2026-11-19 | `company_share_permission.py`, `sharing_statement.py` | yes |
| `config/beta_policy_candidates.v1.json` | 2026-11-07 | no code reads it; only named in the docstring of `website_rigid_feasibility.py:25` ("every embodiment an enabled screening candidate runs on is checked") | no (stale reference) |
| `config/content_agents/*.yaml` (6) | 2026-11-14 | 3 by a build script; 3 `adp009d_*articulated*` by nothing but `adp_content_agents_vast` and tests | build time |
| `config/native_g1_shared_inputs.v1.json` | 2026-11-06 | door `experiment_purge.py` | door only |
| `config/policy_runtimes/*` (2) | 2026-10-31 | nothing in src/scripts/deploy (tests only) | no |
| `config/trial/*` (5, 124 KB) | 2026-11-14 | nothing in src/scripts/deploy (tests and fixtures only) | no |
| `configs/g1_*` (5) | 2026-09-24/27 | G1 modules only (`native_g1_checkpoint_cache`, `native_g1_pi_tokenizer_assets`, `task_evaluation_embodiment_registry`) | no website use |
| `configs/production_pipeline.env.example` | 2026-07-22 | nothing | no |
| `contracts/shared-doctrine.lock.json` | 2026-11-20 | `scripts/verify_shared_doctrine.py` | CI |
| `deploy/systemd/pipeline-control-plane.env.example` | | 100 example keys | template for `/etc/blueprint/pipeline-control-plane.env` (host values not read) |

Flags. The 2026-11-05 inventory (`docs/audits/2026-11-inventory.json`, 17 days old) classified 495
Pipeline flags: KEEP-LIVE 271, KEEP-GUARD 211, REMOVE-CANDIDATE 21, DORMANT-INTENDED 2. Today
`src/blueprint_pipeline` reads 187 distinct `BLUEPRINT_*` names directly through `os.environ`/`getenv`
(grep; helpers that wrap the read are not counted), and 48 names contain ENABLE/ALLOW/DISABLE.
Switches a repo deploy file sets: `BLUEPRINT_VAST_CREDIT_GUARD_ENABLED=true` (4 units),
`BLUEPRINT_RIGID_ROBOT_FREE_PROBE_ENABLED=1` (rigid probe unit), `PRIVACY_PIPELINE_ENABLED=true`,
`RETRIEVAL_REQUIRE_PRIVACY_SAFE_VIDEO=true` (2 units each). Switches only commented in the env example
(production value unknown, host file not read): `BLUEPRINT_ALLOW_SIMULATOR_EXECUTION` (read by the
RunPod and Lambda adapters and `live_pipeline_setup`), `BLUEPRINT_ALLOW_LIVE_AGENTS_SDK_OPERATORS`,
`BLUEPRINT_ALLOW_LIVE_CODEX_SDK_OPERATORS`, `BLUEPRINT_ALLOW_CODEX_CLI_HOST_OAUTH`,
`BLUEPRINT_ALLOW_PACKAGE_DELIVERY_UPLOAD`, `BLUEPRINT_ALLOW_ROLLOUT_VISION_LABELING`,
`BLUEPRINT_MUJOCO_ALLOW_FETCH_G1_ASSETS`, `BLUEPRINT_ALLOW_TASK_EVALUATION_LAUNCH_TRIGGER`,
`BLUEPRINT_LIVE_PIPELINE_INTAKE_ALLOW_LEGACY_BEARER` (example `false`), `BLUEPRINT_WEBSITE_ATLAS_ROUTE`.
Unit env still names retired roots: `BLUEPRINT_CONTROL_PLANE_GC_QUEUE_ROOTS` includes
`task-evaluation-policy-canary-dispatches` and `BLUEPRINT_CONTROL_PLANE_DISK_ROLE_TARGETS` includes
`policy_canary_dispatch` and `policy_canary_output` (3 units each).

Hand-copied privacy lists: `atlas_privacy_screen.NO_FACE_BLUR_PRIVACY_VERSIONS` lists 2026-11-17.1
through 2026-11-22.1 (`atlas_privacy_screen.py:49`). `artisan_provider_choice.PRIVACY_POLICY_VERSIONS`
lists only 2026-11-13.1, 2026-11-17.1 and 2026-11-18.1 (`artisan_provider_choice.py:39`). The website's
current Privacy version is 2026-11-21.1 (`webapp:client/src/lib/legalAcceptance.ts:198-200`).
The two 2026-11-21/22 entries were added at HEAD by #3684 (`7d8b532`, 2026-11-20). The running release
`cbff06b` lists only 2026-11-17.1 to 2026-11-20.1 (`git diff cbff06b HEAD -- src/blueprint_pipeline/atlas_privacy_screen.py`).
So until the next deploy, production treats a job under the current Privacy Policy as "blur required"
(the fail-safe branch of `face_blur_required`, `atlas_privacy_screen.py:178-196`). That is safe for
privacy, but it is the opposite of what AGENTS.md says happens, and each new Privacy version needs a
Pipeline code change and deploy in two places.

## 5. Operator door request kinds and manual commands

Door `status.door.request_kinds` (installed door, version string `1.0.0`):

| Request kind | Scope | What it changes | Owner rule |
|---|---|---|---|
| `deploy` | deploy | switches the release | D-08 window, activation hold |
| `door-upgrade` | deploy | replaces the door | owner, root `install.sh --upgrade` |
| `unit` | operate | start/stop/restart a unit (refuses retired triggers) | |
| `hold` / `release-hold` | operate | park a timer | |
| `test-job` | operate | starts a test job (may spend) | money |
| `selected-handoff` | operate | recover one hand-off | |
| `extend-scene-execution-window` | operate | moves a scene window (plan, then `--apply`) | owner approval reference |
| `confirm-owner-success-contract` | operate | records a site's success thresholds | owner approval evidence |
| `retire-scene-workspace` / `restore-scene-workspace` | operate | moves a scene workspace | |
| `purge-experiment-folder` | operate | deletes an experiment folder | owner (deleting retained data) |
| `retire-parked-delivery` | operate | retires a parked delivery | owner approval evidence |

Client-only subcommands besides these (`scripts/operator_door.py --help`): `legacy-owner-census`,
`provider-output-resume`, `lane-scratch`, `retire-scene`, `restore-scene`, `pull`. Read subcommands:
`whoami, status, usage, ls, cat, journal, units, show, requests`.

The installed door is older than the repo door: the repo says the trial's worker snapshot "is omitted
from `/status`" (`docs/OPERATOR_DOOR.md`, changed 2026-11-20 in 523df9b) and repo `status.py` has no
`beta_screening` key, yet the installed door's status still returns `beta_screening`
(last observed 2026-11-15, `status: preparation_needed`, 4,262 candidates `unavailable`). The door's
version string has not changed (`deploy/operator-door/operator_door/__init__.py:13`: `1.0.0`), so the
status cannot say which door is installed.

Manual `python -m blueprint_pipeline.*` commands in runbooks, OPERATOR_DOOR.md and AGENTS.md (grep, 41
distinct): money (`account_monthly_spend`, `paid_spend_meter_sources`, `daily_spend_snapshot`,
`provider_billing_audit_retention`, `gpu_provider_key_rotation`, `paid_resource_allocator gpu-canary |
remote-cpu-job | provider-reconstruction | cpu-build`), replays (`task_evaluation_stage_replay`,
`atlas_preview_replay`, `task_evaluation_downstream_replay`, `test_job_matrix`), Atlas
(`website_atlas_preview tick|retry|poll`, `website_atlas_pipeline --source-video`,
`website_atlas_operator`, `atlas_video_inputs survey|prepare`, `atlas_video_extension`), withdrawal
(`website_capture_withdrawal_deletion`, `_automatic`, `_drill`), host (`control_plane_state_backup restore`,
`control_plane_break_glass record`, `task_evaluation_release_retention`, `task_evaluation_scene_lifecycle_plan`),
and retired-lane tools still documented (`internal_team_evaluation_diagnostic stage|serve-policy|run|fixture`,
`groot_oscar_cached_footprint`, `task_evaluation_task_family_native_adapter materialize`). AGENTS.md also
lists `python -m blueprint_pipeline.runtime_service_app` as an entry point; see finding IP-11.

## 6. CLI entry points and scripts

- `pyproject.toml [project.scripts]`: 30 console scripts. They include
  `blueprint-run-runpod-provider-adapter` (retired provider) and `blueprint-run-lambda-provider-adapter`
  (unused provider), `blueprint-capture-pipeline` (`capture_orchestrator`, on the website path through
  `run_e2e`) and WAM/policy worker contracts.
- Modules with a `__main__` guard that nothing else starts: **79 modules, 37,702 lines** are reachable
  only as a hand-run CLI (no unit, door script, deploy script or other script reaches them).
- `scripts/`: 183 entries, 177 runnable files. 33 are named in a CI workflow, 92 in deploy or src, 29 only
  in tests, 6 referenced nowhere (`object_index_yolo_world_runner.py` 2026-03-13,
  `paid_call_site_reachability.py`, `probe_inpaint360_camera_rasterizer.py`, `run_simready_validator_worker.py`,
  `write_scene_agents_api_project_guard.py`, `setup_simready_validator_env.sh`). By name: 33 ADP/Aura/
  Inpaint360/ArtiFixer/retained-render, 20 release/evidence/supply chain, 20 deploy/host, 15 paid
  authority/launch, 14 Isaac/Omniverse/measurement, 14 validate/verify, 12 scene configuration, 9
  G1/native/policy, 6 SAM, 34 other.

## 7. Tests and CI

- Test files: 1,754 `tests/**/test_*.py` (1,805 `.py` under `tests/`), 644,817 lines.
- By the package family each test mostly imports: other 586, task_evaluation 360, control_plane 159,
  no package import 151, website 105, native_task_arena 83, atlas 50, ADP/Aura 42, policy/trial 34,
  team/robot offer 31, G1 30, agent runtime 29, Isaac/render 16, public scene 16, task object 15, Astra
  14, measurement 8, episode compilation 7, rigid probe 7, capture bridge 4, content agents 3, RunPod 3,
  screening 1.
- **41 test files (7,933 lines) import only retired-family modules** (G1, trial, RunPod, Astra, screening),
  for example `test_unitree_groot_n17_sonic_*` (7 files), `test_native_g1_*` (11), `test_scripted_robot_*`
  (3), `test_groot_oscar_runpod_*` (2).
- 134 modules on the website path (20,320 lines) are imported by no test file.
- CI (`.github/workflows`, 11 files):
  - `ci.yml` on push to main and every PR: impact plan (2 min cap) then impacted tests and sentinels
    (10 min cap). Recent runs took 2 to 19 minutes (`gh run list --workflow ci.yml`, 2026-11-20/21).
  - `full-test-lane.yml` daily 08:17 UTC (runs observed 15:00-17:40 UTC): 12 shards; on 2026-11-21
    shards took 11 to 24 minutes, about 232 runner-minutes in all, roughly 2,800-3,500 tests per shard.
    **Failed 2026-11-18, 19, 20 and 21; passed 2026-11-14 to 11-17.** Failures: 11-21
    `test_registered_feature_linux.py::test_actual_registered_disk_diagnostic_delete_offload_and_restore`
    (`groupdel: group 'blueprint' does not exist`); 11-20 `test_scene_attempt_measured_compute.py` and
    `test_task_evaluation_scene_configuration_diagnostic_rejection.py`; 11-19 `test_test_job_matrix.py`
    plus one more; 11-18 `test_live_pipeline_setup.py`.
  - `impacted-wide-lane.yml` (53 min cap), `replay-set.yml` (daily 07:41 and PRs), `codeql.yml` weekly,
    `daily-research.yml`, `python-compatibility.yml`, `terraform-static.yml`, and three manual lanes
    (`critical-capability-lanes.yml` on self-hosted GPU/emulator runners, `production-release-provenance.yml`,
    `release-signature-verification.yml`).

## 8. What is live: the import graph

Method: Python `ast`, standard library only, over every module in `src/blueprint_pipeline`
(1,621 modules incl. subpackages, 715,431 lines). Edges are `import`/`from ... import`, including
imports inside functions, resolved to the module file and its parent packages. A second pass also
counts a string literal that is exactly a module name (`"blueprint_pipeline.x"`) as an edge; the
supervisor's worker list is built by string concatenation and is not counted, so each unit's worker is
rooted explicitly. Roots:

- **Website job path:** the 13 modules the W units start (listener, Atlas preview, intake, scene
  progression, launch preparation, activation, dispatcher, reconciler, team scene packet worker, scene
  stage maintenance, dispatcher cgroup cleanup, env guard, supervisor) plus the GPU runner script.
- **Guards, door and deploy:** the G and P unit modules, `scripts/gpu_spend_guard.py`,
  `scripts/deploy_control_plane_commit.py`, the continuous bootstrap, and every `blueprint_pipeline.*`
  name in the door code and door shell scripts.
- **Held lanes:** rigid probe runner, both remote collectors and conditions, terminal resource release,
  host episode compilation worker, SAM 3.1 preparation execution.

| Set | Modules | Lines | Source |
|---|---|---|---|
| Reachable from the website job path (static imports) | 1,317 | 581,873 | `reach.py` |
| same, counting exact-name string references | 1,370 | 604,740 | `reach.py` |
| Reachable from guards, door and deploy | 1,382 | 601,173 | `reach.py` |
| Live total (website path or guards) | 1,393 | 605,219 | `reach.py` |
| Reachable only from held/paused lanes | 5 | 3,062 | `reach.py` (`team_scene_packet_collector`, `..._remote_condition`, episode compilation collector and condition, terminal release) |
| Reached from any production file at all (units, door, all of `scripts/`, `functions/`, `tools/`, `deploy/`, `main.py`, console scripts) | 1,488 | 656,405 | `testonly.py` |
| plus every module with a `__main__` guard | 1,567 | 694,107 | `testonly.py` |
| Imported by nothing but tests | 44 | 20,028 | `testonly.py` |
| Imported by nothing at all | 10 | 1,296 | `testonly.py` |

The website closure is nearly the whole live system because a few hub modules import widely:
`vast_provider_adapter` (10,327 lines), `paid_resource_allocator`, `task_evaluation_launch_dispatcher`,
`team_scene_packet` and `task_evaluation_result_delivery` pull in the robot arena, the trial's policy
contracts, G1 and Astra.

### 8.1 Biggest clusters (modules / lines; on the website path; not live)

| Family (by name) | Modules | Lines | On website path | Not live |
|---|---|---|---|---|
| other (shared, storage, contracts, misc.) | 500 | 205,681 | 361 / 148,982 | 115 / 48,551 |
| `task_evaluation_*` | 345 | 150,326 | 325 / 140,960 | 15 / 6,425 |
| `native_*` incl. `native_task_arena_*` (robot arena) | 129 | 74,832 | 103 / 56,759 | 26 / 18,073 |
| `website_*` | 119 | 48,553 | 115 / 47,229 | 2 / 613 |
| `control_plane_*` | 111 | 45,578 | 86 / 40,136 | 3 / 707 |
| ADP / Aura / Inpaint360 / ArtiFixer | 45 | 34,957 | 32 / 27,046 | 13 / 7,911 |
| Atlas / World Labs | 63 | 22,122 | 60 / 20,709 | 2 / 817 |
| policy / trial (excl. retry and selection policies) | 55 | 17,535 | 44 / 14,135 | 11 / 3,400 |
| episode compilation and episode evidence | 17 | 17,152 | 12 / 13,730 | 2 / 1,405 |
| team / robot offer / embodiment | 43 | 16,091 | 40 / 14,800 | 3 / 1,291 |
| G1 / Unitree / Sonic | 35 | 14,261 | 27 / 7,474 | 8 / 6,787 |
| public scene | 22 | 12,990 | 17 / 10,093 | 5 / 2,897 |
| Isaac / render | 21 | 11,139 | 13 / 5,934 | 8 / 5,205 |
| measurement (Chrono, Drake) | 10 | 8,017 | 10 / 8,017 | 0 |
| agent runtime / execution | 32 | 7,166 | 7 / 1,914 | 6 / 1,054 |
| Astra CAD | 13 | 5,268 | 11 / 4,914 | 2 / 354 |
| rigid robot-free probe | 12 | 4,403 | 12 / 4,403 | 0 |
| capture bridge / ARKit / V3.2 (historical name; `capture_bridge.CaptureDescriptor` is live) | 7 | 4,190 | 7 / 4,190 | 0 |
| RunPod | 4 | 3,524 | 1 / 1,127 | 3 / 2,397 |
| Lambda | 1 | 1,724 | 0 | 1 / 1,724 |
| screening (records kept for withdrawal and money) | 3 | 860 | 3 / 860 | 0 |

Families are by module name, so they are approximate: a name match is not proof of purpose.

## 9. Remains of retired systems

### 9.1 The early trial of robot software (dropped 2026-11-14)

The big removal already happened: #3598 (2026-11-15, `45a99fbeb`) deleted 412 files and 109,638 lines,
including every `beta_policy_screening_*` module. What remains:

- 55 policy/trial modules (17,535 lines); 44 (14,135 lines) are on the website path.
- **Live module -> trial module imports (59 edges, 41 live importers, 22 trial modules).** The full list
  is in `boundary.json`; the ones on the main job path, with lines:

| Live module | Imports trial module | Where |
|---|---|---|
| `task_evaluation_launch_dispatcher` | `task_evaluation_policy_run_contract` (1,092 lines) | `task_evaluation_launch_dispatcher.py:61` |
| `task_evaluation_launch_activation_worker`, `task_evaluation_launch_preparation_worker`, `task_evaluation_launch_preparation_contract`, `task_evaluation_scene_configuration_publication`, `task_evaluation_run_webapp_sync` | `task_evaluation_policy_run_contract` | (graph) |
| `task_evaluation_scene_progression` | `task_evaluation_scene_policy_capability` (a gate on the trial's frozen checkpoint inventory) | `task_evaluation_scene_progression.py:725` |
| `website_robot_fit` | `droid_policy_canary_embodiment` (constants) | `website_robot_fit.py:99` |
| `website_rigid_feasibility` (docstring only) | names `config/beta_policy_candidates.v1.json`, which no code reads | `website_rigid_feasibility.py:25` |
| `task_evaluation_result_delivery` | `policy_canary_control_result_delivery`, `policy_canary_output_members`, `policy_paired_summary`, `droid_policy_canary_embodiment` | `task_evaluation_result_delivery.py:1458` |
| `vast_provider_adapter` | `vast_policy_canary_remote_progress`, `vast_structured_policy_canary_inspection`, `vast_wam_terminal_diagnostic`, `wam_provider_output`, `company_policy_network_lease` | `vast_provider_adapter.py:197` |
| `team_arm_reach` | `scripted_robot_runtime_dispatch` | `team_arm_reach.py:147` |
| `task_evaluation_embodiment_registry` | `droid_policy_canary_embodiment`, `task_evaluation_policy_candidate_registry` | (graph) |
| `task_evaluation_scene_terminal_reconciler`, `..._terminal_result_index`, `..._execution_authority`, `..._control_omission`, `task_evaluation_team_run_*` | `task_evaluation_scene_policy_binding`, `task_evaluation_policy_canary_result`, `task_evaluation_scene_policy_capability` | (graph) |
| 9 provider/output modules (`provider_output_*`, `adp_*_vast`, `native_task_arena_*`, scene configuration transports) | `wam_provider_object_store` (1,994 lines), `wam_provider_output`, `policy_canary_output_members`, `wam_async_runner_common` | (graph) |
| `vast_official_billing_extractor` | `policy_canary_official_billing` | (graph) |
| `job_capability_routing`, `team_candidate_quick10_registry`, `native_task_arena_bundle` | `task_evaluation_policy_candidate_registry`, `policy_canary_scene_resolution`, `task_family_policy_execution` | (graph) |

- Records kept on purpose (AGENTS.md): `screening_retained_ledger` (still holds `SITE_LIMIT = 30`,
  `screening_retained_ledger.py:33`), `screening_site_withdrawal` (imported by `scene_stage_maintenance.py:79`),
  `website_capture_withdrawal_screening`.
- Disk: `/mnt/blueprint-work/beta-policy-screening-work/attempts` 9.4 GiB; policy canaries
  `/var/lib/blueprint/pipeline-control-plane/task-evaluation-policy-canaries` 15.9 GiB;
  `native-policy-canaries` 2.8 GiB; `controlled-policy-integration-20260928` 5.0 GiB.
- Money: $34.52 of November's metered spend is screening (Vast) on two captures.
- Config: `config/trial/` (5 files), `config/policy_runtimes/` (2), `config/beta_policy_candidates.v1.json` (none read by production code).
- Tests: 34 test files mostly about policy/trial modules.
- Docs: AGENTS.md "Spend limits" rows and "Hard stops" still name the screening per-site budget and the
  deleted `beta_policy_screening_coordinator.py`, `_plan.py`, `_capabilities.py`.

### 9.2 Other retired or held systems

| System | Modules / lines | On website path | Still imported by (live, non-retired) | Timers that fire | Disk held (door `usage`) | Tests | Last change |
|---|---|---|---|---|---|---|---|
| RunPod (retired 2026-11-05) | 4 / 3,524 | 1 / 1,127 | `task_evaluation_dispatcher_cgroup_cleanup.py:24` and `vast_independent_watchdog_control` import `groot_oscar_runpod_watchdog` (for `EVIDENCE_NAME`) | the spend guard queries RunPod every run and fails (4,844 times) | none seen | 15 test imports | adapter 2026-11-14 |
| G1 / native humanoid lanes | 35 / 14,261 | 27 / 7,474 | 16 live modules, e.g. `website_locomotion_hold.py:95` -> `task_evaluation_g1_catalog`; `task_evaluation_embodiment_registry` -> `native_g1_beta_authority`; `native_task_arena_runtime` -> `native_g1_navigation_goal`; `control_plane_lane_experiment_*` -> `native_g1_registered_containment`; `website_capture_withdrawal_deletion` -> `website_capture_withdrawal_native_g1` | none | `g1-841757-development` 8.6 GiB, `g1-cuda-runtime-source-7c1f528-20260926` 4.3 GiB, `scene841757-autonomous-20260907` 2.0 GiB, `g1-841757-blueprint-runs` 0.36 GiB | 90 test imports; 35 failed transient units | configs 2026-09-24 |
| Astra CAD authoring (backend kept, "when that backend runs") | 13 / 5,268 | 11 / 4,914 | 19 live modules, incl. `website_task_preparation.py:1809`, `website_native_inputs.py:224`, `website_synthetic_cad.py:195`, `task_object_agent_*`, `claude_opus_*` | none | not separated | 63 test imports | |
| Episode compilation (robot-team) | 17 / 17,152 | 12 / 13,730 | `team_scene_packet.py:439` -> `task_evaluation_native_arena_episode_compiler`; `task_evaluation_launch_preparation_worker.py:72` -> `task_evaluation_episode_compilation_queue`; `team_scene_packet_remote` -> `task_evaluation_episode_compilation_remote` | remote timer 60 s + path (armed to drain); host lane disarmed | not separated | 68 test imports | |
| Rigid robot-free probe (lane kept, $1 cap) | 12 / 4,403 | 12 / 4,403 | `scene_stage_maintenance.py:251`, `scene_stage_holds.py:203`, `team_scene_packet.py:1429` -> `rigid_robot_free_probe_runner` | timer every 5 min + path; queue `pending: 0` | `/mnt/blueprint-work/rigid-robot-free-probe-work` (not in top list) | 64 test imports | runner 2026-11-14 |
| Team scene on Cloud Run | `team_scene_packet_collector` 957, `team_scene_packet_remote_condition` 66 (not live), `team_scene_packet_remote` 851 | partly | `team_scene_packet_worker` | timer 60 s + path, armed although SYSTEM_MAP calls it off | `/opt/blueprint/remote-cpu-runtime` 8.3 GiB (shared) | | 2026-11-05 |
| Configured controls / policy integration | (deleted lanes) | | | retired triggers stopped each release | `configured-controls` 9.1 GiB (newest change 2026-09-27) | | |
| Internal team diagnostic | `internal_team_evaluation_diagnostic` (CLI) | no | | none | `internal-team-evaluation-diagnostic-20261015` 5.5 GiB; 29 failed transient units | | |
| Capture app bridge / BlueprintCapture hand-off | 7 / 4,190 (`capture_bridge`, `capture_intake`, ARKit, V3.2 admission) | 7 / 4,190 | `website_capture_preparation.py:8` uses `capture_bridge.CaptureDescriptor` (live) | Cloud Function `storage-trigger` (live) | | 36 test imports | |
| Lambda Labs | 1 / 1,724 | 0 | nothing (console script only) | none | | 2 | |
| AWS (retired) | guard row `aws_provider_integration_removed` | | | | | | |

Retired-lane disk, lower bound from the survey (`usage survey: truncated`, 10,535 of 20,865 partitions
measured): 15.9 + 9.4 + 9.1 + 8.6 + 5.5 + 5.0 + 4.9 (`runtime-comparison-jobs`) + 4.3 + 2.8 + 2.0 =
**67.5 GiB**, plus experiment roots (`task-evaluation-control-plane-experiments` 2.6, `render-gate-canary`
1.4, `placement-preflight-candidates` 1.2). Host free space: `/` 85.1 GB of 165.3 GB,
`/mnt/blueprint-work` 102.0 GB of 316.5 GB (door `status.disk`).

Spend limits that still exist only for retired lanes: the screening per-site $30 (`screening_retained_ledger.SITE_LIMIT`,
WebApp `server/utils/betaPolicyScreeningContract.ts`), the rigid probe's $1/attempt reservation, the RunPod
refusal path. None reserves money today (`held_usd: 0`).

## 10. Owner, change date, coverage and production status per row

The tables above carry last change (`git log -1 --format=%cs`), test files importing each module, and
host state. Owner, where a row has one: website stages = owner direction 2026-11-12 (AGENTS.md mission);
money units = AGENTS.md "Spend limits" with owner decisions 2026-11-07, 2026-11-12, 2026-11-19, 2026-11-20;
withdrawal = privacy hard stop; door = D-08 (2026-11-02); paused lanes = owner frame 2026-11-12; trial
removal = owner 2026-11-14; RunPod retirement = owner 2026-11-05. Rows with no owner: the preflight timer
(D-04 says its count is not a signal), the Cloud Run team-scene timer, the remote episode-compilation timer,
the rigid probe timer, and the policy capability gate in scene progression.

Running in production means: unit installed and armed per `door units`, and code in release `cbff06b`
(HEAD differs by 22 files, none of them unit files; the code files are `atlas_privacy_screen.py`,
`website_company_simulation.py`, `website_packet_facts.py` and `scripts/operator_door.py`:
`git diff --name-only cbff06b HEAD`).

## Findings index

Full entries with evidence are in `inventory-pipeline.findings.json`.

| id | severity | dimension | title |
|---|---|---|---|
| IP-01 | P1 | broken | No company simulation package exists for any capture on the host |
| IP-02 | P1 | fragile | The GPU spend guard has failed 4,844 times since 2026-11-13 because retired RunPod is still queried |
| IP-03 | P1 | unseen | 207 failed units on the host, 206 of them stale experiment runs that hide real failures |
| IP-04 | P1 | vestigial | The website job path imports 81% of the package, retired lanes included |
| IP-05 | P1 | vestigial | Trial code is still imported by 41 live modules along 59 edges |
| IP-06 | P2 | over-gated | Scene progression still gates every intent on the retired trial's checkpoint inventory |
| IP-07 | P1 | fragile | Production blurs faces for jobs under the current Privacy Policy until the next deploy |
| IP-08 | P1 | untrue | SYSTEM_MAP says faces are blurred in every frame sent to World Labs |
| IP-09 | P2 | untrue | AGENTS.md and architecture docs cite files deleted on 2026-11-15 |
| IP-10 | P2 | vestigial | Retired lanes hold at least 67 GiB of host disk |
| IP-11 | P2 | vestigial | 44 modules are imported only by tests, including an entry point AGENTS.md names |
| IP-12 | P1 | fragile | The nightly full test lane has been red four nights running |
| IP-13 | P2 | vestigial | Three armed timers fire for lanes no website job feeds |
| IP-14 | P1 | unseen | The account's November spend cannot be fully verified and is forecast to hit the limit |
| IP-15 | P2 | unseen | The installed operator door is older than the repo's and its version never changes |
| IP-16 | P2 | vestigial | RunPod and Lambda adapters remain as console scripts after retirement |
| IP-17 | P2 | unseen | The chain preflight reports 108 blockers every 30 minutes that nobody acts on |
| IP-18 | P2 | fragile | Launch preparation, activation and dispatch keep their own retry rules |

## Firestore aggregates wanted

For the orchestrator's reviewed read-only script. Non-personal fields only; no site names, addresses,
contacts, job sentences or video references.

1. `taskEvaluationSceneIntakes`: count by status/outcome field, created in the last 30 days; median and p90
   of (first scene-intent forward time minus created time). Settles how many jobs reach row 5.
2. The collection the WebApp writes when the Pipeline reports a company simulation package (the signed
   `company-simulation` control operation; collection name per WebApp `server/routes`): count of jobs with
   a package recorded, ever and last 30 days; median time from upload complete to package recorded.
   Settles whether any company has ever had a downloadable simulation (finding IP-01).
3. `inboundRequests`: count created in the last 30 days, and how many have a capture upload completed.
4. `captureOutbox` (or `deliveryReceipts`): count by template/kind and status, last 30 days, to see which
   job-path emails actually go out.
5. Introduction / billable-event collection (WebApp name): count of introductions recorded, last 30 days.

## Not covered

- I did not open any site's state file, frames or media; job-level causes (why 4 captures have no team
  scene half) are left unverified.
- I did not run any test suite or CI job; test durations are from GitHub run metadata.
- Host env files (`/etc/blueprint/*.env`) were not read, so production values of commented switches
  are unknown.
- Cloud Run, GCP and B2 resources were not inventoried beyond what the door reports.
- The import graph is static. Code loaded by `runpy`, `importlib` with computed names, subprocesses or
  remote images may add edges; the unit roots cover the supervisor's workers explicitly.
- Flags were not re-classified one by one; the 2026-11-05 inventory is cited for that.
