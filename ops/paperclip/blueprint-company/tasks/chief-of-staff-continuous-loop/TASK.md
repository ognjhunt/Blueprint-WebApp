---
name: Chief of Staff Continuous Loop
project: blueprint-executive-ops
assignee: blueprint-chief-of-staff
recurring: true
---

Run the continuous managerial loop for Blueprint.

This routine runs frequently during weekday operating hours. It is an internal management pass, not an extra founder briefing cadence.

Each run must:

- start with `blueprint-manager-state`
- determine what finished, what stalled, what is blocked, what is unassigned, and what needs a next action now
- use `blueprint-scan-work` when repo or automation state may have changed since the last meaningful check
- create, update, close, reprioritize, or reassign real Paperclip issues instead of narrating
- create blocker follow-up issues only when there is a real dependency or new owner to route
- keep work aligned with Blueprint's capture-first, world-model-product-first, provenance-truthful doctrine
- reduce founder coordination load without crossing human gates for strategy, budget, rights/privacy, commercialization, legal, or policy decisions
- batch normal founder visibility into the existing founder morning/accountability/EoD/Friday/gaps routines instead of sending extra founder-facing summaries from this loop
- leave the queue cleaner, clearer, and more truthful than it was at the start of the cycle
- when you conclude a manager-owned issue, use `blueprint-resolve-work-item` with `issueId` so closure is recorded explicitly

Slack visibility:

- treat task opens, delegations, closures, and manager wakeups as Slack-visible work
- rely on the automation mirror after the Paperclip change is made; do not post Slack-only state
