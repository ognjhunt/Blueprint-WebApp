# Blueprint Launch-Readiness Gap Closeout

Date: 2026-05-14
State: blocked

## Objective

Close Blueprint launch-readiness gaps until repo-safe fixes are landed and the first unavoidable live/human blocker is proven, without inventing capture, recipient, payment, payout, provider, buyer-access, or launch-readiness proof.

## Stage Reached

Repo-safe verification reached all three repos. WebApp, Capture, and Pipeline contract checks ran; GTM and city-launch dry-runs produced blocker evidence; one repo-safe GTM send-executor reporting fix was landed and verified.

## Earliest Hard Stop

Earliest chain blocker: Capture external alpha release config.

Evidence:
- `capture-archive-external-alpha-validate-config-only.log`
- Observed output: `Stage: release_config_blocked`
- Observed output: `Next input needed: Set BLUEPRINT_PAYOUT_PROVIDER in the untracked release xcconfig before building external alpha artifacts.`

Why this is the earliest stop:
- The launch chain cannot truthfully advance to external iPhone alpha capture proof before the external alpha release config is present.
- This input belongs in an ignored/local release config and should not be fabricated or committed in repo.
- Downstream Pipeline/WebApp/GTM proofs would still be blocked by later live evidence, but this is the first hard stop in Capture -> Pipeline -> WebApp order.

Owner: `beta-launch-commander` for release gate coordination, with Ops/founder input for the payout-provider value.

Retry/resume condition:
- Provide the real untracked `Config/BlueprintCapture.release.xcconfig` value for `BLUEPRINT_PAYOUT_PROVIDER`.
- Rerun `./scripts/archive_external_alpha.sh --validate-config-only`.

Next action category: env/config.

## Launch-Gap Matrix

| Lane | Stage reached | Current status | Evidence | First blocker / gap |
| --- | --- | --- | --- | --- |
| Capture app: iPhone | Release config validation | blocked | `capture-archive-external-alpha-validate-config-only.log` | `BLUEPRINT_PAYOUT_PROVIDER` missing from ignored release xcconfig. Real-device iPhone claim/upload proof still remains after config. |
| Capture app: Android | Release config validation | blocked | `capture-android-alpha-readiness-validate-config-only.log` | `BLUEPRINT_BACKEND_BASE_URL` missing for Android external alpha builds. Android remains internal-only until config, unit tests, release build, device/App Distribution smoke, and downstream proof pass. |
| Capture app: glasses | Contract/manual boundary | blocked for external launch | `pipeline-run-paid-marketplace-launch-gate.log`; `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/output/paid_marketplace_launch_gate.md` | Glasses are internal-only until physical-device claim/upload proof and downstream Pipeline/WebApp proof exist for the same `capture_job_id`. |
| Capture app: raw V3.1 bundle | Repo contract tests | pass at test level | `capture-validate-launch-readiness-tests.log` | Raw tests pass, but upstream IDs and real capture/job bootstrap proof cannot be substituted with generated/sample IDs. |
| Capture app: payout language / first-capture UX | Existing dirty copy preserved | not independently changed in this run | Dirty tree: `BlueprintCapture/Models/SkuPricing.swift`, onboarding/auth/glasses copy files, and untracked capturer-marketing doc | No repo-safe edit was needed from the requested checks. Payout/provider readiness remains backend/live-provider gated. |
| Pipeline: raw bundle ingestion | Contract tests | pass | `pipeline-pytest-webapp-launch-site-world.log` | Tests passed, but live raw bundle ingestion from a real device/job chain is not proven. |
| Pipeline: privacy-safe package | Contract gate | pass at automation level | `pipeline-run-paid-marketplace-launch-gate.log`; `paid_marketplace_launch_gate.md` | Manual/live evidence still required before buyer-facing readiness. |
| Pipeline: provider/world-model outputs | Contract/manual boundary | blocked for launch truth | `paid_marketplace_launch_gate.md` | Real provider/world output and Android toolchain evidence are manual/operator requirements; no provider account proof was run. |
| Pipeline: WebApp sync | Contract tests | pass | `pipeline-pytest-webapp-launch-site-world.log` | WebApp projection still requires real `site_submission_id`, `request_id`, `buyer_request_id`, and `capture_job_id` from upstream records. |
| Pipeline: package manifests | Canonical package gate | pass at contract level | `paid_marketplace_launch_gate.md` | Package manifests are not proof of live buyer access, live payments, or real-device capture. |
| WebApp: inbound request | Contract level covered | pass at automation level | `paid_marketplace_launch_gate.md`; `webapp-npm-run-check.log` | Live Firebase/Admin path and real inbound request bootstrap still must be proven for launch claims. |
| WebApp: marketplace/package listing | Contract level covered | pass at automation level | `paid_marketplace_launch_gate.md` | Production inventory must remain pipeline-backed; no live buyer purchase or entitlement proof was run. |
| WebApp: hosted session | Local checks passed, live proof open | partial | `webapp-npm-run-alpha-env.log`; `webapp-npm-run-check.log` | Redis is recommended but missing; authenticated buyer hosted artifact access is still a manual/live requirement. |
| WebApp: authenticated buyer access | Contract/manual boundary | blocked for launch truth | `paid_marketplace_launch_gate.md` | `buyer_artifact_access` requires authenticated buyer session proof after purchase. |
| WebApp: Stripe checkout/payout | Contract level covered | blocked for live launch | `paid_marketplace_launch_gate.md`; `webapp-npm-run-alpha-env.log` | Live buyer payment, live capturer payout, Stripe connected-account live readiness, payout exception monitor, KYC/background-check decisions, and human finance owner remain open. |
| WebApp: public product pages/assets | Static/type checks | pass | `webapp-npm-run-audit-assets.log`; `webapp-npm-run-check-after-gtm-send-fix.log` | Passing static checks is not launch readiness. |
| GTM: Exact-Site Hosted Review targets | Ledger audit | ready_with_warnings | `webapp-gtm-hosted-review-audit.log` | 30 targets, 30 recipient-backed, 0 approved, 0 sent, 0 replies, 0 hosted-review starts. |
| GTM: recipient evidence | Ledger audit | present at ledger level | `webapp-gtm-hosted-review-audit.log`; buyer-loop report | Recipient-backed rows exist, but first sends remain approval-gated and reply durability is blocked. |
| GTM: first-send approval | Dry-run | blocked | `webapp-gtm-send-dry-run-after-approval-guidance.log`; `ops/paperclip/reports/exact-site-hosted-review-buyer-loop/global/2026-05-14/buyer-loop.md` | 30 drafts are not founder/operator approved. Repo-safe fix now prints the approval packet/apply commands. |
| GTM: send dry-run | Dry-run | blocked with `allow-blocked` | `webapp-gtm-send-dry-run-after-approval-guidance.log` | No eligible sends. Live outreach was not sent. |
| GTM: reply durability | Audit | blocked | `webapp-human-replies-audit-durability.log` | Sender/domain verification unknown, approved identity relies on default, Gmail OAuth credentials missing. |
| Paperclip/autonomous org: issue tree | City preflight | blocked | `webapp-city-launch-preflight-durham-lean-72h.log` | Durham activation lacks required child issue ids for ad-studio, Meta paused draft, and scorecard tasks. |
| Paperclip/autonomous org: closure evidence | City preflight closeout | blocked | `webapp-city-launch-preflight-durham-lean-72h.log` | Earliest city-launch blocker is `deep_research_city_plan`; no valid completed city playbook is available. |
| Paperclip/autonomous org: founder/human gates | GTM/city preflight | blocked | buyer-loop report; human-replies audit; city preflight log | Founder first-send approval, sender verification, Gmail watcher credentials, and Deep Research/account access are required before live execution. |
| Paperclip/autonomous org: live wake/resume | Reply durability audit | blocked | `webapp-human-replies-audit-durability.log` | Gmail reply watcher is not production-ready; live resume proof was not run. |

## Repo-Safe Fixes Completed

- Added next-action reporting to `server/utils/gtmSendExecutor.ts` so approval-blocked GTM dry-runs tell operators to run `npm run gtm:first-send-approval:template -- --write`, record founder/operator decisions, apply them with `npm run gtm:first-send-approval:apply -- --write`, then rerun the send dry-run.
- Added a focused regression test in `server/tests/gtm-send-executor.test.ts`.
- Did not edit secrets, real config files, live ledgers, or the existing dirty BlueprintCapture copy changes.
- Did not send live outreach, run live payment/payout, or claim launch readiness from passing tests.

## Verification Commands And Outputs

| Command | Result | Evidence log / artifact | Key observed output |
| --- | --- | --- | --- |
| `npm run check` | pass | `webapp-npm-run-check.log` | `EXIT_CODE=0` |
| `npm run audit:assets` | pass | `webapp-npm-run-audit-assets.log` | `Asset audit passed.` |
| `npm run alpha:env` | pass with recommended gaps | `webapp-npm-run-alpha-env.log` | Required checks passed; recommended missing `REDIS_URL`, ElevenLabs, and Twilio vars. |
| `npm run gtm:hosted-review:audit` | pass with warnings | `webapp-gtm-hosted-review-audit.log` | `status: ready_with_warnings`; 30 recipient-backed targets; 0 human-approved; 0 sent. |
| `npm run gtm:hosted-review:buyer-loop -- --write --allow-blocked` | pass/report written | `webapp-gtm-hosted-review-buyer-loop.log`; `ops/paperclip/reports/exact-site-hosted-review-buyer-loop/global/2026-05-14/buyer-loop.md` | `loop_status: decision_due`; `durability_status: blocked`; 30 founder approvals needed. |
| `npm run gtm:send -- --dry-run --allow-blocked` | blocked with exit 0 because allow-blocked | `webapp-gtm-send-dry-run-after-approval-guidance.log` | `eligible: 0`; `skipped_approval: 30`; approval workflow next action printed. |
| `npm run human-replies:audit-durability -- --allow-not-ready` | blocked with exit 0 because allow-not-ready | `webapp-human-replies-audit-durability.log` | Sender verification unknown; approved email not explicit in env; Gmail OAuth credentials missing. |
| `npm run city-launch:preflight -- --city "Durham, NC" --budget-max-usd 0 --budget-tier lean --window-hours 72 --allow-blocked --no-write-report --no-write-deep-research-blocker --format markdown` | blocked with exit 0 because allow-blocked | `webapp-city-launch-preflight-durham-lean-72h.log` | `earliest_hard_blocker_key: deep_research_city_plan`; required Deep Research credentials/account access or valid playbook. |
| `PYTHONDONTWRITEBYTECODE=1 python3 ./scripts/validate_launch_readiness_tests.py` | pass | `capture-validate-launch-readiness-tests.log` | `Ran 17 tests`; `OK`. |
| `./scripts/archive_external_alpha.sh --validate-config-only` | fail as expected | `capture-archive-external-alpha-validate-config-only.log` | `Stage: release_config_blocked`; missing `BLUEPRINT_PAYOUT_PROVIDER`. |
| `./scripts/android_alpha_readiness.sh --validate-config-only` | fail as expected | `capture-android-alpha-readiness-validate-config-only.log` | `Stage: android_release_config_blocked`; missing `BLUEPRINT_BACKEND_BASE_URL`. |
| `PYTHONDONTWRITEBYTECODE=1 pytest tests/test_webapp_sync.py tests/test_launch_proof_policy.py tests/test_site_world_packaging.py -q` | pass | `pipeline-pytest-webapp-launch-site-world.log` | `21 passed in 16.67s`. |
| `PYTHONDONTWRITEBYTECODE=1 python3 scripts/run_paid_marketplace_launch_gate.py` | pass at automated/manual boundary | `pipeline-run-paid-marketplace-launch-gate.log`; `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/output/paid_marketplace_launch_gate.md` | `overall_status=automated_contracts_passed_manual_ops_required`. |
| `npx vitest run server/tests/gtm-send-executor.test.ts` | pass | `webapp-vitest-gtm-send-executor.log` | `4 tests` passed. |
| `npm run check` after fix | pass | `webapp-npm-run-check-after-gtm-send-fix.log` | `EXIT_CODE=0`. |
| `bash scripts/graphify/run-webapp-architecture-pilot.sh --no-viz` | pass | `webapp-graphify-architecture-pilot-no-viz.log` | `status: ok`; canonical `graphify-out` refreshed. |

## Remaining Live / Human Inputs

- Capture iOS/external alpha config: real `BLUEPRINT_PAYOUT_PROVIDER` in ignored release xcconfig, plus subsequent payout/provider readiness proof.
- Capture Android config: real Android release properties, starting with `BLUEPRINT_BACKEND_BASE_URL`.
- Real-device proof: iPhone, glasses, and Android discovery/reservation/upload screen recordings with the same `capture_job_id`.
- Pipeline/provider proof: live provider/world output evidence, Android operator/toolchain evidence, and real upstream IDs.
- WebApp buyer proof: authenticated buyer artifact/fulfillment access after purchase.
- Stripe proof: live checkout/payment settlement, live connected-account payout readiness, live payout settlement, payout exception monitor, KYC/background-check decision, and human finance owner.
- GTM human approval: founder/operator approve, edit, or reject 30 recipient-backed first-send drafts.
- GTM reply durability: set `BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified`, explicitly set `BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=ohstnhunt@gmail.com`, provide Gmail OAuth credentials, and prove watcher/resume.
- City launch/Paperclip: provide Deep Research credentials/account access or a valid completed Durham playbook, then create/record missing child issue ids and checkpoint closeouts.

## Why No More Reversible Work Remains

The remaining gaps are secrets/config, real device evidence, provider/account access, live Stripe/payment/payout proof, founder/operator approval, live reply watcher credentials, or Paperclip/live city planning state. Advancing those in repo would require fabricating readiness or mutating live/external state without the required human or account input.

## Linked Evidence Paths

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/output/launch-readiness-gap-closeout-2026-05-14/`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/reports/exact-site-hosted-review-buyer-loop/global/2026-05-14/buyer-loop.md`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/output/paid_marketplace_launch_gate.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/reports/city-launch-execution/durham-nc/2026-05-07T00-11-20.556Z/deep-research-blocker-packet.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/reports/city-launch-deep-research/durham-nc/2026-05-06T23-08-48.567Z/manifest.json`
