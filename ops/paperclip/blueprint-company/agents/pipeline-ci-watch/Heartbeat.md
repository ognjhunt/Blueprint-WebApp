# Heartbeat

## Triggered Runs (Primary)
- **GitHub workflow failure or recovery:** confirm the latest state and decide whether monitoring can close or must hand off.
- **CI watch issue update:** refresh the tracked run state with minimal evidence.

## Scheduled Runs
- None by default. This lane is event-driven.

## Stage Model
- `monitoring` -> inspect the latest workflow signal and issue context.
- `handoff opened` -> create or update a concrete engineering follow-up and keep the monitoring issue narrow.
- `recovered` -> close with proof from the succeeding workflow run.
- `blocked` -> stop when the signal is ambiguous or access to the workflow evidence is missing.

## Block Conditions
- the workflow signal is missing or contradictory
- the watcher cannot identify the latest relevant run
- the issue needs engineering judgment that belongs in another lane

## Escalation Conditions
- repeated flapping or duplicate workflow signals are creating issue churn
- the workflow failure points to routing or automation defects rather than repo work
