# Cross-Source Claims Guard Report

Root: `/home/user/Blueprint-WebApp`
Scanned files: 506
Findings: 2

## Target Surfaces

| Source group | Target | Status |
| --- | --- | --- |
| root_doctrine | `AGENTS.md` | scanned |
| root_doctrine | `README.md` | scanned |
| root_doctrine | `PLATFORM_CONTEXT.md` | scanned |
| root_doctrine | `WORLD_MODEL_STRATEGY_CONTEXT.md` | scanned |
| root_doctrine | `AUTONOMOUS_ORG.md` | scanned |
| root_doctrine | `client/src/AGENTS.md` | scanned |
| root_doctrine | `docs/ai-tooling-adoption-implementation-2026-04-07.md` | scanned |
| root_doctrine | `docs/ai-skills-governance-2026-04-07.md` | scanned |
| webapp_pages | `client/src/pages` | scanned |
| webapp_pages | `client/src/data/content` | scanned |
| webapp_pages | `client/src/data/content/publicPages.ts` | scanned |
| webapp_pages | `client/src/lib/proofEvidence.ts` | scanned |
| capture_public_copy_docs | `../BlueprintCapture/docs/PUBLIC_COPY_TRUTH_INDEX_2026-05-24.md` | missing |
| gtm_artifacts | `scripts/gtm` | scanned |
| gtm_artifacts | `ops/paperclip/playbooks` | scanned |
| notion_ready_markdown | `knowledge/reports` | scanned |
| notion_ready_markdown | `knowledge/compiled` | scanned |
| generated_reports | `output` | scanned |

## Findings

| File | Line | Claim type | Claim text | Owner proof required | Safe replacement |
| --- | ---: | --- | --- | --- | --- |
| `client/src/pages/Agents.tsx` | 60 | payment_or_payout_claim | "npx tsx scripts/agent-access/blueprint-agent-cli.ts commerce checkout --site-world-id <pipeline-site-world-id> --product hosted-session-rental --mode live --budget-cents 20000", | Stripe checkout/webhook/entitlement state for payment claims and Stripe Connect payout ledger plus approved policy for payout claims. | Treat forms and CTAs as requests; use `payout eligibility reviewed after accepted capture` or `payment state confirmed after checkout`. |
| `ops/paperclip/playbooks/city-capture-target-ledger-austin-tx.md` | 20 | unsupported_hosted_session_proof | - Warehouse / fulfillment / 3PL (tier_1): Still the clearest real robot workflow lane for exact-site hosted review, brownfield automation, and case-handling proof. | hosted-session runtime/session artifacts, entitlement path, package manifest, and live availability evidence for the exact request. | Use `book hosted review` or `hosted review is confirmed per site/request` until runtime and entitlement proof exists. |

## Claim Type Counts

| Claim type | Count |
| --- | ---: |
| payment_or_payout_claim | 1 |
| unsupported_hosted_session_proof | 1 |
