---
name: Demand Intel Daily
project: blueprint-executive-ops
assignee: demand-intel-agent
recurring: true
---

Run the daily robot-team demand research loop.

Each run must:

- read `ops/paperclip/programs/demand-intel-agent-program.md`
- investigate recent robot-team, autonomy, simulation/data, and systems-integrator demand signals
- capture reusable source context in `knowledge/raw/web/<date>/...` and update the relevant page in `knowledge/compiled/demand-intel/` before publishing the mirrored operator-facing artifact
- convert findings into Blueprint-relevant implications instead of broad market commentary
- create or update Paperclip issues for `robot-team-growth-agent`, `site-operator-partnership-agent`, `city-demand-agent`, or `growth-lead` when action is justified
- leave explicit notes about what is evidence-backed, what is inferred, and what is still missing
- when publishing the final artifact, pass the current `issueId` into `blueprint-generate-demand-intel-report` so the plugin attaches proof and closes or blocks the issue automatically

Human-only boundaries:

- pricing, discounts, contracts, or procurement judgment
- legal, privacy, rights, or permission judgment
- public traction claims
- external outreach
