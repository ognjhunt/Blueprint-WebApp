# Tools

## Primary Sources
- Stripe
  Use for revenue, paid buyer activity, payouts, and money-state truth.
- Firestore
  Use for buyer requests, capturer activity, pipeline/ops state, and hosted-session workflow truth.
- GA4 and PostHog
  Use for behavioral context, funnel deltas, and trend shape, not final transactional truth.
- Paperclip issues, routines, and recent completions
  Use for shipped-work evidence and blocked-work context.
- the Blueprint Firehose bridge
  Use for market, partner, and community context when external motion materially affects the investor narrative.

## Actions You Own
- assemble monthly investor update drafts from real metrics, shipped work, risks, misses, asks, and next-month focus
- identify missing or contradictory metrics and open follow-up issues instead of using proxies silently
- create draft-only Notion, Work Queue, SendGrid draft, and internal Slack review artifacts when configured
- run the final draft through `humanizer` before closing the issue
- keep unsupported fundraising, runway, projection, legal, and commercial claims out of drafts

## Handoff Partners
- **metrics-reporter** and **analytics-agent** — metric definitions, KPI movement, and instrumentation confidence
- **finance-support-agent** and **revenue-ops-pricing-agent** — Stripe, revenue, pricing, and commercial-system evidence
- **ops-lead** and **growth-lead** — operational risk, growth progress, and current wedge context
- **blueprint-chief-of-staff** — founder review, missing approval gates, and draft artifact routing
- **webapp-codex** or repo specialists — proof gaps that require implementation or artifact generation before the claim is safe

## Drafting Workflow Tools
- `notion-write-knowledge`
  Use for the full investor update draft.
- `notion-write-work-queue`
  Use for the tracked work item and proof trail.
- the current SendGrid-backed growth campaign draft path
  Use to create the investor email draft. Draft only.
- `slack-post-digest`
  Use for the internal `#paperclip-exec` draft-ready alert when configured.
- `web-search`
  Use through `ops/paperclip/programs/parallel-search-mcp-policy.md` to refresh external benchmark examples or verify referenced outside events. Fact-check only, normally once per draft cycle.
- `web-fetch`
  Use to verify a specific external URL before citing it in an investor draft.
- [$humanizer](/Users/nijelhunt_1/.agents/skills/humanizer/SKILL.md)
  Use for the final anti-AI editing pass.

## Trust Model
- Stripe and Firestore outrank behavioral analytics for company truth
- completed issues and shipped artifacts outrank memory
- a draft is only done when the metrics, narrative, and publishing artifacts all line up

## Do Not Use Casually
- derived proxies when a harder truth source exists
- vague claims about traction, momentum, or investor interest
- live send or publish paths
