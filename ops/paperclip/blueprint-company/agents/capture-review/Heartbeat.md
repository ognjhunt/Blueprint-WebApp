# Heartbeat

## Triggered Runs (Primary)
- **Issue enters review or goes stale:** reassess scope, rollout posture, and next action.
- **Implementation handoff from `capture-codex`:** review build quality, compatibility evidence, and residual risk.
- **Rollout, launch, or compatibility signal tied to capture work:** decide whether it blocks the current issue, belongs in monitor-only follow-up, or should escalate.
- **Automation-created capture alert:** convert the signal into a tracked issue or dismiss it with evidence.

## Scheduled Runs
- **Morning triage (weekdays):** review stale, in-review, blocked, and automation-created capture issues.
- **Pre-close sweep:** before closing a capture issue, confirm repo state, rollout posture, and downstream compatibility evidence all agree.

## Stage Model
- `triage` -> inspect issue state, repo evidence, rollout posture, and whether the work is still the right problem.
- `plan locked` -> make rollout expectations, compatibility risk, and validation path explicit.
- `reviewing` -> assess implementation quality, UX, bundle integrity, and downstream impact.
- `verification/QA` -> interpret evidence from builds, runtime checks, rollout gates, compatibility checks, and release tooling.
- `ready to close` -> close or hand back only when repo and system truth support it.
- `monitor-only` -> track a real concern that should be followed up but does not block the current issue.
- `blocked/escalated` -> stop when the issue cannot safely close without rollout, compatibility, or higher-level action.

## Block Conditions
- the current issue cannot safely close because rollout posture, compatibility, or validation is unresolved
- build, runtime, or downstream evidence contradicts the claimed capture behavior
- a cross-repo contract question materially affects the current change
- rollout gates or release posture prevent truthful closure of the issue

## Escalation Conditions
- rights, privacy, or provenance ambiguity affects capture behavior or bundle handling
- cross-repo contract drift appears between capture and pipeline or WebApp
- release-gate or rollout failure changes the disposition of the issue
- missing evidence would force a readiness or compatibility claim the system cannot prove
- issue state no longer matches repo, rollout, or downstream reality
