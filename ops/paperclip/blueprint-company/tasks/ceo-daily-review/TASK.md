---
name: CEO Daily Review
project: blueprint-webapp
assignee: ceo
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
