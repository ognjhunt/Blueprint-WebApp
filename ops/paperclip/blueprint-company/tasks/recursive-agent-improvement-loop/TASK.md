---
name: Recursive Agent Improvement Loop
project: blueprint-webapp
assignee: webapp-codex
recurring: true
---

Run the scheduled recursive AutoResearch improvement loop for Blueprint.

This routine is dry-run/report-only by default. It observes local failure artifacts, evaluates low-risk candidates, and writes repo-local evidence for review without mutating live Paperclip/Hermes behavior, Notion, providers, payments, rights, city launch, hosted-session fulfillment, or external messages.

Default command:

```bash
npm run autoagent:recursive-improve -- --dry-run
```

Required repo-local outputs:

- `output/autoagent/recursive-improvement/latest/summary.json`
- `output/autoagent/recursive-improvement/latest/report.md`

Each run must:

- start from the bound Paperclip routine issue context and `git status --short`
- run the default command from `/Users/nijelhunt_1/workspace/Blueprint-WebApp`
- inspect `output/autoagent/recursive-improvement/latest/summary.json` and `output/autoagent/recursive-improvement/latest/report.md`
- require `summary.live_mutation_attempted` to remain `false`
- keep the report local unless an explicit issue instruction asks for a Paperclip summary after the repo report exists
- classify repeat no-change output as `no_change_report_only` when there is no new failure family, no new proof path, no changed candidate, or only repeated no-change closeout churn
- when classified `no_change_report_only`, close the routine issue with the report path and do not create duplicate follow-up issues
- when a low-risk candidate is found, leave the report path and the smallest next bounded issue instead of applying changes directly

Apply mode is off by default:

- Do not run `--apply-canary` or `--apply-rollback` unless a separate bound issue explicitly requests apply mode.
- Apply mode must remain limited to central-policy-approved low-risk AutoAgent lanes from `server/agents/autoagent-promotion-policy.ts`.
- Apply mode still cannot perform live sends, payments, payouts, provider execution, rights/privacy/legal decisions, city-live work, customer claims, operational launch readiness claims, or hosted-session fulfillment.
- If the allowed-lane policy, promotion gate, canary plan, or rollback monitor rejects the candidate, stop and close as blocked with the earliest hard stop.

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
