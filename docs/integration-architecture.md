# Blueprint Integration Architecture

Date: 2026-03-10

Status: Current integration support spec with historical qualification-first language corrected on 2026-05-14

Current doctrine note:

This document is a support-layer integration map. `PLATFORM_CONTEXT.md` and
`WORLD_MODEL_STRATEGY_CONTEXT.md` remain authoritative for product framing.
Blueprint is capture-first and world-model-product-first. Qualification,
readiness, and review outputs are optional trust layers around capture-backed
site-specific world-model packages and hosted access; they are not the default
product center of gravity.

## Summary

Blueprint is a three-repo system with one primary lifecycle:

1. `Blueprint-WebApp` creates and routes a scoped buyer/site/capture request.
2. `BlueprintCapture` collects the real-site evidence package for that request.
3. `BlueprintCapturePipeline` turns the evidence into site-specific package artifacts, hosted-session assets, and optional qualification/readiness handoff material.
4. `Blueprint-WebApp` ingests the resulting artifacts, updates request state, and promotes eligible capture-backed packages into buyer, hosted-access, licensing, and ops lanes.

The key product rule is:

- capture provenance, rights/privacy metadata, site-specific package artifacts, and hosted-session readiness are the central truth surfaces
- qualification/readiness is an optional trust layer that can guide buyer review, commercialization, and deployment support
- exchange, hosted review, evaluation packages, scenario generation, licensing, and managed tuning are downstream commercial lanes
- derived assets must be stored separately from capture/provenance truth and must not overwrite it

## Repo Responsibilities

### Blueprint-WebApp

Primary role:

- intake
- routing
- admin review
- buyer, hosted-access, licensing, and ops surfaces for eligible site-specific packages
- later evaluation / tuning packaging
- monetization

Relevant models already in the repo:

- `requestId`
- `site_submission_id`
- `qualification_state`
- `opportunity_state`
- `requestedLanes`

Canonical source:

- `server/types/inbound-request.ts`

### BlueprintCapture

Primary role:

- create the evidence package for a scoped request

Minimum export bundle:

```text
raw/
  manifest.json
  intake_packet.json
  capture_context.json
  capture_upload_complete.json
  motion.jsonl
  walkthrough.mov
  optional object_index.json
  optional arkit/...
```

### BlueprintCapturePipeline

Primary role:

- convert the evidence package into:
  - site-specific package artifacts
  - hosted-session artifacts where available
  - qualification artifacts
  - readiness decision
  - opportunity handoff
  - human actions required
  - optional preview/evaluation artifacts

## Canonical Identity Mapping

The system needs one stable business identity and one stable capture identity.

### Business / workflow identity

- `site_submission_id`
- owner: `Blueprint-WebApp`
- lifecycle: one site/task/workflow request

Recommendation:

- use `site_submission_id` as the canonical cross-repo business key
- if missing, fall back to `requestId`

### Capture identity

- `scene_id`
- `capture_id`
- owner: capture app + pipeline

Recommendation:

- set `scene_id = site_submission_id`
- set `capture_id = uuid per capture pass`

This gives:

- one business request
- many possible capture attempts or refreshes over time

## Firestore Request State

Current state model in `Blueprint-WebApp`:

- `submitted`
- `capture_requested`
- `qa_passed`
- `needs_more_evidence`
- `in_review`
- `qualified_ready`
- `qualified_risky`
- `not_ready_yet`

Current opportunity states:

- `not_applicable`
- `handoff_ready`
- `escalated_to_geometry` (legacy enum value; display as preview / asset prep)
- `escalated_to_validation`

### Recommended state transitions

1. Intake submitted
- `qualification_state = submitted`
- `opportunity_state = not_applicable`

2. Capture requested / in progress
- `qualification_state = capture_requested`

3. Raw capture received and QA good enough to proceed
- `qualification_state = qa_passed`

4. Qualification pipeline returns incomplete evidence
- `qualification_state = needs_more_evidence`
- `opportunity_state = not_applicable`

5. Qualification under admin or solutions review
- `qualification_state = in_review`

6. Qualification returns usable site
- `qualification_state = qualified_ready` or `qualified_risky`
- `opportunity_state = handoff_ready`

7. Site is promoted into preview or asset-prep work
- `opportunity_state = escalated_to_geometry`

8. Site is promoted into deeper validation
- `opportunity_state = escalated_to_validation`

9. Site is rejected or held
- `qualification_state = not_ready_yet`

## Capture Bundle IDs

Recommended cross-repo mapping:

| Concept | Value | Owner |
|---|---|---|
| `requestId` | frontend-generated request UUID | WebApp |
| `site_submission_id` | durable business key, ideally same as `requestId` or derived from it | WebApp |
| `scene_id` | set equal to `site_submission_id` | Capture / Pipeline |
| `capture_id` | unique per capture pass | Capture / Pipeline |
| `jobId` | same as `site_submission_id` when possible | Capture |

### Recommended remote storage path

```text
gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/
```

with:

```text
raw/
  manifest.json
  intake_packet.json
  capture_context.json
  capture_upload_complete.json
  motion.jsonl
  walkthrough.mov
  optional object_index.json
  optional arkit/frames.jsonl
  optional arkit/poses.jsonl
  optional arkit/intrinsics.json
  optional arkit/depth/*
  optional arkit/confidence/*
pipeline/
  ...
```

## Pipeline Artifact URIs

The minimum support artifacts the webapp should ingest back from `BlueprintCapturePipeline` are:

- `readiness_decision.json`
- `readiness_report.md`
- `qualification_quality_report.json`
- `opportunity_handoff.json`
- `human_actions_required.json`
- `agent_review_bundle.json`
- `agent_readiness_memo.md`
- `dashboard_summary.json` when a scene has Phase 2 task-run rollups
- `scene_deployment_summary.md` when a scene has rollout planning rollups
- `scene_memory/scene_memory_manifest.json` when scene-memory prep is emitted
- `preview_simulation/preview_simulation_manifest.json` when preview simulation is prepared

Recommended Firestore attachment block:

```json
{
  "pipeline": {
    "scene_id": "<scene_id>",
    "capture_id": "<capture_id>",
    "pipeline_prefix": "scenes/<scene_id>/captures/<capture_id>/pipeline",
    "artifacts": {
      "readiness_decision_uri": "gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/pipeline/readiness_decision.json",
      "readiness_report_uri": "gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/pipeline/readiness_report.md",
      "qualification_quality_report_uri": "gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/pipeline/qualification_quality_report.json",
      "opportunity_handoff_uri": "gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/pipeline/opportunity_handoff.json",
      "human_actions_required_uri": "gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/pipeline/human_actions_required.json",
      "agent_review_bundle_uri": "gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/pipeline/agent_review_bundle.json",
      "agent_readiness_memo_uri": "gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/pipeline/agent_readiness_memo.md",
      "dashboard_summary_uri": "gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/pipeline/dashboard_summary.json",
      "scene_deployment_summary_uri": "gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/pipeline/scene_deployment_summary.md",
      "scene_memory_manifest_uri": "gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/pipeline/scene_memory/scene_memory_manifest.json",
      "preview_simulation_manifest_uri": "gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/pipeline/preview_simulation/preview_simulation_manifest.json"
    }
  }
}
```

Recommended derived-assets block:

```json
{
  "derived_assets": {
    "scene_memory": {"status": "prep_ready", "manifest_uri": "gs://.../scene_memory/scene_memory_manifest.json"},
    "preview_simulation": {"status": "prep_ready", "manifest_uri": "gs://.../preview_simulation/preview_simulation_manifest.json"},
    "validation_package": {"status": "not_requested"},
    "dataset_package": {"status": "not_requested"}
  }
}
```

Internal sync rule:

- `pipeline` and `derived_assets` attachments are downstream metadata only
- default attachment sync must preserve `status`, `qualification_state`, and `opportunity_state`
- a pipeline caller may update qualification/readiness support-layer state only when it explicitly sets an authoritative state-update flag

### Optional advanced-geometry attachment block

Only for selected opportunities:

```json
{
  "advanced_geometry": {
    "bundle_uri": "gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/pipeline/advanced_geometry/advanced_geometry_bundle.json",
    "labels_uri": "gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/pipeline/advanced_geometry/labels.json",
    "structure_uri": "gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/pipeline/advanced_geometry/structure.json",
    "task_targets_uri": "gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/pipeline/advanced_geometry/task_targets.synthetic.json",
    "ply_uri": "gs://<bucket>/scenes/<scene_id>/captures/<capture_id>/pipeline/advanced_geometry/3dgs_compressed.ply"
  }
}
```

## How A Capture-Backed Site Becomes A Buyer-Facing Item

### Step 1. Intake creates the request

`Blueprint-WebApp`

Writes:

- `requestId`
- `site_submission_id`
- site/task/budget/buyer metadata
- `requestedLanes`
- initial `qualification_state = submitted`

### Step 2. Capture is attached to that request

`BlueprintCapture`

Creates a finalized evidence bundle tied to:

- `site_submission_id`
- `scene_id`
- `capture_id`

### Step 3. Pipeline materializes package and trust outputs

`BlueprintCapturePipeline`

Produces:

- site-specific package and hosted-session artifacts where available
- qualification artifacts
- readiness decision
- handoff
- human actions required
- optional agent review bundle

### Step 4. WebApp ingests pipeline outputs

The integration bridge should:

- locate the target Firestore request by `site_submission_id`
- attach capture, package, hosted-session, and trust-layer artifact references
- update `qualification_state` only as a support-layer state
- update `opportunity_state`
- expose report/handoff links to admin users

### Step 5. Promote only eligible records

A record becomes a buyer-facing package or hosted-review item only if:

- `qualification_state` is `qualified_ready` or `qualified_risky`
- required artifacts exist
- visibility/privacy rules allow external review
- admin or policy gating permits promotion

Recommended exchange promotion record:

```json
{
  "exchange_item": {
    "source_request_id": "<requestId>",
    "site_submission_id": "<site_submission_id>",
    "scene_id": "<scene_id>",
    "capture_id": "<capture_id>",
    "qualification_state": "qualified_ready",
    "opportunity_state": "handoff_ready",
    "buyer_type": "site_operator",
    "requested_lanes": ["qualification"],
    "title": "<derived site + task title>",
    "summary": "<derived from opportunity_handoff/operator summary>",
    "handoff_uri": "<opportunity_handoff_uri>",
    "report_uri": "<readiness_report_uri>",
    "agent_bundle_uri": "<agent_review_bundle_uri>",
    "geometry_bundle_uri": "<optional advanced geometry uri>",
    "visibility": "gated",
    "exchange_status": "live"
  }
}
```

## Recommended Firestore Additions

To support the bridge cleanly, add these fields to the request document:

- `pipeline.scene_id`
- `pipeline.capture_id`
- `pipeline.pipeline_prefix`
- `pipeline.artifacts.*`
- `latest_capture_completed_at`
- `latest_pipeline_completed_at`
- `exchange_status` (`not_listed`, `eligible`, `live`, `paused`, `closed`) as a legacy/compatibility name for buyer-facing package visibility
- `exchange_visibility` (`internal`, `gated_robot_teams`, `private`)

## Product Ladder Mapping

The platform should be sold in this order:

1. `Exact-Site Hosted Review`
- capture-backed hosted access for one real facility

2. `Evaluation Package`
- deeper site-specific diligence once the hosted review is useful

3. `Data Licensing / Derived Assets`
- scoped package delivery, usage rights, and downstream assets

4. `Managed Tuning / Deployment Support`
- higher-touch validation, tuning, licensing, and deployment help

The data model should reflect that ladder without making qualification the product center of gravity:

- requests may begin in review/qualification, but that is a support layer
- hosted review and site-specific package delivery are the primary commercial surfaces
- deeper evaluation, licensing, and managed tuning only activate for the subset of sites that justify them

## Current Bridge Status

The production bridge is now implemented in:

- [`server/routes/internal-pipeline.ts`](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/routes/internal-pipeline.ts)
- [`server/utils/pipelineStateMachine.ts`](/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/pipelineStateMachine.ts)

Current posture:

- `BlueprintCapturePipeline` emits the downstream artifacts
- `Blueprint-WebApp` ingests those artifacts into inbound request state, proof-path milestones, and hosted-review readiness
- buyer and ops surfaces can inspect bridge state through the internal pipeline status/readiness endpoints

The remaining work is not "build the bridge" from scratch. The remaining work is operational:

- keep production sync verified end to end
- ensure buyer-facing package promotion stays gated by truthful hosted-review readiness
- keep docs and reporting surfaces aligned with the implemented bridge
