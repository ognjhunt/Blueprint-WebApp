# Command Safety Matrix

Date: 2026-05-14

Purpose: make local checks and side-effect boundaries explicit before engineers or agents run WebApp commands.

## Safe Local Checks

| Command | Side-effect class | Notes |
|---|---:|---|
| `npm run check` | local read/compile only | Runs `tsc -p tsconfig.full.json --noEmit`. Safe default verification for TypeScript contracts. |
| `npm run audit:assets` | local read only | Scans repo/public assets for root screenshot dumps, oversized files, and unreferenced public image/thumbnail assets. It can fail on generated or stale local files. |
| `npm run qa:polish` | local browser automation + output artifacts | Starts the Playwright local dev server, checks public routes at desktop/mobile sizes, writes screenshots and reports under `output/qa/brand-polish/latest/`, and does not call live sends, providers, payments, deploys, or Notion writes. |
| `npm run smoke:launch:local` | local server write-light | Starts/bundles local production server and runs launch smoke against `127.0.0.1`. It strips several live provider env vars and uses local smoke values, but it can still exercise local Firebase/admin code if env is present. |
| `npm run gtm:hosted-review:audit` | local file-backed | Audits the canonical GTM ledger; does not send outreach. |
| `npm run gtm:recipient-evidence:validate -- --human-recipient-evidence-path <path>` | local validation | Validates human-supplied recipient evidence without mutating the ledger. |
| `npm run gtm:recipient-evidence:template` | local file write | Writes a template artifact. Safe if the output path is expected. |
| `npm run city-launch:preflight -- --city "<city>"` | local/reporting | Runs launch readiness checks and writes/reads report artifacts. Does not by itself send real outreach. |
| `npm run city-launch:verify-closeout` | local/reporting | Verifies readiness closeout artifacts. |
| `npm run alpha:env` | local env audit | Reads env or a supplied env file and reports missing launch config. Do not paste secrets into logs. |
| `scripts/paperclip/validate-agent-kits.sh` | local validation | Validates repo-side Paperclip agent employee kits without mutating live Paperclip or Notion state. |
| Onboarding unfinished-marker scan over `docs/company`, `docs/onboarding`, `README.md`, and `docs/architecture` | local read only | Quality gate for draft residue before closeout. |
| `bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz` | local generated output | Refreshes graphify architecture outputs. Required after code changes by repo instructions. |

## Heavier Tests

| Command | Side-effect class | Notes |
|---|---:|---|
| `npm run test:coverage` | local tests + coverage output | Runs Vitest coverage excluding `client/tests/build-output.test.ts`. Heavier than targeted tests; may touch coverage output only. |
| `npm run test:e2e` | browser automation | Runs Playwright. May need a running app or configured web server depending on Playwright config. Can create screenshots/videos/traces. |
| `npm run test` | local tests | Runs full Vitest suite without coverage. |
| `npm run alpha:check` | heavy local gate | Runs `npm run check`, then Vitest coverage with a single worker and fails on skipped assertions. |
| `npm run build` | local build output | Builds Vite client, prerenders, generates sitemap, and bundles server into `dist/`. Safe locally but changes generated build output. |

## Commands With External Or Live Side Effects

Do not run these in an ordinary orientation or docs-only session unless the task explicitly authorizes the side effect and the required env/approvals are in place.

| Command | Risk | Notes |
|---|---:|---|
| `npm run smoke:launch` | live write risk | Requires `ALPHA_BASE_URL` or `BASE_URL`. It runs health checks, creates an inbound smoke request, may run post-signup smoke if `ALPHA_BEARER_TOKEN` is set, and runs `smoke:agent`. Non-local targets require `ALPHA_SMOKE_ALLOW_LIVE_WRITE=1` plus explicit smoke identity values. |
| `npm run gtm:send` | outbound/send risk | Defaults to dry-run and does not write unless flags request it. `--write --dry-run 0` can mutate the GTM ledger after send execution; actual send behavior depends on configured transport and approvals. Treat as live-outreach capable. |
| `npm run city-launch:send` | outbound/send risk | Defaults to dry-run. `--live --founder-approved` is required for live sends. Approval mode can mutate approval state. |
| `npm run city-launch:run` | multi-system risk | Can run Deep Research planning, write artifacts, dispatch human blocker packets, dispatch/wake Paperclip issues, materialize prospects, and optionally run Meta read-only/paused-draft proof paths. Requires careful phase flags. |
| `npm run city-launch:activate` | Paperclip/ops mutation risk | Without `--founder-approved`, writes a founder decision packet. With approval, can dispatch Paperclip issues and write launch artifacts. |
| `npm run city-launch:coverage:run -- --apply` | artifact/ledger mutation risk | Without `--apply`, dry-run. With `--apply`, seeds/promotes/rejects city-launch candidates from coverage expansion. |
| `npm run human-replies:poll` | inbox/read + state mutation risk | Polls Gmail via configured watcher and can write human reply events, update blocker threads, and trigger resume handoffs. |
| `npm run human-replies:send-test-blocker` | email send risk | Dispatches a controlled test blocker email to `ohstnhunt@gmail.com`. Do not run without explicit approval. |
| `npm run human-replies:prove-production` | production proof risk | Intended to prove production reply/resume behavior. Treat as live founder-inbox validation. |
| `npm run notion:sync:growth-studio` | Notion mutation risk | Syncs Growth Studio surfaces to Notion when configured. |
| Notion connector page create/update/move tools | Notion mutation risk | Allowed only when the task explicitly asks to update Notion. Fetch first, preserve child pages/databases, and keep repo/Paperclip as execution truth. |
| `npm run render:import-env` | Render env mutation risk | With `--dry-run`, prints redacted changes only. Without `--dry-run`, updates Render service env vars via Render API. |
| `npm run paperclip:sweep:run-failures` | read/report by default | Current sweep is inspection/reporting, but it reads Paperclip runtime state; verify flags before assuming write behavior. |
| `scripts/paperclip/*.sh` | host/control-plane risk | Many scripts bootstrap, repair, reconcile, restart, sync, or configure Paperclip and host services. Read the script first and prefer verify/audit scripts before repair scripts. |

## Exact Command Notes

### `npm run check`

Safe default. Runs TypeScript with `--noEmit`. Use after docs that include TypeScript examples only if code references might affect compilation; mandatory after code changes.

### `npm run audit:assets`

Safe local audit. It reads source and `client/public/`, ignores `dist`, `coverage`, `attached_assets`, and `artifacts`, then fails on root screenshots, oversized files, or unreferenced public assets.

### `npm run qa:polish`

Safe local browser QA. It uses Playwright against the local dev server from `playwright.config.ts`, captures desktop/mobile screenshots, checks route identity, CTAs, same-origin links, basic accessibility, basic SEO, mobile overflow, visible image health, and writes a Notion layout checklist under `output/qa/brand-polish/latest/`.

### `npm run test:coverage`

Heavy local verification. Use for shared behavior changes, server utilities, route behavior, or broad refactors. For docs-only changes, targeted tests are usually not required unless command docs were coupled to script behavior.

### `npm run test:e2e`

Browser-level verification. Use for UI/route/flow changes. Expect Playwright artifacts. Do not substitute it for live-host verification when the claim depends on production env or external systems.

### `npm run smoke:launch`

Live alpha smoke. Requires explicit target URL. It can create an inbound request and may exercise post-signup workflows. Do not run against production or preview without intentional smoke identity values and `ALPHA_SMOKE_ALLOW_LIVE_WRITE=1`.

### `npm run smoke:launch:local`

Local production-like smoke. It selects a local port, builds server bundle if needed, starts `dist/index.js`, and runs `scripts/launch-smoke.mjs` against localhost with several provider env vars removed. Safer than `smoke:launch`, but still more invasive than `check`.

### `npm run gtm:send`

GTM send executor. Default is dry-run. `--write` writes reports, and `--write --dry-run 0` can write the updated ledger after execution. Treat configured email/outbound transport as live-send capable.

### Human-replies commands

- `human-replies:audit-gmail`: audits Gmail OAuth readiness.
- `human-replies:audit-durability`: audits sender, approved mailbox, ingest token, OAuth, and watcher readiness; safe audit.
- `human-replies:poll`: reads mailbox and can mutate reply/blocker state.
- `human-replies:send-test-blocker`: sends a real test blocker email.
- `human-replies:prove-production`: production proof path; treat as live.

### City-launch commands

- `city-launch:plan`: Deep Research planning path; may use provider APIs and write planning artifacts.
- `city-launch:preflight`: local readiness/reporting gate.
- `city-launch:activate`: writes founder packet without approval; with `--founder-approved`, dispatches launch execution through Paperclip/artifacts.
- `city-launch:run`: broad orchestration command; read flags before use.
- `city-launch:send`: dry-run by default; `--live --founder-approved` sends.
- `city-launch:coverage:plan`: dry-run coverage plan.
- `city-launch:coverage:run`: dry-run unless `--apply`.
- `city-launch:creative-ads`: can interact with Meta read-only/paused-draft paths depending on env and flags.

### Render/deploy commands

- `npm run build`: local build only.
- `npm run render:import-env -- <file> --dry-run`: safe redacted Render env preview.
- `npm run render:import-env -- <file>`: mutates Render env vars.
- Deployments should follow `DEPLOYMENT.md` and project scripts. Do not deploy or import env during docs-only work.

### Onboarding and policy docs

Docs-only onboarding work should run the marker scan and the agent-kit validator when `ops/paperclip/` guidance or agent onboarding instructions changed. `npm run check` is not required for docs-only work unless TypeScript/code changed.
