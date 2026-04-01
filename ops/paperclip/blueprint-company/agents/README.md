# Blueprint Agent Employee Kit

Canonical Blueprint agents are employees, not prompt fragments.

Every canonical agent directory under `ops/paperclip/blueprint-company/agents/` must include:

1. `AGENTS.md`
2. `Soul.md`
3. `Tools.md`
4. `Heartbeat.md`

## Non-Negotiables
- Narrow vertical ownership. One agent should own one lane well, not act like a floating generalist.
- Explicit software boundary. The agent operates on top of repo code, product surfaces, CI, issue tracking, QA/release tooling, and deployment systems rather than becoming those systems.
- Explicit handoff map. Adjacent agents and escalation paths must be named, not implied.
- Paperclip is the work record. Delegation, blockers, verification, and closure must show up in issues, not just in prose.
- Human gates remain visible for irreversible or high-risk decisions.
- Language stays capture-first, exact-site/world-model-product-first, rights-safe, privacy-safe, and provenance-truthful.

## Required Structure
`AGENTS.md`
- Frontmatter: `name`, `title`, `reportsTo`, `skills`
- `Read these sibling files before each substantial run`
- `Primary scope`
- `Default behavior`
- `What is NOT your job`
- explicit software-boundary sentence
- explicit delegation-visibility rule

`Soul.md`
- `## Why You Exist`
- `## What You Care About`
- `## Excellent Judgment In This Role`
- `## Never Compromise`
- `## Traps To Avoid`

`Tools.md`
- `## Primary Sources`
- `## Actions You Own`
- `## Handoff Partners`
- `## Trust Model`
- `## Do Not Use Casually`

`Heartbeat.md`
- `## Triggered Runs (Primary)`
- `## Scheduled Runs`
- `## Stage Model`
- `## Block Conditions`
- `## Escalation Conditions`

## Validation
- Run `scripts/paperclip/validate-agent-kits.sh` to validate the repo-side agent contract.
- `scripts/paperclip/verify-blueprint-paperclip.sh` now runs the agent-kit validator before adapter checks.
- The validator enforces the four-file kit for every canonical agent directory.
- The validator enforces the full section-level employee kit for the modernized engineering specialists:
  - `webapp-codex`
  - `webapp-claude`
  - `pipeline-codex`
  - `pipeline-claude`
  - `capture-codex`
  - `capture-claude`

## Adding New Agents
When adding a new canonical hire:

1. Create the full four-file kit on day one.
2. Follow the exact required headings above.
3. Add the new agent slug to the strict section-validation list in `scripts/paperclip/validate-agent-kits.sh`.
4. Run the validator before importing or reconciling the Paperclip company.
