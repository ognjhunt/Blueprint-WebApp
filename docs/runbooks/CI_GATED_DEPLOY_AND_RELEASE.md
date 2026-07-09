# CI-Gated Deploy, Release Stamp, and Rollback Runbook

Remediation for audit findings **R045** (Render autoDeploy decoupled from CI — a
red build could deploy to production) and **R046** (no versioned release
artifact, deploy SHA/tag, or rollback target).

## TL;DR

- Render `autoDeploy` is now **off** (`render.yaml`).
- Production deploys only after **CI passes on `main`**, via
  `.github/workflows/deploy.yml` calling a Render Deploy Hook, pinned to the
  exact green SHA (`?ref=<sha>`).
- Every build stamps `dist/public/version.json` with the git SHA + version
  (`scripts/generate-build-info.mjs`, wired into `npm run build`), readable live
  at `GET /version.json`.
- Rollback = read the last-good SHA, then run `scripts/rollback-deploy.sh`.

---

## R045 — CI-gated deploy flow

### What config now enforces

1. `render.yaml` sets `autoDeploy: false`, so a git push to the release branch no
   longer ships to production on its own.
2. `.github/workflows/deploy.yml` deploys via a Render Deploy Hook using the
   `workflow_run` trigger:
   - It fires after the **CI** workflow completes on `main`.
   - The `deploy` job runs only when `github.event.workflow_run.conclusion == 'success'`.
   - A red CI run therefore never triggers a deploy.
   - The hook is called with `?ref=<head_sha>` so Render builds the exact commit
     that passed CI.
3. A `workflow_dispatch` path lets an operator deploy an explicit SHA on demand
   (roll-forward of a known-good commit).

### Required human/dashboard steps (cannot be done from the repo)

1. **Confirm Auto-Deploy is OFF in the Render dashboard.**
   `render.yaml autoDeploy: false` is authoritative for Blueprint-synced
   services, but a service created before this change keeps its dashboard toggle.
   Render → service `blueprint-webapp` → **Settings → Build & Deploy →
   Auto-Deploy → Off**.

2. **Create a Render Deploy Hook and store it as a GitHub Actions secret.**
   - Render → service → **Settings → Deploy Hook → Copy** (the URL already
     contains the `?key=...` token — treat it as a secret).
   - GitHub → repo **Settings → Secrets and variables → Actions → New repository
     secret**:
     - Name: `RENDER_DEPLOY_HOOK_URL`
     - Value: the copied hook URL.
   - Until this secret exists, `deploy.yml` fails fast with a clear error and does
     not silently skip the deploy.

3. **(Ties to R044) Require CI before merge on `main`.**
   Branch protection is what guarantees only green commits land on `main` and
   therefore only green commits deploy. GitHub → **Settings → Branches →
   `main` → Require status checks to pass before merging**, and add the CI jobs
   (`check`, `test`, `e2e`, `build`) as required.

### Verifying the gate

- Push a branch with a deliberately failing test, open a PR, merge is blocked by
  branch protection → no deploy.
- On a green merge to `main`, watch Actions: **CI** runs, then **Deploy (Render,
  CI-gated)** runs and reports the HTTP status from the Deploy Hook.

---

## R046 — Versioned release artifact + rollback target

### Build stamp

`scripts/generate-build-info.mjs` runs at the end of `npm run build` and writes
`dist/public/version.json`:

```json
{
  "name": "blueprint-webapp",
  "version": "1.0.0",
  "gitSha": "<40-char sha>",
  "gitShaShort": "<12-char sha>",
  "gitBranch": "main",
  "release": "v1.0.0+<12-char sha>",
  "buildTime": "2026-07-09T00:00:00.000Z",
  "ciRunId": "<github run id or null>",
  "nodeEnv": "production"
}
```

- SHA source order: `RENDER_GIT_COMMIT` → `GITHUB_SHA` → other CI env →
  `git rev-parse HEAD` → `"unknown"`. The script never throws, so a missing SHA
  cannot break the build.
- Because `dist/public` is the static web root, the deployed build's SHA is
  readable at `GET https://tryblueprint.io/version.json` — this is the
  authoritative "what is live right now" answer.
- `version.json` lives only in `dist/` (git-ignored); it is a build artifact, not
  committed source.

### Bumping the release version

The human-facing version comes from `package.json` `version`. Bump it in the same
PR as a release-worthy change; the SHA suffix in `release` makes each build
uniquely identifiable even without a version bump. Optionally cut a git tag
`vX.Y.Z` on the release commit for a durable, human-named rollback target.

### Rollback runbook

1. **Identify the last-good SHA.**
   - Live current SHA: `curl -s https://tryblueprint.io/version.json | jq -r .gitSha`
   - Last-good candidate: the SHA of the previous green `main` commit
     (`git log --first-parent main`) or a `vX.Y.Z` tag, or the previous
     successful **Deploy (Render, CI-gated)** run in GitHub Actions, or Render →
     **Deploys** history.

2. **Redeploy it, health-gated,** with the existing script (remediation for
   R038):

   ```bash
   # Dry-run the plan (no API calls, no health checks):
   scripts/rollback-deploy.sh --commit <known-good-sha> --service-id srv_xxxxxxxx --dry-run

   # Execute: redeploy the SHA on Render, then verify /health and /health/ready:
   RENDER_API_KEY=rnd_xxx RENDER_SERVICE_ID=srv_xxxxxxxx \
     scripts/rollback-deploy.sh --commit <known-good-sha> --base-url https://tryblueprint.io --yes
   ```

   The script requires an explicit `--commit`, verifies the SHA, polls Render
   until `live`, and gates on `/health` + `/health/ready`. It never rolls forward
   to a broken build and exits non-zero if the rolled-back version is unhealthy.

3. **Confirm** `curl -s https://tryblueprint.io/version.json | jq -r .gitSha`
   now reports the rolled-back SHA.

4. **Manual fallback:** Render dashboard → service → **Deploys → Rollback** if the
   API is unreachable.

Full incident context: `docs/runbooks/BETA_INCIDENT_RESPONSE_RUNBOOK.md`.

---

## Summary: config vs human action

| Finding | Enforced by config in-repo | Requires a human/dashboard action |
| --- | --- | --- |
| R045 | `render.yaml autoDeploy: false`; `deploy.yml` deploys only on green CI on `main`, pinned to the green SHA | Confirm Auto-Deploy OFF in Render; create Deploy Hook + set `RENDER_DEPLOY_HOOK_URL` secret; enable branch protection requiring CI |
| R046 | `generate-build-info.mjs` stamps SHA+version into every build; served at `/version.json`; `rollback-deploy.sh` redeploys a chosen SHA | Optional: cut `vX.Y.Z` git tags; supply `RENDER_API_KEY`/`RENDER_SERVICE_ID` at rollback time |
