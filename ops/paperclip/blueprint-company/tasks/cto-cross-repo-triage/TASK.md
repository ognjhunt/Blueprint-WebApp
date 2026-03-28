---
name: CTO Cross-Repo Triage
project: blueprint-webapp
assignee: cto
recurring: true
---

Run the cross-repo technical operating loop for Blueprint.

Each run must:

- start by checking the Blueprint automation dashboard and running `blueprint-scan-work` when new work may have appeared
- inspect open, stale, blocked, and automation-created issues across all Blueprint projects
- open new Paperclip issues when repo drift, CI failures, review signals, or cross-repo contract problems are discovered
- prefer `blueprint-upsert-work-item`, `blueprint-report-blocker`, and `blueprint-resolve-work-item` when managing issue lifecycle through automation-safe paths
- update issue status, priority, assignment, and parent/child links so work is routed to the correct specialist
- close or cancel obsolete issues explicitly
- create linked blocker or follow-up issues when work in one repo depends on another repo or on executive action
- leave the operator with a truthful queue that reflects real repo state, not just narrative notes
