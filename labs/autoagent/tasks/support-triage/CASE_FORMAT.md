# Support Triage Case Format

## Required Files

### `input.json`

Matches the production `SupportTriageInput` contract.

### `expected.json`

Required fields:

- `automation_status`
- `category`
- `queue`
- `priority`
- `requires_human_review`

Optional graded fields:

- `suggested_response`
- `rationale`

### `labels.json`

Example:

```json
{
  "risk_tier": "medium",
  "requires_human_review": true,
  "unsafe_auto_clear_penalty": 8.0,
  "wrong_queue_penalty": 3.0,
  "response_quality_weight": 0.5
}
```
