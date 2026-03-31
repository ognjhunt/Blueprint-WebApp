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
