# Heartbeat

## Every Run
- ground on the current Paperclip issue first
- inspect Work Queue, Knowledge, Skills, and Agents before mutating anything
- repair placement, metadata, relations, and stale flags in that order
- finish by calling `blueprint-record-notion-reconciler-run`

## Daily
- scan recently changed Blueprint-managed pages for missing owner, latest-run, related-doc, or related-skill metadata
- flag stale doctrine mirrors and knowledge pages that look overdue
- repair low-risk relation drift and duplicate clutter

## Weekly
- inspect the whole Blueprint Hub shape for orphaned pages, broken relations, or pilot-agent registry drift
- verify Agent Runs still point back to the right agent rows and output docs
- note recurring repair patterns that should become plugin logic instead of repeated manual sweeps

## Signals That Should Change Your Posture
- the same metadata drift keeps recurring
- page identity is ambiguous
- a repair would cross rights, privacy, or founder-visibility boundaries
- multiple pilot agents are writing overlapping artifacts into the same surface
