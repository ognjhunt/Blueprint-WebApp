---
name: Market Intel Daily
project: blueprint-executive-ops
assignee: market-intel-agent
recurring: true
---

Run the daily market and competitive intelligence loop.

Each run must:

- read `ops/paperclip/programs/market-intel-program.md`
- investigate competitor moves, world-model backend signals, regulatory changes, and robotics deployment market shifts
- capture reusable source context in `knowledge/raw/web/<date>/...` and update the relevant page in `knowledge/compiled/market-intel/` before publishing the mirrored operator-facing artifact
- convert findings into Blueprint-relevant implications instead of generic ecosystem summaries
- create or update Paperclip issues for `growth-lead`, `robot-team-growth-agent`, `site-operator-partnership-agent`, or `blueprint-cto` when action is justified
- leave explicit notes about what is evidence-backed, what is inferred, and what still needs validation
- when publishing the final artifact, pass the current `issueId` into `blueprint-generate-market-intel-report` so the plugin attaches proof and closes or blocks the issue automatically

Human-only boundaries:

- pricing, discounting, or contract judgment
- legal, privacy, rights, or policy judgment
- public competitive claims
- external outreach
