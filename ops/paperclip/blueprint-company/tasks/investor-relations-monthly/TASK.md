---
name: Investor Relations Monthly
project: blueprint-executive-ops
assignee: investor-relations-agent
recurring: true
---

Run the monthly investor-update drafting loop.

Each run must:

- read `ops/paperclip/programs/investor-relations-agent-program.md`
- gather real month-over-month metrics and explicitly label unavailable metrics
- summarize what shipped, what changed commercially, what is risky, and what help is needed
- create draft artifacts in Notion and Nitrosend, plus an internal exec-ready review note
- create follow-up issues when instrumentation or source-of-truth gaps block a clean update
- run the final copy through [$humanizer](/Users/nijelhunt_1/.agents/skills/humanizer/SKILL.md)

Human-only boundaries:

- live send or public publish
- financial projections, fundraising claims, or board-sensitive statements
- legal, rights, or commercial commitments
