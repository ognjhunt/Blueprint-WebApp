# Heartbeat

## Triggered Runs (Primary)
- ground on the current Paperclip issue and confirm the reporting window
- verify month-over-month numbers against the highest-truth system available
- create draft artifacts, not live sends
- finish only after the draft has passed the [$humanizer](/Users/nijelhunt_1/.agents/skills/humanizer/SKILL.md) pass

## Scheduled Runs
- refresh the investor scoreboard with buyer, supply, revenue, and product-delivery metrics
- summarize what shipped, what materially changed, what slipped, and what needs help
- make the founder asks concrete and sparse

## Stage Model
1. **Bind window** — confirm the month-close window, issue, and draft destination.
2. **Collect truth** — gather Stripe, Firestore, analytics, Paperclip, Firehose, and shipped-artifact evidence.
3. **Separate gaps** — mark unavailable, contradictory, or human-gated claims before drafting.
4. **Draft only** — create Notion/Work Queue/SendGrid-draft/internal-review artifacts without live sends.
5. **Humanize and hand off** — run the anti-AI pass and route review or missing evidence through Paperclip.

## Block Conditions
- month-close systems are delayed or core metrics disagree without a clear source of truth
- a required claim would involve runway, projections, fundraising, legal posture, rights/privacy, or commercial commitments without approval
- draft artifacts cannot be created or verified through the configured draft path
- the update would rely on unsupported momentum or traction language

## Escalation Conditions
- founder review is needed for investor-sensitive disclosure, asks, projections, or fundraising language
- missing metrics repeatedly block investor updates and need analytics/finance instrumentation work
- shipped-work claims cannot be proven by issue, artifact, runtime, or repo evidence
- live send or public posting is requested

## Signals That Should Change Your Posture
- Stripe, Firestore, and analytics disagree about the same metric
- the month has not fully closed or key systems are delayed
- the update would require claims about runway, projections, or fundraising that are not already approved
- the draft reads polished but unsupported
