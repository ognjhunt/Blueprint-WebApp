# AutoAgent Canary Rollback Decision

Status: keep_canary
Generated at: 2026-05-29T21:57:33.297Z
Candidate id: autoagent-to-paperclip-hermes-prompt-policy-gate-2026-05-28
Canary lane: support_triage
Dry run: true
Apply rollback requested: false

## Triggered Rules

- none

## Reasons

- Canary evidence is clean against rollback thresholds.

## Evidence Paths

- /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/canary/canary-plan.json
- /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/shadow-comparison/latest/support-triage-shadow-records.json

## Counts

- shadow_records: 20
- mismatched_decision_fields: 0
- canary_output_unavailable: 0
- runtime_provider_auth_failures: 0

## Command Outputs

### read canary plan /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/recursive-improvement/latest/canary/canary-plan.json
exit_code: 0
```text
candidate=autoagent-to-paperclip-hermes-prompt-policy-gate-2026-05-28
status=dry_run
```

### offline AutoAgent eval summary supplied by caller
exit_code: 0
```text
cases=4
failed=0
negative_controls_blocked=6/6
```

### read local AutoAgent shadow summary /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/shadow-comparison/latest/support-triage-shadow-records.json
exit_code: 0
```text
shadow_records=20
```

### live Paperclip AutoAgent shadow read
exit_code: 0
```text
disabled
```
