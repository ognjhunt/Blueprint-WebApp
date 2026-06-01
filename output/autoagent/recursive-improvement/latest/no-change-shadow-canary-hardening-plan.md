# AutoAgent No-Change, Shadow, And Canary Hardening Plan

Generated: 2026-05-31T22:32Z
Scope: repo-local plan artifact only. No source-code patch was applied.

## Objective

Harden AutoAgent no-change suppression and `support_triage` shadow/canary evidence without live mutation.

## Doctrine Boundary

- AutoAgent/AutoResearch may write deterministic local reports, fixtures, promotion packets, and repo-local canary artifacts.
- Local eval, generated reports, public copy, and shadow evidence do not prove production automation quality.
- `support_triage` is the only repo-local canary lane.
- `waitlist_triage` stays human/policy-gated.
- `preview_diagnosis` stays shadow-only.
- Live sends, payments, provider execution, hosted-session fulfillment, rights/privacy/legal, city-live, customer claims, Notion writes, Firestore export, Render mutation, and live Paperclip/Hermes mutation remain blocked for this goal.

## Commands Run

1. `git status --short`
   - Initial dirty tree: untracked `docs/research/` and `outputs/`.
   - Those were inspected and left untouched.

2. `npm run agent:cost-cache-report`
   - Exit: 0.
   - Data source: local fixture fallback, not Firestore.
   - Runs scanned: 4.
   - Waste signals:
     - `low_cache_high_prompt`: 2 runs, 4200 prompt tokens, 420 cached tokens.
     - `no_change_completed`: 1 run, sample `fixture-no-change`.
     - `duplicate_suppressed`: 1 run, sample `fixture-duplicate-suppressed`.

3. `npm run autoagent:run -- --sample 3`
   - Exit: 0.
   - Export mode: `offline_seed`; live Firestore export skipped.
   - Overall: 11/11 cases passed, 16/16 negative controls blocked.
   - `support_triage`: 4/4 cases passed, 6/6 negative controls blocked, splits dev=1 holdout=1 shadow=2.

4. `npm run autoagent:recursive-improve -- --dry-run`
   - Exit: 0.
   - Status: `promotion_held`.
   - Selected family: `human_gate_or_reply_durability_blocker`.
   - Offline eval: 10/10 cases passed, 14/14 negative controls blocked.
   - Promotion decision: `hold`.
   - Policy tier: `human_policy_gated`.
   - Canary: `not_run_promotion_hold`.
   - Rollback monitor: `not_run`.
   - Live mutation attempted: false.
   - Live mutation committed: false.

## Current Evidence

- Recursive summary: `/Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/summary.json`
- Recursive report: `/Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/report.md`
- Promotion packet: `/Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/promotion-gate/promotion-packet.md`
- Shadow summary: `/Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/shadow-comparison/latest/support-triage-shadow-summary.json`
- Shadow report: `/Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/shadow-comparison/latest/support-triage-shadow-report.md`

Shadow evidence currently says:

- Generated at: 2026-05-29T21:56:42.757Z.
- Lane: `support_triage`.
- Sample count: 20.
- Clean sample count: 20.
- Regression count: 0.
- Safety blockers: none.
- Mismatched decision fields: none.
- No-regression window days: 14.

## Findings

1. The requested dry-run did not reach canary evaluation because the current promotion candidate includes `waitlist_triage`, `support_triage`, and `preview_diagnosis`; central policy correctly held the mixed candidate on the human/policy-gated and shadow-only lanes.

2. `support_triage` shadow evidence is clean, but the current recursive run consumed an existing 2026-05-29 shadow artifact rather than regenerating or copying a current-run shadow summary into the recursive output. That is acceptable as historical repo-local evidence, but weak as current-run canary proof unless freshness and fixture/candidate binding are explicit.

3. `output/autoagent/recursive-improvement/latest/` still contains stale sibling artifacts from prior canary and production-context runs dated 2026-05-29. The 2026-05-31 summary does not claim them, but consumers that inspect `latest/` broadly could overread stale canary/production files as current-run evidence.

4. No-change suppression exists in `scripts/autoagent/run-recursive-improvement-loop.ts`, but it only activates after the same selected candidate, same family, same held reason, no fixture, and no new proof repeat from the previous summary. The cost-cache report still exposes a `no_change_completed` waste signal, and the current observer ranked no-change churn only after broader human-gate, copy/proof, and live-side-effect families.

5. Runtime duplicate active-run suppression exists separately in `server/agents/runtime.ts`, and cost telemetry can report `duplicate_suppressed`; that is useful but does not cover completed no-change repeats after an active run has ended.

## Ranked Patch Plan

### P0: Bind `latest/` artifacts to the current recursive run

Target:
- `scripts/autoagent/run-recursive-improvement-loop.ts`
- `scripts/autoagent/run-recursive-improvement-loop.test.ts`

Patch:
- Add a current-run manifest under `output/autoagent/recursive-improvement/latest/run-manifest.json`.
- Record `generated_at`, command mode, proof paths written during this invocation, and excluded stale sibling directories.
- Make `report.md` render "Current-run proof paths" separately from "Existing referenced evidence".
- Either clean stage directories that are not reached in this invocation or mark their files stale/excluded in the manifest.

Validation:
- `npm exec -- vitest run scripts/autoagent/run-recursive-improvement-loop.test.ts`
- `npm run autoagent:recursive-improve -- --dry-run`

Success criteria:
- A dry run that stops at `promotion_held` cannot leave prior canary or production artifacts looking like current-run proof.
- `summary.json` and `report.md` remain the only authoritative current-run closeout artifacts unless a reached stage writes and registers proof.

### P1: Make `support_triage` shadow proof freshness explicit

Target:
- `scripts/autoagent/write-support-triage-shadow-comparison.ts`
- `scripts/autoagent/prompt-policy-promotion-gate.ts`
- `scripts/autoagent/run-recursive-improvement-loop.ts`
- matching tests

Patch:
- Include fixture hashes, candidate id, candidate hash, generated_at, and record count in the shadow summary.
- Have the promotion gate validate that shadow records, summary, and report all exist and match the candidate/lane being reviewed.
- Have the recursive loop copy the accepted shadow summary metrics into `summary.json`, not only the records path.
- Fail closed, or hold, when a `support_triage` canary claim has missing, mismatched, or stale shadow binding.

Validation:
- `npm exec -- vitest run scripts/autoagent/write-support-triage-shadow-comparison.test.ts scripts/autoagent/prompt-policy-promotion-gate.test.ts scripts/autoagent/run-recursive-improvement-loop.test.ts`
- `npm run autoagent:shadow:compare -- --sample-count 20 --no-regression-window-days 14`
- `npm run autoagent:recursive-improve -- --dry-run --lane support_triage`

Success criteria:
- Clean `support_triage` shadow evidence is current enough, lane-bound, candidate-bound, and visible in recursive-loop summary output.

### P2: Add a first-class `support_triage`-only canary evidence path

Target:
- `labs/autoagent/promotion-candidates/`
- `scripts/autoagent/run-recursive-improvement-loop.ts`
- `scripts/autoagent/prompt-policy-promotion-gate.ts`
- matching tests

Patch:
- Add or generate a `support_triage`-only candidate manifest for repo-local canary evidence.
- Keep the mixed waitlist/support/preview manifest for cross-lane policy review only.
- When the user asks specifically for `support_triage` shadow/canary evidence, select or scope the central-policy-approved low-risk lane before broad recurrence ranking hides it behind human-gated families.

Validation:
- `npm run autoagent:run -- --sample 3`
- `npm run autoagent:recursive-improve -- --dry-run --lane support_triage`

Success criteria:
- `support_triage` can reach canary dry-run evaluation when offline evals, negative controls, shadow evidence, rollback metadata, and central policy pass.
- `waitlist_triage` and `preview_diagnosis` remain held or shadow-only.

### P3: Route cost-cache `no_change_completed` into durable no-change suppression

Target:
- `scripts/agent-cache-cost-report.ts`
- `server/utils/agentCostTelemetry.ts`
- `scripts/autoagent/run-recursive-improvement-loop.ts`
- `scripts/paperclip/agent-improvement-observer.ts`
- matching tests

Patch:
- Add a machine-readable cost-cache report option that exposes `no_change_completed` and `duplicate_suppressed` signals as structured JSON.
- Let the recursive observer consume that JSON as an input root or explicit flag.
- When a goal targets no-change hardening, prioritize `no_change_closeout_churn` over broader recurrence families if the cost report has an unsuppressed `no_change_completed` signal.
- Emit `no_change_report_only` with a durable suppression key when the repeat has no changed proof, no new artifact, and the same blocker family.

Validation:
- `npm run agent:cost-cache-report -- --from-json server/tests/fixtures/agent-cost-cache-runs.json`
- `npm exec -- vitest run scripts/agent-cache-cost-report.test.ts scripts/autoagent/run-recursive-improvement-loop.test.ts scripts/paperclip/agent-improvement-observer.test.ts`

Success criteria:
- A completed no-change run becomes report-only or blocked until it has changed proof, a durable suppression rule, or an explicit blocker packet.
- The signal does not depend on live Firestore.

### P4: Extend no-change cooldown beyond active-run duplicate suppression

Target:
- `server/agents/runtime.ts`
- `server/tests/agent-session-runtime.test.ts`
- `server/utils/agentCostTelemetry.ts`

Patch:
- Keep existing active duplicate suppression.
- Add a conservative same-session no-change cooldown for completed runs whose normalized closeout indicates no material movement and no changed proof.
- Store the suppression reason in runtime metadata so cost telemetry can count avoided runs.

Validation:
- `npm exec -- vitest run server/tests/agent-session-runtime.test.ts`
- `npm run agent:cost-cache-report -- --from-json server/tests/fixtures/agent-cost-cache-runs.json`

Success criteria:
- Repeated no-change checks after a completed no-change run are suppressed or coalesced locally without suppressing legitimate new proof, new blocker state, or new issue-bound evidence.

## Recommended Next Safe Patch

Implement P0 and P1 together only if the patch stays local and testable. P0 prevents stale proof overreads. P1 makes the existing clean `support_triage` shadow evidence strong enough to feed canary review without pretending it is live production proof.

Stop before P2/P4 if the patch would require live Paperclip/Hermes state, live Firestore export, or policy widening beyond `support_triage`.

## Closeout

State claimed: done
Owner: webapp-codex
Proof paths: this artifact; recursive summary/report; promotion packet; support-triage shadow summary/report
Command outputs: listed above
Next action: implement P0/P1 as a bounded repo-local code patch with focused tests
Retry/resume condition: rerun when a patch is authorized or when new AutoAgent evidence changes the ranked queue
Residual risk: this plan does not prove live Paperclip/Hermes mutation, production automation quality, hosted-session fulfillment, provider recovery, payments, sends, rights/privacy/legal clearance, city-live state, customer claims, or operational launch readiness
