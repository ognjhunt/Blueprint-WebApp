# Notion Hygiene Contract

## Owner
`notion-manager-agent` is the sole owner of Blueprint Notion hygiene.

`notion-reconciler` is a legacy migration lane only. It does not own recurring workspace hygiene, broad sweeps, or duplicate authority over Blueprint Hub.

## Truth Boundary
- `Paperclip` is the execution and ownership record
- app and repo state are the product/runtime truth
- `Notion` is the workspace, review, and visibility mirror

## Order Of Operations
1. deterministic idempotency and natural-key rules
2. event-driven drift repair
3. manual or targeted reconciliation
4. broad recurring sweeps only after the first three layers are stable

## Idempotency Rules
- one canonical page per natural key
- relation repair uses explicit page ids or durable source links, not title guessing
- repo `knowledge/` artifacts outrank mirrored Notion knowledge pages when both exist
- duplicate-page cleanup happens only when canonical source and ownership are clear
- stale metadata drift must open a visible Paperclip follow-up when content truth cannot be refreshed safely

## Drift Classes
- `duplicate-page drift`
- `stale metadata drift`
- `queue lifecycle conflict`
- `registry / agent-run mirror drift`
- `ambiguous workspace mutation`

## Broad Sweep Restart Gate
Do not restart standing sweeps until all are true:
- duplicate-page drift is consistently resolved through deterministic upsert paths
- stale metadata drift is visible and idempotent
- queue lifecycle conflicts are routed to the execution owner instead of producing repeat cleanup churn
- founder-facing views stay legible without manual rescue
- routine operator approvals and launch-readiness work live in operator-facing views instead of being dumped into founder-facing queues

## Legacy Lane Rule
`notion-reconciler` may be woken only for:
- historical Agent Runs mirror repair
- one-time migration cleanup explicitly assigned by Chief of Staff
- legacy page normalization that `notion-manager-agent` delegates deliberately

It is not a standing hygiene owner.
