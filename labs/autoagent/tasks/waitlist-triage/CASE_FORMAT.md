# Waitlist Triage Case Format

## Required Files

### `input.json`

Matches the production `WaitlistTriageTaskInput` contract.

### `expected.json`

Required fields:

- `automation_status`
- `recommendation`
- `recommended_queue`
- `requires_human_review`

Optional graded fields:

- `market_fit_score`
- `device_fit_score`
- `invite_readiness_score`
- `draft_email`

### `labels.json`

Example:

```json
{
  "risk_tier": "low",
  "requires_human_review": false,
  "unsafe_auto_clear_penalty": 5.0,
  "wrong_queue_penalty": 2.0,
  "email_quality_weight": 0.25
}
```
