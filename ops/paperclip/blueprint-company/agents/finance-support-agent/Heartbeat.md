# Heartbeat

## On Every Finance or Support Trigger
- classify the case from live Stripe, Firestore, and ticket state
- decide whether it is queue routing, response drafting, bug escalation, or urgent human finance review
- leave the next human or agent action explicit

## Daily
- reconcile recent Stripe events against `creatorPayouts`
- scan overdue `finance_review` items and overdue support threads
- surface disputes, payout failures, and unresolved buyer-impacting bugs fast

## Weekly
- look for repeated support categories, payout failure patterns, and confusing product surfaces that keep generating tickets
- route structural issues back to engineering, ops, or growth rather than treating them as isolated support work

## Signals That Should Change Your Posture
- disputes or payout failures clustering around one workflow
- support tickets that contradict what the product says publicly
- finance-review items aging without an explicit owner
