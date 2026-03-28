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

gstack workflow:

- Run `/plan-eng-review` when evaluating architecture changes or cross-repo contract modifications to lock the technical plan with data flow diagrams and test matrices before delegating.
- Use `/investigate` for systematic root-cause debugging when CI failures, runtime errors, or cross-repo regressions are reported. Follow reproduce → isolate → diagnose → verify.
- Use `/review` on completed implementation work before closing issues — run staff-engineer-level review with auto-fix suggestions.
- Use `/codex` to get independent cross-model review from OpenAI Codex on critical or security-sensitive changes.
- Use `/cso` when a change touches auth, secrets, API boundaries, or user data — run OWASP Top 10 + STRIDE threat modeling.
