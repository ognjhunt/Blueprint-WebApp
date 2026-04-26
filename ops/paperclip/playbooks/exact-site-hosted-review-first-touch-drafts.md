# Exact-Site Hosted Review First Touch Drafts

Date: 2026-04-26
Owner: `robot-team-growth-agent`
Status: draft-only, no live sends

These are draft message shapes for the first 14-day pilot batch. They are not send receipts and they do not authorize live outreach.

## Proof-Ready Draft

Subject: exact-site review for a real public aisle route

Hi `<recipient name>`,

I am building Blueprint, a capture-backed way for robot teams to inspect real deployment sites before sending people on-site or committing sim work.

For your team, the closest current artifact is a sample hosted review of one public-facing grocery aisle route. It is not a customer result or deployment guarantee; it shows the review shape: scoped route, run observations, rights/privacy limits, and the next decision.

Would it be useful to inspect that review and tell me what exact site or workflow would be more valuable for your team?

`<founder name>`

CTA: inspect the sample hosted review, then name the site/workflow worth capturing next.

Blocked claims:

- no claim that Blueprint has a buyer-specific site ready for this target
- no claim that the sample is a customer result
- no guarantee of model capability or deployment readiness

## Demand-Sourced Capture Draft

Subject: what exact site would be useful to capture for `<organization>`?

Hi `<recipient name>`,

I am building Blueprint, a capture-backed way for robot teams to inspect site-specific world-model products and hosted review sessions before deeper deployment work.

I am trying to keep the first pilot narrow: one robot workflow, one real site, one reviewable artifact. For `<organization>`, I do not want to guess the wrong site type.

What site or workflow would be useful enough for your team to inspect if Blueprint captured it and turned it into a hosted exact-site review?

Examples:

- a warehouse aisle and replenishment route
- a dock or trailer unloading workflow
- a hospital supply route with privacy limits
- an industrial inspection path
- a retail aisle or customer-facing service route

If you point me at the workflow, I will either show the closest current review artifact or tell you plainly what would need to be captured first.

`<founder name>`

CTA: name the site/workflow worth capturing next.

Blocked claims:

- no claim that a hosted review already exists for demand-sourced targets
- no claim that the recipient has opted in
- no pricing, rights, permission, legal, or public-readiness commitments

## Approval Checklist

Before a live send:

- recipient email is explicit and evidence-backed
- `recipient.evidenceSource` explains where the address came from
- `recipient.evidenceType` is `explicit_research`, `historical_campaign`, or `human_supplied`
- `outbound.status` moves from `draft_ready` to `human_approved`
- live send writes `sendLedgerPath`
