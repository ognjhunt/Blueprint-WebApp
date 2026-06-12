# Source Of Truth Map

Date: 2026-05-14

Purpose: make authority boundaries explicit so engineers and agents do not confuse doctrine, generated artifacts, runtime state, and historical reports.

## Canonical Doctrine Files

Treat these as repo-authoritative definitions unless a newer explicit doctrine update supersedes them:

- `AGENTS.md`: agent read order, working rules, human gates, CI posture, and graphify rules.
- `PLATFORM_CONTEXT.md`: platform doctrine, product center of gravity, cross-repo lifecycle, and truth hierarchy.
- `WORLD_MODEL_STRATEGY_CONTEXT.md`: world-model strategy, swappable model posture, and product implications.
- `AUTONOMOUS_ORG.md`: Blueprint autonomous org structure, Paperclip/Notion/repo truth roles, and loop closeout expectations.
- `DEPLOYMENT.md`: deployment path, runtime stack, required env, and operational launch notes.
- `package.json`: actual npm command registry.
- `CLAUDE.md`: shared AI guidance despite the filename.
- `docs/ai-tooling-adoption-implementation-2026-04-07.md`: approved AI-tooling adoption posture.
- `docs/ai-skills-governance-2026-04-07.md`: allowed/disallowed AI-tooling and skill rules.
- `docs/architecture/autoagent-autoresearch-operating-policy.md`: repo-authoritative near-zero-human AutoAgent/AutoResearch operating tiers and blocked autonomous actions.
- `docs/architecture/autonomous-kpi-live-source-contract.md`: repo-local live-source contracts for KPI rows that must stay `Source needed` until owner-system evidence exists.
- `docs/architecture/public-display-ready-claims-matrix.md`: Public Display Ready vs Operational Launch Ready claim rules for docs, agents, and buyer pages.
- `docs/architecture/site-specific-robot-deployment-readiness-wedge-2026-06-02.md`: WebApp PMF wedge doctrine for public robot-eval positioning, allowed category claims, deliverables, buyer scope, and blocked unsupported readiness proof.
- `docs/architecture/real-site-robot-eval-dataset-sync-boundary-2026-06-03.md`: WebApp consumer boundary for Pipeline robot-eval dataset artifacts and advisory-only display rules.
- `docs/company/`: repo-canonical employee handbook and policy drafts until counsel/PEO-approved systems adopt final versions.
- `docs/onboarding/`: repo-canonical onboarding journeys for humans, managers, AI agents, role scorecards, and Notion IA.

When these files disagree with older reports, generated summaries, graph output, or external skill packs, these files win.

## Product And Contract Truth

- Public route truth starts in `client/src/app/routes.tsx`.
- Public real-site robot eval dataset truth starts in `client/src/pages/Home.tsx`, `client/src/pages/ReadinessPack.tsx`, `client/src/pages/Pricing.tsx`, `client/src/pages/Proof.tsx`, `client/src/pages/Contact.tsx`, `client/src/pages/RobotTeamEval.tsx`, `client/src/lib/captureGroundedLanguage.ts`, `client/src/lib/contactRequestPrefill.ts`, `client/src/lib/robotTeamTestSubmission.ts`, `client/src/components/site/ContactForm.tsx`, and `server/routes/site-content.ts`.
- Structured robot-team submission truth starts in `client/src/lib/robotTeamTestSubmission.ts` and the WebApp `policy.robotTeamTestSubmission` field passed through `server/routes/site-world-sessions.ts`, `client/src/types/hostedSession.ts`, and `server/types/hosted-session.ts`. The six current submission modalities are policy API endpoint, Docker container, recorded action trace, high-level skill trace, teleop demo, and sim controller plugin.
- Public editorial visual truth for the humanoid readiness wedge starts in `client/src/lib/editorialGeneratedAssets.ts`, `client/src/lib/siteEditorialContent.ts`, and the project-bound generated assets under `client/public/generated/humanoid-readiness-2026-06-03/`.
- Public catalog/listing disclosure truth starts in `client/src/lib/siteWorldCommercialStatus.ts`, `client/src/data/siteWorlds.ts`, `server/routes/site-worlds.ts`, and `server/utils/site-worlds.ts`.
- Hosted-session truth starts in `server/routes/site-world-sessions.ts`, `server/types/hosted-session.ts`, and `client/src/types/hostedSession.ts`. Hosted-session policy payloads may carry `robotTeamTestSubmission`, but that payload is artifact-reference input only and does not prove robot readiness, safety validation, simulator completion, rights clearance, or policy pass/fail outcome.
- Inbound request and pipeline bridge truth starts in `server/types/inbound-request.ts`, `client/src/types/inbound-request.ts`, `server/routes/inbound-request.ts`, `server/routes/internal-pipeline.ts`, and `server/utils/pipelineStateMachine.ts`.
- Real-site robot evaluation dataset display truth starts in Pipeline artifacts under `pipeline/robot_eval_dataset/` plus CPU pre-GPU support artifacts under `pipeline/simulation_automation/`, including `robot_team_test_submission_modalities.json`, `scene_asset_inventory.json`, `scene_asset_dependency_audit.json`, `collider_proxy_plan.json`, `task_anchor_proposal_manifest.json`, `spawn_pose_validation_manifest.json`, `cpu_preflight_manifest.json`, `pre_gpu_readiness_summary.json`, `gpu_handoff_packet.json`, `gpu_owner_system_proof_schema.json`, `owner_gpu_simulator_execution_blocked_manifest.json`, `cpu_preflight_scorecard.json`, `episode_spec_manifest.json`, and `cpu_simulator_preflight_manifest.json`, then WebApp's advisory-only sync fields in `server/types/inbound-request.ts`, `client/src/types/inbound-request.ts`, `server/utils/pipelineAttachmentContract.ts`, `server/utils/pipelineStateMachine.ts`, and `server/utils/site-task-deployment-confidence.ts`.
- Site-triggered robot-eval job request truth starts in `client/src/lib/robotEvalJobRequest.ts`, `client/src/components/site/RobotEvalJobRequestButton.tsx`, `server/routes/robot-eval-job-requests.ts`, and `server/utils/robotEvalJobRequests.ts`. Accepted `robot_eval_job_request.v1` records must carry `buyer_request_id`, `site_submission_id`, `capture_job_id`, `capture_id`, and the six policy modalities. WebApp-created requests also carry `execution_request.schema_version=blueprint.robot_eval_execution_request.v1`, which says WebApp queues/forwards only, `BlueprintCapturePipeline` owns simulator scheduling and GPU allocation, CPU preflight gates GPU spend, and WebApp does not approve GPU allocation, simulator execution, or public claim upgrades. Pipeline may sync `robot_eval_scheduler_decision_uri`, `robot_eval_worker_launch_plan_uri`, `robot_eval_worker_manifest_uri`, `robot_eval_gpu_provider_launch_request_uri`, `robot_eval_gpu_provider_launcher_result_uri`, `robot_eval_runpod_provider_adapter_result_uri`, `robot_eval_gpu_cost_control_ledger_uri`, `robot_eval_startup_architecture_audit_uri`, `robot_eval_worker_runtime_manifest_uri`, and `robot_eval_worker_runtime_preflight_uri` back as startup-state artifacts, but those only describe scheduling, worker image/cache, provider-launch request/result shape, provider-adapter request/submission status, budget/time/worker limits, provider gates, runtime preflight/finalizer status, and blockers; they remain advisory until owner-runtime proof exists and do not prove simulator execution. The local Pipeline inbox fallback is `output/pipeline/robot_eval_job_requests/inbox/` unless `ROBOT_EVAL_JOB_REQUEST_INBOX_DIR` overrides it. Optional live forwarding to the Pipeline intake service is controlled by `ROBOT_EVAL_JOB_REQUEST_FORWARD_URL`, `ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN`, `ROBOT_EVAL_JOB_REQUEST_FORWARD_REQUIRED`, and `ROBOT_EVAL_JOB_REQUEST_FORWARD_TIMEOUT_MS`. When the live Pipeline control plane requires an exact capture-root match, `ROBOT_EVAL_JOB_REQUEST_FORWARD_CAPTURE_ROOT_BY_SITE_JSON` or the narrower single-root fallback `ROBOT_EVAL_JOB_REQUEST_FORWARD_CAPTURE_ROOT` may override only the forwarded envelope's `site_package.capture_root`, preserving the WebApp/public root in `site_package.webapp_capture_root`. Forwarding is handoff automation only and does not prove simulator execution, safety, or robot readiness.
- Robot-eval forwarding startup readiness truth starts in `scripts/pipeline/audit-robot-eval-forwarding-readiness.ts` and the `npm run pipeline:forwarding:preflight` command. The default report validates forwarding URL/token/timeout/capture-root override configuration and writes `output/pipeline/robot_eval_job_requests/forwarding_preflight.json` with secrets redacted. `-- --probe-intake-audit` performs only a read-only `GET /api/live-pipeline/intake-audit`; it proves endpoint/token reachability, not route submission, queued jobs, GPU allocation, simulator execution, safety, or robot readiness.
- Local WebApp route-to-Pipeline forwarding proof truth starts in `scripts/pipeline/run-first-gpu-webapp-route-forwarding-proof.ts` and the `npm run pipeline:first-gpu:route-forwarding-proof` command. It starts a local WebApp route and POSTs a generated non-rehearsal `robot_eval_job_request.v1` through `/api/robot-eval/job-requests` to the configured Pipeline intake URL. When pointed at a local/staging intake it proves local route submission and Pipeline intake staging only; with a live URL it is a Pipeline intake write. It does not prove full production WebApp deployment, GPU allocation, simulator execution, safety, or robot readiness.
- Local first-GPU request rehearsal truth starts in `scripts/pipeline/export-first-gpu-webapp-rehearsal-request.ts` and the `npm run pipeline:first-gpu:rehearsal-request` command. It emits a `robot_eval_job_request_inbox.v1` envelope with `source_kind=local_first_gpu_rehearsal_request` and `local_rehearsal_only=true`; it proves WebApp request construction only, not public route submission, live forwarding, simulator execution, safety, or robot readiness.
- Stripe/entitlement truth starts in `server/routes/stripe.ts`, `server/routes/stripe-webhooks.ts`, `server/routes/marketplace.ts`, `server/routes/marketplace-entitlements.ts`, and relevant tests.
- Agent runtime truth starts in `server/agents/`, `server/routes/admin-agent.ts`, `server/routes/paperclip-relay.ts`, and the Paperclip package under `ops/paperclip/`. AutoAgent/AutoResearch live action authority is specifically gated by `server/agents/autoagent-production-action-registry.ts`, which defaults to dry-run and allowlists only named production action types.
- Autonomous KPI source-status truth starts in `docs/architecture/autonomous-kpi-live-source-contract.md`, `server/utils/kpiLiveSourceStatus.ts`, and repo-local snapshots consumed by `scripts/autonomy/generate-kpi-source-status.ts`. Notion KPI rows may mirror these artifacts later, but missing live owner-system evidence remains `Source needed`.
- Employee/onboarding policy truth starts in `docs/company/` and `docs/onboarding/`, with legal/HR/payroll/benefits terms remaining draft until counsel/PEO-reviewed documents and live HR/payroll systems adopt them.

For cross-repo contracts, verify the corresponding `BlueprintCapture` and `BlueprintCapturePipeline` docs/artifacts before assuming WebApp alone proves readiness.

## Derived And Support Docs

These are useful orientation or planning surfaces, but they are support layers:

- `docs/architecture/ai-onboarding-map.md`
- `docs/architecture/source-of-truth-map.md`
- `docs/architecture/command-safety-matrix.md`
- `docs/architecture/refactor-hotspots.md`
- `docs/integration-architecture.md`
- `docs/autonomous-loop-evidence-checklist-2026-05-03.md`
- `docs/onboarding/notion-information-architecture.md`
- city-launch system docs under `docs/city-launch-system-*.md`
- Paperclip runbooks under `docs/paperclip-*.md` and `ops/paperclip/*.md`

If a support doc conflicts with canonical doctrine or current code, update or label the support doc rather than changing doctrine by implication.

## Generated Artifacts

Generated artifacts can contain useful evidence, but they are not authority by themselves:

- `graphify-out/GRAPH_REPORT.md`, `graphify-out/graph.json`, `graphify-out/PILOT_METADATA.json`
- `derived/graphify/**`
- `output/**`
- `coverage/**`
- `.tmp/**`
- `dist/**`
- `ops/paperclip/reports/**`
- generated city-launch, GTM, readiness, and scorecard artifacts under `ops/paperclip/playbooks/**`

Generated reports should be treated as snapshots. Prefer newer manifests, current code paths, and live/runtime state over older report prose.

## Live And Runtime Truth Systems

These systems can be authoritative for operational state, but only for the state they own:

- Firestore: request state, entitlements, ledgers, operating graph projections, admin-visible app state.
- Firebase Auth/Admin: identity and authenticated request boundaries.
- Stripe and Stripe Connect: checkout, payment, webhook, payout, and account truth.
- Redis: live hosted-session state when `REDIS_URL` is configured; in-process fallback is less durable.
- Render: deployed WebApp service, health checks, and production env.
- Paperclip: execution record, issues, routines, delegated runs, blocker ownership, and agent activity.
- Notion: workspace, knowledge, review, and operator visibility surface, not the execution record.
- Gmail/Slack human-reply systems: founder/human reply durability only when configured and correlated to blocker ids.

Do not claim live readiness from repo tests alone when the claim depends on one of these live systems.

## Explicit Non-Authorities

The following must not be treated as source of truth for current product direction, readiness, or live operations:

- graphify output
- Hermes KB summaries
- old reports in `output/**` or `ops/paperclip/reports/**`
- generated city-launch or GTM summaries without current manifest/runtime verification
- external skill packs under `ops/paperclip/external/**`
- archived or stale docs
- demo fixtures, planned profiles, sample public listings, or local-only flags
- AI-authored summaries without matching code, artifact, or runtime evidence

They can point you toward evidence. They cannot replace evidence.

## Conflict Resolution

1. Start with canonical doctrine files.
2. Check current code and tests for the relevant contract.
3. Check fresh runtime artifacts or live systems when the question is operational.
4. Treat older docs and generated summaries as historical unless they are explicitly current and backed by current code.
5. If doctrine and implementation disagree, report the disagreement with file paths before rewriting product meaning.
