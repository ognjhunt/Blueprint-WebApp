# Beta Launch Readiness Audit & Remediation Ledger — 2026-07-16

Working branch: `claude/blueprint-beta-launch-readiness-nbznui` (branched from
`origin/main` @ `4603603b0aab485f6633b824fd8d37c04a37cb8d`).

Scope: current-state truth of Blueprint-WebApp as an externally usable beta
release candidate. Every row carries fresh evidence from this branch; nothing
is closed on intent. Statuses: `fixed`, `open`, `externally-blocked`,
`deferred`, `superseded`, `not-reproducible`.

## Git reconciliation record (Phase 1)

Fresh cloud clone, clean worktree, HEAD == origin/main (`4603603`), 0/0
ahead/behind at start. The July 16 dirty worktree (31M/9D/12U files) described
in the audit snapshot existed only on the audit machine and was never pushed;
its known fixes were reconciled through remote branches instead:

| Remote branch | Verdict | Evidence |
|---|---|---|
| `claude/ai-agent-optimization-6e5rx6` | fully absorbed | `git diff origin/main origin/<branch>` is empty — the post-review agent-checkout hardening (catalog-grounded pricing, buyer binding, redirect-origin check) landed in #408 |
| `claude/blueprint-audit-launch-8h007u` | fully absorbed | asset-audit sibling exclusion in `scripts/audit-assets.ts:28-29`; `site_type` fixture in `scripts/qa/operator-surfaces.ts:856` and `client/tests/pages/AdminLeads.test.tsx:175` |
| `claude/header-image-cutoff-nudyop` | fully absorbed | hero clamp at `Home.tsx`, helmet mock in `tests/setup.ts`, QA-sweep fixes all present on main |
| `claude/pre-beta-launch-audit-1pwvpr` (20 commits) | 13 absorbed/superseded, 4 salvaged, 3 dropped | salvaged: `0018286` (DR runbook), `0030684` (beta tester guides), `6c64778` (DPA/consent scaffolds), `07465a8` (terms acceptance — re-verified: tsc clean, 17 tests green). Dropped: `672c4d7` (rules for collections nothing references), `29e7afe` (k6 harness — optional, deferred), rest superseded by #407/#408 |
| `claude/codebase-audit-launch-f33ppy`, `launch-robot-eval-delivery-forwarding-fixes`, `claude/page-load-flash-delay-7m792i` | 0 commits ahead | nothing to reconcile |

No force-pushes, no history rewrites, no work discarded.

In-flight parallel lane (deliberately NOT absorbed here):
`origin/claude/blueprint-public-beta-closure-jqheh6` (`95131b9`, 2026-07-16
21:57 UTC) mirrors `capture_submissions` rules hardening + composite index
from BlueprintCapture and must land together with the matching
BlueprintCapture branch to keep the rules-parity guard green. It is owned by
a separate active session; absorbing it into this branch would create a
competing landing path and break parity until the sibling repo lands.

## Findings ledger

### P0/P1 — engineering

| ID | Sev | Finding | Status | Remediation & proof | Verification |
|---|---|---|---|---|---|
| BLR-001 | P1 | Full vitest run rewrote ~90 tracked `ops/paperclip/playbooks/**` + `docs/city-launch-system-*.md` files (canonical city-launch artifact writes from the execution/planning harnesses) | **fixed** | Canonical writes redirect through `BLUEPRINT_CANONICAL_ARTIFACT_ROOT` (`server/utils/canonicalArtifactRoot.ts`; wired in `cityLaunchExecutionHarness.ts`, `cityLaunchPlanningHarness.ts`, `cityLaunchPlanningState.ts`; set per-worker in `client/tests/setup.ts`). Regression guard `server/tests/canonical-artifact-isolation.test.ts`; CI step "Verify tests did not mutate tracked files" fails on any tracked diff after `test:coverage` | `npm run test` then `git status --short` → empty |
| BLR-002 | P1 | Credential-free forwarding-proof subprocess could attempt Google ADC lookup: test env spread only cleared 2 of the 6 trigger keys (`GOOGLE_CLOUD_PROJECT`, `K_SERVICE`, `FUNCTION_TARGET`, `GCLOUD_PROJECT` survived) | **fixed** | `ADC_CONTEXT_ENV_KEYS` exported from `client/src/lib/firebaseAdmin.ts`; `server/tests/helpers/credentialFreeEnv.ts` deletes all of them; `expectNoAdcActivity()` asserts no admin init/ADC output in all three proof tests; `server/tests/credential-free-env.test.ts` fails if `firebaseAdmin.ts` grows a new trigger key. Note: the 3 failures did not reproduce in this clean env (they require an ADC-context var in the parent shell) — the harness hole was real and is closed | `npx vitest run server/tests/first-gpu-webapp-route-forwarding-proof.test.ts server/tests/credential-free-env.test.ts` |
| BLR-003 | P1 | `smoke:launch:local` cloned `process.env` (inherited live developer/cloud config, enabled automation workers) and failed `/health/ready` under zeroed beta limits; not a real isolated smoke | **fixed** | Allowlist env construction in `scripts/launch-smoke-env.mjs` (inherit-allowlist + forbidden-key scrub + every automation lane pinned off + scheduler disabled + safe non-zero beta caps); loopback-guarded `local_smoke` readiness profile (`isLocalLaunchSmokeProfile` in `server/utils/launch-readiness.ts` — honored only when BASE_URL is loopback, so production stays fail-closed); inbound smoke uses the tmpdir fallback store under the profile; agent-runtime smoke explicitly skipped (no live provider calls). Regression: `scripts/launch-smoke-env.test.js`. CI build job now runs the smoke | `npm run build && npm run smoke:launch:local` → "Launch smoke passed." |
| BLR-004 | P1 | No legal Terms/Privacy acceptance recorded at buyer/operator signup | **fixed** | Reconciled `07465a8` from the stale audit branch: acceptance gate in `BusinessSignUpFlow.tsx`, versioned recording via `client/src/lib/legalAcceptance.ts` + `server/routes/inbound-request.ts`/`server/types/inbound-request.ts`; 17 tests green post-merge on evolved main | `npx vitest run client/tests/pages/BusinessSignUpFlow.test.tsx server/tests/inbound-request.test.ts` |
| BLR-005 | P1 | Two competing deploy paths possible; `render.yaml` had `autoDeploy: true` (any main push ships, red or green) | **fixed** (code/config; activation is human-gated) | Single deploy owner: `render.yaml` `autoDeploy: false`; `.github/workflows/deploy.yml` deploys only the exact `workflow_run.head_sha` of a green CI run on main, fails closed when `RENDER_DEPLOY_HOOK_URL` is missing; deployed SHA observable at `GET /version.json` (`scripts/generate-build-info.mjs`, wired into `npm run build`); rollback stays revert-based (`scripts/deploy-rollback.mjs`). One-time dashboard steps documented in `docs/runbooks/ci-gated-deploy-2026-07-16.md` | inspect `render.yaml`, `.github/workflows/deploy.yml`; `curl <site>/version.json` post-deploy |
| BLR-006 | P1 | Unhandled vitest worker timeout (1 in July 16 run) | **not-reproducible** | Three full-suite runs on this branch (337→340 files) completed with no unhandled errors; timeout headroom rationale already documented in `vitest.config.ts` (WEB-03). Watch in CI; do not mask with larger timeouts | `npm run test` (x3 clean) |
| BLR-007 | P1 | `client/tests/pages/AdminLeads.test.tsx` stale `site_type` fixture | **superseded** | Fix already on main (`AdminLeads.test.tsx:175`, `scripts/qa/operator-surfaces.ts:856`) via #407/#408 reconciliation | `npx vitest run client/tests/pages/AdminLeads.test.tsx` |

### P1 — security & dependencies

| ID | Sev | Finding | Status | Remediation & proof | Verification |
|---|---|---|---|---|---|
| BLR-010 | P1 | npm audit (prod scope): 4 critical / 18 high pre-fix (protobufjs, fast-xml-parser, loader-utils, websocket-driver criticals; axios, express-rate-limit, multer, nodemailer, form-data highs) | **fixed** (residual accepted exceptions below) | `npm audit fix` (lockfile-only, semver-compatible) → 0 critical; `nodemailer` bumped 7→9 (SMTP command-injection CVEs; API verified + email tests green). Full check/test/build green after bumps | `npm audit --omit=dev` |
| BLR-011 | P2 | Residual prod-scope highs: `react-simple-maps`→`d3-color` ReDoS chain (only non-major fix is a downgrade to 1.0.0) | **resolved 2026-07-20** | The unused launch-map component and `react-simple-maps` dependency were deleted; the vulnerable d3 chain is no longer in the production graph | `npm audit --omit=dev --audit-level=high` |
| BLR-012 | — | July-2 launch specs (WSPEC-01..09) reconciliation | **closed** | 01 fixed (`storage.rules` real rules + `firebase.json:6`); 02 fixed (`cors.json` scoped origins); 03 fixed (`firestore.rules:343-352` owner/admin isolation on scenes); 04 fixed (`robot-eval-job-requests.ts:398,548` verifyFirebaseToken; `:588` rate-limited HMAC pipeline callback; global inbound rate limiting); 05 fixed (`client/src/lib/stripeClient.ts` — no fallback key, fail-visible); 06 fixed (`create-checkout-session.ts:188` demo worlds blocked in production unless explicit flag); 07 fixed (server-side entitlement authz `robot-eval-job-requests.ts:143` + signed artifact access in `EntitlementAccessTable`); 08 partial-fixed (dead artifacts removed this branch; `output/`+`outputs/` retained — load-bearing claims/budget-gate evidence — relocation deferred with owner webapp lane); 09 superseded (`backend_supported` static flag no longer exists in the tree) | greps + files cited |
| BLR-013 | — | July-2 CI-health note: `control-room-inventory.test.ts` red since 2026-06-25 | **fixed upstream** | Test passes in all full runs on this branch | `npx vitest run scripts/paperclip/control-room-inventory.test.ts` |

### P1/P2 — frontend quality

| ID | Sev | Finding | Status | Remediation & proof | Verification |
|---|---|---|---|---|---|
| BLR-020 | P1 | Nested/duplicate `<main>` landmarks on `/` and `/robot-team/eval` (SiteLayout + page both rendered `<main>`) | **fixed** | SiteLayout owns the single `<main id="main-content">`; page wrappers in Home, Proof, Sites, SiteDetail, RobotTeamEval, HostedSessionSetup converted to `<div>` | `qa:polish` + DOM inspection |
| BLR-021 | P1 | Home "How it works" rendered 4 narrow columns at 390px (TileGrid forced `repeat(cols,1fr)` at all viewports) | **fixed** | `TileGrid` responsive: 1 col base, 2 from `sm`, `cols` from `lg` (`client/src/components/site/TileGrid.tsx`) — fixes every TileGrid page (Home, Pricing, HowItWorks, ForRobotTeams, ForSiteOperators, About, Vision) | 390px viewport render |
| BLR-022 | P1 | Touch targets <44px: cookie close/customize/action buttons, footer links | **fixed** | `CookieConsent.tsx` all controls ≥44px (close 44×44, actions min-h-44, preference rows min-h-44); `Footer.tsx` links `min-h-[44px] inline-flex`; header mobile menu already met 44px | manual + qa:polish |
| BLR-023 | P2 | `/beta/buyer-guide`, `/beta/capturer-guide` missing `<main>`; 10-11px low-contrast microcopy | **not-reproducible on main** | These routes never existed on `origin/main` — they were uncommitted worktree pages on the audit machine and were never pushed. Tester-facing guides now exist as docs (`docs/beta/CAPTURER_BETA_GUIDE.md`, `docs/beta/BUYER_BETA_GUIDE.md`). If web-route guides are wanted, that is a new feature request | `grep -r "buyer-guide" client/` → empty |
| BLR-024 | P1 | `/robot-team/eval` ~8,300px tall on mobile (abandonment risk) | **fixed** | Explainer card grids collapse behind mobile-only disclosure toggles (`MobileDisclosureGrid` in `RobotTeamEval.tsx`); desktop layout unchanged; form contract untouched; "Start" anchor to the form retained | 390px render; page tests green |
| BLR-025 | P2 | Build warnings: react-helmet-async default-import warning; firebase vendor chunk >500 kB; react-datepicker sourcemap warning | **fixed / not-reproducible** | Helmet: `Reflect.get` interop probe in `client/src/lib/helmet.ts` — warning gone. Firebase: split by feature in `vite.config.ts` (largest chunk now 241 kB, no >500 kB warnings). Datepicker sourcemap warning did not appear in three builds on this branch | `npm run build` log |

### Environment-blocked (not code-fixable here)

| ID | Finding | Owner / retry condition |
|---|---|---|
| BLR-030 | `npm run rules:parity` requires sibling `../BlueprintCapture` checkout — absent in this cloud sandbox (CI checks it out and the gate is green there) | CI owns the gate; re-verify on the PR's CI run |
| BLR-031 | Cloud-only preflights (`alpha:env --require-ready`, `alpha:preflight`, `pipeline:forwarding:preflight --require-forwarding`) need live env config not present in this sandbox | Run on Render/CI where secrets exist; config-proof only, never payment/provider/deploy proof |
| BLR-032 | Live payment/payout/provider/email behavior unproven (by policy — no external mutations authorized) | Human authorization for a supervised live drill |
| BLR-033 | Deploy activation: turning the new CI-gated deploy lane on requires the Render dashboard Deploy-Hook secret (`RENDER_DEPLOY_HOOK_URL`) and confirming Auto-Deploy is off in the dashboard | Owner: Nijel. Steps in `docs/runbooks/ci-gated-deploy-2026-07-16.md` |

### Deferred (intentional, non-blocking)

| ID | Item | Rationale |
|---|---|---|
| BLR-040 | Full WSPEC-08 artifact-tree relocation (`output/`, `outputs/`, root dated reports) | Load-bearing inputs to `claims:guard` and autonomy budget gates; needs a supervised migration, not a launch blocker (P2) |
| BLR-041 | k6 intake load/soak harness (`29e7afe`) | Optional test infra; adopt when load testing is scheduled |
| BLR-042 | `express-rate-limit` IPv6-mapped-IPv4 bypass advisory | Fixed by `npm audit fix` if within semver; verify version in lockfile — see BLR-010 run log; Render fronting normalizes client IPs |

## Verification matrix (this branch, credential-free)

See PR description for the final counts at the candidate SHA. Gates run:
`check`, `audit:assets`, `test` (x3), `test:coverage`, `build`,
`test:build-output`, `test:e2e`, `qa:polish`, `qa:operator`,
`smoke:agent-headless`, `smoke:launch:local`, `claims:guard`, `alpha:check`,
`npm audit`, graphify refresh, `git diff --check`, worktree-clean assertion.

## Beta-claim boundaries (unchanged)

Public Launch Ready ≠ Operational Launch Ready. Nothing in this remediation
upgrades any operational claim: no payment, payout, provider execution, email
delivery, or production deployment was performed or proven. Copy and docs
added here stay inside the proof boundaries defined by PLATFORM_CONTEXT and
the public-display-ready claims matrix.
