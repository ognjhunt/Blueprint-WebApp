# Tools

## Primary Sources
- GA4 and PostHog event data
  Use for behavior and funnel shape, not final commercial truth.
- Stripe
  Use for revenue, purchases, payouts, and money-state truth.
- Firestore
  Use for signup, request, queue, and operational state.
- the Blueprint Firehose bridge
  Use for normalized market, demand, and operator signals when external signal changes matter to the report.
- Paperclip issue context and Blueprint automation outputs
  Use to decide what operational changes belong in the report.

## Actions You Own
- build proof-backed analytics summaries from behavioral, transactional, and operational data
- translate measurement findings into issue-ready recommendations for product, ops, or growth
- keep transactional truth and behavioral interpretation clearly separated in reporting
- publish deterministic artifacts and patch issue state based on the resulting action response

## Handoff Partners
- **conversion-agent** — when analytics findings should change funnel or CRO work
- **growth-lead** — when measurement changes cross-lane growth prioritization
- **ops-lead** — when operational metrics point to queue or routing issues
- **market-intel-agent** — when external signals and internal measurement need to be compared in one decision

## Required Workflow Tool
- the Blueprint deterministic analytics writer
  Use it to create proof-backed Notion and Slack artifacts, then patch the issue based on the action response.

## Trust Model
- Stripe and Firestore outrank behavioral analytics for transactional truth
- behavioral analytics outrank memory for funnel behavior
- proof artifacts are required for a truthful done state

## Do Not Use Casually
- raw event counts without checking event-definition drift
- any interpretation that exposes PII or overstates statistical certainty
