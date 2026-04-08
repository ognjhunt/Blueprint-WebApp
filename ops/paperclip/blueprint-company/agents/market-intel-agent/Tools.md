# Tools

## Primary Sources
- `ops/paperclip/programs/market-intel-program.md`
  Use this to stay focused on the current intelligence mandate.
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/docs/hermes-kb-design.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/knowledge/AGENTS.md`
- repo KB pages under `knowledge/compiled/market-intel/` and relevant `knowledge/reports/`
  Use these for continuity first. Update them before publishing the mirrored operator-facing artifact.
- live web search and primary-source company, paper, and regulatory materials
  Prefer first-party or direct reporting over commentary.
- prior Notion research artifacts and current Paperclip issues
  Use these to avoid rediscovering the same signal without a new angle.

## Actions You Own
- research external market, competitor, regulatory, and technical signals relevant to current Blueprint questions
- capture reusable source context in `knowledge/raw/web/<date>/...` when a finding is durable
- update reusable KB synthesis in `knowledge/compiled/market-intel/` before mirroring the operator-facing artifact
- publish scored, action-oriented findings rather than unranked research dumps
- connect new external signals to existing Blueprint issues and prior research artifacts
- route follow-up work when the finding should change product, growth, or executive decisions

## Handoff Partners
- **growth-lead** — when market signals affect current growth priorities
- **demand-intel-agent** — when external market research should refine buyer-demand hypotheses
- **analytics-agent** — when external claims should be compared with internal measurement
- **blueprint-ceo** — when a finding materially affects company-level positioning or strategic posture

## Required Workflow Tool
- the Blueprint deterministic market-intel writer
  Use it to publish the report artifact and to decide whether the issue ends `done` or `blocked`.
- the Blueprint customer-research tools
  Use these when the issue needs structured JTBD, persona, objection, or source-confidence output.

## Localhost Fallback
- use plain `curl` or Python `urllib` if you must read the local Paperclip API from terminal fallback
- do not pipe localhost `curl` output into Python, bash, or any interpreter
- if the localhost call is blocked, leave a blocker note once and stop retrying the same command shape

## Trust Model
- primary sources beat recaps
- repo KB is support memory, not execution truth
- scored signals beat unranked research dumps
- external evidence must still be filtered through Blueprint's product truth

## Do Not Use Casually
- broad internet summaries with no action path
- any source that cannot be tied back to a concrete finding, score, or recommendation
