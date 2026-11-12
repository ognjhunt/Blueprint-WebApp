---
name: Recursive Agent Improvement Loop
project: blueprint-webapp
assignee: webapp-codex
recurring: true
---

Run the scheduled recursive AutoResearch improvement loop for Blueprint.

This routine is dry-run/report-only by default. It observes local failure artifacts, evaluates low-risk candidates, and writes repo-local evidence for review without mutating live Paperclip/Hermes behavior, Notion, providers, payments, rights, city launch, hosted-session fulfillment, or external messages.

Authoritative policy:

- Human-readable tiers: `docs/architecture/autoagent-autoresearch-operating-policy.md`
- Machine enforcement: `server/agents/autoagent-promotion-policy.ts`
- Production action allowlist: `server/agents/autoagent-production-action-registry.ts`

Default command:

```bash
npm run autoagent:recursive-improve -- --dry-run
```

Production context dry-run:

```bash
npm run autoagent:recursive-improve -- --production-context --ai-production-proposal --dry-run
```

Explicit production canary mode:

```bash
npm run autoagent:recursive-improve -- --production-context --ai-production-proposal --execute-production-canary
```

Production canary mode is not a routine default. Use it only when a separate bound issue explicitly authorizes the allowlisted production path. The AI proposer writes a proposal only; it never executes. The deterministic validator must pass the production action registry, offline eval, promotion gate, canary dry-run, rollback monitor, idempotency check, audit proof write, and rollback snapshot check before any production canary action can commit.

Required repo-local outputs:

- `output/autoagent/recursive-improvement/latest/summary.json`
- `output/autoagent/recursive-improvement/latest/report.md`
- `output/autoagent/recursive-improvement/latest/production-context/context-bundle.json` when production context is requested
- `output/autoagent/recursive-improvement/latest/production-proposal-summary.json` when an AI production proposal is requested
- `output/autoagent/recursive-improvement/latest/production-canary/audit-event.json` when an explicit production canary action executes
- `output/autoagent/recursive-improvement/latest/production-canary/execution.json` and `execution-report.md` when an explicit production canary action executes

`summary.json` must include `status`, `proof_paths`, `next_action`, `retry_condition`, and `residual_risk` for every terminal branch.

Each run must:

- start from the bound Paperclip routine issue context and `git status --short`
- run the default command from `/Users/nijelhunt_1/workspace/Blueprint-WebApp`
- inspect `output/autoagent/recursive-improvement/latest/summary.json` and `output/autoagent/recursive-improvement/latest/report.md`
- require `summary.live_mutation_attempted` and `summary.live_mutation_committed` to remain `false` unless the run used `--execute-production-canary` and the action was registry-approved
- inspect production summary fields when production context is requested: `production_context_built`, `ai_production_proposal_used`, `production_proposal_status`, `production_action_type`, `production_target_system`, `production_canary_attempted`, `production_canary_result`, `idempotency_key`, `audit_event_path`, `rollback_snapshot_path`, `rollback_applied`, `live_mutation_attempted`, and `live_mutation_committed`
- require `summary.policy_tier` to be present and to match the central policy tier that decided the run
- keep the report local unless an explicit issue instruction asks for a Paperclip summary after the repo report exists
- classify repeat no-change output as `no_change_report_only` when there is no new failure family, no new proof path, no generated fixture, the same held reason, and the same selected candidate
- when classified `no_change_report_only`, close the routine issue with the report path and do not create duplicate follow-up issues
- when a low-risk candidate is found, leave the report path and the smallest next bounded issue instead of applying changes directly

Apply mode is off by default:

- Do not run `--auto-apply-low-risk`, `--apply-canary`, or `--apply-rollback` unless a separate bound issue explicitly requests apply mode.
- Apply mode must remain limited to central-policy-approved low-risk AutoAgent lanes from `server/agents/autoagent-promotion-policy.ts`.
- The only current repo-local canary lane is `support_triage`; `waitlist_triage` is human/policy-gated and `preview_diagnosis` is shadow-only unless the policy file changes explicitly.
- Prefer `--auto-apply-low-risk` for approved repo-local apply issues so the loop derives eligibility from central policy and writes `auto_apply_*`, `rollback_monitor_result`, `rollback_applied`, and `live_mutation_attempted=false` summary fields.
- Apply mode still cannot perform live sends, payments, payouts, provider execution, rights/privacy/legal decisions, city-live work, customer claims, operational launch readiness claims, or hosted-session fulfillment.
- If the allowed-lane policy, promotion gate, canary plan, or rollback monitor rejects the candidate, stop and close as blocked with the earliest hard stop.

Production mode constraints:

- `--production-context` may build deterministic owner-system context, proof, and rollback snapshot artifacts. It does not mutate production.
- `--ai-production-proposal` may request one strong AI proposal from the configured command/session. If unavailable, the loop must fall back with `production_proposal_status=fallback_ai_unavailable` and no mutation.
- `--execute-production-canary` is the only flag that may request a production canary. It must still pass deterministic registry validation and idempotency before commit.
- The initial allowed live action is only `paperclip_hermes_internal_metadata_update`.
- The next allowed live action is `paperclip_internal_report_pointer_update`, but only after `production-canary/execution.json` proves a committed `paperclip_hermes_internal_metadata_update`.
- `paperclip_internal_report_pointer_update` may mutate only `metadata.autoagent.latest_production_report_pointer`, with owner system `paperclip_hermes`, proof source `paperclip_issue_metadata_snapshot`, canary limit `1` per run, and rollback strategy `restore_previous_report_pointer_snapshot`.
- Its stop conditions are missing first-lane proof, missing owner-system proof, report pointer outside `output/autoagent/`, duplicate idempotency, rollback monitor trigger, or explicit stop condition.
- External sends, payments/entitlements, provider execution, hosted-session fulfillment, rights/privacy/legal, city launch, customer claims, operational launch readiness claims, Firestore export, Notion writes, and broad live Paperclip/Hermes mutation remain blocked.
- Duplicate production idempotency keys must return `production_proposal_status=duplicate_idempotency` and `production_canary_result=duplicate_idempotency_suppressed`, with no duplicate action.
- Stop conditions must write audit proof and automatically roll back from the rollback snapshot when triggered.

Escalate only when:

- a high-risk lane needs a policy decision
- live credentials are missing for a live-only check
- rollback failed or the rollback monitor requires rollback
- a repeated critical failure family has no safe offline eval target

Forbidden by this routine:

- external sends or outreach
- payments, payouts, Stripe mutation, or entitlement grants
- provider jobs, paid creative/video execution, or live research jobs
- rights, privacy, legal, city-live, customer-claim, operational launch readiness, or hosted-session fulfillment decisions
- Notion writes unless explicitly configured as a review mirror after the repo report is written
- production Paperclip reconcile, repair, import, bootstrap, or host restart work

Closeout must include:

- Goal objective:
- Issue/run id:
- Budget/timeout context:
- Stage reached:
- State claimed:
- Owner:
- Blocker/decision id:
- Proof paths:
- Command outputs:
- Requirement coverage:
- Next action:
- Retry/resume condition:
- Residual risk:

Do not claim live readiness. This routine proves only the repo-local recursive improvement report and any explicitly allowed low-risk local canary evidence.
