# CI-Gated Render Deploy — Runbook (2026-07-16)

Blueprint-WebApp has exactly one deploy owner: `.github/workflows/deploy.yml`.
Render-native auto-deploy is off (`render.yaml` `autoDeploy: false`).

> **OPEN INCIDENT — deploy ownership is NOT yet singular (refreshed 2026-07-21).**
> Evidence from the `1acc5a84` deploy: the gated workflow (run 29552846927)
> failed closed at 03:37:50Z because `RENDER_DEPLOY_HOOK_URL` was unset, yet
> the live site served `1acc5a84` with `built_at_iso 2026-07-17T03:34:55Z` —
> built *before* the workflow ran. Render-native dashboard auto-deploy is
> therefore still active, and the `render.yaml` `autoDeploy: false` setting is
> not in effect for this service (render.yaml governs Blueprint-synced
> services only). Until a human completes the one-time activation steps below
> — dashboard Auto-Deploy off + the authenticated API workflow proven — the
> repository must treat deployment ownership as
> `BLOCKED_RENDER_DEPLOY_OWNER_CONFIGURATION` and must not claim CI-gated
> deployment.
>
> The deploy workflow now also verifies completion: after triggering the hook
> it polls `GET /version.json` until the exact requested SHA is live, then
> checks `/health` and `/health/ready` separately and uploads a
> `deploy-verification` artifact. A deploy-hook 2xx is never treated as
> deployment success.

Current-state refresh (2026-07-21): PR #418 merged as
`41e17825f8716efa91a9dfc99f5329ad0544a02f` and that exact SHA is live.
Production `/health` and `/health/ready` both return 200 after setting beta
capacity to 100 total invites and 25 admissions per day. GitHub Actions now
holds `RENDER_API_KEY` and `RENDER_SERVICE_ID`, but Render still reports
`autoDeploy: yes`. Main CI run `29828655494` therefore passed every substantive
gate but failed its duplicate, obsolete deploy-hook job. The follow-up removes
that duplicate and makes `.github/workflows/deploy.yml` the API-backed single
owner. Do not close this incident or disable provider auto-deploy until the
follow-up workflow succeeds end to end.

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

1. In GitHub: repo → Settings → Secrets and variables → Actions → add the
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

Until step 3 is proven, keep Render native auto-deploy enabled as the recovery
path. After step 4, `.github/workflows/deploy.yml` is the only production deploy
owner.

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
