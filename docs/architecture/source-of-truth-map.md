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
- Current Task Evaluation Run contract truth starts in `contracts/pipeline/decision-evidence-router.v1.json`, `server/utils/decisionEvidenceContract.ts`, `server/routes/robot-eval-job-requests.ts`, `client/src/pages/app/RunIntake.tsx`, and `client/src/pages/app/RunDetail.tsx`. `BlueprintCapturePipeline` owns evidence qualification, routing, normalized results, Decision Envelopes, and Physical Outcome Joins. WebApp owns secure decision intake, authorization, idempotency, durable state, redacted projection, and artifact access. The normal endpoint is `/api/task-evaluation-runs`; `/api/robot-eval/job-requests` and `robot_eval_job_request.v1` are explicit compatibility paths. Unknown states fail closed, abstention cannot infer a winner, and physical notes without authoritative exact-ID evidence cannot recalibrate methods.
- Public Task Evaluation Run truth starts in `client/src/pages/Home.tsx`, `client/src/pages/Pricing.tsx`, `client/src/pages/Proof.tsx`, `client/src/pages/Contact.tsx`, `client/src/pages/ForRobotTeams.tsx`, `client/src/pages/ForSiteOperators.tsx`, `client/src/pages/app/RunIntake.tsx`, `client/src/pages/app/RunDetail.tsx`, `client/src/lib/captureGroundedLanguage.ts`, `client/src/lib/contactRequestPrefill.ts`, `client/src/components/site/ContactForm.tsx`, and `server/routes/site-content.ts`.
- Structured robot-team submission truth starts in `client/src/lib/robotTeamTestSubmission.ts` and the WebApp `policy.robotTeamTestSubmission` field passed through `server/routes/site-world-sessions.ts`, `client/src/types/hostedSession.ts`, and `server/types/hosted-session.ts`. The six current submission modalities are policy API endpoint, Docker container, recorded action trace, high-level skill trace, teleop demo, and sim controller plugin.
- Public editorial visual truth for the humanoid readiness wedge starts in `client/src/lib/editorialGeneratedAssets.ts`, `client/src/lib/siteEditorialContent.ts`, and the project-bound generated assets under `client/public/generated/humanoid-readiness-2026-06-03/`.
- Public captured-site listing truth starts with the shared API types in `client/src/data/siteWorlds.ts` and owner-system reads in `server/routes/site-worlds.ts` plus `server/utils/site-worlds.ts`.
- Hosted-session truth starts in `server/routes/site-world-sessions.ts`, `server/types/hosted-session.ts`, and `client/src/types/hostedSession.ts`. Hosted-session policy payloads may carry `robotTeamTestSubmission`, but that payload is artifact-reference input only and does not prove generated-world rank fidelity, off-scope validation, simulator completion, rights clearance, or policy pass/fail outcome.
- Inbound request and pipeline bridge truth starts in `server/types/inbound-request.ts`, `client/src/types/inbound-request.ts`, `server/routes/inbound-request.ts`, `server/routes/internal-pipeline.ts`, and `server/utils/pipelineStateMachine.ts`.
- Real-site robot evaluation dataset display truth starts in Pipeline artifacts under `pipeline/robot_eval_dataset/` plus CPU pre-GPU support artifacts under `pipeline/simulation_automation/`, including `robot_team_test_submission_modalities.json`, `scene_asset_inventory.json`, `scene_asset_dependency_audit.json`, `collider_proxy_plan.json`, `task_anchor_proposal_manifest.json`, `spawn_pose_validation_manifest.json`, `cpu_preflight_manifest.json`, `pre_gpu_readiness_summary.json`, `gpu_handoff_packet.json`, `gpu_owner_system_proof_schema.json`, `owner_gpu_simulator_execution_blocked_manifest.json`, `cpu_preflight_scorecard.json`, `episode_spec_manifest.json`, and `cpu_simulator_preflight_manifest.json`, then WebApp's advisory-only sync fields in `server/types/inbound-request.ts`, `client/src/types/inbound-request.ts`, `server/utils/pipelineAttachmentContract.ts`, `server/utils/pipelineStateMachine.ts`, and `server/utils/site-task-deployment-confidence.ts`.
- Legacy site-triggered request truth remains in `client/src/lib/robotEvalJobRequest.ts`, `client/src/components/site/RobotEvalJobRequestButton.tsx`, and `server/utils/robotEvalJobRequests.ts` only for saved links, records, and explicit translation. It is not the primary request contract and its simulator preference must not survive translation into `blueprint.decision_evidence_request.v1`.
- Robot-eval forwarding startup readiness truth starts in `scripts/pipeline/audit-robot-eval-forwarding-readiness.ts` and the `npm run pipeline:forwarding:preflight` command. The default report validates forwarding URL/token/timeout/capture-root override configuration and writes `output/pipeline/robot_eval_job_requests/forwarding_preflight.json` with secrets redacted. `-- --probe-intake-audit` performs only a read-only `GET /api/live-pipeline/intake-audit`; it proves endpoint/token reachability, not route submission, queued jobs, GPU allocation, simulator execution, safety, or generated-world rank fidelity.
- Local WebApp route-to-Pipeline forwarding proof truth starts in `scripts/pipeline/run-first-gpu-webapp-route-forwarding-proof.ts` and the `npm run pipeline:first-gpu:route-forwarding-proof` command. It starts a local WebApp route and POSTs a generated non-rehearsal `robot_eval_job_request.v1` through `/api/robot-eval/job-requests` to the configured Pipeline intake URL. When pointed at a local/staging intake it proves local route submission and Pipeline intake staging only; with a live URL it is a Pipeline intake write. It does not prove full production WebApp deployment, GPU allocation, simulator execution, safety, or generated-world rank fidelity.
- Local first-GPU request rehearsal truth starts in `scripts/pipeline/export-first-gpu-webapp-rehearsal-request.ts` and the `npm run pipeline:first-gpu:rehearsal-request` command. It emits a `robot_eval_job_request_inbox.v1` envelope with `source_kind=local_first_gpu_rehearsal_request` and `local_rehearsal_only=true`; it proves WebApp request construction only, not public route submission, live forwarding, simulator execution, safety, or generated-world rank fidelity.
- Stripe/entitlement truth starts in `server/routes/stripe.ts`, `server/routes/stripe-webhooks.ts`, `server/routes/api/create-checkout-session.ts`, `server/routes/agent-access.ts`, `server/routes/marketplace-entitlements.ts`, and relevant tests. Legacy orders and entitlements remain readable, but new standalone site-package, hosted-session, and fixed-price robot-eval checkout creation returns an explicit retired-product response; new Task Evaluation Runs use scoped server-authoritative quotes.
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
