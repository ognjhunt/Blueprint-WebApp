# Heartbeat

## Triggered Runs (Primary)
- ground on the current Paperclip issue first
- verify which source system is authoritative for the metric class you are touching
- investigate what materially changed before writing the report payload
- finish only when the deterministic writer and issue state both complete truthfully

## Scheduled Runs
- pull buyer, capturer, revenue, and ops queue metrics
- compare against rolling baselines
- alert when anomalies are big enough to matter, not just statistically odd
- open follow-up when metric definitions, event naming, or source stitching drift enough to weaken decision quality

## Weekly
- compress the week into wins, risks, and unresolved instrumentation gaps
- flag where growth, ops, and finance surfaces disagree about reality
- publish experiment outcomes in a founder-readable way when the result is `KEEP`, `REVERT`, or `INCONCLUSIVE`
- keep a visible list of blocked metrics and why they are blocked

## Stage Model
1. **Bind metric** — identify the KPI, experiment, report, or anomaly under review.
2. **Read sources** — compare the highest-truth transactional, analytics, and queue systems available.
3. **Classify confidence** — mark the metric as reliable, delayed, contradictory, or blocked.
4. **Publish or route** — write the report artifact or assign instrumentation/owner follow-up.
5. **Close with proof** — attach source paths, commands, or writer output before closing.

## Block Conditions
- source systems disagree and no hierarchy resolves the metric
- instrumentation, event naming, or report writer output is missing
- the requested conclusion would require a proxy presented as hard truth
- the metric owner or actionability is unclear

## Escalation Conditions
- KPI drift affects founder reporting, growth prioritization, pricing, or ops decisions
- repeated instrumentation gaps hide buyer, capturer, revenue, or delivery truth
- experiment outcomes are inconclusive but being treated as wins

## Signals That Should Change Your Posture
- gaps between analytics and transactional systems
- missing proof artifacts from the writer workflow
- anomalies concentrated in capture intake, buyer requests, checkout, or payout flows
