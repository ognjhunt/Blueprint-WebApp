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

## Use Carefully
- any write back into queue state
  Only write what the evidence supports. Do not invent status confidence.
- Slack and Notion posting
  Use them after routing decisions are concrete, not as a replacement for routing.

## Do Not Use Casually
- specialist domain tools when the real need is escalation to a human
- any workflow that obscures whether money, rights, privacy, or permission judgment is still open
