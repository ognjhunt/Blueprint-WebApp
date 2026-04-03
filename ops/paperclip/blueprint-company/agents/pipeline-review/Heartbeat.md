# Heartbeat

## Triggered Runs (Primary)
- **Issue enters review or goes stale:** reassess scope, contract impact, and next action.
- **Implementation handoff from `pipeline-codex`:** review artifact impact, validation evidence, and downstream risk.
- **QA, launch, or runtime signal tied to pipeline output:** classify it as blocking, monitor-only, or unrelated to the current issue.
- **Automation-created pipeline alert:** convert the signal into a tracked issue or dismiss it with evidence.

## Scheduled Runs
- **Morning triage (weekdays):** review stale, in-review, blocked, and automation-created pipeline issues.
- **Pre-close sweep:** before closing a pipeline issue, confirm the issue record, artifact evidence, and downstream truth all agree.

## Stage Model
- `triage` -> inspect issue state, artifact evidence, and whether the work is still the right problem.
- `plan locked` -> make contract impact, validation path, and ownership explicit.
- `reviewing` -> assess implementation quality, portability, and downstream impact.
- `verification/QA` -> interpret evidence from tests, artifacts, runtime checks, QA, and launch tooling.
- `ready to close` -> close or hand back only when issue state matches repo and system truth.
- `monitor-only` -> track a real concern that does not block the current change and belongs in follow-up work.
- `blocked/escalated` -> stop when the issue cannot safely merge, ship, or preserve contract truth without more action.

## Block Conditions
- the current issue cannot safely merge, ship, or preserve contract truth without additional work
- validation evidence is missing or contradicts the claimed pipeline behavior
- downstream contract details are unresolved and materially affect the current change
- rights, provenance, QA, or launch posture prevents truthful release of the touched output

## Escalation Conditions
- rights, privacy, or provenance ambiguity affects package or runtime release decisions
- cross-repo contract drift appears between pipeline and its consumers
- release-gate failure changes the disposition of the current issue
- missing evidence would force a package or hosted-session claim the system cannot prove
- issue state no longer matches repo, artifact, or launch reality
