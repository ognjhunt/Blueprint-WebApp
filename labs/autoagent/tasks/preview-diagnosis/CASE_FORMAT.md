# Preview Diagnosis Case Format

## Required Files

### `input.json`

Matches the production `PreviewDiagnosisInput` contract.

### `expected.json`

Required fields:

- `automation_status`
- `disposition`
- `retryable`
- `requires_human_review`
- `queue`

Optional graded fields:

- `retry_recommended`
- `rationale`

### `labels.json`

Example:

```json
{
  "risk_tier": "high",
  "requires_human_review": true,
  "unsafe_auto_clear_penalty": 10.0,
  "wrong_retry_penalty": 6.0,
  "wrong_escalation_penalty": 5.0
}
```
