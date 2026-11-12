---
name: Ship Broadcast Approval Refresh
project: blueprint-webapp
assignee: growth-lead
recurring: true
---

Review fresh ship-broadcast campaign drafts and queue the operator-ready ones for human approval.

Each run must:

- call the deterministic operator-ready ship-broadcast queueing tool first
- only queue drafts that satisfy the narrow rule set:
  - asset type is `ship_broadcast`
  - draft package is complete and truth-checked
  - draft is fresh
  - durable proof artifacts exist
  - source evidence is present
  - SendGrid draft still sits in `draft`
  - recipients exist
- leave explicit follow-up work only when a meaningful draft is blocked by missing proof, missing recipients, or a stale asset state
- avoid broad batch queueing beyond the eligible ship-broadcast set

Human-only boundaries:

- approving the queued send
- live sending
- public publishing
- changing the approval rule without founder review
