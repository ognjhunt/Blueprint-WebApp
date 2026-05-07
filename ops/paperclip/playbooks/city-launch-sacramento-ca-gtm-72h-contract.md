# Sacramento, CA CITY+BUDGET 72h GTM Contract

- status: deterministic launch contract
- doctrine: capture-first, world-model-product-first, proof-led GTM only
- city: Sacramento, CA
- launch_run_id: 2026-05-07T17-54-10.120Z
- budget_tier: zero_budget
- budget_max_usd: 0
- founder_approved: true

## Human Gates
- Founder approval is required for city posture.
- Founder approval is required for the budget envelope.
- Founder approval is required before any live buyer/operator/capturer send.
- Founder approval is required before live paid spend.
- Founder or designated rights/privacy approval is required for rights/privacy exceptions.

## Creative And Paid Acquisition Boundary
- Ad Studio Firestore collection: `ad_studio_runs`
- Meta Ads CLI provenance collection: `meta_ads_cli_runs`
- Generated creative is marketing material, not ground truth, proof, rights clearance, supply readiness, or ad performance evidence.
- Image work routes through Ad Studio/Paperclip/Codex handoff; no generated image may be treated as captured site evidence.
- Video/Higgsfield/OpenRouter handoff is optional and only valid when a proof-led first frame, provider auth, and claims review exist.
- Meta Ads CLI read-only proof and paused draft creation only; active campaigns, active ad sets, active ads, and live spend remain prohibited in this loop.

## 24/48/72h Scorecard Windows
| Checkpoint | Status | Window end | Run artifact | Canonical artifact |
| --- | --- | --- | --- | --- |
| 24h | scheduled_not_due | 2026-05-08T17:54:10.120Z | /var/folders/7w/c3s8_n4n7l305ywhp9hnlz740000gp/T/autonomy-sparse-city-ofEo3S/sacramento-ca/2026-05-07T17-54-10.120Z/city-launch-sacramento-ca-scorecard-24h.md | /Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-launch-sacramento-ca-scorecard-24h.md |
| 48h | scheduled_not_due | 2026-05-09T17:54:10.120Z | /var/folders/7w/c3s8_n4n7l305ywhp9hnlz740000gp/T/autonomy-sparse-city-ofEo3S/sacramento-ca/2026-05-07T17-54-10.120Z/city-launch-sacramento-ca-scorecard-48h.md | /Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-launch-sacramento-ca-scorecard-48h.md |
| 72h | scheduled_not_due | 2026-05-10T17:54:10.120Z | /var/folders/7w/c3s8_n4n7l305ywhp9hnlz740000gp/T/autonomy-sparse-city-ofEo3S/sacramento-ca/2026-05-07T17-54-10.120Z/city-launch-sacramento-ca-scorecard-72h.md | /Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/playbooks/city-launch-sacramento-ca-scorecard-72h.md |

## Firestore/Admin Evidence Sources
| Collection | Query name | Query | Purpose |
| --- | --- | --- | --- |
| growth_events | city_launch_growth_events_recent | `collection("growth_events").orderBy("created_at", "desc").limit(4000)` | CTA, hosted-review, proof-motion, follow-up, stall, and demand response events filtered to the city. |
| waitlistSubmissions | city_capturer_waitlist_recent | `collection("waitlistSubmissions").limit(1500)` | Capturer signups and market/source tags for the city supply lane. |
| users | city_capturer_users_recent | `collection("users").limit(2000)` | Approved capturer, first-capture, and QA-passed capture evidence for the city. |
| inboundRequests | city_inbound_requests_recent | `collection("inboundRequests").limit(1500) + decryptInboundRequestForAdmin` | Waitlist, CTA response, exact-site request, proof-pack, hosted-review, and buyer reply evidence. |
| cityLaunchActivations | city_launch_activation_doc | `collection("cityLaunchActivations").doc(citySlug)` | Founder approval, root issue id, budget tier, task issue ids, and activation status. |
| cityLaunchProspects | city_launch_prospects_by_city | `collection("cityLaunchProspects").where("citySlug", "==", citySlug).limit(1000)` | Target discovery, capturer/operator prospect status, and supply follow-through. |
| cityLaunchBuyerTargets | city_launch_buyer_targets_by_city | `collection("cityLaunchBuyerTargets").where("citySlug", "==", citySlug).limit(1000)` | Buyer/site-operator target research and proof-path status. |
| cityLaunchTouches | city_launch_touches_by_city | `collection("cityLaunchTouches").where("citySlug", "==", citySlug).limit(1000)` | Recipient-backed first touches, Meta draft touches, and proof-led outreach evidence. |
| cityLaunchChannelAccounts | city_launch_channel_accounts_by_city | `collection("cityLaunchChannelAccounts").where("citySlug", "==", citySlug).limit(1000)` | Channel registry state for direct outreach and artifact-only community/social publication lanes. |
| cityLaunchSendActions | city_launch_send_actions_by_city | `collection("cityLaunchSendActions").where("citySlug", "==", citySlug).limit(1000)` | Recipient-backed direct outreach ledger, no-fake-email checks, approval state, sent state, and response ingest state. |
| cityLaunchReplyConversions | city_launch_reply_conversions_by_city | `collection("cityLaunchReplyConversions").where("citySlug", "==", citySlug).limit(1000)` | Reply ownership, routing, next follow-up due state, and conversion blockers. |
| cityLaunchBudgetEvents | city_launch_budget_events_by_city | `collection("cityLaunchBudgetEvents").where("citySlug", "==", citySlug).limit(1000)` | Actual/recommended spend ledger and policy compliance. |
| agentSpendRequests | city_launch_agent_spend_requests | `collection("agentSpendRequests").where("citySlug", "==", citySlug).limit(1000)` | Founder/provider approval state for budget, creative, paid acquisition, and other agent spend requests. |
| ad_studio_runs | city_launch_ad_studio_runs | `collection("ad_studio_runs").where("city", "==", city).orderBy("updated_at_iso", "desc").limit(100)` | Claims ledger, claims review, prompt pack, image handoff, video task, and Meta draft linkage. |
| meta_ads_cli_runs | city_launch_meta_ads_cli_runs | `collection("meta_ads_cli_runs").where("city", "==", city).orderBy("createdAtIso", "desc").limit(100)` | Meta Ads CLI read-only proof, paused-draft command provenance, and policy-blocked errors. |