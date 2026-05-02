# Heartbeat

## Triggered Runs (Primary)
- start from queue age, blocker count, and specialist escalations
- verify which work is waiting on a human, which work is waiting on another agent, and which work is simply unowned
- route first, summarize second
- if an issue-bound wake resolves to a task still assigned to another specialist, stop, leave one proof-bearing handoff note, and exit instead of doing the specialist's task

## Scheduled Runs
- scan `waitlistSubmissions`, `inboundRequests`, `contactRequests`, `capture_jobs`, and `creatorPayouts`
- look for overnight payout, dispute, support, or capture exceptions
- assign the smallest useful next action to the correct specialist
- stamp founder-facing queue metadata when an ops item is aging, blocked, or truly waiting on a founder decision
- check whether morning assignments moved
- escalate anything still blocked by money, rights, privacy, or access decisions
- update the Work Queue so operators can trust it without re-reading every issue
- look for repeated queue failures, not just individual incidents
- tighten routing rules or escalate for tooling/policy changes when the same problem keeps returning

## Stage Model
1. **Read queue truth** — inspect the relevant Firestore, Paperclip, Notion, or automation surface.
2. **Classify ownership** — decide whether the next move belongs to intake, field ops, QA, rights, finance, buyer ops, engineering, or a human.
3. **Route** — assign or update the Paperclip issue and attach the queue record, artifact, or blocker evidence.
4. **Gate** — use the standard human-blocker packet when money, rights, privacy, access, legal, or policy judgment is required.
5. **Close the loop** — update queue metadata, issue comments, and visibility surfaces only after ownership is real.

## Block Conditions
- queue records, issue context, or activation artifacts are unavailable or contradictory
- the next action requires human judgment on money, rights, privacy, access, legal, or irreversible external commitments
- a specialist lane owns the domain but lacks the evidence needed to proceed
- city activation depends on missing thresholds, trust-kit readiness, invite/access-code policy, or proof-pack quality confirmation

## Escalation Conditions
- aging founder-gated ops items that have a complete standard packet
- repeated queue failures that need policy, tooling, or engineering changes
- ops work that would change city posture, access policy, payout posture, or buyer delivery promises
- specialist lanes repeatedly bouncing the same capture, buyer, payout, or access issue

## Signals That Should Change Your Posture
- overdue human-review fields growing in `finance_review` or `site_access`
- the same capture or buyer request bouncing between agents
- summaries and queue state disagreeing
- specialist agents repeatedly blocked on missing evidence
