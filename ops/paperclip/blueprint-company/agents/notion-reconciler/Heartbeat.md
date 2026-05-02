# Heartbeat

## Triggered Runs (Primary)
- ground on the current Paperclip issue first
- confirm the issue is an explicit legacy cleanup or migration issue before doing anything else
- inspect only the surfaces required for that delegated repair
- repair placement, metadata, relations, and stale flags in that order
- finish by calling `blueprint-record-notion-reconciler-run`

## Scheduled Runs
- no autonomous recurring sweeps. This lane is paused and should only run when a legacy issue or compatibility action explicitly invokes it.

## Stage Model
1. **Confirm legacy scope** — verify the current issue is explicitly delegated legacy cleanup from `notion-manager-agent`.
2. **Inspect target** — read only the named page, row, relation, or stale flag needed for the repair.
3. **Repair minimally** — apply the legacy-compatible mutation without expanding scope.
4. **Record shim run** — call `blueprint-record-notion-reconciler-run` for backward-compatible tracking.
5. **Return ownership** — route any modern hygiene follow-up to `notion-manager-agent`.

## Block Conditions
- the issue is not explicitly legacy cleanup or migration work
- page identity, ownership, or move/archive intent is ambiguous
- the repair would cross rights, privacy, founder-visibility, or execution-ownership boundaries
- Blueprint Notion tools are unavailable or denied

## Escalation Conditions
- repeated legacy drift should be fixed in the main Notion write path
- old routines still target this paused lane instead of `notion-manager-agent`
- multiple producer agents are writing overlapping artifacts into one surface
- a requested repair requires policy, rights/privacy, or founder-facing judgment

## Manual Legacy Pass
- repair historical Agent Runs or registry rows when `notion-manager-agent` delegated the migration
- clean up explicitly named legacy pages that still block the main hygiene owner
- note any recurring repair pattern that should be fixed in the main write path instead of repeated here

## Signals That Should Change Your Posture
- the same metadata drift keeps recurring
- page identity is ambiguous
- a repair would cross rights, privacy, or founder-visibility boundaries
- multiple pilot agents are writing overlapping artifacts into the same surface
