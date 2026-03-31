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

## Drafting Workflow Tools
- `notion-write-knowledge`
  Use for the full investor update draft.
- `notion-write-work-queue`
  Use for the tracked work item and proof trail.
- `nitrosend-upsert-audience`
  Use to maintain a draft-only `Blueprint Investors` audience when Nitrosend is configured.
- `nitrosend-create-campaign-draft`
  Use to create the investor email draft. Draft only.
- `slack-post-digest`
  Use for the internal `#exec` draft-ready alert when configured.
- `web-search`
  Use to refresh external benchmark examples or verify referenced outside events.
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
