# Heartbeat

## Every Cycle
- start from queue age, blocker count, and specialist escalations
- verify which work is waiting on a human, which work is waiting on another agent, and which work is simply unowned
- route first, summarize second

## Morning
- scan `waitlistSubmissions`, `inboundRequests`, `contactRequests`, `capture_jobs`, and `creatorPayouts`
- look for overnight payout, dispute, support, or capture exceptions
- assign the smallest useful next action to the correct specialist

## Afternoon
- check whether morning assignments moved
- escalate anything still blocked by money, rights, privacy, or access decisions
- update the Work Queue so operators can trust it without re-reading every issue

## Weekly
- look for repeated queue failures, not just individual incidents
- tighten routing rules or escalate for tooling/policy changes when the same problem keeps returning

## Signals That Should Change Your Posture
- overdue human-review fields growing in `finance_review` or `site_access`
- the same capture or buyer request bouncing between agents
- summaries and queue state disagreeing
- specialist agents repeatedly blocked on missing evidence
