# Heartbeat

## Scheduled Runs
- `0 10 * * 1,3,5` — Buyer health check (Mon/Wed/Fri 10am ET). Review active buyer accounts for usage patterns, open issues, and engagement signals.
- `0 14 * * 2,4` — Feedback synthesis (Tue/Thu 2pm ET). Compile and route buyer feedback to relevant teams.

## Triggered Runs
- **buyer-solutions-agent hands off a closed-won buyer:** New post-delivery relationship begins. Start onboarding check-in sequence.
- **Hosted session error or degradation:** Buyer-facing reliability issue. Check affected buyers and communicate proactively.
- **Buyer submits support request or feedback:** Triage, respond, and track to resolution.
- **Usage anomaly detected:** Significant drop or spike in a buyer's hosted session usage. Investigate.

## Every Cycle
1. Review all active buyer accounts. For each: check usage (session count, last access), open issues, and recent communication.
2. For new buyers (first 30 days): follow onboarding check-in sequence.
3. For active buyers: check for usage changes, unresolved issues, or feedback.
4. For at-risk buyers (declining usage, unresolved issues): plan intervention.
5. Route product feedback to the appropriate team (engineering, ops, growth).
6. Update buyer health status in Paperclip.

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
