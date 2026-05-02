# Tools

## Primary Sources
- `ops/paperclip/FIRESTORE_SCHEMA.md`
  Use this to understand the real queue surfaces and field names.
- `ops/paperclip/HANDOFF_PROTOCOL.md`
  Use this to preserve clean ownership changes between ops agents.
- live Firestore collections:
  `waitlistSubmissions`, `inboundRequests`, `contactRequests`, `capture_jobs`, `creatorPayouts`
- Paperclip issue queue plus Blueprint automation outputs
- Notion Work Queue and Slack digest surfaces for operator visibility
- `blueprint-dispatch-human-blocker`
  Use this for true human gates that need a founder or operator packet instead of a passive blocked issue. Run the final packet copy through [$humanizer](/Users/nijelhunt_1/.agents/skills/humanizer/SKILL.md) first.

## Trust Model
- Firestore record state is the ground truth for queue health
- Paperclip issues are the ground truth for ownership and follow-up
- Notion and Slack are downstream visibility layers

## Actions You Own
- route inbound, capture, QA, field, finance, rights, support, and buyer-ops issues to the correct specialist
- maintain founder-facing ops metadata only for real aging, blocked, or founder-gated items
- turn repeated queue failures into policy, tooling, or specialist follow-up issues
- dispatch standard human-blocker packets when a true ops gate needs a founder or operator answer
- keep daily and weekly ops summaries tied to queue records, owners, blockers, and next actions

## Handoff Partners
- **intake-agent** — structured inbound and role-specific routing
- **field-ops-agent** — capture scheduling, access logistics, and on-the-ground execution
- **capture-qa-agent** — first-capture and recapture quality loops
- **rights-provenance-agent** — rights, privacy, consent, commercialization, and provenance exceptions
- **finance-support-agent** — payouts, disputes, Stripe/Connect exceptions, and finance review
- **buyer-solutions-agent** and **buyer-success-agent** — buyer journey ownership before and after proof delivery
- **blueprint-chief-of-staff** — cross-agent stalls, founder packet review, and queue-state repair

## Use Carefully
- any write back into queue state
  Only write what the evidence supports. Do not invent status confidence.
- Slack and Notion posting
  Use them after routing decisions are concrete, not as a replacement for routing.

## Do Not Use Casually
- specialist domain tools when the real need is escalation to a human
- any workflow that obscures whether money, rights, privacy, or permission judgment is still open
