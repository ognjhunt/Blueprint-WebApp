# Blocker Title

Prove the API-backed CI deploy owner, then disable Render auto-deploy

## Blocker Id

`human-blocker:webapp-render-deploy-hook-2026-07-20`

## Status

Activation in progress; the credential/configuration request was answered on
2026-07-21 and is no longer human-gated.

## Current State

GitHub Actions now has the `RENDER_API_KEY` secret and
`RENDER_SERVICE_ID` repository variable. PR #418 merged as
`41e17825f8716efa91a9dfc99f5329ad0544a02f`, and an authenticated Render API
deploy put that exact SHA live. Production `/health` and `/health/ready` both
return 200 after configuring beta capacity at 100 total invites and 25 daily
admissions.

The remaining defect is repository deployment ownership. Main CI run
`29828655494` passed check, rules emulator, tests, e2e, and build, then failed
only because `.github/workflows/ci.yml` still contained an obsolete
`RENDER_DEPLOY_HOOK_URL` job. That failure prevented the intended
workflow-run-gated deploy workflow from owning the release. Render native
auto-deploy remains enabled as a temporary recovery path.

## Required Closeout

1. Merge the follow-up that removes the duplicate in-CI deploy job and makes
   `.github/workflows/deploy.yml` call Render's authenticated API with the exact
   successful `workflow_run.head_sha`.
2. Observe one hosted deploy become live and verify its uploaded evidence,
   exact `/version.json` SHA, `/health`, and `/health/ready`.
3. Disable Render native auto-deploy and retrieve the service configuration to
   prove `autoDeploy: no`.
4. Rotate the API key that was exposed in chat, replace the GitHub secret, and
   re-prove authenticated access without printing the replacement value.

## Risk

Disabling provider auto-deploy before the replacement workflow proves itself
could stop production releases. Leaving it enabled after proof allows a main
push to begin deploying before CI finishes.

## Execution Owner

`webapp-codex` for workflow implementation and hosted proof;
`blueprint-cto` for final credential rotation if provider policy requires an
owner-generated replacement.

## Evidence

- PR #418 merged at `41e17825f8716efa91a9dfc99f5329ad0544a02f`.
- Render deploy `dep-d9fm74vavr4c73ci0gs0` became live for that exact SHA.
- `GET /version.json` returned the exact merge SHA after the redeploy.
- `GET /health` returned 200.
- `GET /health/ready` returned 200 with `blocker_count: 0`.
- GitHub Actions contains the secret name `RENDER_API_KEY` and repository
  variable name `RENDER_SERVICE_ID`; values are not written to this file.

## Non-Scope

This authorization does not permit exposing the API key, deploying an
unreviewed SHA, bypassing CI, changing the production domain, or treating API
request acceptance as successful-deployment proof.
