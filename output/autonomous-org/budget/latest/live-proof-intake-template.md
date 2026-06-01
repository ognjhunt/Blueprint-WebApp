# Live Proof Intake Template

Generated: 2026-06-01T14:43:48.558Z
State: `awaiting_human_decision`
Blocker id: `autonomous-org-budget-live-proof-20260601`

This is a fillable template for owner-system billing/export proof. It does not verify spend by itself, call providers, store secrets, or authorize live mutation.

## Guardrails

- Codex OAuth/Pro target: $0.00 and excluded from the $500 launch/growth budget.
- OpenAI API target: $0.00; current verified amount: $0.00.
- Partial source proof remains blocking until owner-system proof is attached and the verifier passes.
- Live spend movement still requires explicit human approval after proof is attached.

## Accepted Artifact Types

- `billing_export_json`
- `invoice_pdf`
- `dashboard_screenshot`
- `provider_usage_csv`
- `read_only_api_snapshot`
- `receipt`
- `explicit_no_spend_confirmation`

## Required Fields

- `artifact_path`
- `artifact_type`
- `owner_system_account_label`
- `billing_period_start`
- `billing_period_end`
- `current_period_amount_usd`
- `currency`
- `source_system_generated_at`
- `source_system_export_id_or_invoice_id`
- `human_confirmation`

## Items

| Item | Status | Target | Owner System | Needed Proof |
|---|---:|---:|---|---|
| `deepseek-openrouter-usage-export` | `partial_source_proof` | $80.00 | DeepSeek API account and OpenRouter account if used | DeepSeek monthly usage or invoice export, plus valid OpenRouter credit/billing read or export if any DeepSeek runs route through OpenRouter. |
| `render-billing-export` | `partial_source_proof` | $25.00 | Render account billing | Render billing endpoint proof, current invoice export, dashboard screenshot/export, or other owner-system billing artifact for the current period. |
| `digitalocean-cloudflare-billing` | `partial_source_proof` | $30.00 | DigitalOcean billing, Cloudflare account billing, and Paperclip host ledger | Current DigitalOcean invoice preview/export or dashboard proof, plus Cloudflare billing profile/export if the tunnel has billable spend. |
| `firebase-gcp-billing-export` | `partial_source_proof` | $25.00 | Google Cloud Billing export for Firebase project blueprint-8c1ca | GCP/Firebase Cloud Billing export or BigQuery billing export JSON for the current period. |
| `redis-upstash-billing` | `open` | $10.00 | Redis / Upstash account billing | Upstash/Redis billing endpoint result, usage export, invoice, or dashboard proof. |
| `email-human-reply-slack-billing-readiness` | `partial_source_proof` | $7.00 | SendGrid, Gmail human-reply path, and Slack workspace | SendGrid plan/billing export, Slack admin billing/export if paid, and safe human-reply/sender readiness audit output. |
| `analytics-billing-kpi-proof` | `open` | $0.00 | PostHog, GA4, or Firestore analytics mirror | Analytics export or owner-system KPI proof for allocation outcomes; billing proof if paid analytics is introduced. |
| `search-research-api-billing` | `open` | $45.00 | Search or research API provider account | Provider identity plus billing or usage export for Parallel, Perplexity, Tavily, SerpAPI, or whichever search provider is used. |
| `recipient-evidence-enrichment-receipts` | `partial_source_proof` | $35.00 | GTM evidence/enrichment providers and recipient evidence artifacts | Receipts, provider exports, or repo-local recipient evidence artifacts tied to exact-site hosted-review outcomes. |
| `profiles-listings-receipts` | `partial_source_proof` | $20.00 | Owned growth/profile/listing surfaces | Receipt, invoice, provider export, or owner-system proof for any paid profile/listing spend. |
| `ad-spend-paused-draft-proof` | `open` | $50.00 | Meta Ads and Google Ads accounts | Read-only ad spend/export proof and paused-draft evidence before any paid city/launch experiment can be considered. |
| `live-paperclip-routine-propagation` | `partial_source_proof` | $173.00 | Paperclip runtime state | Live Paperclip runtime inventory or issue/routine run proof showing the compressed routine set is propagated. |

## Fillable JSON Shape

Copy one `artifact_intake_template` block per proof artifact, fill it in, and keep the resulting proof intake local unless explicitly approved for a safe repo artifact.
