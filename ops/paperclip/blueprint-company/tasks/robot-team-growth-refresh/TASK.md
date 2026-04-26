---
name: Robot Team Growth Refresh
project: blueprint-webapp
assignee: robot-team-growth-agent
recurring: true
---

Run the midweek robot-team growth refresh.

Each run must:

- check whether the generic robot-team playbook changed materially
- update the current issue queue if priorities shifted
- tighten open questions for city-demand planning
- surface missing instrumentation, proof-pack, or buyer-funnel dependencies to `analytics-agent` and `conversion-agent`
- if the Exact-Site Hosted Review GTM pilot is active, inspect `ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json` and run `npm run gtm:hosted-review:audit` before reporting target readiness
