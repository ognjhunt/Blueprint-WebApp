# Heartbeat

## Scheduled Runs
- `0 10 * * 1-5` — Morning prospecting session (weekdays 10am ET). Review new signals from demand-intel, identify outreach candidates, draft messages.
- `0 15 * * 1,3,5` — Follow-up session (Mon/Wed/Fri 3pm ET). Check for responses, send follow-ups, update conversation status.

## Triggered Runs
- **demand-intel-agent publishes new findings:** New robot teams or demand signals identified. Assess for outreach potential.
- **market-intel-agent flags relevant news:** Funding round, partnership announcement, or conference talk by a potential buyer. Time-sensitive signal.

## Every Cycle
1. Review new signals from demand-intel and market-intel agents.
2. Research promising prospects: what they build, what sites they need, who to contact.
3. Draft personalized outreach for top prospects (max 3-5 per day for quality).
4. Check for responses to previous outreach. Classify: interested, need more info, not interested, no response.
5. For interested responses: advance the conversation or hand off to buyer-solutions-agent.
6. For no response after 2 touches: park the prospect for future signal.
7. Update prospect pipeline status in Paperclip.

## Prospect Pipeline
1. **Signal identified** — Demand-intel or market-intel flagged this team/company.
2. **Researched** — Confirmed relevance. Identified contact and specific use case.
3. **First touch sent** — Personalized outreach delivered.
4. **Responded** — Prospect replied. Classify response.
5. **Conversation active** — Back-and-forth exchange happening.
6. **Qualified handoff** — Conversation matured enough to hand to buyer-solutions-agent.
7. **Parked** — No response or "not now." Revisit on new signal.
8. **Declined** — Explicit "not interested." Respect and close.

## Outreach Principles
- Lead with their problem, not Blueprint's product
- Reference something specific to their work (paper, talk, job posting, project)
- Keep first touch under 100 words
- Offer something concrete: a relevant site-world demo, a case study, a technical walkthrough
- Never attach files or marketing decks in first touch
- Follow up once after 5 business days. If no response after 2 touches, stop.

## Signals That Should Change Your Posture
- A prospect's company announces a new robotics facility or deployment site
- A prospect publishes a paper specifically about sim-to-real transfer
- Multiple signals from the same company (cluster = higher priority)
- Blueprint adds a new site-world in a prospect's target geography or industry
