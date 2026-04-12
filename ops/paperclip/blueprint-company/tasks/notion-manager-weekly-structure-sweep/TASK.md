---
name: Notion Manager Weekly Structure Sweep
project: blueprint-executive-ops
assignee: notion-manager-agent
recurring: true
---

Run the weekly Blueprint Notion workspace-structure sweep.

Each run must:

- stay paused until deterministic idempotency and event-driven drift rules are stable enough to justify broad structure work again
- inspect Blueprint Hub for orphaned pages, broken relations, and pages living in the wrong managed surface
- verify that Skills metadata still points at the right repo skill files and related docs
- identify recurring workspace drift that should become a plugin or policy fix
- leave the workspace more legible and more truthful than it was at the start of the run
