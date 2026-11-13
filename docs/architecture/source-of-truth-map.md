# Source Of Truth Map

Updated 2026-11-12. Which file or system decides what, so that doctrine,
generated artifacts, runtime state and history are not confused.

## Canonical doctrine

- The shared block of `PLATFORM_CONTEXT.md`: what Blueprint is (the job packet; owner direction 2026-11-12). Where any other file disagrees, this block is right.
- `AGENTS.md`: working rules for every agent, the only hard stops (privacy, rights, money) and the words to use.
- `VISION.md`, `WORLD_MODEL_STRATEGY_CONTEXT.md`: their shared blocks, read with the frame above.
- `DEPLOYMENT.md`: deployment path, runtime stack and required env.
- `package.json`: the command registry.
- `docs/architecture/capture-upload-sessions.md`, `docs/architecture/autonomous-scene-intake.md`: upload, consent and Pipeline intake boundaries.
- `docs/company/`, `docs/onboarding/`: handbook and onboarding drafts; legal, HR and payroll terms stay drafts until counsel/PEO review.

## Wording people agreed to

Terms, Privacy, their previous versions and the consent statements
(`client/src/lib/legalAcceptance.ts`, `jobCardAnswerConsent.ts`,
`recordingRightsStatement.ts`, `siteStartConsent.ts`) record what a person
accepted. They change only with a new version and the owner. No statement
recorded so far covers sending a site's video or simulation to a deployment
company.

## Code truth

- Routes: `client/src/app/routes.tsx`, `server/routes.ts`.
- Pipeline bridge: `server/routes/internal-pipeline.ts`, `server/utils/pipelineStateMachine.ts`.
- Early-trial results: `docs/architecture/task-evaluation-result-delivery.md`, `server/routes/task-evaluation-results.ts`.
- Money: `server/utils/agentSpendPolicy.ts`, `server/utils/agentSpendLedger.ts`; Stripe routes.
- Language-model tasks: `server/agents/`. Live action authority is gated by `server/agents/autoagent-production-action-registry.ts` (dry-run by default).

## Live systems (each only for what it owns)

- Firestore: job and request state, ledgers, admin-visible state.
- Firebase Auth/Admin: identity.
- Stripe: payment and webhook truth.
- Redis: live state when `REDIS_URL` is set.
- Render: the deployed service, health checks and production env.
- Notion: workspace and visibility, not the execution record.

Do not claim live readiness from repo tests alone when the claim depends on a live system.

## Not authority

- `docs/archive/` (history before 2026-11-12)
- graphify output, `derived/`, `output/`, `coverage/`, `.tmp/`, `dist/`
- Hermes KB summaries under `knowledge/`
- demo fixtures, sample listings, local-only flags
- AI-authored summaries without matching code, artifact or runtime evidence

## Conflict resolution

1. The shared block of `PLATFORM_CONTEXT.md`, then `AGENTS.md`.
2. Current code and tests for the contract in question.
3. Fresh runtime artifacts or live systems when the question is operational.
4. Everything else is history unless it is current and backed by code.
5. If doctrine and code disagree, report it with file paths before rewriting product meaning.
