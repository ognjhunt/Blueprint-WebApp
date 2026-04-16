# Ops Automation Analysis 2026

Date: 2026-03-21

Purpose: inventory the human-judgment-heavy operational work implied by `Blueprint-WebApp`, then identify what should be automated now, what should remain human-in-the-loop, and what is not yet worth automating.

This document is repo-specific. It is based on the current codebase plus current official platform capabilities from OpenAI, Anthropic, Zapier, Stripe, Notion, and MCP documentation.

## Executive Summary

Blueprint has enough structured operational surface area to run much leaner than a traditional services-heavy team, but only if operations are treated as queues with explicit machine-readable state.

The highest-leverage automation opportunities in this repo are:

1. Capturer recruiting and beta routing
2. Buyer intake triage and qualification drafting
3. Site scheduling, reminder, and handoff workflows
4. Capture QA, recapture recommendation, and payout recommendation routing
5. Preview / world-model generation orchestration
6. Finance and payout exception handling
7. Support intake classification and routing

The broad rule for 2026:

- LLMs are strong enough to own triage, summarization, drafting, record enrichment, queue routing, and low-risk workflow execution.
- LLMs should still not have unsupervised authority over payouts, contract/rights signoff, irreversible billing actions, or policy-sensitive approval decisions.
- Browser/computer-use agents are now practical for legacy/internal tools, but should be a fallback behind APIs, MCP servers, and first-party integrations.

## Current Service Areas

The repo currently implies six distinct service areas:

1. Capturer supply
2. Buyer / site-operator intake
3. Site qualification and readiness review
4. World-model / preview production
5. Marketplace / buyer delivery and entitlements
6. Finance, payout, compliance, and support

## Human Ops Inventory

### 1. Capturer Recruitment, Waitlist, and Beta Activation

Current signals in repo:

- `client/src/pages/CapturerSignUpFlow.tsx`
- `client/src/pages/CaptureAppPlaceholder.tsx`
- `server/routes/waitlist.ts`
- `server/routes/process-waitlist.ts`
- `client/src/pages/AdminLeads.tsx`

Human actions implied:

- Review inbound capturer applications by market, device, and role
- Decide whether a market has enough demand to activate more supply
- Decide which device profiles are good enough for invite access
- Draft and send invite instructions
- Follow up with partially qualified applicants
- Prioritize applicants when supply exceeds current capture demand

Automate now:

- Classify applicants by market, device fit, referral source, and likely activation priority
- Score invite readiness from structured intake plus market metadata
- Generate invite / rejection / “not yet” drafts automatically
- Route applicants into queues (`capturer_beta_review`, `capturer_beta_access`, etc.)
- Aggregate market heatmaps from waitlist volume

Human-in-loop:

- Final invite release for sensitive markets
- Manual review for edge cases, fraud suspicion, or weak device fit

Not worth full automation yet:

- Fully autonomous applicant acceptance with no ops review if market quality matters

### 2. Buyer / Site-Operator Intake

Current signals in repo:

- `server/routes/inbound-request.ts`
- `client/src/pages/BusinessSignUpFlow.tsx`
- `client/src/pages/OutboundSignUpFlow.tsx`
- `client/src/pages/OffWaitlistSignUpFlow.tsx`

Human actions implied:

- Review inbound site requests
- Interpret task statement, workflow context, constraints, rights, and blocker notes
- Decide qualification priority
- Decide whether capture should be requested
- Assign an owner / region and determine next step

Automate now:

- Intake normalization into canonical requested lanes
- Priority recommendation
- Buyer type classification
- Missing-information detection
- Internal notes / summaries for ops
- Auto-drafted follow-up questions to buyer
- Auto-generated “evidence still needed” checklists

Human-in-loop:

- Final qualification state updates when the decision affects buyer commitments
- Rights-sensitive interpretation
- Escalation decisions for risky or high-value requests

Not worth full automation yet:

- Fully autonomous qualification acceptance / rejection without human signoff

### 3. Qualification Review and Evidence Decisions

Current signals in repo:

- `server/routes/admin-leads.ts`
- `server/routes/requests.ts`
- `server/routes/inbound-request.ts`
- `server/routes/internal-pipeline.ts`
- `client/src/pages/AdminLeads.tsx`

Human actions implied:

- Move records through `qualification_state` and `opportunity_state`
- Assess whether evidence is strong enough
- Decide if a site is `qualified_ready`, `qualified_risky`, or `not_ready_yet`
- Issue buyer review links
- Request recapture or deeper evidence

Automate now:

- State recommendation from intake + pipeline signals
- Readiness summaries from structured artifacts
- Risk summaries for ops
- Buyer-ready vs. needs-more-evidence recommendation
- Draft notes explaining state changes

Human-in-loop:

- Final state transition when it changes buyer-facing promises
- Policy / rights interpretation

Not worth full automation yet:

- Allowing the model to publish qualification decisions directly to buyers with no review

### 4. Capture Job Publication and Supply Routing

Current signals in repo:

- `server/routes/admin-leads.ts`
- `server/routes/creator.ts`
- `server/routes/internal-pipeline.ts`

Human actions implied:

- Convert qualified requests into capture jobs
- Decide payout level / urgency
- Decide whether a site is claimable, reserved, or needs managed routing
- Publish jobs into a market at the right time

Automate now:

- Suggested payout ranges
- Suggested creator targeting rules
- Market/device matching
- Availability window recommendations
- Auto-publication when record confidence is high and policy checks are already green

Human-in-loop:

- First publication of unusual or high-risk jobs
- Any publication where rights status is unclear

Not worth full automation yet:

- Fully unsupervised job publication for new markets until fraud and quality controls are stronger

### 5. Capture QA, Recapture, and Rights Review

Current signals in repo:

- `server/routes/internal-pipeline.ts`
- `server/routes/admin-leads.ts`
- `server/routes/creator.ts`
- `client/src/pages/AdminLeads.tsx`

Human actions implied:

- Review scene / capture readiness
- Decide whether recapture is needed
- Interpret rights profile and capture policy tier
- Approve / reject payout-worthy submissions

Automate now:

- Scene-level anomaly detection
- Recapture recommendation generation
- Payout recommendation generation
- Auto-summarization of scene dashboard / memo outputs
- Rights / privacy risk extraction from intake and capture metadata

Human-in-loop:

- Final payout approval
- Rights-sensitive approval decisions
- Fraud review

Not worth full automation yet:

- Unsupervised payout release on model recommendation alone

### 6. World-Model / Preview Production

Current signals in repo:

- `server/routes/admin-site-worlds.ts`
- `server/routes/internal-pipeline.ts`
- `client/src/pages/SiteWorldDetail.tsx`
- `client/src/pages/HostedSessionSetup.tsx`

Human actions implied:

- Trigger preview generation
- Refresh failed previews
- Interpret provider failures
- Decide whether preview quality is good enough for buyer review

Automate now:

- Retry logic
- Failure classification
- Preview QA summaries
- Auto-escalation only when retries fail or confidence is low

Human-in-loop:

- Final decision to expose previews for key accounts

Not worth full automation yet:

- Letting the model decide that any generated preview is buyer-safe without artifact checks

### 7. Scheduling, Mapping Confirmation, and Field Coordination

Current signals in repo:

- `server/routes/process-waitlist.ts`
- `server/utils/ai-prompts.ts`
- `server/routes/post-signup-workflows.ts`
- `client/src/pages/EmbedCalendar.tsx`
- `client/src/components/CalendarSetup.tsx`

Human actions implied:

- Find the right contact
- Confirm schedule
- Draft emails
- Create calendar events
- Send reminders
- Estimate travel and timing
- Coordinate field operations

Automate now:

- Calendar scheduling and reminder workflows
- Time-zone normalization
- Contact lookup from CRM / Notion / Sheets
- Drafting and sending confirmations
- Travel-time estimation
- Slack notifications for field ops

Human-in-loop:

- Exceptions involving access issues, site contact confusion, or schedule disputes

Not worth full automation yet:

- Fully autonomous rescheduling when there is conflicting human intent across multiple stakeholders

### 8. Buyer Handoff, Marketplace Delivery, and Entitlements

Current signals in repo:

- `server/routes/requests.ts`
- `server/routes/marketplace.ts`
- `server/routes/marketplace-entitlements.ts`
- `client/src/pages/Portal.tsx`
- `client/src/pages/RequestConsole.tsx`

Human actions implied:

- Decide when a buyer is handoff-ready
- Grant or confirm access
- Answer buyer questions about scenes, rights, or readiness
- Resolve access exceptions

Automate now:

- Access recommendation and entitlement checks
- Buyer-facing summaries from scene/pipeline artifacts
- Auto-generated review memos and FAQ answers
- Access issue troubleshooting

Human-in-loop:

- Contractual and licensing exceptions
- Custom commercial promises

Not worth full automation yet:

- Letting an agent rewrite licensing or commercial terms without legal / sales review

### 9. Finance, Stripe, Payout, Tax, and Compliance

Current signals in repo:

- `server/routes/stripe.ts`
- `server/routes/stripe-webhooks.ts`
- `server/routes/creator.ts`
- `server/utils/accounting.ts`

Human actions implied:

- Stripe onboarding recovery
- Handle payout failures
- Reconcile payout states
- Investigate compliance / requirements_due
- Resolve tax / KYC exceptions

Automate now:

- Stripe account health monitoring
- Requirements due follow-up emails / SMS
- Payout failure triage
- Ledger reconciliation checks
- Draft support responses for onboarding and payout issues

Human-in-loop:

- Actual money movement approval policy
- Tax/legal exception handling
- Manual fraud review

Not worth full automation yet:

- Fully autonomous disbursement overrides or exception approvals

### 10. Support, Incident Triage, and Reliability Ops

Current signals in repo:

- `server/routes/errors.ts`
- `server/routes/health.ts`
- `client/src/pages/Help.tsx`
- `client/src/components/ErrorBoundary.tsx`
- `server/routes/contact.ts`

Human actions implied:

- Triage errors and incidents
- Route support issues
- Diagnose common auth, upload, or billing problems
- Monitor service availability

Automate now:

- Support ticket categorization
- Error clustering
- Root-cause hypothesis generation
- Suggested remediation runbooks
- Health-check summarization and alert routing

Human-in-loop:

- Production incident command for severe outages
- User-impacting rollback / shutdown decisions

Not worth full automation yet:

- Allowing AI to execute production incident mitigations without explicit safeguards

### 11. Marketing, Growth, and Revenue Ops

Current signals in repo:

- `server/routes/contact.ts`
- `server/routes/waitlist.ts`
- `client/src/pages/Capture.tsx`
- `client/src/pages/Pricing.tsx`
- `client/src/pages/VenueMaterials.tsx`

Human actions implied:

- Qualify inbound leads
- Draft outbound sequences
- Segment by market, role, or funnel stage
- Decide which campaigns to run

Automate now:

- Lead segmentation
- Outbound draft generation
- Personalization at scale
- Funnel summarization
- Trigger-based nurture sequences

Human-in-loop:

- Brand / positioning changes
- High-value sales outreach

Not worth full automation yet:

- Letting agents independently run paid campaigns or public communications with no review

## What 2026 AI Can Reliably Automate

Based on current official platform capabilities:

- OpenAI Responses API now supports web search, file search, MCP/connectors, computer use, and background mode for long-running tasks.
- OpenAI recommends official MCP servers such as Stripe’s and emphasizes approval flows for sensitive actions.
- Anthropic supports MCP and computer-use workflows, with explicit guidance to use sandboxes/containers and require human confirmation for meaningful real-world consequences.
- Zapier MCP exposes 8,000 apps / 30,000+ actions and handles auth, retries, and rate limits.
- Stripe now explicitly supports MCP and an Agent Toolkit for agentic Stripe operations.
- Notion MCP can read/write with user OAuth, but its official remote MCP is not ideal for fully headless automation; this matters if you want zero-human workflow runners.

This means Blueprint can automate the following reliably today:

1. Intake classification and summarization
2. Queue routing and priority scoring
3. CRM / email / calendar / Slack orchestration
4. Search and retrieval over internal operating docs
5. Drafting responses, follow-ups, and buyer/capturer updates
6. Structured exception detection
7. Low-risk record updates and workflow triggers
8. Legacy dashboard clicking only when no direct API/MCP path exists

## What Should Stay Human-In-The-Loop

1. Payout approval and exception release
2. Rights, privacy, licensing, and consent signoff
3. Final qualification acceptance for risky/high-value buyer work
4. Final public / buyer-facing release of sensitive previews
5. Compliance, tax, and KYC exception decisions
6. High-impact production changes or incident mitigations

## Recommended 2026 Automation Architecture

### System of record

Use Firestore collections as explicit queues, not just storage:

- `waitlistSubmissions`
- `inboundRequests`
- `creatorCaptures`
- payout / disbursement ledgers
- preview generation jobs
- support / incident queues

Each queue should have:

- `status`
- `queue`
- `intent`
- `filter_tags`
- `ops_automation.status`
- `ops_automation.next_action`
- `ops_automation.last_error`
- `ops_automation.last_attempt_at`
- `human_review_required`
- `automation_confidence`

### Agent execution pattern

Preferred execution stack:

1. LLM reasoning for triage and decision recommendation
2. MCP / direct API tools for actions
3. Background jobs for long-running work
4. Browser/computer-use only as fallback for missing integrations

### Recommended service choices

- Reasoning / orchestration: OpenAI Responses API with background mode and MCP/connectors
- Legacy UI fallback: OpenAI computer use or Anthropic computer use in isolated environments
- Cross-app execution: Zapier MCP
- Billing / payout actions: Stripe official MCP / Stripe Agent Toolkit
- Internal docs / KB: OpenAI file search or a first-party vector retrieval layer
- Notion: use official MCP only for user-authenticated workflows; use direct API or a maintained headless path for unattended automation

## Priority Automation Backlog

### P0: should build immediately

1. Waitlist auto-triage worker
   - Read `waitlistSubmissions`
   - Score by market/device/role
   - Draft invite or hold response
   - Push status + next action back into Firestore

2. Inbound request qualification specialist
   - Summarize every `inboundRequest`
   - Recommend `qualification_state`, `opportunity_state`, and `next_step`
   - Draft buyer follow-up questions

3. Scheduling automation
   - Calendar, email, reminder, and Slack workflows from a single structured request

4. Payout exception triage
   - Watch Stripe and payout ledgers
   - Draft fixes and follow-ups
   - Escalate only real exceptions

### P1: next layer

5. Capture QA / recapture specialist
6. Preview-generation retry + diagnosis worker
7. Support triage agent
8. Daily ops summary agent across waitlist, qualification, preview, and payout queues

### P2: later

9. Browser-use agents for internal back-office tools that still lack APIs
10. Agentic buyer-facing concierge for low-risk support and scene Q&A

## Recommended Decision Rule

For every operational step, ask:

1. Is this step mostly classification, drafting, retrieval, or routing?
   - Automate now.
2. Is this step taking action in a known system with a reversible API path?
   - Automate with approvals or guardrails.
3. Is this step financial, contractual, rights-sensitive, or compliance-sensitive?
   - Keep human signoff.
4. Is this step currently performed by clicking around a legacy UI?
   - Use browser/computer-use only if no API/MCP path exists.

## External Capability Notes

Official sources consulted on 2026-03-21:

- OpenAI background mode: https://developers.openai.com/api/docs/guides/background
- OpenAI web search: https://developers.openai.com/api/docs/guides/tools-web-search
- OpenAI file search: https://developers.openai.com/api/docs/guides/tools-file-search
- OpenAI MCP/connectors: https://developers.openai.com/api/docs/guides/tools-connectors-mcp
- OpenAI computer use: https://developers.openai.com/api/docs/guides/tools-computer-use
- MCP intro: https://modelcontextprotocol.io/docs/getting-started/intro
- Anthropic computer use: https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool
- Zapier MCP: https://zapier.com/mcp
- Stripe with LLMs / MCP / Agent Toolkit: https://docs.stripe.com/building-with-llms
- Notion MCP limitations / OAuth requirement: https://developers.notion.com/guides/mcp/get-started-with-mcp

## Bottom Line

Blueprint should not scale ops by adding people first.

Blueprint should scale ops by:

1. turning every human workflow into a structured queue
2. attaching an automation state machine to every queue
3. letting LLMs own triage, drafting, retrieval, and orchestration
4. keeping humans only on money, rights, compliance, and strategic exceptions

If implemented cleanly, the repo can support a lean, automation-first operating model rather than a headcount-first one.
