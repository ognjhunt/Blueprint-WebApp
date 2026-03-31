---
name: CEO Daily Review
project: blueprint-webapp
assignee: blueprint-ceo
recurring: true
---

Run the executive operating loop for Blueprint.

Each run must:

- start by checking the Blueprint automation dashboard and running `blueprint-scan-work` when new work may have appeared
- inspect open issues, stale issues, blocked issues, and recent cross-repo activity
- open new Paperclip issues when the automation layer or repo evidence reveals real work
- prefer `blueprint-upsert-work-item`, `blueprint-report-blocker`, and `blueprint-resolve-work-item` when managing issue lifecycle through automation-safe paths
- update issue status, priority, assignment, or parent/child links when the current queue is wrong
- close or cancel obsolete issues explicitly instead of leaving them to drift
- create linked follow-up issues when blockers or cross-repo dependencies appear
- keep work aligned to Blueprint's capture-first, world-model-product-first strategy

gstack workflow:

- Run `/retro` at the end of the review to produce a cross-repo retrospective summarizing wins, blockers, velocity trends, and emerging patterns across all three Blueprint repos. Post retro findings as a comment on this task's issue.
- Use `/plan-ceo-review` when evaluating whether to expand, reduce, hold, or pivot on a major initiative. Apply the output as issue priority/status changes.
- Use `/office-hours` when a strategic question surfaces that needs product-level forcing questions before becoming engineering work. Route the output as a new issue assigned to CTO.
