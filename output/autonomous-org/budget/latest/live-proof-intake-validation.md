# Live Proof Intake Validation

Generated: 2026-06-01T14:43:49.596Z
State: `awaiting_human_decision`
Blocker id: `autonomous-org-budget-live-proof-20260601`

This validator makes no provider calls and does not count artifacts as live billing proof. Accepted rows are only ready for manual review and later reconciliation.

## Summary

- Total items: 12
- Accepted for manual review: 0
- Missing submissions: 12
- Rejected submissions: 0
- Intake complete: no
- Proof ready to count as live billing: no
- Codex OAuth/Pro target: $0.00 and excluded from the $500 budget
- OpenAI API current-period spend: $0.00

## Items

| Item | Status | Amount | Errors | Warnings |
|---|---:|---:|---|---|
| `deepseek-openrouter-usage-export` | `missing_submission` | missing |  | no artifact submitted yet |
| `render-billing-export` | `missing_submission` | missing |  | no artifact submitted yet |
| `digitalocean-cloudflare-billing` | `missing_submission` | missing |  | no artifact submitted yet |
| `firebase-gcp-billing-export` | `missing_submission` | missing |  | no artifact submitted yet |
| `redis-upstash-billing` | `missing_submission` | missing |  | no artifact submitted yet |
| `email-human-reply-slack-billing-readiness` | `missing_submission` | missing |  | no artifact submitted yet |
| `analytics-billing-kpi-proof` | `missing_submission` | missing |  | no artifact submitted yet |
| `search-research-api-billing` | `missing_submission` | missing |  | no artifact submitted yet |
| `recipient-evidence-enrichment-receipts` | `missing_submission` | missing |  | no artifact submitted yet |
| `profiles-listings-receipts` | `missing_submission` | missing |  | no artifact submitted yet |
| `ad-spend-paused-draft-proof` | `missing_submission` | missing |  | no artifact submitted yet |
| `live-paperclip-routine-propagation` | `missing_submission` | missing |  | no artifact submitted yet |

## Required Next Commands

- `npm run autonomy:budget:live-proof:reconcile`
- `npm run autonomy:budget:live-proof:template`
- `npm run autonomy:budget:live-proof:validate`
- `npm run autonomy:budget:verify`
