# Autonomous Spend Snapshot

Generated: 2026-06-01T04:09:18.455Z
Mode: local-inventory
Keychain: disabled
Window: 2026-06-01T00:00:00.000Z to 2026-06-01T04:09:18.455Z
Live mutation attempted: no
Secrets persisted: no

## Totals

- Source target total: $500.00
- Live billing verified: $0.00
- Credit-balance sources: 0
- Usage-only sources: 0
- Missing or unverified target: $500.00

## Sources

| source | provider | status | proof_level | amount_usd | missing_to_verify |
|---|---|---|---|---:|---|
| paperclip_declared_agent_envelope | Paperclip | manual_export_loaded | repo-local-export | 173.00 | live Paperclip runtime propagation and model/provider billing export |
| openai_api_costs | OpenAI | missing_credentials | missing |  | OPENAI_ADMIN_KEY |
| codex_oauth_pro_seat | OpenAI | outside_budget_excluded | repo-local-config |  |  |
| openrouter_credits | OpenRouter | configured_not_queried | repo-local-config |  | rerun with --live-read for read-only provider query |
| deepseek_balance | DeepSeek | configured_not_queried | repo-local-config |  | rerun with --live-read for read-only provider query |
| digitalocean_billing | DigitalOcean | missing_credentials | missing |  | DIGITALOCEAN_TOKEN |
| render_inventory | Render | missing_credentials | missing |  | RENDER_API_KEY |
| sendgrid_credits | SendGrid | configured_not_queried | repo-local-config |  | rerun with --live-read for read-only provider query |
| github_billing_usage | GitHub | missing_credentials | missing |  | GITHUB_BILLING_OWNER; GITHUB_BILLING_OWNER_TYPE; one of: GITHUB_TOKEN, GITHUB_CLASSIC_TOKEN |
| backblaze_b2_account | Backblaze | missing_credentials | missing |  | BACKBLAZE_B2_KEY_ID; BACKBLAZE_B2_APPLICATION_KEY |
| gcp_firebase_billing_export | Google Cloud | missing_credentials | missing |  | GCP_BILLING_EXPORT_JSON |
| firebase_project_config | Firebase | missing_credentials | missing |  | FIREBASE_PROJECT_ID; FIREBASE_PROJECT_NUMBER; FIREBASE_WEB_API_KEY; FIREBASE_AUTH_DOMAIN; FIREBASE_DATABASE_URL; FIREBASE_STORAGE_BUCKET; FIREBASE_MESSAGING_SENDER_ID; FIREBASE_APP_ID; FIREBASE_MEASUREMENT_ID |
| upstash_redis_usage | Upstash | missing_credentials | missing |  | UPSTASH_API_KEY; UPSTASH_EMAIL |
| cloudflare_billing_profile | Cloudflare | missing_credentials | missing |  | CLOUDFLARE_API_TOKEN; CLOUDFLARE_ACCOUNT_ID |
| posthog_usage | PostHog | missing_credentials | missing |  | POSTHOG_PERSONAL_API_KEY; POSTHOG_HOST; POSTHOG_PROJECT_ID |
| search_research_api_spend | Search / research APIs | missing_credentials | missing |  | one of: PARALLEL_API_KEY, PARALLEL_SEARCH_API_KEY, PERPLEXITY_API_KEY, TAVILY_API_KEY, SERPAPI_API_KEY |
| recipient_evidence_enrichment | GTM evidence / enrichment providers | configured_not_queried | repo-local-config |  | rerun with --live-read for read-only provider query |
| profiles_owned_growth_ops | Organic/profile operations | configured_not_queried | repo-local-config |  | rerun with --live-read for read-only provider query |
| meta_ads_spend | Meta | missing_credentials | missing |  | META_ACCESS_TOKEN; META_AD_ACCOUNT_ID |
| google_ads_billing | Google Ads | missing_credentials | missing |  | GOOGLE_ADS_CUSTOMER_ID; GOOGLE_ADS_DEVELOPER_TOKEN; GOOGLE_ADS_REFRESH_TOKEN; GOOGLE_ADS_CLIENT_ID; GOOGLE_ADS_CLIENT_SECRET |
| runway_api_credits | Runway | configured_not_queried | repo-local-config |  | rerun with --live-read for read-only provider query |
| worldlabs_api_credits | World Labs | missing_credentials | missing |  | WORLDLABS_API_KEY |
| slack_billing | Slack | missing_credentials | missing |  | SLACK_BOT_TOKEN |

## Missing Inputs

- openai_api_costs: OPENAI_ADMIN_KEY
- digitalocean_billing: DIGITALOCEAN_TOKEN
- render_inventory: RENDER_API_KEY
- github_billing_usage: GITHUB_BILLING_OWNER; GITHUB_BILLING_OWNER_TYPE; one of: GITHUB_TOKEN, GITHUB_CLASSIC_TOKEN
- backblaze_b2_account: BACKBLAZE_B2_KEY_ID; BACKBLAZE_B2_APPLICATION_KEY
- gcp_firebase_billing_export: GCP_BILLING_EXPORT_JSON
- firebase_project_config: FIREBASE_PROJECT_ID; FIREBASE_PROJECT_NUMBER; FIREBASE_WEB_API_KEY; FIREBASE_AUTH_DOMAIN; FIREBASE_DATABASE_URL; FIREBASE_STORAGE_BUCKET; FIREBASE_MESSAGING_SENDER_ID; FIREBASE_APP_ID; FIREBASE_MEASUREMENT_ID
- upstash_redis_usage: UPSTASH_API_KEY; UPSTASH_EMAIL
- cloudflare_billing_profile: CLOUDFLARE_API_TOKEN; CLOUDFLARE_ACCOUNT_ID
- posthog_usage: POSTHOG_PERSONAL_API_KEY; POSTHOG_HOST; POSTHOG_PROJECT_ID
- search_research_api_spend: one of: PARALLEL_API_KEY, PARALLEL_SEARCH_API_KEY, PERPLEXITY_API_KEY, TAVILY_API_KEY, SERPAPI_API_KEY
- meta_ads_spend: META_ACCESS_TOKEN; META_AD_ACCOUNT_ID
- google_ads_billing: GOOGLE_ADS_CUSTOMER_ID; GOOGLE_ADS_DEVELOPER_TOKEN; GOOGLE_ADS_REFRESH_TOKEN; GOOGLE_ADS_CLIENT_ID; GOOGLE_ADS_CLIENT_SECRET
- worldlabs_api_credits: WORLDLABS_API_KEY
- slack_billing: SLACK_BOT_TOKEN
