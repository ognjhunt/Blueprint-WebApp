# Paperclip Agent Registry Sync

Date: 2026-04-09

Status: Active

## Purpose

Keep `Blueprint Agents` in Notion as a visibility mirror of Blueprint's Paperclip-run autonomous org without letting Notion become the execution source of truth.

## Truth Order

1. Repo truth:
   - `ops/paperclip/blueprint-company/.paperclip.yaml`
   - `ops/paperclip/blueprint-company/agents/*/AGENTS.md`
   - `AUTONOMOUS_ORG.md`
2. Live Paperclip truth:
   - current live agents and their runtime status
3. Notion:
   - visibility layer for registry rows, relations, and readable agent page bodies

## What The Sync Owns

- upsert every canonical repo agent row in `Blueprint Agents`
- include live Paperclip-only agent aliases when they still exist in the company
- populate registry metadata from repo + live Paperclip state:
  - canonical key
  - reporting line
  - department / role
  - runtime
  - default trigger
  - readable / writable surfaces
  - tool access
  - linked skills when a matching `Blueprint Skills` row exists
  - latest run relation when a matching `Blueprint Agent Runs` row exists
- replace each agent page body with a compact generated summary and canonical links back to repo and Notion surfaces

## Ongoing Sync Paths

- startup maintenance in the Blueprint automation worker
- `agent.created` and `agent.updated` event handling in the Blueprint automation worker
- scheduled job: `agent-registry-sync`
- manual repo-side backfill:

```bash
source /Users/nijelhunt_1/workspace/.paperclip-blueprint.env
npx tsx scripts/paperclip/backfill-blueprint-agents-registry.ts
```

## Guardrails

- Do not use Notion native paid Custom Agents as runtime truth.
- Do not derive execution ownership from Notion-only state.
- Do not invent runs, permissions, or linked skills when the repo / live state does not support them.
- Prefer leaving a field blank over asserting unsupported state.
