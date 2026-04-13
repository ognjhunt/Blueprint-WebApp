# WebApp Launch Readiness Run

Date: 2026-04-12

Owner: `webapp-codex`

## Goal

Establish truthful current-state launch readiness for `Blueprint-WebApp`, remove any validation-path noise that blocks reliable execution, and leave a durable operator-facing snapshot with the next priority queue.

## Current Company State Snapshot

- Product doctrine remains intact: Blueprint is capture-first and world-model-product-first, with Exact-Site Hosted Review as the current wedge.
- Repo state is active and mid-flight: there is substantial existing city-launch and admin-growth work already present in the working tree before this run.
- Local code health for the current repo state is strong enough to validate: typecheck, build, alpha check, and preflight all ran successfully after one harness fix.
- Live production readiness is green at the canonical site health endpoint.

## Priority Queue Ordered By Business Leverage

1. Keep launch truth trustworthy by maintaining a clean validation path for the webapp repo.
2. Preserve Exact-Site Hosted Review positioning against adjacent digital-twin and observability competitors by leaning harder into provenance, exact-site truth, and low-rewrite adoption.
3. Continue the city-launch execution work already in progress without breaking current launch readiness.
4. Expand optional growth and buyer lifecycle lanes only when they are configured and measured, not merely enabled.

## Evidence Consulted

- Required doctrine and operating files:
  - `PLATFORM_CONTEXT.md`
  - `WORLD_MODEL_STRATEGY_CONTEXT.md`
  - `AUTONOMOUS_ORG.md`
  - `DEPLOYMENT.md`
  - `package.json`
  - `docs/ai-tooling-adoption-implementation-2026-04-07.md`
  - `docs/ai-skills-governance-2026-04-07.md`
- Repo state:
  - `git status --short --branch`
  - `render.yaml`
  - `scripts/alpha-check.mjs`
  - `scripts/launch-smoke.mjs`
  - `vitest.config.ts`
  - `server/index.ts`
  - `server/routes/health.ts`
- Validation runs:
  - `npm run check`
  - `npm run build`
  - `npm run alpha:check`
  - `npm run alpha:preflight`
  - `BASE_URL=http://127.0.0.1:5050 npm run smoke:launch`
- Live deployment verification:
  - `curl -sS -D - https://tryblueprint.io/health/ready`
- Required post-edit graph refresh:
  - `bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz`
- External market evidence:
  - NVIDIA Isaac Sim / NuRec / OSMO
  - Siemens Digital Twin Composer / Process Simulate
  - Rockwell Emulate3D Factory Test
  - AWS IoT TwinMaker
  - Foxglove
  - Clearpath Husky Observer / Teleoperation
  - ABB RobotStudio HyperReality

## Action Taken

1. Read the required doctrine and repo operating context in the mandated order.
2. Assessed the live repo state and confirmed the current working tree was already dirty before this run.
3. Ran `npm run check` and `npm run build`.
4. Ran `npm run alpha:check` and found the validation path was polluted by coverage/sourcemap noise from generated `paperclip-desktop` bundles that are outside the webapp test target.
5. Updated `vitest.config.ts` to exclude `paperclip-desktop/**` from both test discovery and coverage.
6. Re-ran `npm run alpha:check` successfully.
7. Ran `npm run alpha:preflight` successfully in `local_test` mode.
8. Ran local production smoke against `http://127.0.0.1:5050` and captured the precise readiness blockers for the local environment.
9. Verified live deployment readiness directly at `https://tryblueprint.io/health/ready`.
10. Refreshed the required graphify architecture outputs.

## Result

### Repo Validation

- `npm run check`: passed
- `npm run build`: passed
- `npm run alpha:check`: passed after the Vitest exclusion fix
  - `827` assertions passed
  - `0` skipped
- `npm run alpha:preflight`: passed in `local_test` mode

### Harness Improvement

- The test harness is now cleaner and more truthful because generated `paperclip-desktop` bundles no longer flood the alpha check with irrelevant sourcemap warnings.
- File changed by this run:
  - `vitest.config.ts`

### Local Smoke Result

- `BASE_URL=http://127.0.0.1:5050 npm run smoke:launch` failed at `/health/ready` with a truthful `503 not_ready`.
- Local blockers were configuration-based, not code-failure-based:
  - Stripe secret/webhook config missing for enabled Stripe flows
  - autonomous research outbound enabled locally without Firehose, recipients, and topic configuration

### Live Deployment Health

- As of 2026-04-12, `https://tryblueprint.io/health/ready` returned `200 ready`.
- Live deployment reported:
  - `firebaseAdmin: true`
  - `redis: true`
  - `stripe: true`
  - `email: true`
  - `agentRuntime: true`
  - `autonomousAutomation: true`
- Live warnings remained only for optional voice and telephony paths, not launch-critical blockers.

### Market Signal

- The adjacent market is crowded around generic digital twins, observability, and remote inspection.
- Blueprint should continue to differentiate on:
  - exact-site review from real captures
  - provenance-forward truth
  - no-workflow-rewrite adoption posture

## Next Action

1. Treat the current repo state as launchable from a webapp-code perspective unless unrelated in-flight working-tree changes introduce new regressions.
2. Keep live deployment monitoring anchored to `https://tryblueprint.io/health/ready`.
3. Preserve the Vitest exclusion so alpha check remains a truthful signal instead of a generated-artifact noise channel.
4. Use the existing city-launch work already in progress as the next implementation lane, with Chicago/Austin/San Francisco expansion work reviewed against the same launch gates before release.
5. When running local production smoke in future sessions, either:
   - provide the required local alpha env values for enabled lanes, or
   - explicitly disable non-configured optional alpha lanes in the local runtime before using the smoke gate as a readiness proxy.

## Durable Artifacts

- This report: `ops/paperclip/reports/webapp-launch-readiness-2026-04-12.md`
- Validation harness change: `vitest.config.ts`
- Refreshed graph outputs:
  - `graphify-out/`
  - `derived/graphify/webapp-architecture/corpus/graphify-out/`
