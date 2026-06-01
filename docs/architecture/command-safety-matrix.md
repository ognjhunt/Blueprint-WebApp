# Command Safety Matrix

Date: 2026-05-14

Purpose: make local checks and side-effect boundaries explicit before engineers or agents run WebApp commands.

## Safe Local Checks

| Command | Side-effect class | Notes |
|---|---:|---|
| `npm run check` | local read/compile only | Runs `tsc -p tsconfig.full.json --noEmit`. Safe default verification for TypeScript contracts. |
| `npm run audit:assets` | local read only | Scans repo/public assets for root screenshot dumps, oversized files, and unreferenced public image/thumbnail assets. It can fail on generated or stale local files. |
| `npm run qa:polish` | local browser automation + output artifacts | Starts the Playwright local dev server, checks public routes at desktop/mobile sizes, writes screenshots and reports under `output/qa/brand-polish/latest/`, and does not call live sends, providers, payments, deploys, or Notion writes. |
| `npm run qa:operator` | local browser automation + mocked API fixtures | Starts the Playwright local dev server with local fake auth and the ops automation scheduler disabled, checks internal/private operator surfaces at desktop/mobile sizes, intercepts `/api/**`, writes screenshots and reports under `output/qa/operator-surfaces/latest/`, and does not call live Firebase, Stripe, Notion, Paperclip, Render, Redis, providers, Slack/email, payments, payouts, or sends. |
| `npm run smoke:launch:local` | local server write-light | Starts/bundles local production server and runs launch smoke against `127.0.0.1`. It strips several live provider env vars and uses local smoke values, but it can still exercise local Firebase/admin code if env is present. |
| `npm run gtm:hosted-review:audit` | local file-backed | Audits the canonical GTM ledger; does not send outreach. |
| `npm run gtm:recipient-evidence:validate -- --human-recipient-evidence-path <path>` | local validation | Validates human-supplied recipient evidence without mutating the ledger. |
| `npm run gtm:recipient-evidence:template` | local file write | Writes a template artifact. Safe if the output path is expected. |
| `npm run autoagent:recursive-improve -- --dry-run` | local eval/report artifacts | Runs the recursive AutoResearch observer, fixture writer, offline eval, promotion gate, canary dry-run, and rollback monitor with live mutation off. Writes under `output/autoagent/recursive-improvement/latest/`; does not mutate live Paperclip/Hermes state, Notion, providers, sends, payments, rights/legal, city-live, or hosted-session fulfillment. |
| `npm run autoagent:canary-rollback -- --canary-plan <path> --shadow-summary <path> --apply-rollback` | repo-local rollback artifact | Restores only the repo-local active AutoAgent canary config from the stored rollback snapshot when the monitor finds a rollback trigger. It does not mutate live Paperclip/Hermes state, Notion, providers, sends, payments, rights/legal, city-live, or hosted-session fulfillment. |
| `npm run autonomy:budget:verify` | local read/check + output artifacts | Verifies the `$500/month` autonomous-org budget packet against `.paperclip.yaml`, the control-room map, budget plan doc, summary JSON, and completion audit. Writes `output/autonomous-org/budget/latest/verification.json` and `.md`; does not read live billing, mutate Paperclip, write Notion/Firebase/Stripe/Render, send outreach, call providers, or claim Operational Launch Ready. |
| `npm run autonomy:spend:snapshot` | local credential/source inventory by default; optional read-only provider queries with `-- --live-read` | Reads `config/autonomy/spend-sources.yaml` and writes redacted spend-observability artifacts under `output/autonomous-org/budget/spend-snapshots/`. Default mode does not call providers. `-- --keychain` loads env vars from the local macOS Keychain service without writing secret values to output. `-- --live-read` may call billing, credit, usage, or account-read endpoints only; it must not mutate Paperclip, Notion, Firebase, Stripe, Render, providers, ads, sends, payments, payouts, city activation, hosted sessions, rights/legal state, or claim Operational Launch Ready. Secrets must come from env vars, macOS Keychain, or a local ignored env file and must never be committed or printed. |
| `npm run autonomy:spend:snapshot:keychain` | local Keychain-backed credential/source inventory by default; optional read-only provider queries with `-- --live-read` | Same collector as `autonomy:spend:snapshot`, with `--keychain` pre-applied. Reads from macOS Keychain service `Blueprint-WebApp autonomous-spend`; provider calls still require `-- --live-read`. |
| `npm run autonomy:outcomes:snapshot` | local read/check + output artifacts | Reads `config/autonomy/outcome-sources.yaml` plus repo-local outcome exports/fixtures and writes `output/autonomous-org/budget/outcomes/latest.json` and `.md`. It does not call live APIs, mutate providers, send outreach, launch ads, write Notion/Firebase/Stripe/Render, mutate Paperclip production state, fulfill hosted sessions, clear rights/legal state, activate cities, or claim Operational Launch Ready. |
| `npm run autonomy:budget:recommend` | local recommendation + approval packet artifacts | Joins spend snapshot, outcome snapshot, and `config/autonomy/budget-allocation-policy.yaml`; writes dynamic recommendation JSON/Markdown, a human approval packet, and a proposed repo-local diff artifact. It never applies the diff or mutates live spend, ads, sends, providers, Stripe, Render, Firebase, Notion, Paperclip production state, hosted sessions, rights/legal state, city activation, or customer/traction claims. |
| `npm run autonomy:budget:dynamic:verify` | local verifier + output artifacts | Verifies generated dynamic allocator outputs, budget cap, Paperclip subcap, OpenAI API `$0` guardrail, evidence refs, fixture/local-proof boundaries, live mutation flags, and human approval gates. It writes verification JSON/Markdown only. |
| `npm run autonomy:budget:live-proof:reconcile` | local read/check + output artifacts | Reads the existing live-proof backlog and redacted spend snapshot, then writes `output/autonomous-org/budget/latest/live-proof-reconciliation.json` and `.md`. It makes no provider calls, persists no secrets, does not mutate live spend, ads, sends, providers, Stripe, Render, Firebase, Notion, Paperclip production state, hosted sessions, rights/legal state, city activation, or customer/traction claims, and treats partial proof as still blocking. |
| `npm run autonomy:budget:live-proof:template` | local template artifact | Reads the existing live-proof backlog and reconciliation artifact, then writes `output/autonomous-org/budget/latest/live-proof-intake-template.json` and `.md`. It is a fillable proof handoff template only; it does not validate spend, call providers, persist secrets, mutate live systems, or authorize spend movement. |
| `npm run autonomy:budget:live-proof:validate` | local validation artifact | Validates a filled live-proof intake packet, or the blank default template, and writes `output/autonomous-org/budget/latest/live-proof-intake-validation.json` and `.md`. It makes no provider calls, does not count artifacts as live billing proof, persists no secrets, and accepts rows only for manual review before later reconciliation. Add `-- --require-complete` when a CI/handoff gate should fail on missing or rejected intake rows. |
| `npm run autonomy:budget:next-goals` | local handoff artifact | Writes `output/autonomous-org/budget/latest/next-goal-queue.json` and `.md` with five ranked `/goal` commands, owners, safe commands, success criteria, blocked claims, Codex OAuth/Pro exclusion, OpenAI API `$0` guardrail, and no-live-mutation gates. It does not call providers, spend money, send outreach, mutate live systems, or approve live action. |
| `npm run autonomy:budget:delegate` | local owner-delegation artifact | Writes `output/autonomous-org/budget/latest/budget-delegation-packet.json` and `.md` by joining the budget ledger, dynamic recommendation state, live-proof validation, and next-goal queue into owner work orders. It delegates only repo-local proof, planning, and review work; it does not call providers, spend money, send outreach, mutate live systems, or approve live action. |
| `npm run autonomy:budget:live-action-gate` | local fail-closed gate artifact | Writes `output/autonomous-org/budget/latest/live-action-gate.json` and `.md` by joining the delegation packet, live-proof intake validation, and dynamic recommendations. Default mode reports whether live action is blocked while still allowing repo-local work; `-- --require-live-action-ready` exits non-zero until live billing proof and explicit human approval clear. It does not call providers, spend money, send outreach, mutate live systems, or persist secrets. |
| `npm run autonomy:budget:launch-approval` | local approval packet artifact | Writes `output/autonomous-org/budget/latest/launch-now-approval-packet.json` and `.md` with exact bounded human approval text for the current `$500/month` ledger. It keeps `approval_effective=false`, makes no provider calls, persists no secrets, and does not authorize live sends, ads, provider jobs, production mutations, OpenAI API spend above `$0`, or Operational Launch Ready claims by itself. |
| `npm run autonomy:budget:status` | local status artifact | Writes `output/autonomous-org/budget/latest/control-status.json` and `.md` by reading the summary, audit, verifier, delegation packet, and live-action gate. It gives agents one pre-action answer for repo-local allocation, repo-local delegation, live spend mutation, live budget completion claims, and Operational Launch Ready claims. It does not call providers, spend money, send outreach, mutate live systems, or persist secrets. |
| `npm run autonomy:budget:control-suite` | local suite artifact | Runs the safe local budget control suite: live-proof reconciliation, proof template, proof validation, next-goal queue generation, budget delegation packet generation, live-action gate generation, budget status generation, launch-now approval packet generation, dynamic budget verifier, focused proof-intake tests, focused dynamic allocator tests, focused next-goal queue tests, focused delegation tests, focused live-action gate tests, focused budget status tests, focused launch-now approval tests, and the budget packet verifier. Writes `output/autonomous-org/budget/control-suite/latest/summary.json` and `.md`; default mode requests no live provider calls and no live mutation. Optional `-- --include-check` and `-- --include-graphify` add heavier local checks. |
| `npm run autonomy:kpi-source-status` | local fixture/snapshot artifact | Reads a repo-local KPI source snapshot and writes `output/autonomous-org/kpi-source-status-latest/`. It does not export live Firestore, write Notion, send outreach, touch Stripe, call providers, or mutate Paperclip. |
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

### `npm run qa:operator`

Safe local browser QA for internal/private operator surfaces. It sets `VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH=1`, disables the ops automation scheduler, uses mocked API fixtures, fails on unmocked `/api/**` calls, captures desktop/mobile screenshots, and writes `output/qa/operator-surfaces/latest/report.md`. It proves local UI rendering only, not live operational readiness.

### `npm run autoagent:recursive-improve -- --dry-run`

Safe local recursive-improvement report path. It observes local failure artifacts, writes `summary.json`, `report.md`, `proposed_patch_summary.json`, and `proposed_patch_report.md` under `output/autoagent/recursive-improvement/latest/`, keeps `exportLive=false`, and runs canary/rollback in dry-run mode. The patch-proposal stage is report-only; `--ai-patch-proposal` can request a local AI proposal, but unsafe scopes are rejected and no patch is applied. Apply flags such as `--apply-canary` or `--apply-rollback` are outside the safe default and require an explicit bound issue plus central policy approval.

Recursive-improvement summaries must also name `server/agents/autoagent-production-action-registry.ts`. That registry defaults production actions to dry-run, requires owner-system proof, idempotency, audit schema, target record/field, canary limit, rollback path, and an explicit live mutation flag. The first live lane is `paperclip_hermes_internal_metadata_update`; the next lane is `paperclip_internal_report_pointer_update`, gated until the first lane has committed execution proof and limited to one internal report pointer metadata field. External sends, payments/entitlements, provider execution, hosted-session fulfillment, rights/privacy/legal, and city-launch actions remain blocked.

`npm run autoagent:recursive-improve -- --production-context --ai-production-proposal --dry-run` is the safe production-decision dry-run. It builds `production-context/`, optionally asks the configured AI proposer for one action packet, validates that packet against `server/agents/autoagent-production-action-registry.ts`, runs the usual offline eval/promotion/canary/rollback checks, and writes production summary fields without committing a mutation.

`npm run autoagent:recursive-improve -- --production-context --ai-production-proposal --execute-production-canary` is side-effect capable and requires a separate bound issue. The AI proposal still does not execute directly. The deterministic harness may commit only registry-allowlisted production canaries after registry validation, idempotency, audit proof, execution proof, rollback snapshot, offline eval, promotion gate, canary dry-run, and rollback monitor pass. The internal report pointer lane additionally requires prior committed execution proof from the internal metadata lane. Duplicate idempotency keys suppress duplicate actions. Stop conditions roll back automatically from the stored snapshot.

`npm run autoagent:recursive-improve -- --auto-apply-low-risk` is the bounded repo-local auto-apply entrypoint. It can write a support-triage canary config under the AutoAgent output directory only when the candidate lane is the central-policy-approved low-risk lane, offline eval passes, generated fixtures are included, negative controls remain blocked, the promotion gate returns `promote`, clean shadow comparison evidence exists, rollback metadata exists, and the rollback monitor runs immediately after apply. It still must not send, pay, launch providers, clear rights/privacy/legal claims, fulfill hosted sessions, make customer claims, mutate live Paperclip/Hermes state, or claim operational launch readiness.

### `npm run autoagent:canary-rollback`

Repo-local rollback monitor/apply path. It reads a canary plan, offline eval evidence, and local shadow summary, then restores the previous repo-local canary config from the stored snapshot only when rollback triggers fire. It is not a live Paperclip/Hermes rollback mechanism and must not be used to mutate production services.

### Dynamic budget allocation commands

`npm run autonomy:outcomes:snapshot`, `npm run autonomy:budget:recommend`, `npm run autonomy:budget:dynamic:verify`, `npm run autonomy:budget:live-proof:reconcile`, `npm run autonomy:budget:live-proof:template`, `npm run autonomy:budget:live-proof:validate`, `npm run autonomy:budget:next-goals`, `npm run autonomy:budget:delegate`, `npm run autonomy:budget:live-action-gate`, `npm run autonomy:budget:status`, `npm run autonomy:budget:launch-approval`, and `npm run autonomy:budget:control-suite` are the safe local dynamic allocation loop. They implement `observe -> outcome snapshot -> score -> recommend -> human approval packet -> proof reconciliation -> proof intake template -> proof intake validation -> next-goal queue -> owner delegation packet -> live-action gate -> control status -> pending launch approval packet -> suite verification -> approved repo-local diff -> live system handled separately`.

These commands do not move money, launch ads, send outreach, start providers, deploy, write Notion/Firebase/Stripe/Render, mutate Paperclip production state, fulfill hosted sessions, clear rights/legal state, activate a city, or make customer/traction claims. Missing, stale, fixture-only, unsupported, or `repo-local-config` proof must produce `no reallocation, improve proof first` or advisory-only output.

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
