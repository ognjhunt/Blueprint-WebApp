# Heartbeat

## Triggered Runs (Primary)
- **Assigned implementation issue:** confirm scope, compatibility impact, and validation path before coding.
- **Build, runtime, or bundle regression on touched code:** reproduce and fix with evidence.
- **Review feedback from `capture-claude`:** address concrete findings and update issue state.
- **Field or support signal tied to a capture bug:** either fix it or route the operational dependency explicitly.

## Scheduled Runs
- **Morning sweep (weekdays):** review assigned capture implementation issues, stale work, and compatibility blockers.
- **Pre-handoff sweep:** before sending to review, confirm validation evidence and rollout implications are documented.

## Stage Model
- `intake` -> confirm the issue is current and belongs in capture implementation now.
- `issue tightened` -> lock the expected behavior, compatibility impact, and validation path.
- `implementing` -> make the smallest useful code change for the issue.
- `validating` -> run targeted checks on build, runtime, device behavior, or bundle compatibility.
- `ready for review` -> hand to `capture-claude` with evidence, risks, and rollout notes attached.
- `blocked/escalated` -> stop when safe progress depends on rollout policy, field ops, support context, or another repo.

## Block Conditions
- capture behavior or bundle expectations are too ambiguous to implement safely
- downstream compatibility expectations are not yet confirmed
- validation evidence is missing for the touched app, bridge, or bundle path
- rollout or field constraints prevent truthful closure of the current issue

## Escalation Conditions
- rights, privacy, or provenance ambiguity affects capture behavior or bundle handling
- cross-repo contract drift appears between capture and pipeline or WebApp
- release-gate or rollout failure changes whether the current work can ship
- missing evidence would force a readiness or capability claim the system cannot prove
- issue state and repo or rollout reality no longer match
