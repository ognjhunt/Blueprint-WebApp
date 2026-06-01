# Launch-Now Budget Approval Packet

Generated: 2026-06-01T14:43:55.249Z
State: pending_human_signature
Approval effective: no
Requested live spend ceiling: $327.00
Repo-local Paperclip envelope: $173.00
Combined budget ceiling: $500.00
OpenAI API target: $0.00
Codex OAuth/Pro excluded: yes

This packet is a pending approval artifact. It makes no provider calls, persists no secrets, and attempts no live mutation.

## Exact Approval Text

I, Nijel Hunt, approve the Blueprint launch-now bounded spend caps in output/autonomous-org/budget/latest/launch-now-approval-packet.json generated at 2026-06-01T14:43:55.249Z. This approval is capped at $327.00 in live launch/growth spend plus the existing $173.00 repo-local Paperclip envelope, for a combined ceiling of $500.00 through 2026-07-01. OpenAI API spend remains $0.00 and Codex OAuth/Pro remains excluded from the $500 budget. This approval does not by itself authorize live sends, ad launch, provider jobs, production infrastructure mutation, hosted-session fulfillment, rights/legal clearance, customer/traction claims, or Operational Launch Ready claims without the separate owner-system proof and gates listed in the packet.

## Approval Items

| Budget line | Owner system | Max | Expires | Purpose |
|---|---|---:|---|---|
| DeepSeek direct model reserve | DeepSeek API account | $80.00 | 2026-07-01 | Billable model reserve for launch/growth synthesis, cached reasoning, and high-value triage through the DeepSeek lane. |
| Render WebApp hosting | Render | $25.00 | 2026-07-01 | Keep the WebApp hosting path available for launch traffic while billing proof is collected. |
| Paperclip VPS / tunnel | DigitalOcean / Cloudflare / Paperclip host | $30.00 | 2026-07-01 | Keep the Paperclip host/tunnel path available for control-room and agent runtime proof. |
| Firebase / Firestore / storage | Firebase / Firestore / GCS | $25.00 | 2026-07-01 | Cover Firebase, Firestore, storage, and related launch telemetry/data needs within the cap. |
| Redis / cache | Redis / Upstash | $10.00 | 2026-07-01 | Cover cache/runtime support for launch flows within the cap. |
| Email / human reply / Slack | SendGrid, Gmail, Slack | $7.00 | 2026-07-01 | Cover sender readiness, human reply path, and Slack/Gmail/SendGrid support costs without authorizing live sends. |
| Search / research APIs | Parallel Search MCP / configured search | $45.00 | 2026-07-01 | Cover search/research API usage for proof-backed GTM and city-launch research. |
| Recipient evidence enrichment | GTM evidence / enrichment providers | $35.00 | 2026-07-01 | Cover recipient evidence enrichment for the Exact-Site Hosted Review wedge. |
| Profiles, listings, and owned growth ops | Repo docs / Paperclip growth lanes | $20.00 | 2026-07-01 | Cover owned growth profiles, listings, and launch profile operations. |
| Paid city/launch experiments | Meta/ads/provider accounts | $50.00 | 2026-07-01 | Cover tightly capped paid city/launch experiments; ad launch still needs the ad-system approval trail. |

## Non-Spend Guardrails

- Codex OAuth / Pro subscription seat: $0.00. Excluded from the $500 launch/growth envelope.
- OpenAI API costs (approval-only guardrail): $0.00. Target remains $0 unless a separate explicit OpenAI API approval artifact exists.
- Analytics: $0.00. Use free/native analytics until an owner-system billing proof and approval exists.

## Still Required Before Live Action

- DeepSeek direct usage export and OpenRouter billing if used
- Render billing
- DigitalOcean/Cloudflare billing
- Firebase/Firestore/GCS billing
- Redis billing
- SendGrid/Gmail/Slack billing and sender readiness
- Analytics billing and KPI owner-system proof
- Search/research API billing
- Recipient evidence enrichment receipts or provider exports
- Profiles/listings receipts or provider exports
- Ad account spend and paused-draft proof
- Live Paperclip routine execution after repo config propagation

## Activation Instructions

- Have the human approver send or commit the exact_human_approval_text without editing caps, dates, or guardrails.
- Record the received text, approver, timestamp, and source in a separate approval-capture artifact before treating this packet as effective.
- Rerun npm run autonomy:budget:live-proof:validate -- --require-complete, npm run autonomy:budget:live-action-gate -- --require-live-action-ready, npm run autonomy:budget:status -- --require-live-action-ready, and npm run autonomy:budget:control-suite.
- Do not use this pending packet to execute live sends, launch ads, start provider jobs, mutate production infrastructure, or claim Operational Launch Ready.
