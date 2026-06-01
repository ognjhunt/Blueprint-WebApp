# Pipeline/runtime proof packet harness spec

Generated: 2026-05-31

Scope: map the proof packet harness across `BlueprintCapturePipeline`, `BlueprintContracts`, `BlueprintValidation`, `BlueprintCapture`, and `Blueprint-WebApp`.

This is a local specification artifact. It is not provider proof, hosted proof, rights clearance, payment proof, production readiness, or human approval.

## Repository state observed

| Repo | Path | `git status --short` summary |
| --- | --- | --- |
| WebApp | `/Users/nijelhunt_1/workspace/Blueprint-WebApp` | Dirty generated AutoAgent, claims-guard, and QA output plus untracked architecture/research/playbook artifacts, `output/autoagent/recursive-improvement/latest/no-change-shadow-canary-hardening-plan.md`, and `outputs/`. This spec is a new file under `outputs/proof-packets/`. |
| CapturePipeline | `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline` | Clean. |
| Contracts | `/Users/nijelhunt_1/workspace/BlueprintContracts` | Clean. |
| Validation | `/Users/nijelhunt_1/workspace/BlueprintValidation` | Dirty user-owned changes in `PLATFORM_CONTEXT.md`, `pyproject.toml`, `src/blueprint_validation/runtime_backend.py`, and `uv.lock`. Not modified. |
| Capture | `/Users/nijelhunt_1/workspace/BlueprintCapture` | Clean. |

## Inspected doctrine and harness surfaces

- WebApp doctrine: `AGENTS.md`, `README.md`, `PLATFORM_CONTEXT.md`, `WORLD_MODEL_STRATEGY_CONTEXT.md`, `AUTONOMOUS_ORG.md`, `DEPLOYMENT.md`, `docs/architecture/source-of-truth-map.md`, `docs/architecture/command-safety-matrix.md`, `docs/architecture/public-display-ready-claims-matrix.md`, `docs/architecture/ai-onboarding-map.md`, `docs/ai-tooling-adoption-implementation-2026-04-07.md`, `docs/ai-skills-governance-2026-04-07.md`, `docs/autonomous-loop-evidence-checklist-2026-05-03.md`, and `graphify-out/GRAPH_REPORT.md`.
- CapturePipeline doctrine/tests: `README.md`, `AGENTS.md`, `src/AGENTS.md`, `src/blueprint_pipeline/AGENTS.md`, `tests/AGENTS.md`, `scripts/AGENTS.md`, `docs/READINESS_MATRIX.md`, `docs/CAPTURE_BRIDGE_CONTRACT.md`, and tests around same-capture lineage, geometry, privacy, WebApp sync, site-world packaging, native runtime service, and external alpha gate.
- Contracts surfaces: `README.md`, `docs/site_world_contract.md`, `docs/runtime_layer_contract.md`, `docs/handoff_contract.md`, `docs/canonical_package.md`, `src/blueprint_contracts/*_contract.py`, and contract tests.
- Validation surfaces: `README.md`, runtime/preflight/hosted-session/runtime-service app code and runtime, preflight, hosted session, report, and grounding tests.
- Capture surfaces: `AGENTS.md`, `README.md`, nested guides, raw V3 validator, upload service, bundle support, rights acknowledgement, and iOS/Android contract tests.
- WebApp runtime/sync surfaces: `server/routes/internal-pipeline.ts`, `server/routes/site-world-sessions.ts`, `server/utils/pipelineAttachmentContract.ts`, `server/utils/pipelineStateMachine.ts`, `server/utils/hosted-session-runtime.ts`, `server/utils/hosted-session-orchestrator.ts`, `server/utils/hosted-session-launch-readiness.ts`, and associated tests.

## Owner boundaries

| Proof class | Owner system | What can be proven locally | What stays outside local proof |
| --- | --- | --- | --- |
| Local/repo proof | Capture, Pipeline, Contracts, Validation, WebApp tests | Contract shape, same-capture lineage, deterministic validation, package assembly, local runtime service contracts, WebApp route logic | Live provider execution, live hosted fulfillment, payment/payout, rights clearance, production data, human approval |
| Provider proof | Pipeline plus the named provider service | Provider adapter inputs and required env/runner config can be validated | Actual `video_to_world`, privacy runner, World Labs/Cosmos/native model execution unless a real provider run artifact exists |
| Hosted proof | WebApp plus runtime service/Render/Redis/Firestore entitlement state | Artifact resolution, launch-readiness logic, entitlement checks, runtime handle probing in tests | Protected buyer access or live session fulfillment without current owner-system state and runtime responses |
| Rights/privacy proof | Capture metadata, Pipeline privacy processing, operator/legal review | Raw `rights_consent.json`, privacy manifests/reports, fail-closed processing decisions | Legal/commercial clearance, customer rights, exception approval, and final commercialization scope |
| Human-gated proof | Human blocker packet owner plus durable issue/report | Packet format, blocker id, routing, resume condition | Any approval or decision until the reply is recorded in the owning artifact |

## Packet schema

```json
{
  "schema_version": "blueprint.pipeline_runtime_proof_packet.v1",
  "generated_at": "ISO-8601",
  "packet_id": "proof-packet:<scene_id>:<capture_id>:<run_id>",
  "claim_ceiling": "local_repo_proof | provider_proof | hosted_proof | rights_privacy_proof | human_gated_proof | operational_launch_proof",
  "run_context": {
    "repos": {
      "capture": {"path": "...", "git_status": "..."},
      "pipeline": {"path": "...", "git_status": "..."},
      "contracts": {"path": "...", "git_status": "..."},
      "validation": {"path": "...", "git_status": "..."},
      "webapp": {"path": "...", "git_status": "..."}
    },
    "forbidden_actions_observed": [
      "no_provider_jobs",
      "no_production_data",
      "no_live_sends",
      "no_payment_or_payout_mutation"
    ]
  },
  "capture_identity": {
    "scene_id": "",
    "capture_id": "",
    "capture_source": "iphone | android | glasses",
    "capture_modality": "",
    "site_submission_id": "",
    "request_id": "",
    "buyer_request_id": "",
    "capture_job_id": ""
  },
  "local_repo_proof": {
    "raw_bundle": {},
    "bridge_handoff": {},
    "contracts": {},
    "pipeline_outputs": {},
    "same_capture_lineage": {},
    "validation_harness": {},
    "webapp_sync_contract": {},
    "status": "not_evaluated | passed | blocked"
  },
  "provider_proof": {
    "geometry": {},
    "privacy_runners": {},
    "world_model_provider": {},
    "native_runtime_provider": {},
    "status": "not_requested | not_configured | passed | blocked"
  },
  "hosted_proof": {
    "webapp_attachment_sync": {},
    "entitlement": {},
    "runtime_handle": {},
    "runtime_probe": {},
    "session": {},
    "status": "not_requested | artifact_backed | runtime_live_ready | blocked"
  },
  "rights_privacy_proof": {
    "capture_rights_consent": {},
    "pipeline_privacy_processing": {},
    "rights_and_compliance_review": {},
    "commercialization_scope": {},
    "status": "unknown | privacy_processed | rights_review_required | cleared | blocked"
  },
  "human_gate": {
    "required": false,
    "blocker_id": "",
    "owner": "",
    "packet_uri": "",
    "reply_record_uri": "",
    "resume_condition": ""
  },
  "claims": {
    "same_capture_lineage_repo_proven": false,
    "webapp_upstream_links_verified": false,
    "world_model_ready_claim_allowed": false,
    "hosted_review_claim_allowed": false,
    "rights_cleared_claim_allowed": false,
    "operational_launch_ready_claim_allowed": false
  },
  "blockers": [],
  "residual_risk": []
}
```

## Required local evidence

### Capture local evidence

Minimum raw bundle evidence:

- `scenes/{scene_id}/captures/{capture_id}/raw/manifest.json`
- `provenance.json`
- `rights_consent.json`
- `capture_context.json`
- `intake_packet.json`
- `task_hypothesis.json`
- `recording_session.json`
- `capture_topology.json`
- `video_track.json`
- `hashes.json`
- `capture_upload_complete.json`
- canonical video, `motion.jsonl`, `sync_map.jsonl`, semantic anchor rows, and modality sidecars such as `arkit/`, `arcore/`, `glasses/`, or `companion_phone/`

Local claim ceiling: raw capture bundle and upload-completion marker exist and pass the repo validator. This does not prove final readiness, payout, rights clearance, provider readiness, hosted readiness, or buyer trust.

### Bridge and Pipeline local evidence

Minimum bridge/pipeline evidence:

- `capture_descriptor.json`
- `qa_report.json`
- `pipeline_handoff.json`
- `pipeline/qualification_summary.json`
- `pipeline/capture_quality_summary.json`
- `pipeline/rights_and_compliance_summary.json`, if rights review exists
- `pipeline/privacy/privacy_processing_manifest.json`
- `pipeline/privacy/privacy_verification_report.json`
- `pipeline/geometry/geometry_summary.json`
- `pipeline/site_package/canonical_site_package.json`
- `pipeline/site_package/provider_adapter_inputs/world_labs_marble.json`
- `pipeline/evaluation_prep/site_world_spec.json`
- `pipeline/evaluation_prep/site_world_registration.json`
- `pipeline/evaluation_prep/site_world_health.json`
- `pipeline/presentation_world/presentation_world_manifest.json`
- `pipeline/presentation_world/runtime_demo_manifest.json`
- `pipeline/webapp_sync_result.json`
- same-capture lineage packet output from `scripts/validate_same_capture_lineage.py`

Local claim ceiling: package artifacts are assembled and contract-valid for the same capture chain. This still does not prove provider execution, hosted live launch, buyer entitlement, rights clearance, payment/payout, or public operational readiness.

### Contracts local evidence

Contracts proof must validate:

- capture source/modality/requested-lane normalization from `capture_contract`
- qualification handoff remains qualification-only from `handoff_contract`
- canonical package hash/version inputs from `canonical_package`
- canonical versus presentation output semantics from `runtime_layer_contract`
- `runtime_eligibility.readiness_state` is the machine-readable launch gate, not a free-form `status`
- `site_world_contract` agrees across registration, health, and spec

Local claim ceiling: schema and semantic contract compliance only. Contracts do not execute runtimes or providers.

### Validation local evidence

Validation proof may include:

- `runtime:service_url`, `runtime:healthz`, `runtime:capabilities`, `runtime:kind`, `runtime:model_ready`, and `runtime:checkpoint_ready` preflight checks
- `runtime_probe.json`
- `session_state.json`
- episode state and rollout artifacts
- `runtime_batch_manifest.json`
- `export_manifest.json`, `exports/raw_bundle/raw_session_bundle.json`, and `exports/rlds/rlds_manifest.json`

Claim rules:

- `smoke_contract` proves a deterministic local contract only.
- `native_world_model` or `neoverse_production` proof requires a configured runtime service and runtime probe artifacts from that service.
- Validation is downstream and optional; it does not own raw capture, package assembly, WebApp buyer access, or public readiness.

### WebApp local evidence

WebApp proof may include:

- internal pipeline attachment payload accepted by `/api/internal/pipeline/attachments`
- real upstream ids: `site_submission_id`, `request_id`, `buyer_request_id`, `capture_job_id`
- no placeholder/generated upstream ids unless explicitly marked as placeholder-only proof
- inbound request `pipeline`, `derived_assets`, `deployment_readiness`, and `ops.proof_path`
- hosted entitlement state from marketplace entitlement records
- runtime artifact resolution for `site_world_spec`, `site_world_registration`, `site_world_health`, scene memory, conditioning, presentation manifest, and runtime demo manifest
- runtime handle probe response from `/v1/site-worlds/{site_world_id}` and `/v1/site-worlds/{site_world_id}/health`
- hosted session record, live runtime metadata, runtime session state, and export artifacts

Claim rules:

- WebApp sync with `sync_not_configured` is not hosted proof.
- Artifact-backed presentation demo is not the same as live runtime proof.
- Runtime-only launch requires a live runtime handle and launchable health response.
- Protected buyer launch requires robot-team/admin access or a provisioned hosted-session entitlement.
- Current launch-readiness code does not enforce qualification or human-action blockers as a hosted launch blocker; those must remain separate proof packet fields unless a future WebApp change explicitly wires them into launch readiness.

## Provider proof gates

Provider proof must name the provider, run id, input artifact checksums, output artifact URIs, status, and failure mode.

### Geometry provider

`world_model_ready_claim_allowed` may only become true when the same-capture packet has a geometry summary with all of:

- `geometry_source == "video_to_world"`
- `fallback_used == false`
- `provider_native_result == true`
- `site_frame_available == true`
- `scale_resolved == true`
- `ready_for_world_model == true`
- `geometry_live_ready == true`

Blocked states:

- `fallback_geometry_not_live_video_to_world`
- `geometry_source_not_video_to_world:<source>`
- `provider_native_geometry_missing`
- `scale_not_proven`
- `android_xr_video_only_requires_explicit_geometry_contract`
- missing `VIDEO_TO_WORLD_URL`
- missing `VIDEO_TO_WORLD_RUNNER_TOKEN`

### Privacy providers

Privacy processing must fail closed. A packet may cite privacy-safe world-model input only when the privacy manifest and verification report show a completed safe path:

- no people detected and final video emitted, or
- person removal/anonymization completed and verification passed

Blocked states:

- privacy pipeline disabled in a production proof context
- SAM3/VIP/Depth Anything/DeepPrivacy2 runner failure when fail-closed is required
- raw walkthrough used as provider input without explicit internal bypass labeling
- `BLUEPRINT_ALLOW_RAW_WORLDLABS_BYPASS=true` used as production proof

### World-model/native runtime providers

Provider proof requires an owner-system artifact, not just adapter input:

- provider operation manifest/run id
- input package uri/checksum
- output package uri/checksum
- model/runtime identity
- cost/latency/status, if provided by provider
- provider-native error/fallback state

Adapter-input artifacts alone remain local package proof.

## Hosted proof gates

Hosted proof is separate from provider proof.

Minimum hosted live proof:

- WebApp attachment sync accepted with real upstream ids.
- Site-world artifacts are resolvable from WebApp.
- `site_world_registration.json` includes a runtime handle.
- Runtime responds to `/v1/site-worlds/{site_world_id}`.
- Runtime health responds with `launchable: true`, unless an explicit unsafe override is recorded as unsafe/non-production.
- Protected route has robot-team/admin/session-owner access or provisioned hosted-session entitlement.
- Runtime session creation returns a session id and runtime metadata.
- At least one session state/read/render or export artifact is recorded for the same session.

Presentation-demo states:

- `presentation_assets_missing`: not hosted launchable.
- `presentation_ui_unconfigured`: artifact-backed only, not live UI proof.
- `presentation_ui_live`: presentation viewer proof, still separate from runtime-only session execution.
- `runtime_live_ready`: runtime-only launch proof if access, handle, health, and session execution are present.

## Rights and privacy gates

Capture-side rights metadata can prove only what was recorded:

- consent status
- permission document URI, if present
- consent scope and notes
- redaction required
- capture basis
- derived scene/data licensing/payout booleans

Pipeline-side privacy artifacts can prove only processing/verification status.

Rights clearance proof requires an explicit rights/compliance review artifact and cannot be inferred from:

- open capture acknowledgement alone
- in-app copy
- `rights_profile`
- upload completion
- privacy processing completion
- WebApp public polish
- local tests

Commercialization is blocked or unknown if rights status is absent, unclear, expired, disputed, restricted, or requires counsel/operator decision.

## Human-gated proof

Human-gated blockers must use a durable packet with:

- stable blocker id
- owner
- exact decision needed
- default fast path, if allowed
- default durable path, if allowed
- repo/report/issue path where the reply must be recorded
- correlation key for Slack/email/report handoff
- explicit resume condition

Until the reply is recorded in the owning artifact, packet status must remain `awaiting_human_decision` or `blocked`; never upgrade to `done`.

## Claim transition matrix

| Claim | Required proof | Forbidden shortcut |
| --- | --- | --- |
| `same_capture_lineage_repo_proven` | Capture raw ids, descriptor, QA, handoff, pipeline outputs, and WebApp ids all match | Matching `scene_id`/`capture_id` alone |
| `webapp_upstream_links_verified` | Non-empty, non-placeholder `site_submission_id`, `request_id`, `buyer_request_id`, `capture_job_id` | Placeholder fallback, generated IDs, skipped sync |
| `world_model_ready_claim_allowed` | Same-capture lineage plus live `video_to_world` geometry gate | local SFM, fallback geometry, adapter input only |
| `hosted_review_claim_allowed` | WebApp upstream ids plus hosted artifacts/runtime/access proof for the same capture | `sync_not_configured`, artifact-backed demo only, public sample copy |
| `rights_cleared_claim_allowed` | Rights/compliance artifact and allowed commercialization scope | rights acknowledgement, redaction_required, privacy processing only |
| `operational_launch_ready_claim_allowed` | Owner-system proof for provider/runtime, WebApp access, rights, payments/payouts if claimed, Paperclip/live ops if claimed, city-launch if claimed, and no human gate pending | local tests, public route polish, shadow proof, generated docs |

## Safe verification commands

These are local-only commands appropriate for future packet production. They were not required to be run for this map.

```bash
# CapturePipeline
PYTHONDONTWRITEBYTECODE=1 pytest \
  tests/test_same_capture_lineage.py \
  tests/test_geometry_stage.py \
  tests/test_privacy_processing.py \
  tests/test_privacy_runner_service.py \
  tests/test_webapp_sync.py \
  tests/test_site_world_packaging.py \
  tests/test_native_runtime_service.py

# Contracts
PYTHONDONTWRITEBYTECODE=1 pytest tests

# Validation
PYTHONDONTWRITEBYTECODE=1 pytest \
  tests/test_preflight.py \
  tests/test_hosted_session.py \
  tests/test_runtime_backends.py \
  tests/test_runtime_service_app.py \
  tests/test_runtime_layer_grounding.py

# Capture iOS, simulator only
xcodebuild test -project BlueprintCapture.xcodeproj -scheme BlueprintCapture \
  -destination "platform=iOS Simulator,name=${BLUEPRINT_IOS_SIMULATOR_NAME:-iPhone 17 Pro}" \
  -derivedDataPath build/DerivedData \
  -only-testing:BlueprintCaptureTests/PipelineContractTests \
  -only-testing:BlueprintCaptureTests/CaptureRawContractV3ValidatorTests \
  -only-testing:BlueprintCaptureTests/CaptureBundleAndInferenceTests \
  -only-testing:BlueprintCaptureTests/RuntimeConfigTests

# Capture Android, local unit tests only
cd android && ./gradlew testDebugUnitTest

# WebApp targeted route/unit checks
npm exec -- vitest run \
  server/tests/pipeline-routes.test.ts \
  server/tests/pipeline-state-machine.test.ts \
  server/tests/site-world-sessions.test.ts \
  server/tests/hosted-session-launch-readiness.test.ts \
  server/tests/hosted-session-orchestrator.test.ts
```

Forbidden under this packet objective:

- provider jobs or paid model runs
- production Firestore/Firebase/Render/Redis/Stripe/Paperclip mutation
- Slack, Gmail, SendGrid, Notion, or human-send side effects
- live WebApp sync unless pointed at an approved non-production target
- raw World Labs bypass as production proof
- real customer, city-live, payment, payout, hosted fulfillment, or rights-clearance claims without owner-system proof

## Acceptance rule

A valid packet must fail closed. Missing provider, hosted, rights, payment, production, or human proof must stay explicit in the corresponding proof class and must not be converted into operational launch readiness by local artifact success.
