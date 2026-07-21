# CI-Gated Render Deploy — Runbook (2026-07-16)

Blueprint-WebApp has exactly one deploy owner: `.github/workflows/deploy.yml`.
Render-native auto-deploy is off (`render.yaml` `autoDeploy: false`).

> **RESOLVED 2026-07-21 — deployment ownership is singular.** PR #419 merged as
> `1cf156f2e38127c3b2a38727232c7c7451d6646e`. Main CI run `29836994895`
> completed successfully, then workflow-run-gated deploy run `29837245844`
> created Render deploy `dep-d9fno0hkh4rs73cr9fsg` for that exact SHA.
>
> The deployment evidence records provider status `live`, an exact match
> between requested and public SHA, `/health` 200, and `/health/ready` 200.
> Render service configuration was then updated and read back as
> `autoDeploy: no`. `.github/workflows/deploy.yml` is now the only production
> deploy trigger.

Current-state refresh (2026-07-21): production serves
`1cf156f2e38127c3b2a38727232c7c7451d6646e`, `/health` and `/health/ready`
return 200, beta capacity is 100 total invites and 25 admissions per day, and
the provider reports native auto-deploy disabled. The Render API credential
shared in chat still requires rotation and replacement in GitHub Actions; that
security task is separate from deployment-owner activation.

## How a deploy happens

1. A commit lands on `main`.
2. The `CI` workflow runs (typecheck, rules parity, asset audit, contract
   verify, tests + worktree-mutation guard, e2e, build + build-output tests +
   isolated local smoke).
3. Only if CI concludes `success` does the `Deploy (Render, CI-gated)`
   workflow fire, POSTing Render's authenticated deploy API with the exact
   `workflow_run.head_sha` as `commitId`.
4. Render builds and serves that commit. `GET /version.json` on the live site
   reports the deployed `git_sha` (written by `scripts/generate-build-info.mjs`
   at build time) — verify it matches the green SHA.

Fail-closed properties:

- A red CI run never triggers the deploy job.
- A missing `RENDER_API_KEY` secret or invalid `RENDER_SERVICE_ID` variable
  errors the deploy job loudly; it never silently skips or falls back.
- No push to a non-main branch can deploy.

## One-time activation steps (Render + GitHub)

Completed on 2026-07-21:

1. In GitHub: repo → Settings → Secrets and variables → Actions, add the
   Render control-plane key as secret `RENDER_API_KEY`.
2. Add the production Render service ID as repository variable
   `RENDER_SERVICE_ID`.
3. Merge the API-workflow change and observe one exact-SHA deploy complete with
   a green `deploy-verification` artifact.
4. In Render: Service → Settings → set **Auto-Deploy** to **Off**. The
   `render.yaml` value governs Blueprint-synced services only; confirm the live
   service reports `autoDeploy: no` through the API.
5. Recommended: branch protection on `main` requiring the CI workflow's
   `check`, `test`, `e2e`, and `build` jobs.

All activation steps are complete. `.github/workflows/deploy.yml` is the only
production deploy owner. Rotate the exposed API key without changing these
ownership semantics.

## Manual redeploy / roll-forward

`Actions → Deploy (Render, CI-gated) → Run workflow` with the exact SHA to
deploy. Use only SHAs that have a green CI run.

## Rollback

Rollback is revert-commit based — never rewrite history:

```bash
node scripts/deploy-rollback.mjs --target <last-good-sha> \
  --health-url https://<service-host> \
  --verify-command "npm run check"
```

Push the revert commits to a branch, PR them to main, let CI go green, and the
deploy workflow ships the rollback commit. Verify `GET /version.json` and
`GET /health/ready` afterwards.

## Observability

- Deployed SHA: `GET /version.json` (`git_sha`, `built_at_iso`).
- Launch-critical dependency state: `GET /health/ready` (503 + blockers when
  not ready; `profile` field distinguishes the loopback-only local-smoke mode
  from standard production readiness).
