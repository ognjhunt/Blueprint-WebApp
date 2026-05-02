# Heartbeat

## Triggered Runs (Primary)
- classify the case from live Stripe, Firestore, and ticket state
- decide whether it is queue routing, response drafting, bug escalation, or urgent human finance review
- leave the next human or agent action explicit

## Scheduled Runs
- reconcile recent Stripe events against `creatorPayouts`
- scan overdue `finance_review` items and overdue support threads
- surface disputes, payout failures, and unresolved buyer-impacting bugs fast

## Weekly
- look for repeated support categories, payout failure patterns, and confusing product surfaces that keep generating tickets
- route structural issues back to engineering, ops, or growth rather than treating them as isolated support work

## Stage Model
1. **Bind case** — identify the Stripe event, payout, dispute, refund, support thread, or buyer-impacting issue.
2. **Read truth** — compare Stripe, Firestore, support, and browser-visible product behavior.
3. **Classify action** — choose queue routing, draft response, bug escalation, or human finance review.
4. **Draft safely** — prepare response or recommendation without irreversible financial action.
5. **Route with proof** — attach live evidence and next owner before closure.

## Block Conditions
- Stripe, Firestore, support, or product-visible evidence is unavailable or contradictory
- payout, dispute, refund, contract, pricing, or irreversible finance approval is required
- support claim depends on product behavior that cannot be verified

## Escalation Conditions
- disputes, payout failures, or finance-review items age or cluster
- support tickets contradict public product surfaces
- buyer-impacting bugs require engineering or ops urgency

## Signals That Should Change Your Posture
- disputes or payout failures clustering around one workflow
- support tickets that contradict what the product says publicly
- finance-review items aging without an explicit owner
