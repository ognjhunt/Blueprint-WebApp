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
  robot_task_library.json
  scenario_library.json
  robot_pov_evidence_requirements.json
  human_demo_evidence_requirements.json
  robot_team_test_submission_modalities.json
  failure_taxonomy.json
  prediction_outcome_ledger.json
  eval_methodology_summary.md
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
- `robot_task_library_uri`
- `robot_scenario_library_uri`
- `robot_pov_evidence_requirements_uri`
- `human_demo_evidence_requirements_uri`
- `robot_team_test_submission_modalities_uri`
- `robot_failure_taxonomy_uri`
- `prediction_outcome_ledger_uri`
- `robot_eval_methodology_summary_uri`

`deployment_readiness.robot_eval_dataset_summary` may summarize the contract as
advisory with `dataset_version`, `dataset_state`, `site_card_count`,
`task_card_count`, `scenario_card_count`, `eval_card_count`,
`annotation_backlog_count`, `manifest_uri`, and `card_artifact_uris`. Its
presence must not set `runtime_launchable`, `runtime_registration_status`,
`native_world_model_status`, `qualified_ready`, `handoff_ready`, or any
operational readiness state.

## Allowed Display

WebApp may display:

- advisory dataset contract present
- Site, Task, Scenario, and Eval Card artifact URIs
- task count and scenario count
- card counts and annotation backlog count
- evidence requirements
- robot-team submission modality requirements and missing-evidence statuses
- failure taxonomy availability
- prediction-vs-actual ledger schema availability
- missing-proof statuses such as `needs_robot_pov`, `needs_human_demo`,
  `needs_action_logs`, `needs_actual_outcome`,
  `needs_policy_api_endpoint_ref`, `needs_docker_container_ref`,
  `needs_recorded_action_trace_ref`, `needs_high_level_skill_trace_ref`,
  `needs_teleop_demo_ref`, and `needs_sim_controller_plugin_ref`

## Blocked Claims

These artifacts alone must not be displayed as:

- robot-ready or deployment-ready status
- simulator execution completed
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
