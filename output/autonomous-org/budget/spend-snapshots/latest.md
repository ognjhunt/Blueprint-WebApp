# Autonomous Spend Snapshot

Generated: 2026-06-01T04:37:00.505Z
Mode: live-read
Keychain: enabled (20 loaded)
Window: 2026-06-01T00:00:00.000Z to 2026-06-01T04:37:00.505Z
Live mutation attempted: no
Secrets persisted: no

## Totals

- Source target total: $500.00
- Live billing verified: $0.00
- Credit-balance sources: 2
- Usage-only sources: 3
- Missing or unverified target: $500.00

## Sources

| source | provider | status | proof_level | amount_usd | missing_to_verify |
|---|---|---|---|---:|---|
| paperclip_declared_agent_envelope | Paperclip | manual_export_loaded | repo-local-export | 173.00 | live Paperclip runtime propagation and model/provider billing export |
| openai_api_costs | OpenAI | live_billing_verified | live-billing | 0.00 |  |
| codex_oauth_pro_seat | OpenAI | outside_budget_excluded | repo-local-config |  |  |
| openrouter_credits | OpenRouter | live_read_error | missing |  | successful read-only provider response |
| deepseek_balance | DeepSeek | live_credit_balance_verified | live-credit-balance |  | DeepSeek monthly usage or invoice export |
| digitalocean_billing | DigitalOcean | live_usage_verified | live-usage |  | DigitalOcean invoice preview amount |
| render_inventory | Render | live_usage_verified | live-usage |  | Render billing endpoint, invoice export, or dashboard proof |
| sendgrid_credits | SendGrid | live_credit_balance_verified | live-credit-balance |  | SendGrid plan cost or billing export |
| github_billing_usage | GitHub | live_read_error | missing |  | successful read-only provider response |
| backblaze_b2_account | Backblaze | live_usage_verified | live-usage |  | Backblaze billing export or B2 usage pricing reconciliation |
| gcp_firebase_billing_export | Google Cloud | missing_credentials | missing |  | GCP_BILLING_EXPORT_JSON |
| firebase_project_config | Firebase | credential_presence_only | repo-local-config |  | live billing or usage adapter |
| upstash_redis_usage | Upstash | missing_credentials | missing |  | UPSTASH_API_KEY; UPSTASH_EMAIL |
| cloudflare_billing_profile | Cloudflare | missing_credentials | missing |  | CLOUDFLARE_API_TOKEN; CLOUDFLARE_ACCOUNT_ID |
| posthog_usage | PostHog | missing_credentials | missing |  | POSTHOG_PERSONAL_API_KEY; POSTHOG_HOST; POSTHOG_PROJECT_ID |
| search_research_api_spend | Search / research APIs | missing_credentials | missing |  | one of: PARALLEL_API_KEY, PARALLEL_SEARCH_API_KEY, PERPLEXITY_API_KEY, TAVILY_API_KEY, SERPAPI_API_KEY |
| recipient_evidence_enrichment | GTM evidence / enrichment providers | credential_presence_only | repo-local-config |  | live billing or usage adapter |
| profiles_owned_growth_ops | Organic/profile operations | credential_presence_only | repo-local-config |  | live billing or usage adapter |
| meta_ads_spend | Meta | missing_credentials | missing |  | META_ACCESS_TOKEN; META_AD_ACCOUNT_ID |
| google_ads_billing | Google Ads | missing_credentials | missing |  | GOOGLE_ADS_CUSTOMER_ID; GOOGLE_ADS_DEVELOPER_TOKEN; GOOGLE_ADS_REFRESH_TOKEN; GOOGLE_ADS_CLIENT_ID; GOOGLE_ADS_CLIENT_SECRET |
| runway_api_credits | Runway | credential_presence_only | repo-local-config |  | live billing or usage adapter |
| worldlabs_api_credits | World Labs | credential_presence_only | repo-local-config |  | live billing or usage adapter |
| slack_billing | Slack | missing_credentials | missing |  | SLACK_BOT_TOKEN |

## Missing Inputs

- gcp_firebase_billing_export: GCP_BILLING_EXPORT_JSON
- upstash_redis_usage: UPSTASH_API_KEY; UPSTASH_EMAIL
- cloudflare_billing_profile: CLOUDFLARE_API_TOKEN; CLOUDFLARE_ACCOUNT_ID
- posthog_usage: POSTHOG_PERSONAL_API_KEY; POSTHOG_HOST; POSTHOG_PROJECT_ID
- search_research_api_spend: one of: PARALLEL_API_KEY, PARALLEL_SEARCH_API_KEY, PERPLEXITY_API_KEY, TAVILY_API_KEY, SERPAPI_API_KEY
- meta_ads_spend: META_ACCESS_TOKEN; META_AD_ACCOUNT_ID
- google_ads_billing: GOOGLE_ADS_CUSTOMER_ID; GOOGLE_ADS_DEVELOPER_TOKEN; GOOGLE_ADS_REFRESH_TOKEN; GOOGLE_ADS_CLIENT_ID; GOOGLE_ADS_CLIENT_SECRET
- slack_billing: SLACK_BOT_TOKEN
