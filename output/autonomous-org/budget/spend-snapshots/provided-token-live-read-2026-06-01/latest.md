# Autonomous Spend Snapshot

Generated: 2026-06-01T02:48:26.650Z
Mode: live-read
Window: 2026-06-01T00:00:00.000Z to 2026-06-01T02:48:26.650Z
Live mutation attempted: no
Secrets persisted: no

## Totals

- Source target total: $435.00
- Live billing verified: $0.00
- Credit-balance sources: 2
- Usage-only sources: 3
- Missing or unverified target: $435.00

## Sources

| source | provider | status | proof_level | amount_usd | missing_to_verify |
|---|---|---|---|---:|---|
| paperclip_declared_agent_envelope | Paperclip | manual_export_loaded | repo-local-export | 173.00 | live Paperclip runtime propagation and model/provider billing export |
| openai_api_costs | OpenAI | missing_credentials | missing |  | OPENAI_ADMIN_KEY |
| deepseek_balance | DeepSeek | live_credit_balance_verified | live-credit-balance |  | DeepSeek monthly usage or invoice export |
| digitalocean_billing | DigitalOcean | live_usage_verified | live-usage |  | DigitalOcean invoice preview amount |
| render_inventory | Render | live_usage_verified | live-usage |  | Render billing endpoint, invoice export, or dashboard proof |
| sendgrid_credits | SendGrid | live_credit_balance_verified | live-credit-balance |  | SendGrid plan cost or billing export |
| github_billing_usage | GitHub | live_read_error | missing |  | successful read-only provider response |
| backblaze_b2_account | Backblaze | live_usage_verified | live-usage |  | Backblaze billing export or B2 usage pricing reconciliation |
| runway_api_credits | Runway | credential_presence_only | repo-local-config |  | live billing or usage adapter |
| worldlabs_api_credits | World Labs | credential_presence_only | repo-local-config |  | live billing or usage adapter |

## Missing Inputs

- openai_api_costs: OPENAI_ADMIN_KEY
