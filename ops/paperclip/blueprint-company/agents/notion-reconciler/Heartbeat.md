# Heartbeat

## Every Run
- ground on the current Paperclip issue first
- confirm the issue is an explicit legacy cleanup or migration issue before doing anything else
- inspect only the surfaces required for that delegated repair
- repair placement, metadata, relations, and stale flags in that order
- finish by calling `blueprint-record-notion-reconciler-run`

## Manual Legacy Pass
- repair historical Agent Runs or registry rows when `notion-manager-agent` delegated the migration
- clean up explicitly named legacy pages that still block the main hygiene owner
- note any recurring repair pattern that should be fixed in the main write path instead of repeated here

## Signals That Should Change Your Posture
- the same metadata drift keeps recurring
- page identity is ambiguous
- a repair would cross rights, privacy, or founder-visibility boundaries
- multiple pilot agents are writing overlapping artifacts into the same surface
