# Blocker Title

Resolved: API-backed CI deploy ownership

## Blocker Id

`human-blocker:webapp-render-deploy-hook-2026-07-20`

## Status

Resolved on 2026-07-21. This blocker is closed.

## Current State

PR #419 merged as `1cf156f2e38127c3b2a38727232c7c7451d6646e`.
Main CI run `29836994895` passed check, rules emulator, tests, e2e, and build.
Workflow-run-gated deploy run `29837245844` then created provider deploy
`dep-d9fno0hkh4rs73cr9fsg` for that exact SHA. Its evidence recorded Render
status `live`, an exact public SHA match, `/health` 200, and `/health/ready`
200. Render service configuration was subsequently read back as
`autoDeploy: no`, leaving `.github/workflows/deploy.yml` as the single
production deploy owner.

## Remaining Separate Security Action

Rotate the API key that was exposed in chat, replace the GitHub secret, and
re-prove authenticated access without printing the replacement value. This is
a credential-containment task, not an open deployment-ownership blocker.

## Risk

Re-enabling provider native auto-deploy would recreate two competing deploy
paths and allow a main push to begin deploying before CI finishes.

## Execution Owner

`webapp-codex` for workflow implementation and hosted proof;
`blueprint-cto` for final credential rotation if provider policy requires an
owner-generated replacement.

## Evidence

- PR #419 merged at `1cf156f2e38127c3b2a38727232c7c7451d6646e`.
- Main CI run `29836994895` completed successfully.
- Gated deploy run `29837245844` completed successfully and uploaded evidence.
- Render deploy `dep-d9fno0hkh4rs73cr9fsg` became live for the exact merge SHA.
- `GET /version.json` returned the exact merge SHA.
- `GET /health` returned 200.
- `GET /health/ready` returned 200 with `blocker_count: 0`.
- Render service configuration returned `autoDeploy: no` after the update.
- GitHub Actions contains the secret name `RENDER_API_KEY` and repository
  variable name `RENDER_SERVICE_ID`; values are not written to this file.

## Non-Scope

This authorization does not permit exposing the API key, deploying an
unreviewed SHA, bypassing CI, changing the production domain, or treating API
request acceptance as successful-deployment proof.
