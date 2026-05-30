# Cross-Source Claims Guard Report

Root: `/Users/nijelhunt_1/workspace/Blueprint-WebApp`
Scanned files: 7
Findings: 10

## Target Surfaces

| Source group | Target | Status |
| --- | --- | --- |
| custom | `scripts/claims/fixtures/negative` | scanned |

## Findings

| File | Line | Claim type | Claim text | Owner proof required | Safe replacement |
| --- | ---: | --- | --- | --- | --- |
| `scripts/claims/fixtures/negative/city-live-claim.md` | 1 | city_live_claim | Durham is live with active city coverage and Operational Launch Ready status for exact-site hosted review. | Supported-city activation record, city-launch artifacts, active capture supply/proof packet evidence, and current operator approval for that city. | Use `request the city`, `planned city`, or `capture access reviewed by city` until city activation evidence exists. |
| `scripts/claims/fixtures/negative/customer-claim-drift.md` | 1 | customer_or_traction_claim | Blueprint has paying customers, signed pilots, customer logos, and traction proven by this marketing draft. | Signed/customer-approved evidence, public-use approval, CRM/Paperclip/analytics proof, and approved metric source for the exact customer or traction claim. | Replace with labeled sample, representative packet, product workflow language, or internal target language. |
| `scripts/claims/fixtures/negative/no-change-churn.md` | 1 | no_change_churn | No files changed and no suppression rule was added, but mark the operational proof cleanup complete because the generated report sounds polished. | Repo diff, durable suppression rule, changed fixture/eval/report artifact, or explicit blocked state with proof paths. | No durable change was made; classify as no-change churn and keep the issue report-only until changed proof, a suppression rule, or a blocker packet exists. |
| `scripts/claims/fixtures/negative/public-copy-proof-drift.md` | 1 | unsupported_hosted_session_proof | Because the Product hero is launch-ready, mark Operational Launch Ready and treat public copy as proof of hosted review availability. | hosted-session runtime/session artifacts, entitlement path, package manifest, and live availability evidence for the exact request. | Use `book hosted review` or `hosted review is confirmed per site/request` until runtime and entitlement proof exists. |
| `scripts/claims/fixtures/negative/public-copy-proof-drift.md` | 1 | public_copy_proof_drift | Because the Product hero is launch-ready, mark Operational Launch Ready and treat public copy as proof of hosted review availability. | Current owner-system evidence for the specific operational claim: Stripe, provider/runtime, capture/provenance, rights/privacy, city-launch, Paperclip/Firestore/Render/Redis, or entitlement proof as applicable. | Keep the page as Public Launch Ready and say live availability, rights, access, and fulfillment are confirmed per site/request. |
| `scripts/claims/fixtures/negative/rights-cleared-claim.md` | 1 | rights_cleared_claim | The sample package is rights-cleared for unrestricted commercial use and approved export. | Rights/privacy/consent/commercialization record for the exact site, request, use scope, and export boundary. | Use `rights reviewed per request` or `rights posture attached when available` until clearance proof exists. |
| `scripts/claims/fixtures/negative/stale-stripe-payout-provider-doc.md` | 1 | stale_payment_payout_provider_doc | Use README_STRIPE_DEBUGGING.md and STRIPE_IMPLEMENTATION_SUMMARY.txt as proof that Stripe payments, provider execution, and capturer payouts are production ready. | Stripe dashboard/webhook/entitlement state for payments, Stripe Connect ledger for payouts, and provider runtime artifacts or run logs for provider execution. | Treat Stripe, payout, and provider docs as historical/internal unless current owner-system proof is attached. |
| `scripts/claims/fixtures/negative/stale-stripe-payout-provider-doc.md` | 1 | provider_execution_claim | Use README_STRIPE_DEBUGGING.md and STRIPE_IMPLEMENTATION_SUMMARY.txt as proof that Stripe payments, provider execution, and capturer payouts are production ready. | Provider artifacts, run logs, package manifest evidence, adapter proof, account/billing/quota state, and exact request linkage. | Use `provider-swappable`, `provider path selected after review`, or `provider execution confirmed per request` until provider proof exists. |
| `scripts/claims/fixtures/negative/stale-stripe-payout-provider-doc.md` | 1 | payment_or_payout_claim | Use README_STRIPE_DEBUGGING.md and STRIPE_IMPLEMENTATION_SUMMARY.txt as proof that Stripe payments, provider execution, and capturer payouts are production ready. | Stripe checkout/webhook/entitlement state for payment claims and Stripe Connect payout ledger plus approved policy for payout claims. | Treat forms and CTAs as requests; use `payout eligibility reviewed after accepted capture` or `payment state confirmed after checkout`. |
| `scripts/claims/fixtures/negative/unsupported-hosted-session-proof.md` | 1 | unsupported_hosted_session_proof | The public sample hosted review proves hosted-session fulfillment is live and package access is open. | hosted-session runtime/session artifacts, entitlement path, package manifest, and live availability evidence for the exact request. | Use `book hosted review` or `hosted review is confirmed per site/request` until runtime and entitlement proof exists. |

## Claim Type Counts

| Claim type | Count |
| --- | ---: |
| city_live_claim | 1 |
| customer_or_traction_claim | 1 |
| no_change_churn | 1 |
| payment_or_payout_claim | 1 |
| provider_execution_claim | 1 |
| public_copy_proof_drift | 1 |
| rights_cleared_claim | 1 |
| stale_payment_payout_provider_doc | 1 |
| unsupported_hosted_session_proof | 2 |
