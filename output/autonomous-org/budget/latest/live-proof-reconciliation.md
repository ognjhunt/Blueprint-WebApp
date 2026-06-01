# Live Proof Reconciliation

Generated: 2026-06-01T14:43:47.476Z
State: `awaiting_human_decision`
Blocker id: `autonomous-org-budget-live-proof-20260601`

No live provider calls were made by this reconciliation command. It only read the repo-local backlog and the existing redacted spend snapshot.

## Summary

- Total live-proof items: 12
- Closed items: 0
- Partial source proof items: 8
- Open/blocking items: 12
- Live mutation attempted: no
- Secrets persisted: no
- Codex OAuth/Pro target: $0.00 and excluded from the $500 launch/growth budget
- OpenAI API current-period spend: $0.00 with target $0.00

## Items

| Item | Status | Sources | Remaining Proof | Next Action |
|---|---:|---|---|---|
| `deepseek-openrouter-usage-export` | `partial_source_proof` | deepseek_balance:partial, openrouter_credits:partial | DeepSeek monthly usage or invoice export, plus valid OpenRouter credit/billing read or export if any DeepSeek runs route through OpenRouter. | Attach the requested proof or confirmation, then rerun the safe proof command. Required input: DeepSeek usage/invoice export for the current month; valid OpenRouter API key or dashboard export only if OpenRouter is used. |
| `render-billing-export` | `partial_source_proof` | render_inventory:partial | Render billing endpoint proof, current invoice export, dashboard screenshot/export, or other owner-system billing artifact for the current period. | Attach the requested proof or confirmation, then rerun the safe proof command. Required input: Render billing export/dashboard proof if the API cannot return current billing. |
| `digitalocean-cloudflare-billing` | `partial_source_proof` | digitalocean_billing:partial, cloudflare_billing_profile:missing | Current DigitalOcean invoice preview/export or dashboard proof, plus Cloudflare billing profile/export if the tunnel has billable spend. | Attach the requested proof or confirmation, then rerun the safe proof command. Required input: Cloudflare account id/token if tunnel billing is relevant; DigitalOcean invoice export if API preview remains absent. |
| `firebase-gcp-billing-export` | `partial_source_proof` | gcp_firebase_billing_export:missing, firebase_project_config:partial | GCP/Firebase Cloud Billing export or BigQuery billing export JSON for the current period. | Attach the requested proof or confirmation, then rerun the safe proof command. Required input: Local exported JSON report path in GCP_BILLING_EXPORT_JSON, or a future read-only BigQuery billing query adapter. |
| `redis-upstash-billing` | `open` | upstash_redis_usage:missing | Upstash/Redis billing endpoint result, usage export, invoice, or dashboard proof. | Attach the requested proof or confirmation, then rerun the safe proof command. Required input: UPSTASH_API_KEY and UPSTASH_EMAIL, or a current invoice/export artifact. |
| `email-human-reply-slack-billing-readiness` | `partial_source_proof` | sendgrid_credits:partial, slack_billing:missing | SendGrid plan/billing export, Slack admin billing/export if paid, and safe human-reply/sender readiness audit output. | Attach the requested proof or confirmation, then rerun the safe proof command. Required input: SLACK_BOT_TOKEN if Slack billing/usage proof is needed; SendGrid billing export or dashboard proof; sender/domain verification state for live sends. |
| `analytics-billing-kpi-proof` | `open` | posthog_usage:missing | Analytics export or owner-system KPI proof for allocation outcomes; billing proof if paid analytics is introduced. | Attach the requested proof or confirmation, then rerun the safe proof command. Required input: POSTHOG_PERSONAL_API_KEY/host/project id or a local GA4/PostHog/Firestore export when analytics is used for allocation. |
| `search-research-api-billing` | `open` | search_research_api_spend:missing | Provider identity plus billing or usage export for Parallel, Perplexity, Tavily, SerpAPI, or whichever search provider is used. | Attach the requested proof or confirmation, then rerun the safe proof command. Required input: One of PARALLEL_API_KEY, PARALLEL_SEARCH_API_KEY, PERPLEXITY_API_KEY, TAVILY_API_KEY, or SERPAPI_API_KEY, plus billing/export proof. |
| `recipient-evidence-enrichment-receipts` | `partial_source_proof` | recipient_evidence_enrichment:partial | Receipts, provider exports, or repo-local recipient evidence artifacts tied to exact-site hosted-review outcomes. | Attach the requested proof or confirmation, then rerun the safe proof command. Required input: Human-supplied receipts/provider export path, or fresh recipient-backed GTM evidence artifacts. |
| `profiles-listings-receipts` | `partial_source_proof` | profiles_owned_growth_ops:partial | Receipt, invoice, provider export, or owner-system proof for any paid profile/listing spend. | Attach the requested proof or confirmation, then rerun the safe proof command. Required input: Manual receipt/export path if any profile or listing spend occurs. |
| `ad-spend-paused-draft-proof` | `open` | meta_ads_spend:missing, google_ads_billing:missing | Read-only ad spend/export proof and paused-draft evidence before any paid city/launch experiment can be considered. | Attach the requested proof or confirmation, then rerun the safe proof command. Required input: META_ACCESS_TOKEN and META_AD_ACCOUNT_ID, or Google Ads customer/developer/OAuth credentials, plus human approval before launch. |
| `live-paperclip-routine-propagation` | `partial_source_proof` | paperclip_declared_agent_envelope:partial | Live Paperclip runtime inventory or issue/routine run proof showing the compressed routine set is propagated. | Attach the requested proof or confirmation, then rerun the safe proof command. Required input: If live runtime propagation is required, run an explicit read-only Paperclip runtime proof task with approval for any live access; do not reconcile or mutate. |

## Guardrails

- Partial proof is not spend proof. Credit balances, service inventory, credential presence, and repo-local config do not close a budget line.
- Spend-affecting moves still require human approval before live systems act.
- This packet does not authorize sends, ads, provider jobs, payment actions, production mutations, hosted-session fulfillment, city activation, or Operational Launch Ready claims.

## Safe Resume Commands

- `npm run autonomy:spend:snapshot`
- `npm run autonomy:spend:snapshot:keychain -- --live-read --out-dir output/autonomous-org/budget/spend-snapshots/keychain-live-read-2026-06-01`
- `npm run autonomy:outcomes:snapshot`
- `npm run autonomy:budget:recommend`
- `npm run autonomy:budget:dynamic:verify`
- `npm run autonomy:budget:live-proof:reconcile`
- `npm run autonomy:budget:live-proof:template`
- `npm run autonomy:budget:live-proof:validate`
- `npm run autonomy:budget:verify`
