# San Jose, CA 72h City Launch Scorecard

- status: scheduled_not_due
- evidence_boundary: checkpoint placeholder only until the window closes and the first-party collections below are queried
- city: San Jose, CA
- city_slug: san-jose-ca
- launch_run_id: 2026-05-15T22-10-08.655Z
- checkpoint_hour: 72
- window_start_iso: 2026-05-15T22:10:08.655Z
- window_end_iso: 2026-05-18T22:10:08.655Z

## Prompt-To-Artifact Contract
- canonical city launch plan and activation payload must be linked from the launch manifest.
- Paperclip root/child issue ids must be linked from `cityLaunchActivations` and the run manifest.
- Target ledger, distribution pack, recipient-backed send ledger, creative/ad handoff, founder decision packet, and reply-conversion queue must have exact artifact paths.
- Community/social publication tasks stay artifact-only unless a real connector and proof record exist.
- Meta Ads evidence is read-only proof and paused draft provenance only; no live spend is implied.

## Firestore/Admin Collection And Query Names
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