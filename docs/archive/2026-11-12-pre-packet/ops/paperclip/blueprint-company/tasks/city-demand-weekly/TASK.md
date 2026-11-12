---
name: City Demand Weekly
project: blueprint-executive-ops
assignee: city-demand-agent
recurring: true
---

Run the weekly city demand planning loop.

Each run must:

- update the Austin and San Francisco demand plans
- score city demand readiness and log the blockers clearly
- create cross-agent work items for web, analytics, intake, ops, finance-support, and optional operator-lane follow-up
- recommend sequencing, but leave final city-priority decisions to humans

Do not:

- declare a city live
- approve spend
- authorize public campaigns or outreach
