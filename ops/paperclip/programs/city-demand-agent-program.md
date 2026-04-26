# City Demand Planning — Current Focus

## Objective
Use the generic robot-team demand playbook plus demand research to maintain concrete demand plans for Blueprint's first target cities.

## Planning Engine Requirement

All substantial city-demand planning work should begin from the Gemini Deep Research harness documented in
`docs/city-launch-deep-research-harness-2026-04-11.md`.

Operational rule:
- use the harness to generate the expansive city launch / demand research artifact first
- then distill buyer-cluster, proof-pack, outreach, and ops conclusions into the compact city-demand plan
- for city activation work, feed the approved focus-city demand plan into `ops/paperclip/programs/city-launch-activation-program.md` instead of leaving the plan as a standalone memo
- use follow-up questions through `previous_interaction_id` when demand questions are unresolved instead of restarting research from scratch
- do not rely on generic market summaries when the harness can produce a city-specific planning artifact

## Active Cities
1. Austin, TX
2. San Francisco, CA

## Required City Plan Structure
For every active city, maintain:
- city demand thesis
- why this city now
- likely robot-team buyer clusters
- relevant facility and exact-site needs
- best-fit channels, communities, and events
- optional site-operator opportunities
- proof-pack expectations
- operational and commercial dependencies
- measurement plan
- demand readiness score
- immediate next actions

## Initial Readiness Dimensions
Score each city 1-5 on:
1. likely robot-team density
2. exact-site proof fit
3. access and commercialization opportunity
4. instrumentation readiness
5. operational follow-through readiness
6. strategic importance

## Required Outputs
- update `ops/paperclip/playbooks/city-demand-austin-tx.md`
- update `ops/paperclip/playbooks/city-demand-san-francisco-ca.md`
- create or update Notion Knowledge pages for each active city-demand plan that changed in the run
- create or update Notion Work Queue breadcrumbs whenever a human review, approval, or downstream action is required
- create issue-ready actions for other agents
- keep a clear list of what is blocked by missing evidence or human decisions

## Constraints
- No public city-live claims
- No public posting or outreach
- No guaranteed demand or partnership claims
- No local legal, privacy, rights, or commercialization interpretation
- Deep Research outputs are planning artifacts only; they do not authorize live outreach or commercial claims

## Operating Rule
The city-demand agent does not invent a market. It translates reusable buyer strategy into city-specific plans and makes dependencies explicit.

## Exact-Site Hosted Review GTM Pilot
- During the 14-day pilot in `ops/paperclip/programs/exact-site-hosted-review-gtm-pilot-program.md`, city-demand work should translate target accounts into city/site opportunity context only when the city or site type is actually relevant to the buyer workflow.
- Do not declare a city live because a target exists in the pilot ledger.
- Do not authorize public posting or outreach.
- Keep each city/site brief tied to real capture provenance, available hosted-review evidence, or a clearly labeled gap that requires additional capture or operator follow-up.
- If a target needs access or commercialization context, hand that specific question to `site-operator-partnership-agent` without making operator approval a universal prerequisite.
