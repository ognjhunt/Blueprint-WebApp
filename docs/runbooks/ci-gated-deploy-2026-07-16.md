# CI-Gated Render Deploy — Runbook (2026-07-16)

Blueprint-WebApp has exactly one deploy owner: `.github/workflows/deploy.yml`.
Render-native auto-deploy is off (`render.yaml` `autoDeploy: false`).

## How a deploy happens

1. A commit lands on `main`.
2. The `CI` workflow runs (typecheck, rules parity, asset audit, contract
   verify, tests + worktree-mutation guard, e2e, build + build-output tests +
   isolated local smoke).
3. Only if CI concludes `success` does the `Deploy (Render, CI-gated)`
   workflow fire, POSTing the Render Deploy Hook pinned to the exact
   `workflow_run.head_sha`.
4. Render builds and serves that commit. `GET /version.json` on the live site
   reports the deployed `git_sha` (written by `scripts/generate-build-info.mjs`
   at build time) — verify it matches the green SHA.

Fail-closed properties:

- A red CI run never triggers the deploy job.
- A missing `RENDER_DEPLOY_HOOK_URL` secret errors the deploy job loudly; it
  never silently skips or falls back.
- No push to a non-main branch can deploy.

## One-time activation steps (human, Render + GitHub dashboards)

1. In Render: Service → Settings → confirm **Auto-Deploy is Off** (the
   render.yaml change governs Blueprint-synced services; confirm the dashboard
   agrees).
2. In Render: Service → Settings → **Deploy Hook** → create, copy URL.
3. In GitHub: repo → Settings → Secrets and variables → Actions → add
   `RENDER_DEPLOY_HOOK_URL` with that URL.
4. Recommended: branch protection on `main` requiring the CI workflow's
   `check`, `test`, `e2e`, and `build` jobs.

Until step 3 is done, merges to main do not deploy at all (fail-closed).

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
