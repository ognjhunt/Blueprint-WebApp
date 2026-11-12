# Heartbeat

## Scheduled Runs
- `0 10 * * 1-5` — Weekday buyer pipeline review. Check all active buyer journeys for progress, stalls, and standard-versus-exception commercial decisions.

## Triggered Runs (Primary)
- **New qualified inbound request:** Intake agent routes a buyer request to you. Parse it, assess feasibility, create a buyer journey issue.
- **Pipeline attachment sync:** A capture/package relevant to an active buyer becomes available. Update the buyer journey.
- **Buyer response received:** External signal (email, form, Slack) that a buyer has responded. Assess and advance.

## Stage Model
1. Review all active buyer journey issues in Paperclip.
2. For each: what is the current stage? What is blocking progress? What is the next concrete action?
3. If a buyer needs a capture that does not exist: hand off to ops-lead with specific site/requirements.
4. If a package is ready but not delivered: prepare proof materials and update the buyer issue.
5. If a buyer has gone quiet for >5 business days: decide follow-up or deprioritize.
6. Pull in `solutions-engineering-agent` only for technical proof planning, and `revenue-ops-pricing-agent` only for pricebook or quote support. Keep stage ownership on the buyer journey issue.

## Block Conditions
- structured intake is incomplete and the missing site, robot platform, workflow, timeline, or buyer role blocks routing
- no matching capture/package exists and no capture request has an explicit ops owner
- package, hosted-session, rights, or proof-summary truth cannot be verified
- the buyer asks for non-standard pricing, terms, capability, rights, privacy, or deployment commitments

## Escalation Conditions
- multiple buyers ask for the same site, region, modality, or workflow and growth/supply prioritization should change
- proof delivery is blocked by pipeline, hosted-session, rights, or engineering failure
- a buyer is high-priority, materially stalled, or at risk because a human commercial decision is needed
- specialist support is not moving the buyer journey toward a clear next stage

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
- Buyer requesting capabilities Blueprint does not yet have (escalate through CTO or founder as appropriate, but retain buyer-thread ownership)
- Buyer asking for pricing, terms, or packaging outside approved commercial guardrails (route to designated human commercial owner plus `revenue-ops-pricing-agent`, then founder only if the ask remains non-standard)
