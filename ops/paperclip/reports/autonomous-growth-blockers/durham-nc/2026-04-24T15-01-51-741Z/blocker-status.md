# Autonomous Growth Blocker Status - Durham, NC

- generated_at: 2026-04-24T15:01:51.352Z
- overall_status: blocked
- latest_manifest: ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z/manifest.json

## Ranked Blockers

| Blocker | Status | Owner | Next action |
| --- | --- | --- | --- |
| Public Paperclip state must match trusted local org state | warning | runtime/Paperclip deploy | Use the bridge issue for immediate execution continuity; schedule full company-state migration only if historic issue continuity is required. |
| City launch needs live response, applicant, operator, or buyer signal | external_gated | capturer-growth-agent, city-launch-agent, site-operator-partnership-agent, outbound-sales-agent | Execute the no-signal recovery lanes and record an explicit reply, applicant, qualified intro, or no-response outcome. |
| Buyer direct outreach needs explicit recipient-backed contact evidence | human_gated | city-demand-agent, outbound-sales-agent | Create buyer-specific draft actions and send only after approval/transport checks. |
| Sender verification and durable reply resume must be production-proven | warning | ops/runtime config | Verify sender/domain in the live mail provider, set the sender verification mirror, and configure/prove Gmail reply watcher resume. |
| Ad/content/campaign lanes are intentionally draft-first for live side effects | human_gated | growth-lead, community-updates-agent, webapp-codex | Keep draft creation autonomous; add narrow auto-approval only after a product/doctrine decision. |
| Marketing integrations require provider and Notion Growth Studio config | blocked | ops/runtime config | Provide only the provider credentials you want enabled; leave unsupported providers disabled and draft-only. |
| Scheduled content/city routines must be explicit about active vs paused posture | warning | blueprint-cto, growth-lead | Only unpause routines that are drill-proven and produce proof-bearing artifacts without live side effects. |

## Details

### 1. Public Paperclip state must match trusted local org state

- key: paperclip_state_sync
- status: warning
- lane: all Paperclip-backed autonomous execution
- stage_reached: public issueCounter=46, local issueCounter=4360, bridgeIssue=BLU-46
- why: Public Paperclip still does not contain the full local history, but it now has a bridge issue to the trusted blocker artifact.
- owner: runtime/Paperclip deploy
- next_action: Use the bridge issue for immediate execution continuity; schedule full company-state migration only if historic issue continuity is required.
- missing_env: none
- evidence:
  - https://paperclip.tryblueprint.io/api/companies
  - http://127.0.0.1:3100/api/companies
  - ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z/manifest.json
  - public bridge issue BLU-46

### 2. City launch needs live response, applicant, operator, or buyer signal

- key: city_live_signal
- status: external_gated
- lane: city-launch, outreach, capture target motion
- stage_reached: Durham, NC manifest status=founder_approved_activation_ready, sent=2, liveSignalCount=0
- why: Recorded sends and generated artifacts are not replies, applicants, capturers, site authorization, hosted-review starts, or buyer outcomes.
- owner: capturer-growth-agent, city-launch-agent, site-operator-partnership-agent, outbound-sales-agent
- next_action: Execute the no-signal recovery lanes and record an explicit reply, applicant, qualified intro, or no-response outcome.
- missing_env: none
- evidence:
  - ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z/manifest.json
  - ops/paperclip/playbooks/city-opening-durham-nc-no-signal-scorecard.md

### 3. Buyer direct outreach needs explicit recipient-backed contact evidence

- key: buyer_recipient_evidence
- status: human_gated
- lane: buyer outreach, city demand
- stage_reached: recoveredBuyerTargetContacts=2, unresolvedBuyerTargets=0
- why: Explicit buyer recipient evidence exists, but live buyer send still requires proof-led copy and approval.
- owner: city-demand-agent, outbound-sales-agent
- next_action: Create buyer-specific draft actions and send only after approval/transport checks.
- missing_env: none
- evidence:
  - ops/paperclip/playbooks/city-launch-durham-nc-contact-enrichment.json
  - ops/paperclip/playbooks/city-opening-durham-nc-robot-team-contact-list.md

### 4. Sender verification and durable reply resume must be production-proven

- key: sender_and_reply_durability
- status: warning
- lane: city-launch outreach, founder/human reply resume
- stage_reached: emailTransport=configured, senderVerification=unknown, humanReplyMissing=7
- why: Outbound launchability requires truthful sender state, and blocker/resume loops require a durable reply watcher rather than Slack-only visibility.
- owner: ops/runtime config
- next_action: Verify sender/domain in the live mail provider, set the sender verification mirror, and configure/prove Gmail reply watcher resume.
- missing_env:
  - BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified
  - BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN
  - BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL
  - BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID
  - BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET
  - BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN
  - BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS
  - BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED=1
- evidence:
  - DEPLOYMENT.md
  - ops/paperclip/reports/city-launch-execution/durham-nc/2026-04-22T21-47-28.818Z/manifest.json

### 5. Ad/content/campaign lanes are intentionally draft-first for live side effects

- key: content_campaign_live_side_effects
- status: human_gated
- lane: ads, content, campaign sends, brand assets
- stage_reached: Ad Studio can create briefs/handoffs; growth campaigns write drafts; live sends/public posts/paid spend require approval.
- why: This is the correct guardrail until product policy defines narrow auto-publish or paid-spend criteria.
- owner: growth-lead, community-updates-agent, webapp-codex
- next_action: Keep draft creation autonomous; add narrow auto-approval only after a product/doctrine decision.
- missing_env: none
- evidence:
  - server/utils/ad-studio.ts
  - server/utils/growth-ops.ts
  - server/agents/action-policies.ts

### 6. Marketing integrations require provider and Notion Growth Studio config

- key: marketing_provider_config
- status: blocked
- lane: Meta ads, Growth Studio Notion mirror, Firehose/Introw enrichment
- stage_reached: missingMeta=3, missingNotionGrowthStudio=5, missingFirehose=2, missingIntrow=2
- why: Adapters exist, but the runtime cannot create paused Meta drafts or mirror Growth Studio proof without configured providers.
- owner: ops/runtime config
- next_action: Provide only the provider credentials you want enabled; leave unsupported providers disabled and draft-only.
- missing_env:
  - META_MARKETING_API_ACCESS_TOKEN
  - META_PAGE_ID
  - META_AD_ACCOUNT_ID
  - NOTION_GROWTH_STUDIO_SHIP_BROADCAST_DB_ID
  - NOTION_GROWTH_STUDIO_CAMPAIGN_DRAFTS_DB_ID
  - NOTION_GROWTH_STUDIO_CREATIVE_RUNS_DB_ID
  - NOTION_GROWTH_STUDIO_INTEGRATION_CHECKS_DB_ID
  - NOTION_GROWTH_STUDIO_CONTENT_REVIEWS_DB_ID
  - FIREHOSE_API_TOKEN
  - FIREHOSE_BASE_URL
  - INTROW_API_TOKEN
  - INTROW_BASE_URL
- evidence:
  - server/utils/meta-marketing.ts
  - server/utils/notion-sync.ts
  - ops/paperclip/plugins/blueprint-automation/src/marketing-integrations.ts

### 7. Scheduled content/city routines must be explicit about active vs paused posture

- key: scheduled_routine_posture
- status: warning
- lane: proactive content, broadcast, city launch refresh
- stage_reached: active=capturer-growth-weekly, demand-intel-weekly, robot-team-growth-weekly, site-operator-partnership-weekly, city-demand-weekly; paused=community-updates-weekly, ship-broadcast-refresh, ship-broadcast-approval-refresh, content-feedback-refresh, city-launch-weekly, city-launch-refresh, demand-intel-daily
- why: Manual/event-driven execution can work while paused schedules remain intentionally quiet. This should be explicit, not rediscovered in audits.
- owner: blueprint-cto, growth-lead
- next_action: Only unpause routines that are drill-proven and produce proof-bearing artifacts without live side effects.
- missing_env: none
- evidence:
  - ops/paperclip/blueprint-company/.paperclip.yaml
