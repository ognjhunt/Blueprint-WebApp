---
name: Robot Team Growth Weekly
project: blueprint-webapp
assignee: robot-team-growth-agent
recurring: true
---

Run the weekly generic robot-team demand playbook update.

Each run must:

- read the current program and generic playbook
- ingest new demand-intel findings plus any analytics, intake, ops, pricing, or buyer-thread feedback
- update Blueprint's generic robot-team demand playbook
- create downstream issues for `conversion-agent`, `analytics-agent`, `intake-agent`, `ops-lead`, `buyer-solutions-agent`, `revenue-ops-pricing-agent`, and `city-demand-agent` where needed
- create or update a downstream `webapp-codex` issue using `ops/paperclip/blueprint-company/tasks/webapp-creative-image-execution/TASK.md` when the weekly output needs image-heavy campaign or mockup execution
- keep all recommendations truthful to current Blueprint capabilities

Human-only boundaries:

- spend
- pricing or discounts
- contracts or procurement commitments
- outreach sends or public traction claims
