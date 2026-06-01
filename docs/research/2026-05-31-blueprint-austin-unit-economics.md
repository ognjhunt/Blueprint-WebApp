# Blueprint Austin Unit Economics Memo

Date: 2026-05-31
Scope: Austin, TX launch wedge for capture-backed exact-site world-model packages and Exact-Site Hosted Review for robot teams.
Status: modeled investor memo, not operational launch proof.

## Executive Answer

Blueprint can be contribution-margin positive per Austin site up front if the first sites stay tightly bounded: package access is sold before heavy custom work, hosted review is metered, capturer payouts are QA/rights/scope gated, and complex or private sites carry custom pricing instead of being forced into the standard package band.

The base modeled Austin site produces about **$3,190 revenue**, **$1,518 direct delivery COGS**, **$1,672 direct gross margin**, and **$1,172 contribution after a $500 variable city acquisition allocation**. That is enough to make individual site economics work. It is not enough to claim Austin is operationally live or fixed-cost profitable from the first one or two sales. A lean Austin loop needs roughly **$10k-$15k** to get moving if the founder absorbs management time; **$25k-$40k** is the healthier first-30-day base cash plan.

Hard caveat: Austin currently has launch playbooks and activation-ready posture, but the repo evidence still says first live capture is blocked until named sites, rights/access posture, proof packs, and hosted reviews materialize. This memo must not be used as proof of city-live coverage, rights clearance, payout readiness, provider execution, or hosted-session fulfillment.

## Repo-Observed Product Inputs

These are repo-observed proof inputs, not live operational proof:

- `client/src/pages/Pricing.tsx` exposes current public package pricing of **$2,100-$3,400** and hosted review pricing of **$16-$29 per session-hour**, with custom scope at **$50,000+** for larger/non-standard work.
- `client/src/pages/ExactSiteHostedReview.tsx` frames the buyer flow as indoor site capture -> world-model package -> hosted evaluation -> export/recapture decision, with proof and rights boundaries visible.
- `server/routes/site-world-sessions.ts` gates protected launch through robot-team account checks, hosted-session entitlement proof, launch-readiness checks, runtime handles, render/media/control proxying, and Firestore/live session state.
- `server/utils/accounting.ts` models buyer orders, marketplace entitlements, creator payouts, delivery modes, payment state, fulfillment state, and payout state.
- `server/routes/creator.ts` records creator captures, estimated payout cents, review status, rights profile, earnings status, and payout ledger state.
- `server/routes/internal-pipeline.ts` expects upstream identifiers such as site submission, buyer request, and capture job identifiers before pipeline sync can attach capture/job context.
- `ops/paperclip/playbooks/city-launch-austin-tx.md` keeps Austin as an activation-ready, gated cohort pilot, but blocks operational reality until rights-cleared sites, proof packs, and hosted reviews exist.
- `ops/paperclip/playbooks/city-launch-austin-tx-indoor-location-supply-report.md` is explicitly not proof of approved capture targets, rights clearance, operator approval, payable work, or derived-world-model readiness.
- `/Users/nijelhunt_1/workspace/BlueprintCapture/README.md` and `AGENTS.md` define Capture as the evidence client that preserves raw walkthrough truth, manifests, upload completion, and no-fake payout/provider/rights posture.
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/README.md` and `AGENTS.md` define Pipeline as the packaging/trust/runtime layer that turns raw bundles into QA, privacy, provenance, rights/compliance, provider/preview, package, and hosted artifacts without treating downstream artifacts as capture truth.

## Low/Base/High Per-Site Model

Assumption formula:

`revenue = package price + hosted hours * hosted rate + optional custom add-on`

`direct delivery COGS = capturer payout + QA + pipeline/model conversion + storage/upload + hosted runtime + support + payment fees + rights/ops reserve + recapture risk`

`contribution = gross margin - variable city acquisition allocation`

Payment fee uses Stripe's current standard online domestic card benchmark, **2.9% + $0.30 per successful transaction**. Connect/payout ops are treated as part of the rights/ops reserve unless the platform chooses the Stripe Connect pricing model where Blueprint handles user pricing.

| Scenario | Revenue | Direct delivery COGS | Gross margin | Gross margin % | Variable city acquisition allocation | Contribution margin | Contribution % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Low / simple common-access site | $2,228 | $800 | $1,428 | 64.1% | $250 | $1,178 | 52.9% |
| Base / standard buyer-led site | $3,190 | $1,518 | $1,672 | 52.4% | $500 | $1,172 | 36.7% |
| High / complex site with modest add-on | $6,060 | $3,551 | $2,509 | 41.4% | $900 | $1,609 | 26.6% |

Scenario detail:

| Scenario | Package | Hosted hours | Hosted rate | Add-on/custom | Capturer | QA | Pipeline/model conversion | Storage/upload | Hosted runtime | Support | Rights/ops reserve | Recapture risk | Payment fee |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Low | $2,100 | 8 | $16/hr | $0 | $125 | $120 | $180 | $20 | $40 | $100 | $150 | $0 | $65 |
| Base | $2,750 | 20 | $22/hr | $0 | $250 | $180 | $350 | $35 | $120 | $160 | $250 | $80 | $93 |
| High | $3,400 | 40 | $29/hr | $1,500 | $650 | $320 | $850 | $85 | $420 | $300 | $500 | $250 | $176 |

Interpretation:

- The low and base cases work because package revenue absorbs fixed per-site workflow costs that hosted-only pricing cannot cover.
- The high case still works only because complex sites get a custom add-on. Without custom pricing, complex private/multi-zone sites become margin traps.
- The $1,500 high-case add-on is not the public `$50,000+` custom enterprise tier; it is a modeled surcharge for moderate complexity. True private/multi-site/operator-heavy work should move to the repo's custom-scope path.

## Hosted Session-Hour Economics

Hosted review is useful margin expansion after a package sale, but it is not a strong standalone first-city business unless utilization is very high.

| Hosted case | Buyer rate | Runtime / infra | Support | Ops reserve | Payment fee | Direct margin / hour | Direct margin % |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Low | $16/hr | $4.00 | $3.00 | $1.00 | $0.76 | $7.24 | 45.2% |
| Base | $22/hr | $6.00 | $4.00 | $1.50 | $0.94 | $9.56 | 43.5% |
| High | $29/hr | $12.00 | $5.00 | $2.00 | $1.14 | $8.86 | 30.5% |

Break-even implication:

- At $12k/month fixed city spend, hosted-only break-even would require roughly **1,255 base-rate hosted hours/month** at $9.56 margin/hour.
- The same $12k/month fixed spend needs about **11 base package sites/month** after the variable city acquisition allocation, or about **8 base package sites/month** if first-city acquisition is treated as fixed city spend instead of per-site variable CAC.

## Capturer Payout Recommendation

These are non-guaranteed, operator-editable payout recommendations. They are not public earnings claims and are not live payout readiness. Actual payout should require assignment acceptance, capture upload, QA review, rights/access review, and approved payout state.

| Site complexity | Typical capture work | Travel/admin buffer | QA and recapture risk | Suggested payout band |
| --- | --- | --- | --- | ---: |
| Simple common-access | 30-45 minute walkthrough; compact indoor common area; low privacy density | 20-30 minutes travel + 15 minutes upload/admin | Low, if access is clear and route is complete | $85-$125 |
| Standard buyer-led | 60-90 minute walkthrough; one main workflow route; moderate occlusion/lighting issues | 30-45 minutes travel + 20-30 minutes upload/admin | Moderate; one QA pass likely | $150-$250 |
| Complex multi-zone | 2-3.5 hours capture; multi-zone route, shelves/equipment, denser robot workflow detail | 45-60 minutes travel + 30-45 minutes upload/admin | Higher; recapture reserve required | $325-$600 |
| High-complexity/private | 4-6 hours capture; multi-floor/private/operator-supervised; privacy-sensitive or staff/back-of-house constraints | 60-90 minutes travel + 45 minutes upload/admin | High; human rights/privacy review and custom quote required | $750-$1,200+ with custom approval |

Rationale:

- BLS's Austin May 2024 release puts all-occupation mean hourly wage at **$34.32**, architecture/engineering at **$49.18**, installation/maintenance/repair at **$28.56**, production at **$22.69**, and transportation/material moving at **$21.32**. Capture payouts need to compensate for skilled on-site work, local travel, upload/admin time, and independent-contractor variability, not just raw walkthrough minutes.
- The IRS 2026 business mileage benchmark is **72.5 cents per mile**, so a 20-30 mile round trip alone consumes roughly **$15-$22** of payout value before labor, admin, and risk.
- Matterport's own pricing page confirms users can capture with phone/tablet/camera or hire scan service providers; public scan-service examples commonly quote per-square-foot or minimum project pricing. Blueprint should not copy real estate tour pricing directly, because Blueprint's buyer value is proof/provenance/world-model review, not a listing tour.

## First-City Austin Cash Plan

| Plan | One-time setup | First 30 days | First 90 days | Operating assumption |
| --- | ---: | ---: | ---: | --- |
| Minimum lean launch | $3k-$6k | $10k-$15k | $25k-$45k | Founder handles sales, rights triage, QA, and ops; BYOD capturers; 3-5 paid captures; 2-3 paid package attempts; no broad paid acquisition. |
| Base launch | $10k-$18k | $25k-$40k | $60k-$110k | Small rights/legal budget, ops contractor, capturer coordinator time, 8-15 capture attempts, 6-10 package sales target, modest recruiting and buyer-outreach spend. |
| Better-funded launch | $30k-$55k | $60k-$90k | $150k-$250k | Equipment pool, faster support/QA, provider/GPU retry budget, legal review, structured outbound, and larger first-wave capturer/buyer cohort. |

Working capital recommendation:

- **Minimum viable cash to move the first loop:** $10k-$15k if founder time is unpaid and site scope stays simple.
- **Pragmatic base cash float:** $25k-$40k for the first 30 days, because rights review, QA, recapture, provider retries, buyer support, and payment/payout ops should not be run at zero reserve.
- **Do not spend into complex/private sites** without a custom quote, operator authorization, and rights/privacy review; the standard package band is not designed to absorb that risk.

## Break-Even

| Monthly fixed Austin spend | Fixed spend contents | Base direct-delivery margin break-even | Base contribution break-even after $500 variable CAC | Hosted-only break-even at base $22/hr |
| ---: | --- | ---: | ---: | ---: |
| $5,000 | Founder-led ops, minimal tooling, targeted recruiting/outreach | 3 base sites/month | 5 base sites/month | 523 hosted hours/month |
| $12,000 | Part-time ops/QA/support, modest rights/legal, recruiting/outreach budget | 8 base sites/month | 11 base sites/month | 1,255 hosted hours/month |
| $30,000 | Better-funded city pod with legal/retry/support/equipment reserve | 18 base sites/month | 26 base sites/month | 3,138 hosted hours/month |

Conclusion: Austin should be managed as a package-led launch, not hosted-only SaaS. Hosted review increases expansion and buyer stickiness after proof-backed packages exist, but package revenue is what covers capture, QA, rights, conversion, and support.

## Value Chain

1. Buyer names an exact site, robot workflow, deployment question, and desired review path.
2. WebApp routes the request to an existing package, hosted review, new capture request, or custom scope. Pricing and payment remain proof/rights/access gated.
3. Ops validates site scope, access posture, rights/privacy sensitivity, target area, estimated minutes, complexity, and payout recommendation.
4. Capturer accepts a bounded assignment with non-guaranteed/operator-editable payout terms.
5. BlueprintCapture records the raw walkthrough bundle, manifests, context, motion/walkthrough evidence, and upload-complete markers.
6. Pipeline validates raw capture integrity, QA, privacy, rights/compliance, provenance, world-model fit, provider/preview status, recapture needs, and payout recommendation.
7. WebApp internal pipeline sync attaches site submission, buyer request, capture job, package, and artifact identifiers.
8. Rights/provenance review decides whether the package can be buyer-visible, needs redaction/recapture, or must be blocked.
9. Entitlement/accounting creates buyer order, package access, hosted-session entitlement, payment state, fulfillment state, and delivery mode.
10. Hosted review starts only if account, entitlement, runtime readiness, and session access checks pass.
11. Buyer uses package and hosted review for run notes, observations, export/recapture decisions, and implementation next steps.
12. Payout/accounting only moves after QA/rights/scope/payment evidence supports the approved payout state.

## Pitch-Deck Version

Slide headline: **Austin sites can be margin-positive before the city is fixed-cost profitable.**

Bullets:

- Base site economics: **$3.19k revenue**, **$1.52k delivery COGS**, **$1.67k direct margin**, **$1.17k contribution after variable city acquisition allocation**.
- Package access is the profit engine; hosted review adds margin and workflow lock-in but cannot carry first-city fixed costs alone.
- First Austin wedge should stay to **5-10 vetted professional capturers** and bounded public/common-access or buyer-authorized sites.
- Capturer payouts should be **review-gated, non-guaranteed, and operator-editable**, with simple sites around **$85-$125**, standard sites **$150-$250**, and complex sites **$325-$600+**.
- Healthy first-30-day base cash float is **$25k-$40k**; lean first loop can start at **$10k-$15k** only if founder time carries sales, QA, rights, and ops.
- At $12k/month fixed city spend, Blueprint needs about **11 base sites/month** after variable CAC, or **8 base sites/month** if acquisition is treated as fixed launch spend.
- Complex/private sites need custom pricing or the standard package band gets consumed by rights review, recapture, provider retries, support, and payout risk.

Compact slide table:

| Case | Revenue/site | Direct COGS | Direct margin | Contribution after CAC | Best use |
| --- | ---: | ---: | ---: | ---: | --- |
| Simple | $2.23k | $0.80k | $1.43k | $1.18k | Common-access/public proof path |
| Base | $3.19k | $1.52k | $1.67k | $1.17k | Standard buyer-led Austin package |
| Complex | $6.06k | $3.55k | $2.51k | $1.61k | Custom-priced higher-risk site |

## Research Appendix

All external sources were checked on 2026-05-31. Source labels distinguish current price inputs from modeled assumptions.

| Source | Source date | Used for | Label |
| --- | --- | --- | --- |
| [BLS OEWS tables](https://www.bls.gov/oes/tables.htm) | May 2025 data page | Latest OEWS table availability and current official wage source path. | Current public data source |
| [BLS Austin occupational employment and wages](https://www.bls.gov/regions/southwest/news-release/2025/occupationalemploymentandwages_austin_20250617.htm) | 2025-06-17 release, May 2024 data | Austin mean hourly wage benchmarks for all occupations and major groups. | Current official wage benchmark |
| [IRS 2026 standard mileage rate](https://www.irs.gov/newsroom/irs-sets-2026-business-standard-mileage-rate-at-725-cents-per-mile-up-25-cents) | 2025-12-29 | Business mileage buffer at 72.5 cents/mile. | Current official travel-cost input |
| [Stripe pricing](https://stripe.com/pricing) | Current page accessed 2026-05-31 | 2.9% + $0.30 online domestic card transaction fee. | Current payment price input |
| [Stripe Connect pricing](https://stripe.com/connect/pricing) | Current page accessed 2026-05-31 | Marketplace/platform payout pricing options: no platform fee under Stripe-handled pricing; $2 monthly active account plus 0.25% + $0.25 per payout when platform handles pricing. | Current payout/platform price input |
| [Firebase pricing](https://firebase.google.com/pricing) | Current page accessed 2026-05-31 | Blaze pay-as-you-go, no-cost Firestore/Auth/Storage thresholds, Firebase Storage upload/download operations. | Current app/storage price input |
| [Google Cloud Firestore pricing](https://cloud.google.com/firestore/pricing) | Current page accessed 2026-05-31 | Firestore charges for reads/writes/deletes/storage/network and free daily quota. | Current datastore price input |
| [Google Cloud Storage pricing](https://cloud.google.com/storage/pricing) | Current page accessed 2026-05-31 | Object storage, inbound transfer, outbound transfer, and storage/network billing structure. | Current storage/bandwidth price input |
| [Render pricing](https://render.com/pricing) | Current page accessed 2026-05-31 | Web services, workers, workflows, bandwidth, persistent disk, and Render Key Value pricing. | Current hosted/runtime price input |
| [RunPod Serverless pricing](https://docs.runpod.io/serverless/pricing) | Current page accessed 2026-05-31 | GPU serverless pay-per-second and storage rates for optional model conversion/runtime workloads. | Current GPU/provider price input |
| [RunPod GPU cloud pricing](https://www.runpod.io/pricing) | Current page accessed 2026-05-31 | GPU hourly price cross-check for A100/H100/L40/L4/4090 classes. | Current GPU/provider price input |
| [Indeed employer pricing](https://www.indeed.com/hire/cs/pricing) | Current page accessed 2026-05-31 | Sponsored job minimums and pay-for-click/apply model for capturer recruiting cost floor. | Current recruiting price input |
| [Craigslist posting fees](https://www.craigslist.org/about/Help/posting_fees) | Current page accessed 2026-05-31 | US job-category posting fees of $10-$75, varying by area. | Current recruiting price input |
| [Matterport pricing](https://matterport.com/plans) | Current page accessed 2026-05-31 | Comparable capture market: phone/tablet/camera capture path and scan-service-provider option. | Comparable-market evidence |
| [Digital Twin Photography Matterport scan pricing](https://www.digitaltwinphotography.com/pricing) | Current page accessed 2026-05-31 | Public service-provider example of 15 cents/sq ft up to 5,000 sq ft; used only as a low-confidence comparable scan-service reference. | Comparable-market evidence, not core pricing |
| [Apple iPhone 16 purchase page](https://www.apple.com/shop/buy-iphone/iphone-16) | Current page accessed 2026-05-31 | Optional device-pool assumption; base iPhone 16 public price source. | Device capex reference |
| `docs/research/2026-05-31-blueprint-tam-market-research.md` | 2026-05-31 repo memo | Confirms wedge pricing and TAM framing from package + hosted review, not operational traction. | Repo-observed research |
| `/Users/nijelhunt_1/workspace/BlueprintCapture/README.md` and `AGENTS.md` | Repo-observed 2026-05-31 | Raw capture bundle, upload, and evidence-client boundaries. | Repo-observed architecture |
| `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/README.md` and `AGENTS.md` | Repo-observed 2026-05-31 | Packaging, QA, rights/provenance, provider/preview, package, and hosted artifact boundaries. | Repo-observed architecture |

## Assumption Labels

- **Modeled estimates:** all low/base/high COGS, CAC allocation, cash-plan ranges, hosted runtime cost per hour, and break-even site counts.
- **Current web-sourced prices:** Stripe card fee, Stripe Connect pricing, IRS mileage rate, Render pricing, Firebase/Firestore/Storage pricing, RunPod pricing, Indeed/Craigslist recruiting floors, Apple device reference.
- **Repo-observed proof:** public pricing surface, hosted-session gate shape, accounting/payout records, Austin playbook status, capture/pipeline architecture.
- **Unknown/human-gated:** named Austin target list, rights/access clearance, paid buyer orders, approved capturer roster, live payout state, provider execution, hosted-session fulfillment, support/reply durability.

## Blockers Before Operational Claims

These must be proven by the owning system before anyone presents Austin as operationally live:

- Named Austin sites with source URLs, access posture, target area/minutes/complexity, and operator-editable payout estimates.
- Rights/access review for each site, including public/common-access boundaries and staff/back-of-house/privacy exclusions.
- Approved capturer assignment, real capture bundle, upload completion, QA pass, and recapture decision.
- Pipeline package artifacts with provenance, rights/compliance, quality, world-model fit, provider/preview status, and package manifest.
- WebApp buyer order, Stripe payment state, marketplace entitlement, hosted-session entitlement, and fulfillment state.
- Hosted runtime/session proof from the runtime owner, not just route existence or local demo code.
- Payout approval and payout execution proof from the accounting/Stripe owner system.
- Support/reply durability and human-blocker handling for rights, refunds, disputes, and non-standard commercial commitments.

Bottom line: the Austin unit economics are investable as a modeled wedge, but operational readiness still depends on named site supply, rights/provenance, capture QA, provider/runtime proof, payment/entitlement proof, and payout accounting proof.
