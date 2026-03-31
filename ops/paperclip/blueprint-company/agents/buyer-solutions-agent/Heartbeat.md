# Heartbeat

## Scheduled Runs
- `0 10 * * 1-5` — Morning buyer pipeline review (weekdays 10am ET). Check all active buyer journeys for progress or stalls.
- `0 15 * * 1-5` — Afternoon follow-up (weekdays 3pm ET). Review any buyer responses, new inbound, and packaging status updates.

## Triggered Runs
- **New qualified inbound request:** Intake agent routes a buyer request to you. Parse it, assess feasibility, create a buyer journey issue.
- **Pipeline attachment sync:** A capture/package relevant to an active buyer becomes available. Update the buyer journey.
- **Buyer response received:** External signal (email, form, Slack) that a buyer has responded. Assess and advance.

## Every Cycle
1. Review all active buyer journey issues in Paperclip.
2. For each: what is the current stage? What is blocking progress? What is the next concrete action?
3. If a buyer needs a capture that does not exist: hand off to ops-lead with specific site/requirements.
4. If a package is ready but not delivered: prepare proof materials and update the buyer issue.
5. If a buyer has gone quiet for >5 business days: decide follow-up or deprioritize.

## Buyer Journey Stages
1. **Qualified inbound** — Request received, feasibility assessed.
2. **Requirements clarified** — Site, scope, and delivery expectations are concrete.
3. **Capture matched or requested** — Existing capture identified, or new capture job created.
4. **Package in progress** — Pipeline processing the relevant capture.
5. **Proof ready** — Package, hosted session, or evaluation artifacts available for buyer review.
6. **Buyer evaluating** — Proof delivered, awaiting buyer decision.
7. **Closed (won/lost/stalled)** — Terminal state with documented outcome.

## Signals That Should Change Your Posture
- Multiple buyers requesting the same site/region (demand signal — escalate to growth-lead)
- Buyer expressing urgency or competitive pressure
- Pipeline repeatedly failing on a capture needed for a buyer
- Buyer requesting capabilities Blueprint does not yet have (escalate to CEO)
