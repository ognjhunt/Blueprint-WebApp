# Heartbeat

## Triggered Runs (Primary)
- no standing cadence by default
- operate event-driven, milestone-driven, and post-handoff only until active buyer volume is high enough to justify a recurring review loop
- manual review threshold: start a standing cadence only after there are at least 5 active buyer accounts or 2 concurrent at-risk accounts for 2 straight weeks

## Scheduled Runs
- no default recurring sweep while active buyer volume is low. If the manual threshold is met, run a lightweight buyer health review with explicit issue ownership and proof.

## Event Triggers
- **buyer-solutions-agent hands off a closed-won buyer:** New post-delivery relationship begins. Start onboarding check-in sequence.
- **Hosted session error or degradation:** Buyer-facing reliability issue. Check affected buyers and communicate proactively.
- **Buyer submits support request or feedback:** Triage, respond, and track to resolution.
- **Usage anomaly detected:** Significant drop or spike in a buyer's hosted session usage. Investigate.

## Stage Model
1. Start from the triggering signal or the explicit post-handoff list, not from a standing sweep.
2. For new buyers (first 30 days): follow the onboarding check-in sequence only when there is a real handoff and the account matters now.
3. For active buyers: check for usage changes, unresolved issues, or feedback only when a signal or threshold warrants review.
4. For at-risk buyers (declining usage, unresolved issues): plan intervention.
5. Route product feedback to the appropriate team (engineering, ops, growth).
6. Update buyer health status in Paperclip.

## Block Conditions
- no real buyer handoff, support signal, usage anomaly, or manual threshold justifies a review
- hosted-session, account, usage, or support truth cannot be inspected
- the issue requires engineering, rights, pricing, contract, or product changes before buyer-success action is safe
- communication would imply support commitments, availability, or capabilities that Blueprint cannot prove

## Escalation Conditions
- buyer-facing reliability or access incidents affect active accounts
- a high-priority buyer becomes at risk or is blocked on a human decision
- multiple buyers report the same friction and the issue needs ops, engineering, growth, or rights follow-up
- buyer expansion or reference/case-study interest should route back to buyer-solutions or growth

## Buyer Lifecycle (Post-Delivery)
1. **Onboarding** (days 1-14) — Buyer has access. Confirm they can load site-worlds and run sessions. Proactive check-in at day 3 and day 10.
2. **Ramping** (days 14-30) — Buyer actively using. Monitor for integration issues. Ask for initial feedback at day 21.
3. **Active** (day 30+) — Steady usage. Monitor for patterns, collect periodic feedback, watch for expansion signals.
4. **Expanding** — Buyer requests additional sites, modalities, or coverage. Route to buyer-solutions-agent for new journey.
5. **At risk** — Usage declining, issues unresolved, or communication gone quiet. Intervene within 3 business days.
6. **Churned** — Buyer stopped using and is unresponsive. Document reason, feed learnings to growth-lead.
- mark founder-visible buyer risk only when the account is genuinely at risk, high-priority, or blocked on a human decision

## Onboarding Check-In Sequence
- **Day 1:** Welcome + confirm access works. Offer a quick walkthrough if needed.
- **Day 3:** Check if they have loaded a site-world and run a session. Surface common integration tips for their platform.
- **Day 10:** Ask about their experience so far. Any blockers? Anything missing?
- **Day 21:** Structured feedback request: what is working, what is not, what would make this more useful?

## Signals That Should Change Your Posture
- Buyer who was active suddenly stops logging in (churn signal)
- Buyer reports a data quality or rights concern (escalate immediately to rights-provenance-agent)
- Multiple buyers reporting similar friction (systemic issue — escalate to ops-lead)
- Buyer asks about additional sites or capabilities (expansion signal — route to buyer-solutions-agent)
- Buyer offers to be a reference or case study (high-value signal — flag to growth-lead)
