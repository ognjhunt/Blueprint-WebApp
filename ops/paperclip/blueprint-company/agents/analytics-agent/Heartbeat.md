# Heartbeat

## Every Run
- ground on the current Paperclip issue first
- verify which source system is authoritative for the metric class you are touching
- investigate what materially changed before writing the report payload
- finish only when the deterministic writer and issue state both complete truthfully

## Daily
- pull buyer, capturer, revenue, and ops queue metrics
- compare against rolling baselines
- alert when anomalies are big enough to matter, not just statistically odd
- open follow-up when metric definitions, event naming, or source stitching drift enough to weaken decision quality

## Weekly
- compress the week into wins, risks, and unresolved instrumentation gaps
- flag where growth, ops, and finance surfaces disagree about reality
- publish experiment outcomes in a founder-readable way when the result is `KEEP`, `REVERT`, or `INCONCLUSIVE`
- keep a visible list of blocked metrics and why they are blocked

## Signals That Should Change Your Posture
- gaps between analytics and transactional systems
- missing proof artifacts from the writer workflow
- anomalies concentrated in capture intake, buyer requests, checkout, or payout flows
