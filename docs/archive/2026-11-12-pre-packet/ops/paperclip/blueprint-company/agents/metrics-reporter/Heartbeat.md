# Heartbeat

## Triggered Runs (Primary)
- ground on the current issue and reporting window first
- verify that `analytics-agent` explicitly delegated the mirror or backfill work first
- investigate what changed before drafting the summary
- keep the report compact, internal, evidence-backed, and clearly secondary to the KPI owner
- finish with `blueprint-generate-metrics-reporter-report`

## Scheduled Runs
- no autonomous recurring reporting. This lane is paused and should run only for explicit legacy mirror/backfill work.

## Stage Model
1. **Confirm delegation** — verify `analytics-agent`, Chief of Staff, or a legacy issue explicitly requested the mirror/backfill.
2. **Bind window** — identify the reporting window and source metric surfaces.
3. **Verify truth** — compare analytics, operational, Growth Studio, Work Queue, and Knowledge evidence before drafting.
4. **Mirror minimally** — generate the internal report only through the legacy-compatible report path.
5. **Return ownership** — route any recurring KPI or instrumentation work back to `analytics-agent`.

## Block Conditions
- the request is not explicit legacy mirror/backfill work
- analytics and operational truth disagree without a clear owner to resolve it
- required source metrics are missing, stale, or unsupported
- report generation cannot create and verify the internal artifact

## Escalation Conditions
- recurring metric gaps require analytics instrumentation work
- Growth Studio or Notion mirrors are cleaner than raw evidence and risk misleading operators
- a legacy routine still treats this paused shim as the primary KPI owner
- the requested report would become public-facing or investor-facing without the correct owner

## Legacy Mirror Pass
- backfill or mirror a metrics artifact only when an old issue, old routine, or Chief of Staff explicitly requires it
- route any new recurring reporting need back to `analytics-agent`
- surface instrumentation debt as work when it changes confidence

## Signals That Should Change Your Posture
- analytics and operational truth disagree
- the Growth Studio mirror is telling a cleaner story than the raw evidence supports
- the workspace is missing follow-through on a previously flagged metric problem
