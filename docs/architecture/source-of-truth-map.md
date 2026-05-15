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
- `docs/architecture/public-display-ready-claims-matrix.md`: Public Display Ready vs Operational Launch Ready claim rules for docs, agents, and buyer pages.
- `docs/company/`: repo-canonical employee handbook and policy drafts until counsel/PEO-approved systems adopt final versions.
- `docs/onboarding/`: repo-canonical onboarding journeys for humans, managers, AI agents, role scorecards, and Notion IA.

When these files disagree with older reports, generated summaries, graph output, or external skill packs, these files win.

## Product And Contract Truth

- Public route truth starts in `client/src/app/routes.tsx`.
- Public catalog/listing disclosure truth starts in `client/src/lib/siteWorldCommercialStatus.ts`, `client/src/data/siteWorlds.ts`, `server/routes/site-worlds.ts`, and `server/utils/site-worlds.ts`.
- Hosted-session truth starts in `server/routes/site-world-sessions.ts`, `server/types/hosted-session.ts`, and `client/src/types/hostedSession.ts`.
- Inbound request and pipeline bridge truth starts in `server/types/inbound-request.ts`, `client/src/types/inbound-request.ts`, `server/routes/inbound-request.ts`, `server/routes/internal-pipeline.ts`, and `server/utils/pipelineStateMachine.ts`.
- Stripe/entitlement truth starts in `server/routes/stripe.ts`, `server/routes/stripe-webhooks.ts`, `server/routes/marketplace.ts`, `server/routes/marketplace-entitlements.ts`, and relevant tests.
- Agent runtime truth starts in `server/agents/`, `server/routes/admin-agent.ts`, `server/routes/paperclip-relay.ts`, and the Paperclip package under `ops/paperclip/`.
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
