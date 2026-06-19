# Real-Site Robot Eval Dataset Sync Boundary

Date: 2026-06-03

Status: Active WebApp consumer boundary for the Pipeline robot-eval dataset lane.

## Source System

`BlueprintCapturePipeline` owns the deterministic artifact contract under:

```text
pipeline/robot_eval_dataset/
  robot_eval_dataset_manifest.json
  real_site_robot_eval_dataset_manifest.json
  site_card.json
  task_cards.json
  scenario_cards.json
  eval_cards.json
  annotation_backlog.json
  proof_boundaries.json
  rights_packet.json
  rights_ledger.json
  task_ontology_v1.json
  robot_task_library.json
  scenario_family_library.json
  scenario_library.json
  scoring_methodology.json
  task_thresholds.json
  publication_readiness.json
  recorded_trace_eval_report.json
  policy_eval_report.json
  robot_pov_evidence_requirements.json
  human_demo_evidence_requirements.json
  robot_team_test_submission_modalities.json
  failure_taxonomy.json
  prediction_outcome_ledger.json
  prediction_vs_actual_summary.json
  eval_methodology_summary.md
pipeline/simulation_automation/
  scene_asset_inventory.json
  scene_asset_dependency_audit.json
  scene_asset_preflight.json
  scene_asset_inspection.json
  scene_frame_estimate.json
  collider_proxy_plan.json
  cpu_scene_proxy_manifest.json
  cpu_preflight_scorecard.json
  task_anchor_proposal_manifest.json
  episode_spec_manifest.json
  episode_specs.json
  spawn_pose_validation_manifest.json
  cpu_preflight_manifest.json
  pre_gpu_readiness_summary.json
  cpu_simulator_preflight_manifest.json
  gpu_handoff_packet.json
  gpu_owner_system_proof_schema.json
  gpu_run_checklist.md
  owner_gpu_simulator_execution_blocked_manifest.json
```

WebApp consumes only synced artifact URIs and advisory summary fields. It does
not own raw capture truth, task execution truth, simulator truth, robot trial
truth, or rights/privacy clearance.

## Sync Fields

Pipeline sync may attach these optional artifact fields:

- `robot_eval_dataset_manifest_uri`
- `robot_eval_legacy_manifest_uri`
- `robot_eval_site_card_uri`
- `robot_eval_task_cards_uri`
- `robot_eval_scenario_cards_uri`
- `robot_eval_cards_uri`
- `robot_eval_annotation_backlog_uri`
- `robot_eval_proof_boundaries_uri`
- `robot_rights_packet_uri`
- `robot_rights_ledger_uri`
- `robot_task_ontology_v1_uri`
- `robot_task_library_uri`
- `robot_scenario_family_library_uri`
- `robot_scenario_library_uri`
- `robot_scoring_methodology_uri`
- `robot_eval_task_thresholds_uri`
- `robot_eval_publication_readiness_uri`
- `robot_eval_scene_asset_inventory_uri`
- `robot_eval_scene_asset_dependency_audit_uri`
- `robot_eval_scene_asset_preflight_uri`
- `robot_eval_scene_asset_inspection_uri`
- `robot_eval_scene_frame_estimate_uri`
- `robot_eval_collider_proxy_plan_uri`
- `robot_eval_cpu_scene_proxy_manifest_uri`
- `robot_eval_cpu_preflight_scorecard_uri`
- `robot_eval_task_anchor_proposal_manifest_uri`
- `robot_eval_episode_spec_manifest_uri`
- `robot_eval_episode_specs_uri`
- `robot_eval_spawn_pose_validation_manifest_uri`
- `robot_eval_cpu_preflight_manifest_uri`
- `robot_eval_pre_gpu_readiness_summary_uri`
- `robot_eval_cpu_simulator_preflight_manifest_uri`
- `robot_eval_gpu_handoff_packet_uri`
- `robot_eval_gpu_owner_system_proof_schema_uri`
- `robot_eval_gpu_run_checklist_uri`
- `robot_eval_owner_gpu_simulator_execution_blocked_manifest_uri`
- `recorded_trace_eval_report_uri`
- `policy_eval_report_uri`
- `robot_pov_evidence_requirements_uri`
- `human_demo_evidence_requirements_uri`
- `robot_team_test_submission_modalities_uri`
- `robot_failure_taxonomy_uri`
- `prediction_outcome_ledger_uri`
- `prediction_vs_actual_summary_uri`
- `robot_eval_methodology_summary_uri`
- `robot_eval_job_request_uri`
- `robot_eval_scheduler_decision_uri`
- `robot_eval_worker_launch_plan_uri`
- `robot_eval_worker_manifest_uri`
- `robot_eval_gpu_provider_launch_request_uri`
- `robot_eval_gpu_provider_launcher_result_uri`
- `robot_eval_runpod_provider_adapter_result_uri`
- `robot_eval_gpu_cost_control_ledger_uri`
- `robot_eval_startup_architecture_audit_uri`
- `robot_eval_worker_runtime_manifest_uri`
- `robot_eval_worker_runtime_preflight_uri`
- `robot_eval_job_run_manifest_uri`
- `robot_eval_job_proof_boundary_uri`
- `robot_eval_job_blocked_manifest_uri`

`deployment_readiness.robot_eval_dataset_summary` may summarize the contract as
advisory with `dataset_version`, `dataset_state`, `site_card_count`,
`task_card_count`, `scenario_card_count`, `eval_card_count`,
`annotation_backlog_count`, `manifest_uri`, and `card_artifact_uris`. Its
presence must not set `runtime_launchable`, `runtime_registration_status`,
`native_world_model_status`, `qualified_ready`, `handoff_ready`, or any
operational readiness state.

`Ready to evaluate` is gated by the complete publication package. WebApp may set
`ready_to_evaluate_publishable=true` only when the synced artifact family
includes the dataset manifest, Site/Task/Scenario/Eval Cards, proof boundaries,
task ontology, scenario family library, scoring methodology,
`task_thresholds.json`, and `publication_readiness.json`. A partial artifact
family must stay `publication_blocked_missing_robot_eval_package`.

When a robot team chooses a site/task/scenario/policy from `/sites` or
`/sites/:slug`, WebApp posts a durable `robot_eval_job_request.v1` to
`/api/robot-eval/job-requests`. The request includes the selected site package,
task thresholds, six structured policy submission modalities, the
`buyer_request_id`, `site_submission_id`, `capture_job_id`, `capture_id`,
access/entitlement state, fixture-local Pipeline defaults, and proof boundaries.
New WebApp-created requests also include
`execution_request.schema_version=blueprint.robot_eval_execution_request.v1` so
the handoff explicitly records that WebApp only queues/forwards the job,
`BlueprintCapturePipeline` owns simulator scheduling and GPU allocation, CPU
preflight must block GPU spend when required artifacts are missing, and no GPU
allocation, spend approval, simulator execution, or public claim upgrade is
granted by the website request itself. This metadata may name Isaac, Isaac
Lab/Arena, MuJoCo, PyBullet, and fixture/proxy lanes as routing options, but the
actual backend, worker image, warm-pool/on-demand policy, and artifact proof
remain Pipeline/owner-system responsibilities.
Current requests carry a `mujoco_first_unless_proof_requires_isaac` simulator
selection policy: MuJoCo is the default first real simulator pass for cheap
policy/spawn smoke, while Isaac Sim and Isaac Lab/Arena are escalation backends
only when the request names richer USD/OpenUSD, Isaac robot-asset, RTX sensor,
contact/physics, or batch Arena proof classes. MuJoCo evidence must not clear
the Isaac-specific, real-robot, safety/contact, or public-claim gates.
Accepted requests are written to Firestore when configured and always export a
Pipeline-readable local inbox envelope at
`output/pipeline/robot_eval_job_requests/inbox/*.json` unless
`ROBOT_EVAL_JOB_REQUEST_INBOX_DIR` overrides the path. Pipeline can consume that
`robot_eval_job_request_inbox.v1` envelope without a human copy/paste step.
For first-GPU startup rehearsals that are not submitted through the public route,
`npm run pipeline:first-gpu:rehearsal-request -- --capture-root <capture-root>
--output <queue-envelope.json> --site-slug <slug> --site-submission-id <id>
--capture-job-id <id> --capture-id <id> --buyer-request-id <id>` exports the
same queue-envelope contract with `source_kind=local_first_gpu_rehearsal_request`
and `local_rehearsal_only=true`. That rehearsal exporter proves WebApp request
construction only; it does not prove live route submission, live forwarding,
simulator execution, policy execution, robot readiness, safety validation, or
public claim upgrades.

Before treating live forwarding as startup-ready, run
`npm run pipeline:forwarding:preflight -- --require-forwarding` with the
intended `ROBOT_EVAL_JOB_REQUEST_FORWARD_*` environment. This command validates
the forwarding URL, bearer-token presence, timeout, and capture-root override
shape and writes a redacted report at
`output/pipeline/robot_eval_job_requests/forwarding_preflight.json`. Add
`-- --probe-intake-audit` only for a read-only authenticated
`GET /api/live-pipeline/intake-audit` against the Pipeline intake service. The
preflight proves configuration and optional endpoint reachability only; it does
not submit a job request, allocate GPU workers, run Isaac/MuJoCo, prove route
submission, or upgrade any simulator, safety, readiness, or public claim.
After preflight, `npm run pipeline:first-gpu:route-forwarding-proof -- --forward-url <pipeline-intake-url> ...`
can prove the local WebApp route path by starting a local `/api/robot-eval/job-requests`
route and POSTing a generated non-rehearsal request into the configured Pipeline
intake. Use a local/staging intake URL unless a live Pipeline staging side
effect is explicitly intended. This proves local route submission and Pipeline
intake staging only; it does not prove production WebApp deployment, GPU
allocation, simulator execution, policy execution, robot readiness, safety
validation, or public claim upgrades.
Pipeline status sync is advisory through
`deployment_readiness.robot_eval_job_summary` and must not promote simulator
execution, robot readiness, safety validation, or public claim upgrades.
`robot_eval_scheduler_decision_uri`, `robot_eval_worker_launch_plan_uri`,
`robot_eval_worker_manifest_uri`, `robot_eval_gpu_provider_launch_request_uri`,
`robot_eval_gpu_provider_launcher_result_uri`,
`robot_eval_runpod_provider_adapter_result_uri`,
`robot_eval_gpu_cost_control_ledger_uri`,
`robot_eval_startup_architecture_audit_uri`,
`robot_eval_worker_runtime_manifest_uri`, and
`robot_eval_worker_runtime_preflight_uri` describe queued startup intent,
CPU-preflight gating, worker image/cache choices, provider launch request/result
shape, provider-adapter request/submission status, required env/secret names,
GPU constraints, cost-control limits, estimated versus actual GPU time records,
runtime preflight/finalizer status, and live-action blockers only. They are
advisory until owner-runtime proof exists and are not simulator-result artifacts.

Sites may also project a per-site manifest status family for privacy, World
Labs compatibility/support artifacts, materialization, CPU preflight, GPU
handoff, eval result, and policy-improvement export. Those rows may include
retry/failure summaries, but the summaries are operational diagnostics only.
They must not imply simulator execution, safety validation, robot deployment
readiness, or policy pass/fail outcomes.

`deployment_readiness.robot_eval_preflight_summary` may summarize the CPU-only
pre-GPU lane with `scene_asset_preflight_status`, `episode_spec_status`,
`episode_count`, `cpu_simulator_preflight_status`,
`local_cpu_preflight_smoke_ran`, `collider_backend_labels`,
`collider_backend_blockers`, dependency counts, `real_collider_proven`,
`proxy_estimated`, `missing_collider`, `review_required`,
`ready_for_owner_gpu_preflight`, GPU handoff artifact URIs, install
instructions, and the preflight artifact URIs above. WebApp must keep
`owner_gpu_simulator_execution_proven`, `simulator_execution_proven`,
`robot_readiness_proven`, `safety_validated`, and
`public_claim_upgrade_allowed` false unless request-scoped owner-system proof
later supplies simulator traces, robot logs, safety signoff, and
buyer-approved methodology.

## Allowed Display

WebApp may display:

- advisory dataset contract present
- Site, Task, Scenario, and Eval Card artifact URIs
- rights packet and rights ledger URIs
- task ontology and scenario family library URIs
- task count and scenario count
- card counts and annotation backlog count
- scoring methodology, recorded trace eval report, and policy eval report URIs
- task thresholds and publication readiness URIs
- CPU scene-asset inspection, scene-frame estimate, CPU preflight scorecard,
  dependency audit, collider/proxy plan, task-anchor proposals, episode specs,
  spawn validation, GPU handoff packet, owner proof schema, run checklist, and
  owner-GPU blocked manifest URIs
- CPU preflight statuses, optional dependency install instructions, dependency
  warnings, collider/proxy labels, task/spawn proposal status, and
  collider-backend blockers
- advisory robot-eval job request and run-status URIs
- evidence requirements
- robot-team submission modality requirements and missing-evidence statuses
- failure taxonomy availability
- prediction-vs-actual ledger schema availability
- prediction-vs-actual summary availability
- missing-proof statuses such as `needs_robot_pov`, `needs_human_demo`,
  `needs_action_logs`, `needs_actual_outcome`,
  `needs_policy_api_endpoint_ref`, `needs_docker_container_ref`,
  `needs_recorded_action_trace_ref`, `needs_high_level_skill_trace_ref`,
  `needs_teleop_demo_ref`, and `needs_sim_controller_plugin_ref`

## Blocked Claims

These artifacts alone must not be displayed as:

- robot-ready or deployment-ready status
- simulator execution completed
- local CPU preflight smoke as completed owner-system simulator execution
- `ready_for_owner_gpu_preflight` as completed simulator execution
- a GPU handoff packet as evidence that an owner GPU simulator run occurred
- safety validation
- actual robot trial passed
- submitted policy/container/trace/demo/plugin passed evaluation
- guaranteed success rate, cycle time, intervention rate, or safety threshold

Those claims require request-scoped owner-system proof from simulator traces,
robot POV/action logs, human demo/teleop evidence, actual outcome records,
rights/privacy clearance, and buyer-approved methodology.

## Verification

The regression test is:

```bash
npm run test -- server/tests/pipeline-state-machine.test.ts
```

It asserts robot-eval dataset artifact presence remains advisory-only and does
not promote runtime or deployment readiness fields.
