# AutoAgent Canary Rollback Decision

Status: insufficient_evidence
Generated at: 2026-05-29T14:10:17.039Z
Candidate id: autoagent-to-paperclip-hermes-prompt-policy-gate-2026-05-28
Canary lane: unknown
Dry run: true
Apply rollback requested: false

## Triggered Rules

- none

## Reasons

- No AutoAgent shadow records exist; missing evidence cannot count as canary success.

## Evidence Paths

- /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/canary/latest/canary-plan.json
- /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/canary/latest/shadow-summary.json

## Counts

- shadow_records: 0
- mismatched_decision_fields: 0
- canary_output_unavailable: 0
- runtime_provider_auth_failures: 0

## Command Outputs

### read canary plan /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/canary/latest/canary-plan.json
exit_code: 0
```text
candidate=autoagent-to-paperclip-hermes-prompt-policy-gate-2026-05-28
status=rejected
```

### offline AutoAgent eval runPipeline(exportLive=false,sample=3)
exit_code: 0
```text
export_mode=offline_seed
cases=9
failed=0
negative_controls_blocked=12/12
```

### read local AutoAgent shadow summary /Users/nijelhunt_1/workspace/Blueprint-WebApp/output/autoagent/canary/latest/shadow-summary.json
exit_code: 1
```text
local shadow summary not found
```

### live Paperclip AutoAgent shadow read
exit_code: 0
```text
disabled
```
